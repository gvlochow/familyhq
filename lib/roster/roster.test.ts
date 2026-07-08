/**
 * Tests de los casos borde del clasificador de rol.
 * Puerto de reference/test_roster_classifier.py: si estos se rompen, la app
 * miente sin que nadie lo note. Corren contra el .ics real de julio de Pablo.
 *
 * El fixture (reference/p.vonlochow.r@gmail.com.ics) está gitignored y solo
 * existe en local. El resultado DEBE ser idéntico a reference/salida_julio_2026.txt,
 * la verdad validada por el usuario real. Si un test difiere, el bug está en el
 * puerto, no en el test.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { beforeAll, expect, it } from 'vitest'
import { Estado, RosterEvent, estadoPorDia, loadRosterEvents } from './index'

const ICS = join(process.cwd(), 'reference', 'p.vonlochow.r@gmail.com.ics')

let events: RosterEvent[]

beforeAll(() => {
  events = loadRosterEvents(readFileSync(ICS, 'utf-8'))
})

// --- Filtrado de privacidad -------------------------------------------------

it('solo eventos de rol pasan el filtro', () => {
  // Ningún evento personal (sin firma iFlight) debe entrar.
  const personales = [
    'Cita',
    'Atención Médica',
    'Tenis',
    'Alojamiento',
    'Matrimonio',
    'Zoom',
    'Reunión',
    'Stay at',
    'Reservation',
  ]
  for (const e of events) {
    for (const p of personales) {
      expect(e.summary, `Evento personal se filtró mal: ${e.summary}`).not.toContain(p)
    }
  }
})

it('cantidad esperada de eventos de rol', () => {
  // En julio + arrastre, el .ics tiene 217 eventos con firma iFlight.
  expect(events.length).toBe(217)
})

// --- Caso Blank / POR_CONFIRMAR ---------------------------------------------

it('blank es por_confirmar, no en_casa', () => {
  // El 3-jul es Blank. NO debe ser 'en_casa' (sería un falso disponible).
  expect(estadoPorDia(events, { year: 2026, month: 7, day: 3 })).toBe(Estado.POR_CONFIRMAR)
})

it('segundo blank también por_confirmar', () => {
  // El 29-jul es el otro Blank del mes.
  expect(estadoPorDia(events, { year: 2026, month: 7, day: 29 })).toBe(Estado.POR_CONFIRMAR)
})

// --- Caso rotación multi-día (Brasilia) -------------------------------------

it('rotación Brasilia cubre días intermedios', () => {
  // Sale 9-jul noche, vuelve 11-jul: FUERA los tres días, incluido el 10 que no
  // tiene evento propio de inicio.
  expect(estadoPorDia(events, { year: 2026, month: 7, day: 9 })).toBe(Estado.FUERA)
  expect(estadoPorDia(events, { year: 2026, month: 7, day: 10 })).toBe(Estado.FUERA)
  expect(estadoPorDia(events, { year: 2026, month: 7, day: 11 })).toBe(Estado.FUERA)
})

it('día después de Brasilia vuelve a casa', () => {
  // El 13-jul (tras descanso post-rotación) debe ser en_casa.
  expect(estadoPorDia(events, { year: 2026, month: 7, day: 13 })).toBe(Estado.EN_CASA)
})

// --- Caso HSB vs ASB (el que más engaña) ------------------------------------

it('HSB es standby en casa', () => {
  // 15-jul y 17-jul son HSB1 (home standby): en casa pero llamable.
  expect(estadoPorDia(events, { year: 2026, month: 7, day: 15 })).toBe(Estado.STANDBY_CASA)
  expect(estadoPorDia(events, { year: 2026, month: 7, day: 17 })).toBe(Estado.STANDBY_CASA)
})

it('ASB es fuera', () => {
  // 16-jul es ASB3 (airport standby): está EN EL AEROPUERTO -> fuera.
  expect(estadoPorDia(events, { year: 2026, month: 7, day: 16 })).toBe(Estado.FUERA)
})

// --- Timezone (el error silencioso de 3-4h) ---------------------------------

it('report de la ida a Brasilia cae el día local correcto', () => {
  // El vuelo de ida (03:55 UTC del 10-jul) convertido a hora de Santiago debe
  // caer el 9-jul de noche, no el 10 de madrugada. Si falla, todo el rol está corrido.
  const brasilia = events.filter(
    (e) => e.summary.includes('790') && e.startUtc.day === 10 && e.startUtc.month === 7,
  )
  expect(brasilia.length, 'No se encontró el vuelo de ida a Brasilia').toBeGreaterThan(0)
  expect(brasilia[0].startLocal.day, 'El report debería caer el 9-jul local').toBe(9)
})

// --- Días libres normales ---------------------------------------------------

it('días off son en_casa', () => {
  // Bloque de DO del 4 al 7-jul: todos en_casa.
  for (let d = 4; d <= 7; d++) {
    expect(estadoPorDia(events, { year: 2026, month: 7, day: d })).toBe(Estado.EN_CASA)
  }
})

it('bloque off fin de mes', () => {
  // 22 al 27-jul es un bloque largo de DO (6 días en casa).
  for (let d = 22; d <= 27; d++) {
    expect(estadoPorDia(events, { year: 2026, month: 7, day: d })).toBe(Estado.EN_CASA)
  }
})
