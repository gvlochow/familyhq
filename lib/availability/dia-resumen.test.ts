import { describe, expect, it } from 'vitest'
import { estadoEnInstante, resumirDia, type TramoVista } from './dia-resumen'

// Chile en julio está en UTC-4: 00:00 local del 13 = 04:00Z; 24:00 = 04:00Z del 14.
function t(inicioUtc: string, finUtc: string, estado: string): TramoVista {
  return { inicioUtc, finUtc, estado }
}

describe('resumirDia (precedencia con piso)', () => {
  it('aterrizaje nocturno: fuera ~2h no alcanza el piso -> en_casa', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T05:45:00Z', 'fuera'), // 00:00-01:45 (~2h)
      t('2026-07-13T05:45:00Z', '2026-07-14T04:00:00Z', 'en_casa'), // ~22h
    ]
    expect(resumirDia(dia, '2026-07-13')).toBe('en_casa')
  })

  it('jornada 9-18 (fuera 9h) supera el piso -> fuera, aunque haya 15h en casa', () => {
    // El caso que la dominancia por duración pura resolvía mal (daba en_casa).
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T13:00:00Z', 'en_casa'), // 9h mañana
      t('2026-07-13T13:00:00Z', '2026-07-13T22:00:00Z', 'fuera'), // 9h jornada
      t('2026-07-13T22:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'), // 6h noche
    ]
    expect(resumirDia(dia, '2026-07-13')).toBe('fuera')
  })

  it('día de vuelo completo: fuera', () => {
    const dia = [t('2026-07-13T04:00:00Z', '2026-07-14T04:00:00Z', 'fuera')]
    expect(resumirDia(dia, '2026-07-13')).toBe('fuera')
  })

  it('standby de jornada (12h) supera el piso -> standby', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T16:00:00Z', 'en_casa'), // 12h
      t('2026-07-13T16:00:00Z', '2026-07-14T04:00:00Z', 'standby_casa'), // 12h
    ]
    expect(resumirDia(dia, '2026-07-13')).toBe('standby_casa')
  })

  it('un rato fuera marginal (2h de tarde) no define el día -> en_casa', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T22:00:00Z', 'en_casa'),
      t('2026-07-13T22:00:00Z', '2026-07-14T00:00:00Z', 'fuera'), // 2h < piso
      t('2026-07-14T00:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'),
    ]
    expect(resumirDia(dia, '2026-07-13')).toBe('en_casa')
  })

  it('datos parciales sub-piso: cae a dominante por duración', () => {
    // Solo 3h de datos ese día, ninguno supera el piso -> gana el de más duración.
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T06:00:00Z', 'fuera'), // 2h
      t('2026-07-13T06:00:00Z', '2026-07-13T07:00:00Z', 'en_casa'), // 1h
    ]
    expect(resumirDia(dia, '2026-07-13')).toBe('fuera')
  })

  it('solo cuenta el solape con el día (recorta tramos que cruzan el borde)', () => {
    // Tramo fuera enorme que cubre el 13 entero pero también días vecinos.
    const dia = [t('2026-07-10T04:00:00Z', '2026-07-20T04:00:00Z', 'fuera')]
    expect(resumirDia(dia, '2026-07-13')).toBe('fuera')
  })

  it('sin tramo que solape el día -> null', () => {
    const dia = [t('2026-07-20T04:00:00Z', '2026-07-21T04:00:00Z', 'fuera')]
    expect(resumirDia(dia, '2026-07-13')).toBeNull()
  })

  it('ignora estados desconocidos (no crashea, no los cuenta)', () => {
    const dia = [
      t('2026-07-13T04:00:00Z', '2026-07-13T22:00:00Z', 'raro'), // se descarta
      t('2026-07-13T22:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'), // único válido
    ]
    expect(resumirDia(dia, '2026-07-13')).toBe('en_casa')
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
