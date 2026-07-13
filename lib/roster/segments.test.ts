/**
 * Tests del modelo de tramos intra-día (lib/roster/segments). Eventos sintéticos,
 * sin depender del fixture real gitignored (el golden real vive en golden.test.ts).
 *
 * Cubren la riqueza intra-día que el modelo por-día perdía (standby parcial,
 * aterrizaje nocturno), la precedencia por instante, y la EQUIVALENCIA con
 * estadoPorDia: derivar el día desde los tramos no puede cambiar la verdad.
 *
 * Chile en julio está en UTC-4: medianoche local del día D = 04:00Z de ese día D.
 */
import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { Estado, RosterEvent, estadoPorDia } from './index'
import { construirSegmentos, estadoDelDiaDesdeSegmentos } from './segments'

function ev(
  uid: string,
  summary: string,
  kind: 'activity' | 'flight' | 'report' | 'window' | 'other',
  code: string,
  startISO: string,
  endISO: string,
): RosterEvent {
  return new RosterEvent(
    uid,
    summary,
    '',
    DateTime.fromISO(startISO, { zone: 'utc' }),
    DateTime.fromISO(endISO, { zone: 'utc' }),
    kind,
    code,
  )
}

/** Instante UTC como epoch-ms, para comparar bordes de tramos. */
function ms(iso: string): number {
  return DateTime.fromISO(iso, { zone: 'utc' }).toMillis()
}

describe('construirSegmentos', () => {
  it('sin eventos: un único tramo EN_CASA que cubre toda la ventana', () => {
    const segs = construirSegmentos([], '2026-07-15', '2026-07-15')
    expect(segs).toHaveLength(1)
    expect(segs[0].estado).toBe(Estado.EN_CASA)
    expect(segs[0].inicioUtc.toMillis()).toBe(ms('2026-07-15T04:00:00Z')) // 00:00 local
    expect(segs[0].finUtc.toMillis()).toBe(ms('2026-07-16T04:00:00Z')) // 24:00 local
  })

  it('HSB parcial parte el día: en_casa / standby / en_casa', () => {
    // Home standby de 08:00 a 16:00 local (12:00Z-20:00Z). El resto del día NO es
    // standby: es en casa. Eso es justo lo que el modelo por-día no podía expresar.
    const hsb = ev('h', 'Activity : HSB1 at SCL', 'activity', 'HSB1', '2026-07-15T12:00:00Z', '2026-07-15T20:00:00Z')
    const segs = construirSegmentos([hsb], '2026-07-15', '2026-07-15')

    expect(segs.map((s) => s.estado)).toEqual([
      Estado.EN_CASA,
      Estado.STANDBY_CASA,
      Estado.EN_CASA,
    ])
    expect(segs[1].inicioUtc.toMillis()).toBe(ms('2026-07-15T12:00:00Z'))
    expect(segs[1].finUtc.toMillis()).toBe(ms('2026-07-15T20:00:00Z'))
  })

  it('aterrizaje nocturno: FUERA hasta aterrizaje+buffer, luego EN_CASA el resto del día', () => {
    // Vuelo que aterriza 05:00Z del 21 (01:00 local). Con buffer de llegada de 45min
    // el crew queda FUERA hasta 05:45Z (01:45 local) y EN_CASA las otras ~22 horas.
    const vuelo = ev('f', 'Flight : LA800', 'flight', '', '2026-07-20T18:00:00Z', '2026-07-21T05:00:00Z')
    const segs = construirSegmentos([vuelo], '2026-07-20', '2026-07-21', 45)

    const finFuera = segs.find((s) => s.estado === Estado.FUERA)!.finUtc.toMillis()
    expect(finFuera).toBe(ms('2026-07-21T05:45:00Z')) // aterrizaje + 45min

    const ultimo = segs[segs.length - 1]
    expect(ultimo.estado).toBe(Estado.EN_CASA)
    expect(ultimo.inicioUtc.toMillis()).toBe(finFuera) // en casa desde 01:45 local del 21

    // Pero la DERIVACIÓN por-día sigue diciendo FUERA el 21 (el bloque toca el día):
    // la verdad por-día no cambia; solo ganamos el detalle intra-día.
    expect(estadoDelDiaDesdeSegmentos(segs, { year: 2026, month: 7, day: 21 })).toBe(Estado.FUERA)
  })

  it('precedencia por instante: ASB gana sobre HSB en el solape', () => {
    const hsb = ev('h', 'Activity : HSB1 at SCL', 'activity', 'HSB1', '2026-07-15T12:00:00Z', '2026-07-15T20:00:00Z')
    const asb = ev('a', 'Activity : ASB3 at SCL', 'activity', 'ASB3', '2026-07-15T15:00:00Z', '2026-07-15T18:00:00Z')
    const segs = construirSegmentos([hsb, asb], '2026-07-15', '2026-07-15')

    const fuera = segs.find((s) => s.estado === Estado.FUERA)!
    expect(fuera.inicioUtc.toMillis()).toBe(ms('2026-07-15T15:00:00Z'))
    expect(fuera.finUtc.toMillis()).toBe(ms('2026-07-15T18:00:00Z'))
    expect(segs.map((s) => s.estado)).toEqual([
      Estado.EN_CASA,
      Estado.STANDBY_CASA,
      Estado.FUERA,
      Estado.STANDBY_CASA,
      Estado.EN_CASA,
    ])
  })

  it('los tramos son contiguos, no se solapan y cubren toda la ventana', () => {
    const hsb = ev('h', 'Activity : HSB1 at SCL', 'activity', 'HSB1', '2026-07-15T12:00:00Z', '2026-07-15T20:00:00Z')
    const vuelo = ev('f', 'Flight : LA800', 'flight', '', '2026-07-16T13:00:00Z', '2026-07-16T22:00:00Z')
    const segs = construirSegmentos([hsb, vuelo], '2026-07-15', '2026-07-17')

    expect(segs[0].inicioUtc.toMillis()).toBe(ms('2026-07-15T04:00:00Z'))
    expect(segs[segs.length - 1].finUtc.toMillis()).toBe(ms('2026-07-18T04:00:00Z'))
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].inicioUtc.toMillis()).toBe(segs[i - 1].finUtc.toMillis()) // contiguo
      expect(segs[i].estado).not.toBe(segs[i - 1].estado) // fusionados: nunca dos iguales seguidos
    }
  })
})

