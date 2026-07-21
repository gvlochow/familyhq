import { describe, it, expect } from "vitest"

import {
  JOIN_CODE_ALFABETO,
  JOIN_CODE_LARGO,
  esCodigoValido,
  formatearCodigo,
  normalizarCodigo,
} from "./join-code"

describe("normalizarCodigo", () => {
  it("pasa a mayúsculas y quita espacios y guiones", () => {
    expect(normalizarCodigo(" abcd-efgh ")).toBe("ABCDEFGH")
    expect(normalizarCodigo("ab c d\tef")).toBe("ABCDEF")
  })

  it("coincide con la presentación agrupada (round-trip)", () => {
    const codigo = "ABCDEFGH"
    expect(normalizarCodigo(formatearCodigo(codigo))).toBe(codigo)
  })
})

describe("esCodigoValido", () => {
  it("acepta 8 caracteres del alfabeto (incluye la forma con guion)", () => {
    expect(esCodigoValido("ABCDEFGH")).toBe(true)
    expect(esCodigoValido("abcd-efgh")).toBe(true)
    expect(esCodigoValido(`${JOIN_CODE_ALFABETO.slice(0, JOIN_CODE_LARGO)}`)).toBe(true)
  })

  it("rechaza largo incorrecto", () => {
    expect(esCodigoValido("ABCDEFG")).toBe(false)
    expect(esCodigoValido("ABCDEFGHJ")).toBe(false)
    expect(esCodigoValido("")).toBe(false)
  })

  it("rechaza caracteres ambiguos fuera del alfabeto (0/O, 1/I/L)", () => {
    // '0', '1', 'I', 'L', 'O' no están en el alfabeto.
    expect(esCodigoValido("ABCDEFG0")).toBe(false)
    expect(esCodigoValido("ABCDEFGI")).toBe(false)
    expect(esCodigoValido("ABCDEFGO")).toBe(false)
  })
})

describe("formatearCodigo", () => {
  it("agrupa en dos bloques de 4", () => {
    expect(formatearCodigo("ABCDEFGH")).toBe("ABCD-EFGH")
    expect(formatearCodigo("abcdefgh")).toBe("ABCD-EFGH")
  })

  it("deja intacto lo que no tiene el largo esperado", () => {
    expect(formatearCodigo("ABC")).toBe("ABC")
  })
})
