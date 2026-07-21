"use server"

import { createClient } from "@/lib/supabase/server"

type Result = { error: null; householdName: string } | { error: string }

/**
 * Acepta una invitación por su token. Toda la lógica (que el correo de la sesión
 * sea el invitado, que no tengas hogar, crear/vincular el member) vive en la RPC
 * aceptar_invitacion (SECURITY DEFINER). Devuelve el nombre del hogar.
 */
export async function aceptarInvitacion(token: string): Promise<Result> {
  const t = token.trim()
  if (!t) return { error: "Invitación inválida." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("aceptar_invitacion", { p_token: t })
  if (error) {
    return { error: error.message || "No pudimos aceptar la invitación." }
  }

  const nombre = (data as { household_name?: string } | null)?.household_name
  return { error: null, householdName: nombre ?? "el hogar" }
}
