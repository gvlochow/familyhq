/**
 * Tests de la derivación del horario fijo a tramos (lib/availability/fijo-segmentos).
 *
 * Chile en julio está en UTC-4: 00:00 local = 04:00Z, 09:00 local = 13:00Z, etc.
 * 2026-07-06 es lunes (weekday 1); 2026-07-11 sábado; 2026-07-12 domingo.
 */
import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { Estado } from '../roster'
import { construirSegmentosFijo, type FilaHorarioFijo } from './fijo-segmentos'

function ms(iso: string): number {
  return DateTime.fromISO(iso, { zone: 'utc' }).toMillis()
}

/** Fila de trabajo con horas; el resto de campos por defecto (sin almuerzo). */
function trabaja(
  diaSemana: number,
  horaInicio: string,
  horaFin: string,
  almuerzo?: [string, string],
): FilaHorarioFijo {
  return {
    diaSemana,
    horaInicio,
    horaFin,
    almuerzaEnCasa: !!almuerzo,
    horaAlmuerzoInicio: almuerzo?.[0] ?? null,
    horaAlmuerzoFin: almuerzo?.[1] ?? null,
  }
}

describe('construirSegmentosFijo', () => {
  it('jornada 09-18 sin almuerzo: en_casa / fuera / en_casa', () => {
    const segs = construirSegmentosFijo([trabaja(1, '09:00', '18:00')], '2026-07-06', '2026-07-06')

    expect(segs.map((s) => s.estado)).toEqual([Estado.EN_CASA, Estado.FUERA, Estado.EN_CASA])
    expect(segs[0].inicioUtc.toMillis()).toBe(ms('2026-07-06T04:00:00Z')) // 00:00 local
    expect(segs[1].inicioUtc.toMillis()).toBe(ms('2026-07-06T13:00:00Z')) // 09:00 local
    expect(segs[1].finUtc.toMillis()).toBe(ms('2026-07-06T22:00:00Z')) // 18:00 local
    expect(segs[2].finUtc.toMillis()).toBe(ms('2026-07-07T04:00:00Z')) // 24:00 local
  })

  it('almuerzo en casa recorta EN_CASA dentro de la jornada', () => {
    const segs = construirSegmentosFijo(
      [trabaja(1, '09:00', '18:00', ['13:00', '14:00'])],
      '2026-07-06',
      '2026-07-06',
    )

    expect(segs.map((s) => s.estado)).toEqual([
      Estado.EN_CASA, // 00-09
      Estado.FUERA, // 09-13
      Estado.EN_CASA, // 13-14 almuerzo
      Estado.FUERA, // 14-18
      Estado.EN_CASA, // 18-24
    ])
    expect(segs[2].inicioUtc.toMillis()).toBe(ms('2026-07-06T17:00:00Z')) // 13:00 local
    expect(segs[2].finUtc.toMillis()).toBe(ms('2026-07-06T18:00:00Z')) // 14:00 local
  })

  it('día libre (sin fila): un solo tramo EN_CASA', () => {
    // Sábado sin fila -> libre. Ventana de un solo día.
    const segs = construirSegmentosFijo([], '2026-07-11', '2026-07-11')
    expect(segs).toHaveLength(1)
    expect(segs[0].estado).toBe(Estado.EN_CASA)
    expect(segs[0].inicioUtc.toMillis()).toBe(ms('2026-07-11T04:00:00Z'))
    expect(segs[0].finUtc.toMillis()).toBe(ms('2026-07-12T04:00:00Z'))
  })

  it('fusiona la tarde en casa con el día libre siguiente', () => {
    // Viernes 09-18 de trabajo + sábado libre: la tarde del viernes y el sábado
    // entero son un único tramo EN_CASA continuo.
    const segs = construirSegmentosFijo(
      [trabaja(5, '09:00', '18:00')],
      '2026-07-10', // viernes
      '2026-07-11', // sábado
    )
    expect(segs.map((s) => s.estado)).toEqual([Estado.EN_CASA, Estado.FUERA, Estado.EN_CASA])
    // El último EN_CASA arranca al salir del trabajo el viernes (18:00 local)...
    expect(segs[2].inicioUtc.toMillis()).toBe(ms('2026-07-10T22:00:00Z'))
    // ...y se extiende hasta el final del sábado.
    expect(segs[2].finUtc.toMillis()).toBe(ms('2026-07-12T04:00:00Z'))
  })

  it('los tramos son contiguos, no se solapan y cubren toda la ventana', () => {
    const filas = [
      trabaja(1, '09:00', '18:00', ['13:00', '14:00']),
      trabaja(2, '08:00', '17:00'),
      trabaja(3, '10:00', '14:00'),
    ]
    const segs = construirSegmentosFijo(filas, '2026-07-06', '2026-07-12') // lun a dom

    expect(segs[0].inicioUtc.toMillis()).toBe(ms('2026-07-06T04:00:00Z'))
    expect(segs[segs.length - 1].finUtc.toMillis()).toBe(ms('2026-07-13T04:00:00Z'))
    for (let i = 1; i < segs.length; i++) {
      expect(segs[i].inicioUtc.toMillis()).toBe(segs[i - 1].finUtc.toMillis())
      expect(segs[i].estado).not.toBe(segs[i - 1].estado) // fusionados
    }
  })
})
