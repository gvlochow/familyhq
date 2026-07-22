import { describe, expect, it } from "vitest"

import {
  contarPorMiembro,
  ordenarRecienteDesc,
  type EventoHistorial,
} from "./historial"

function ev(
  memberId: string | null,
  completadoAt: string,
  recurrente = false,
): EventoHistorial {
  return { titulo: "t", memberId, completadoAt, recurrente }
}

describe("ordenarRecienteDesc", () => {
  it("ordena del más reciente al más antiguo, sin mutar la entrada", () => {
    const entrada = [
      ev("m1", "2026-07-20T10:00:00Z"),
      ev("m2", "2026-07-22T08:00:00Z"),
      ev("m1", "2026-07-21T23:00:00Z"),
    ]
    const r = ordenarRecienteDesc(entrada)
    expect(r.map((e) => e.completadoAt)).toEqual([
      "2026-07-22T08:00:00Z",
      "2026-07-21T23:00:00Z",
      "2026-07-20T10:00:00Z",
    ])
    // no muta el arreglo original
    expect(entrada[0].completadoAt).toBe("2026-07-20T10:00:00Z")
  })

  it("compara por instante aunque el offset venga en formatos distintos", () => {
    const r = ordenarRecienteDesc([
      ev("m2", "2026-07-22T03:00:00Z"),
      ev("m1", "2026-07-22T00:00:00-04:00"), // = 04:00Z, posterior a 03:00Z
    ])
    expect(r[0].memberId).toBe("m1") // 04:00Z es más reciente que 03:00Z
  })
})

describe("contarPorMiembro", () => {
  const eventos = [
    ev("m1", "2026-07-22T10:00:00Z"),
    ev("m1", "2026-07-05T10:00:00Z"),
    ev("m2", "2026-07-15T10:00:00Z"),
    ev(null, "2026-07-16T10:00:00Z"), // sin integrante -> se ignora
    ev("m1", "2026-06-30T10:00:00Z"), // antes del corte -> se ignora
  ]

  it("cuenta por integrante desde el corte, ignorando nulos y anteriores", () => {
    const r = contarPorMiembro(eventos, "2026-07-01T00:00:00Z")
    expect(r.get("m1")).toBe(2)
    expect(r.get("m2")).toBe(1)
    expect(r.size).toBe(2)
  })

  it("el corte es inclusive", () => {
    const r = contarPorMiembro([ev("m1", "2026-07-01T00:00:00Z")], "2026-07-01T00:00:00Z")
    expect(r.get("m1")).toBe(1)
  })
})