describe('estadoDelDiaDesdeSegmentos ≡ estadoPorDia', () => {
  it('coincide día por día sobre un rol sintético con bloque, standby y libre', () => {
    // Rotación multi-día (sale el 10, vuelve el 12), HSB el 15, y días libres.
    const events = [
      ev('r1', 'Report Time', 'report', '', '2026-07-10T20:00:00Z', '2026-07-11T02:00:00Z'),
      ev('f1', 'Flight : ida', 'flight', '', '2026-07-11T14:00:00Z', '2026-07-11T18:00:00Z'),
      ev('f2', 'Flight : vuelta', 'flight', '', '2026-07-12T12:00:00Z', '2026-07-12T16:00:00Z'),
      ev('hsb', 'Activity : HSB1 at SCL', 'activity', 'HSB1', '2026-07-15T12:00:00Z', '2026-07-15T20:00:00Z'),
      ev('b', 'Activity : B at SCL', 'activity', 'B', '2026-07-17T07:00:00Z', '2026-07-17T21:00:00Z'),
      ev('do', 'Activity : DO at SCL', 'activity', 'DO', '2026-07-18T04:00:00Z', '2026-07-19T03:59:00Z'),
    ]
    const segs = construirSegmentos(events, '2026-07-09', '2026-07-20')

    for (let day = 9; day <= 20; day++) {
      const dia = { year: 2026, month: 7, day }
      expect(estadoDelDiaDesdeSegmentos(segs, dia), `día ${day}`).toBe(estadoPorDia(events, dia))
    }
  })
})
