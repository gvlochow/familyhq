import { describe, expect, it } from 'vitest'
import { DateTime } from 'luxon'

import { tramosEventosPorMiembro, type EventoDisponibilidad } from './eventos'
import { TZ_LOCAL } from '../roster/types'

// Día local completo del 21 de julio 2026 (Santiago = UTC-4 en julio): 00:00 local
// del 21 = 04:00Z; 00:00 local del 22 = 04:00Z del 22.
const WIN_INI = '2026-07-21T04:00:00Z'
const WIN_FIN = '2026-07-22T04:00:00Z'

/** Hora local "HH:MM" de un instante UTC ISO (para aserciones robustas al offset). */
function horaLocal(iso: string): string {
  return DateTime.fromISO(iso).setZone(TZ_LOCAL).toFormat('HH:mm')
}

describe('tramosEventosPorMiembro', () => {
  it("marca 'fuera' a cada asignado en la ventana local del evento", () => {
    const eventos: EventoDisponibilidad[] = [
      { fecha: '2026-07-21', hora: '18:00', horaFin: '20:00', asignados: ['a', 'b'] },
    ]
    const r = tramosEventosPorMiembro(eventos, WIN_INI, WIN_FIN)

    for (const id of ['a', 'b']) {
      const tramos = r.get(id)!
      expect(tramos).toHaveLength(1)
      expect(tramos[0].estado).toBe('fuera')
      expect(horaLocal(tramos[0].inicioUtc)).toBe('18:00')
      expect(horaLocal(tramos[0].finUtc)).toBe('20:00')
    }
  })

  it('no emite nada para eventos sin asignados o sin rango válido', () => {
    const eventos: EventoDisponibilidad[] = [
      { fecha: '2026-07-21', hora: '18:00', horaFin: '20:00', asignados: [] },
      { fecha: '2026-07-21', hora: '20:00', horaFin: '18:00', asignados: ['a'] }, // fin <= inicio
    ]
    const r = tramosEventosPorMiembro(eventos, WIN_INI, WIN_FIN)
    expect(r.size).toBe(0)
  })

  it('recorta a la ventana', () => {
    const eventos: EventoDisponibilidad[] = [
      // Evento del día anterior que no toca la ventana -> se descarta.
      { fecha: '2026-07-20', hora: '10:00', horaFin: '11:00', asignados: ['a'] },
    ]
    const r = tramosEventosPorMiembro(eventos, WIN_INI, WIN_FIN)
    expect(r.get('a')).toBeUndefined()
  })

  it('fusiona los solapes del mismo integrante en un solo tramo', () => {
    const eventos: EventoDisponibilidad[] = [
      { fecha: '2026-07-21', hora: '18:00', horaFin: '20:00', asignados: ['a'] },
      { fecha: '2026-07-21', hora: '19:00', horaFin: '21:00', asignados: ['a'] },
    ]
    const r = tramosEventosPorMiembro(eventos, WIN_INI, WIN_FIN)
    const tramos = r.get('a')!
    expect(tramos).toHaveLength(1)
    expect(horaLocal(tramos[0].inicioUtc)).toBe('18:00')
    expect(horaLocal(tramos[0].finUtc)).toBe('21:00')
  })
})
