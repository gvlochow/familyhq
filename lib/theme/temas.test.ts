import { describe, expect, it } from "vitest"

import {
  MODO_DEFAULT,
  TEMA_DEFAULT,
  TEMAS,
  esModoColor,
  esTemaId,
  modoValido,
  resolverOscuro,
  temaValido,
} from "./temas"

describe("esTemaId / temaValido", () => {
  it("acepta los ids reales y rechaza el resto", () => {
    expect(esTemaId("puerto")).toBe(true)
    expect(esTemaId("bosque")).toBe(true)
    expect(esTemaId("ciruela")).toBe(true)
    expect(esTemaId("otro")).toBe(false)
    expect(esTemaId(null)).toBe(false)
  })
  it("temaValido cae al default con basura", () => {
    expect(temaValido("bosque")).toBe("bosque")
    expect(temaValido("nope")).toBe(TEMA_DEFAULT)
    expect(temaValido(undefined)).toBe(TEMA_DEFAULT)
  })
})

describe("esModoColor / modoValido", () => {
  it("acepta claro/oscuro/sistema", () => {
    expect(esModoColor("claro")).toBe(true)
    expect(esModoColor("oscuro")).toBe(true)
    expect(esModoColor("sistema")).toBe(true)
    expect(esModoColor("dark")).toBe(false)
  })
  it("modoValido cae al default con basura", () => {
    expect(modoValido("oscuro")).toBe("oscuro")
    expect(modoValido("x")).toBe(MODO_DEFAULT)
  })
})

describe("resolverOscuro", () => {
  it("modo explícito manda sobre el sistema", () => {
    expect(resolverOscuro("oscuro", false)).toBe(true)
    expect(resolverOscuro("claro", true)).toBe(false)
  })
  it("modo sistema sigue la preferencia del equipo", () => {
    expect(resolverOscuro("sistema", true)).toBe(true)
    expect(resolverOscuro("sistema", false)).toBe(false)
  })
})

describe("TEMAS", () => {
  it("son exactamente 3 y con swatch completo", () => {
    expect(TEMAS).toHaveLength(3)
    for (const t of TEMAS) {
      expect(t.swatch.primary).toMatch(/^#[0-9a-f]{6}$/i)
      expect(t.swatch.secondary).toMatch(/^#[0-9a-f]{6}$/i)
      expect(t.swatch.accent).toMatch(/^#[0-9a-f]{6}$/i)
      expect(t.swatch.bg).toMatch(/^#[0-9a-f]{6}$/i)
    }
  })
})
