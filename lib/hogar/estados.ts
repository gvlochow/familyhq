/**
 * Estados de las solicitudes e invitaciones de ingreso al hogar (grupo 3).
 * Espejan los CHECK de household_join_requests.status y household_invites.status
 * (migración 20260721120000). database.types los tipa como `string`; este módulo
 * es la fuente de verdad del dominio (CLAUDE.md: enums tipados, no strings sueltos).
 */

export type EstadoSolicitud = "pendiente" | "aprobada" | "rechazada" | "bloqueada"

export const ESTADOS_SOLICITUD = [
  "pendiente",
  "aprobada",
  "rechazada",
  "bloqueada",
] as const

export function esEstadoSolicitud(valor: unknown): valor is EstadoSolicitud {
  return (
    typeof valor === "string" &&
    (ESTADOS_SOLICITUD as readonly string[]).includes(valor)
  )
}

export type EstadoInvitacion = "pendiente" | "aceptada" | "revocada"

export const ESTADOS_INVITACION = ["pendiente", "aceptada", "revocada"] as const

export function esEstadoInvitacion(valor: unknown): valor is EstadoInvitacion {
  return (
    typeof valor === "string" &&
    (ESTADOS_INVITACION as readonly string[]).includes(valor)
  )
}

/**
 * Acciones con que un responsable resuelve una solicitud (parámetro p_accion de
 * resolver_ingreso). No incluye 'pendiente': es el estado inicial, no una acción.
 */
export type AccionSolicitud = "aprobar" | "rechazar" | "bloquear"

export const ACCIONES_SOLICITUD = ["aprobar", "rechazar", "bloquear"] as const

export function esAccionSolicitud(valor: unknown): valor is AccionSolicitud {
  return (
    typeof valor === "string" &&
    (ACCIONES_SOLICITUD as readonly string[]).includes(valor)
  )
}
