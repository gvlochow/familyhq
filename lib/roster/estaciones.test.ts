import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'

import { estacionDestino, estacionesPorDia } from './estaciones'
import { RosterEvent, type RosterKind } from './types'

function ev(
  summary: string,
  startUtc: string,
  endUtc: string,
  kind: RosterKind = 'flight',
): RosterEvent {
  return new RosterEvent(
    'uid',
    summary,
    '',
    DateTime.fromISO(startUtc, { zone: 'utc' }),
    DateTime.fromISO(endUtc, { zone: 'utc' }),
    kind,
    '',
  )
}

describe('estacionDestino', () => {
  it('extrae el destino de un vuelo', () => {
    expect(estacionDestino(ev('Flight : LA 218 CCP - ANF', '2026-07-10T20:00:00Z', '2026-07-10T22:00:00Z'))).toBe('ANF')
    expect(estacionDestino(ev('Flight : LA 163 IQQ - SCL', '2026-07-11T01:00:00Z', '2026-07-11T03:00:00Z'))).toBe('SCL')
  })
  it('null para eventos que no son vuelo', () => {
    expect(estacionDestino(ev('Activity : DO at SCL', '2026-07-10T04:00:00Z', '2026-07-11T04:00:00Z', 'activity'))).toBeNull()
  })
})

describe('estacionesPorDia', () => {
  it('toma el destino del último vuelo que aterriza ese día', () => {
    const events = [
      ev('Flight : LA 516 SCL - FLN', '2026-07-10T12:00:00Z', '2026-07-10T15:00:00Z'), // llega FLN 11:00 local
      ev('Flight : LA 515 FLN - SCL', '2026-07-10T20:00:00Z', '2026-07-10T23:00:00Z'), // llega SCL 19:00 local (más tarde)
    ]
    const r = estacionesPorDia(events, '2026-07-01', '2026-07-31')
    expect(r.get('2026-07-10')).toBe('SCL')
  })

  it('asigna cada vuelo al día LOCAL de su llegada', () => {
    // Aterriza 2026-07-11T02:00Z = 22:00 local del 10.
    const r = estacionesPorDia(
      [ev('Flight : LA 790 SCL - BSB', '2026-07-10T22:00:00Z', '2026-07-11T02:00:00Z')],
      '2026-07-01', '2026-07-31',
    )
    expect(r.get('2026-07-10')).toBe('BSB')
    expect(r.get('2026-07-11')).toBeUndefined()
  })

  it('ignora los días fuera de la ventana', () => {
    const r = estacionesPorDia(
      [ev('Flight : LA 218 CCP - ANF', '2026-06-30T20:00:00Z', '2026-06-30T22:00:00Z')],
      '2026-07-01', '2026-07-31',
    )
    expect(r.size).toBe(0)
  })
})
