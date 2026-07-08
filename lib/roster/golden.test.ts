/**
 * Test golden: el mes completo, día por día, contra reference/salida_julio_2026.txt.
 *
 * Complementa a roster.test.ts. Aquellos 11 tests documentan POR QUÉ importa cada
 * caso borde (Blank, HSB vs ASB, rotación multi-día, timezone); este cubre los 31
 * días de una y es la red contra regresiones.
 *
 * ┌─ IMPORTANTE ────────────────────────────────────────────────────────────────┐
 * │ reference/salida_julio_2026.txt NO es un snapshot cualquiera: es la salida    │
 * │ VALIDADA por Pablo (el crew real dueño del rol) día por día. Es la fuente de  │
 * │ verdad del comportamiento esperado.                                          │
 * │                                                                              │
 * │ Si este test falla, significa que la clasificación cambió de resultado. Eso  │
 * │ es un cambio real de comportamiento que hay que revisar CONTRA PABLO, no un  │
 * │ test que ajustar para que pase. NO edites salida_julio_2026.txt para         │
 * │ silenciar el test: primero confirmá con el usuario real que la nueva salida  │
 * │ es correcta, y recién ahí actualizá el golden.                              │
 * └──────────────────────────────────────────────────────────────────────────────┘
 *
 * El fixture (reference/p.vonlochow.r@gmail.com.ics) está gitignored y solo existe
 * en local, igual que el golden.
 */
import { readFileSync } from 'node:fs'
import { join } from 'node:path'
import { expect, it } from 'vitest'
import { estadosDelMes, loadRosterEvents } from './index'

const REFERENCE = join(process.cwd(), 'reference')
const ICS = join(REFERENCE, 'p.vonlochow.r@gmail.com.ics')
const GOLDEN = join(REFERENCE, 'salida_julio_2026.txt')

const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']

it('julio 2026 completo es idéntico a la salida validada por Pablo', () => {
  const events = loadRosterEvents(readFileSync(ICS, 'utf-8'))

  // Reproducimos el formato exacto del golden (ver __main__ de roster_classifier.py):
  //   "Eventos de rol (filtrados): N" + una línea "  yyyy-mm-dd Ddd: estado" por día.
  const got = [`Eventos de rol (filtrados): ${events.length}`]
  for (const dia of estadosDelMes(events, 2026, 7)) {
    const [y, m, d] = dia.fecha.split('-').map(Number)
    const wd = DOW[new Date(Date.UTC(y, m - 1, d)).getUTCDay()]
    got.push(`  ${dia.fecha} ${wd}: ${dia.estado}`)
  }

  const expected = readFileSync(GOLDEN, 'utf-8')
    .replace(/\r\n/g, '\n') // el golden puede venir con CRLF en Windows
    .trimEnd()
    .split('\n')

  // toEqual sobre arrays de líneas: el diff señala exactamente qué día cambió.
  expect(got).toEqual(expected)
})
