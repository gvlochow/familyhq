import { describe, expect, it } from 'vitest'
import { estadoEnInstante, resumirDia, type TramoVista } from './dia-resumen'

// Chile en julio está en UTC-4: 00:00 local del 13 = 04:00Z; 24:00 = 04:00Z del 14.
function t(inicioUtc: string, finUtc: string, estado: string): TramoVista {
  return { inicioUtc, finUtc, estado }
}

describe('resumirDia (casa / parcial / fuera)', () => {
  it('vuelo nocturno que llega 05:45: fuera PARCIAL (en casa 18h)', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T09:45:00Z', 'fuera'), // 00:00-05:45 (5.75h)
      t('2026-07-13T09:45:00Z', '2026-07-14T04:00:00Z', 'en_casa'), // resto del día
    ]
    expect(resumirDia(dia, '2026-07-13')).toEqual({ estado: 'fuera', parcial: true })
  })

  it('vuelo nocturno que sale de noche: fuera PARCIAL (2h)', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-14T02:00:00Z', 'en_casa'), // 00:00-22:00
      t('2026-07-14T02:00:00Z', '2026-07-14T04:00:00Z', 'fuera'), // 22:00-24:00 (2h)
    ]
    expect(resumirDia(dia, '2026-07-13')).toEqual({ estado: 'fuera', parcial: true })
  })

  it('jornada 9-18 (fuera 9h ≥ 8h): fuera SÓLIDO', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T13:00:00Z', 'en_casa'),
      t('2026-07-13T13:00:00Z', '2026-07-13T22:00:00Z', 'fuera'), // 9h jornada
      t('2026-07-13T22:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'),
    ]
    expect(resumirDia(dia, '2026-07-13')).toEqual({ estado: 'fuera', parcial: false })
  })

  it('fuera exactamente 8h: sólido (borde de jornada completa)', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T14:00:00Z', 'en_casa'), // 10h
      t('2026-07-13T14:00:00Z', '2026-07-13T22:00:00Z', 'fuera'), // 8h exactas
      t('2026-07-13T22:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'), // 6h
    ]
    expect(resumirDia(dia, '2026-07-13')).toEqual({ estado: 'fuera', parcial: false })
  })

  it('día de vuelo completo: fuera sólido', () => {
    const dia = [t('2026-07-13T04:00:00Z', '2026-07-14T04:00:00Z', 'fuera')]
    expect(resumirDia(dia, '2026-07-13')).toEqual({ estado: 'fuera', parcial: false })
  })

  it('fuera de 45 min (borde del ruido): parcial, NO en casa', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T13:00:00Z', 'en_casa'),
      t('2026-07-13T13:00:00Z', '2026-07-13T13:45:00Z', 'fuera'), // 45 min exactos
      t('2026-07-13T13:45:00Z', '2026-07-14T04:00:00Z', 'en_casa'),
    ]
    expect(resumirDia(dia, '2026-07-13')).toEqual({ estado: 'fuera', parcial: true })
  })

  it('blip de 30 min fuera (bajo el ruido): en casa', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T13:00:00Z', 'en_casa'),
      t('2026-07-13T13:00:00Z', '2026-07-13T13:30:00Z', 'fuera'), // 30 min < 45
      t('2026-07-13T13:30:00Z', '2026-07-14T04:00:00Z', 'en_casa'),
    ]
    expect(resumirDia(dia, '2026-07-13')).toEqual({ estado: 'en_casa', parcial: false })
  })

  it('standby de jornada (12h) supera el piso: standby', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T16:00:00Z', 'en_casa'), // 12h
      t('2026-07-13T16:00:00Z', '2026-07-14T04:00:00Z', 'standby_casa'), // 12h
    ]
    expect(resumirDia(dia, '2026-07-13')).toEqual({ estado: 'standby_casa', parcial: false })
  })

  it('datos parciales con fuera notable (2h) y casa (1h): fuera parcial', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T06:00:00Z', 'fuera'), // 2h
      t('2026-07-13T06:00:00Z', '2026-07-13T07:00:00Z', 'en_casa'), // 1h
    ]
    expect(resumirDia(dia, '2026-07-13')).toEqual({ estado: 'fuera', parcial: true })
  })

  it('solo cuenta el solape con el día (recorta tramos que cruzan el borde)', () => {
    const dia = [t('2026-07-10T04:00:00Z', '2026-07-20T04:00:00Z', 'fuera')]
    expect(resumirDia(dia, '2026-07-13')).toEqual({ estado: 'fuera', parcial: false })
  })

  it('sin tramo que solape el día: null', () => {
    const dia = [t('2026-07-20T04:00:00Z', '2026-07-21T04:00:00Z', 'fuera')]
    expect(resumirDia(dia, '2026-07-13')).toBeNull()
  })

  it('ignora estados desconocidos (no crashea, no los cuenta)', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T22:00:00Z', 'raro'), // se descarta
      t('2026-07-13T22:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'), // único válido
    ]
    expect(resumirDia(dia, '2026-07-13')).toEqual({ estado: 'en_casa', parcial: false })
  })
})

describe('estadoEnInstante', () => {
  const tramos = [
    t('2026-07-13T13:00:00Z', '2026-07-13T22:00:00Z', 'fuera'),
    t('2026-07-13T22:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'),
  ]

  it('devuelve el estado y el fin del tramo que cubre el instante', () => {
    const r = estadoEnInstante(tramos, '2026-07-13T18:00:00Z')
    expect(r).toEqual({ estado: 'fuera', finUtc: '2026-07-13T22:00:00Z' })
  })

  it('el inicio es inclusivo y el fin exclusivo', () => {
    expect(estadoEnInstante(tramos, '2026-07-13T13:00:00Z')?.estado).toBe('fuera')
    // Justo en el borde 22:00Z ya es el tramo siguiente.
    expect(estadoEnInstante(tramos, '2026-07-13T22:00:00Z')?.estado).toBe('en_casa')
  })

  it('sin tramo que cubra el instante -> null', () => {
    expect(estadoEnInstante(tramos, '2026-07-13T10:00:00Z')).toBeNull()
  })
})
