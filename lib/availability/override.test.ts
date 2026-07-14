import { describe, expect, it } from 'vitest'
import { aplicarOverrides, type OverrideVista } from './override'
import type { TramoVista } from './dia-resumen'

function t(inicioUtc: string, finUtc: string, estado: string): TramoVista {
  return { inicioUtc, finUtc, estado }
}
function o(inicioUtc: string, finUtc: string, estado: string): OverrideVista {
  return { inicioUtc, finUtc, estado }
}

describe('aplicarOverrides', () => {
  it('sin overrides devuelve la base tal cual', () => {
    const base = [t('2026-07-14T12:00:00Z', '2026-07-14T21:00:00Z', 'fuera')]
    expect(aplicarOverrides(base, [])).toBe(base)
  })

  it('el override gana dentro de su intervalo y parte el tramo base', () => {
    // Base: fuera 12-21. Override: en_casa 15-18. Resultado: fuera / en_casa / fuera.
    const base = [t('2026-07-14T12:00:00Z', '2026-07-14T21:00:00Z', 'fuera')]
    const ov = [o('2026-07-14T15:00:00Z', '2026-07-14T18:00:00Z', 'en_casa')]
    expect(aplicarOverrides(base, ov)).toEqual([
      t('2026-07-14T12:00:00.000Z', '2026-07-14T15:00:00.000Z', 'fuera'),
      t('2026-07-14T15:00:00.000Z', '2026-07-14T18:00:00.000Z', 'en_casa'),
      t('2026-07-14T18:00:00.000Z', '2026-07-14T21:00:00.000Z', 'fuera'),
    ])
  })

  it('override que cubre toda la base la reemplaza por completo', () => {
    const base = [t('2026-07-14T12:00:00Z', '2026-07-14T18:00:00Z', 'fuera')]
    const ov = [o('2026-07-14T12:00:00Z', '2026-07-14T18:00:00Z', 'en_casa')]
    expect(aplicarOverrides(base, ov)).toEqual([
      t('2026-07-14T12:00:00.000Z', '2026-07-14T18:00:00.000Z', 'en_casa'),
    ])
  })

  it('fusiona bordes cuando el override coincide con el estado base contiguo', () => {
    // Base: en_casa 12-15, fuera 15-21. Override: en_casa 15-18.
    // El trozo 12-15 (base en_casa) y 15-18 (override en_casa) se fusionan.
    const base = [
      t('2026-07-14T12:00:00Z', '2026-07-14T15:00:00Z', 'en_casa'),
      t('2026-07-14T15:00:00Z', '2026-07-14T21:00:00Z', 'fuera'),
    ]
    const ov = [o('2026-07-14T15:00:00Z', '2026-07-14T18:00:00Z', 'en_casa')]
    expect(aplicarOverrides(base, ov)).toEqual([
      t('2026-07-14T12:00:00.000Z', '2026-07-14T18:00:00.000Z', 'en_casa'),
      t('2026-07-14T18:00:00.000Z', '2026-07-14T21:00:00.000Z', 'fuera'),
    ])
  })

  it('override sin base debajo emite solo el override (integrante sin tramos)', () => {
    const ov = [o('2026-07-14T15:00:00Z', '2026-07-14T18:00:00Z', 'fuera')]
    expect(aplicarOverrides([], ov)).toEqual([
      t('2026-07-14T15:00:00.000Z', '2026-07-14T18:00:00.000Z', 'fuera'),
    ])
  })

  it('override que excede la base deja huecos fuera de base y de override', () => {
    // Base: fuera 12-15. Override: en_casa 18-20 (no toca la base). Hueco 15-18.
    const base = [t('2026-07-14T12:00:00Z', '2026-07-14T15:00:00Z', 'fuera')]
    const ov = [o('2026-07-14T18:00:00Z', '2026-07-14T20:00:00Z', 'en_casa')]
    expect(aplicarOverrides(base, ov)).toEqual([
      t('2026-07-14T12:00:00.000Z', '2026-07-14T15:00:00.000Z', 'fuera'),
      t('2026-07-14T18:00:00.000Z', '2026-07-14T20:00:00.000Z', 'en_casa'),
    ])
  })

  it('varios overrides no solapados se aplican todos', () => {
    const base = [t('2026-07-14T00:00:00Z', '2026-07-15T00:00:00Z', 'en_casa')]
    const ov = [
      o('2026-07-14T09:00:00Z', '2026-07-14T12:00:00Z', 'fuera'),
      o('2026-07-14T15:00:00Z', '2026-07-14T18:00:00Z', 'standby_casa'),
    ]
    expect(aplicarOverrides(base, ov)).toEqual([
      t('2026-07-14T00:00:00.000Z', '2026-07-14T09:00:00.000Z', 'en_casa'),
      t('2026-07-14T09:00:00.000Z', '2026-07-14T12:00:00.000Z', 'fuera'),
      t('2026-07-14T12:00:00.000Z', '2026-07-14T15:00:00.000Z', 'en_casa'),
      t('2026-07-14T15:00:00.000Z', '2026-07-14T18:00:00.000Z', 'standby_casa'),
      t('2026-07-14T18:00:00.000Z', '2026-07-15T00:00:00.000Z', 'en_casa'),
    ])
  })
})
