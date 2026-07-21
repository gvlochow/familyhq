import { describe, it, expect } from "vitest"

import {
  esAccionSolicitud,
  esEstadoInvitacion,
  esEstadoSolicitud,
} from "./estados"

describe("esEstadoSolicitud", () => {
  it("acepta los cuatro estados válidos", () => {
    for (const s of ["pendiente", "aprobada", "rechazada", "bloqueada"]) {
      expect(esEstadoSolicitud(s)).toBe(true)
    }
  })
  it("rechaza cualquier otra cosa", () => {
    expect(esEstadoSolicitud("aceptada")).toBe(false)
    expect(esEstadoSolicitud(null)).toBe(false)
    expect(esEstadoSolicitud(undefined)).toBe(false)
  })
})

describe("esEstadoInvitacion", () => {
  it("acepta los tres estados válidos", () => {
    for (const s of ["pendiente", "aceptada", "revocada"]) {
      expect(esEstadoInvitacion(s)).toBe(true)
    }
  })
  it("rechaza estados de otro dominio", () => {
    expect(esEstadoInvitacion("aprobada")).toBe(false)
    expect(esEstadoInvitacion("")).toBe(false)
  })
})

describe("esAccionSolicitud", () => {
  it("acepta aprobar/rechazar/bloquear", () => {
    for (const a of ["aprobar", "rechazar", "bloquear"]) {
      expect(esAccionSolicitud(a)).toBe(true)
    }
  })
  it("rechaza 'pendiente' (es estado, no acción) y basura", () => {
    expect(esAccionSolicitud("pendiente")).toBe(false)
    expect(esAccionSolicitud(42)).toBe(false)
  })
})
