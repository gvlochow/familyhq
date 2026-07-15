import { describe, expect, it } from 'vitest'
import {
  COLOR_CATEGORIA_DEFECTO,
  esColorCategoria,
  hexCategoria,
  PALETA_CATEGORIAS,
} from './categorias'

describe('paleta de categorías', () => {
  it('claves únicas y hex válidos', () => {
    const claves = PALETA_CATEGORIAS.map((c) => c.clave)
    expect(new Set(claves).size).toBe(claves.length)
    for (const c of PALETA_CATEGORIAS) {
      expect(c.hex).toMatch(/^#[0-9A-Fa-f]{6}$/)
    }
  })

  it('esColorCategoria valida contra la paleta', () => {
    expect(esColorCategoria('ambar')).toBe(true)
    expect(esColorCategoria('gris')).toBe(true)
    expect(esColorCategoria('inventado')).toBe(false)
    expect(esColorCategoria(null)).toBe(false)
  })

  it('hexCategoria mapea la clave; desconocida cae al default', () => {
    expect(hexCategoria('ambar')).toBe('#E0A020')
    expect(hexCategoria('zzz')).toBe(hexCategoria(COLOR_CATEGORIA_DEFECTO))
  })
})
