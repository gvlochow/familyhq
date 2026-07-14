import { describe, expect, it } from 'vitest'
import { detalleDelDia, fraseFuera, type MiembroDetalle } from './dia-detalle'
import type { MiembroCalendario } from './mes-familia'
import type { TramoVista } from './dia-resumen'

function t(inicioUtc: string, finUtc: string, estado: string): TramoVista {
  return { inicioUtc, finUtc, estado }
}

// UTC-4: 00:00 local del 13 = 04:00Z, 09:00 = 13:00Z, 18:00 = 22:00Z, 24:00 = 04:00Z del 14.
const pablo: MiembroCalendario = {
  id: 'p',
  nombre: 'Pablo',
  inicial: 'P',
  tramos: [
    t('2026-07-13T04:00:00Z', '2026-07-13T13:00:00Z', 'en_casa'),
    t('2026-07-13T13:00:00Z', '2026-07-13T22:00:00Z', 'fuera'),
    t('2026-07-13T22:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'),
  ],
}
const ana: MiembroCalendario = {
  id: 'a',
  nombre: 'Ana',
  inicial: 'A',
  tramos: [t('2026-07-13T04:00:00Z', '2026-07-14T04:00:00Z', 'en_casa')],
}

describe('detalleDelDia', () => {
  it('recorta los tramos al día con horas locales', () => {
    const [primero] = detalleDelDia([pablo, ana], '2026-07-13')
    // Pablo va primero (fuera = excepción).
    expect(primero.id).toBe('p')
    expect(primero.segmentos).toHaveLength(3)
    expect(primero.segmentos[1]).toMatchObject({
      estado: 'fuera',
      inicioHHMM: '09:00',
      finHHMM: '18:00',
    })
    expect(primero.segmentos[0].inicioHHMM).toBe('00:00')
    expect(primero.segmentos[2].finHHMM).toBe('24:00')
  })

  it('las fracciones cubren el día de 0 a 1', () => {
    const [p] = detalleDelDia([pablo], '2026-07-13')
    expect(p.segmentos[0].inicioFrac).toBeCloseTo(0)
    expect(p.segmentos[p.segmentos.length - 1].finFrac).toBeCloseTo(1)
    expect(p.segmentos[1].inicioFrac).toBeCloseTo(9 / 24)
    expect(p.segmentos[1].finFrac).toBeCloseTo(18 / 24)
  })

  it('sin datos ese día -> un tramo null "sin información"', () => {
    const detalle = detalleDelDia([ana], '2026-07-20')
    expect(detalle[0].segmentos).toHaveLength(1)
    expect(detalle[0].segmentos[0].estado).toBeNull()
  })

  it('ordena por excepción (fuera antes que en casa)', () => {
    const ids = detalleDelDia([ana, pablo], '2026-07-13').map((m) => m.id)
    expect(ids).toEqual(['p', 'a'])
  })
})

describe('fraseFuera', () => {
  const de = (m: MiembroDetalle) => fraseFuera(m.segmentos)

  it('resume los tramos fuera de casa con horas', () => {
    const [p] = detalleDelDia([pablo], '2026-07-13')
    expect(de(p)).toBe('Fuera 09:00–18:00')
  })

  it('todo en casa', () => {
    const [a] = detalleDelDia([ana], '2026-07-13')
    expect(de(a)).toBe('En casa todo el día')
  })

  it('sin información', () => {
    const [a] = detalleDelDia([ana], '2026-07-20')
    expect(de(a)).toBe('Sin información')
  })
})
