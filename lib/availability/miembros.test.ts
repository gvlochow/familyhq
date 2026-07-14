import { describe, expect, it } from 'vitest'
import { tramosConDefault } from './miembros'
import type { TramoVista } from './dia-resumen'

const VENTANA = ['2026-07-13T04:00:00Z', '2026-07-20T04:00:00Z'] as const

describe('tramosConDefault', () => {
  it("'ninguno' sin tramos -> un tramo en_casa que cubre la ventana", () => {
    const out = tramosConDefault('ninguno', [], VENTANA[0], VENTANA[1])
    expect(out).toEqual([
      { inicioUtc: VENTANA[0], finUtc: VENTANA[1], estado: 'en_casa' },
    ])
  })

  it('variable/fijo sin tramos -> sigue vacío (sin información)', () => {
    expect(tramosConDefault('variable', [], VENTANA[0], VENTANA[1])).toEqual([])
    expect(tramosConDefault('fijo', [], VENTANA[0], VENTANA[1])).toEqual([])
  })

  it("'ninguno' con tramos existentes -> no los toca", () => {
    const tramos: TramoVista[] = [
      { inicioUtc: '2026-07-13T13:00:00Z', finUtc: '2026-07-13T22:00:00Z', estado: 'fuera' },
    ]
    expect(tramosConDefault('ninguno', tramos, VENTANA[0], VENTANA[1])).toBe(tramos)
  })
})
