import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'
import {
  esEstadoOverride,
  esPresetFin,
  intervaloDesde,
} from './estado-override'

const TZ = 'America/Santiago'

describe('esEstadoOverride', () => {
  it('acepta los estados afirmables y rechaza el resto', () => {
    expect(esEstadoOverride('en_casa')).toBe(true)
    expect(esEstadoOverride('fuera')).toBe(true)
    expect(esEstadoOverride('standby_casa')).toBe(true)
    // por_confirmar NO es afirmable a mano.
    expect(esEstadoOverride('por_confirmar')).toBe(false)
    expect(esEstadoOverride('inventado')).toBe(false)
  })
})

describe('esPresetFin', () => {
  it('valida el set de presets', () => {
    expect(esPresetFin('1h')).toBe(true)
    expect(esPresetFin('todoElDia')).toBe(true)
    expect(esPresetFin('otro')).toBe(false)
  })
})

describe('intervaloDesde', () => {
  // 14:00 local Chile (julio, UTC-4) = 18:00Z.
  const now = DateTime.fromISO('2026-07-14T14:00:00', { zone: TZ }).toUTC().toISO()!

  it('1h: inicio = ahora, fin = +1 hora', () => {
    const { inicioUtc, finUtc } = intervaloDesde('1h', now)
    expect(inicioUtc).toBe('2026-07-14T18:00:00.000Z')
    expect(finUtc).toBe('2026-07-14T19:00:00.000Z')
  })

  it('3h: fin = +3 horas', () => {
    expect(intervaloDesde('3h', now).finUtc).toBe('2026-07-14T21:00:00.000Z')
  })

  it('restoDia: inicio = ahora, fin = próxima medianoche local', () => {
    const { inicioUtc, finUtc } = intervaloDesde('restoDia', now)
    expect(inicioUtc).toBe('2026-07-14T18:00:00.000Z')
    // Medianoche local del 15-jul = 04:00Z del 15.
    expect(finUtc).toBe('2026-07-15T04:00:00.000Z')
  })

  it('todoElDia: adelanta el inicio al comienzo del día local', () => {
    const { inicioUtc, finUtc } = intervaloDesde('todoElDia', now)
    // 00:00 local del 14 = 04:00Z del 14; fin = 04:00Z del 15.
    expect(inicioUtc).toBe('2026-07-14T04:00:00.000Z')
    expect(finUtc).toBe('2026-07-15T04:00:00.000Z')
  })

  it('todos los presets cumplen fin > inicio, incluso tarde en la noche', () => {
    const tarde = DateTime.fromISO('2026-07-14T23:45:00', { zone: TZ }).toUTC().toISO()!
    for (const p of ['1h', '3h', 'restoDia', 'todoElDia'] as const) {
      const { inicioUtc, finUtc } = intervaloDesde(p, tarde)
      expect(DateTime.fromISO(finUtc) > DateTime.fromISO(inicioUtc)).toBe(true)
    }
  })
})
