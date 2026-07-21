"use server"

import { createClient } from "@/lib/supabase/server"
import { normalizarCodigo } from "@/lib/hogar/join-code"

type SolicitarResult =
  | { error: null; householdName: string }
  | { error: string }

/**
 * Envía una solicitud de ingreso a un hogar por su código. Toda la lógica
 * sensible (validar código, evitar doble hogar, bloqueos, rate limit) vive en la
 * RPC solicitar_ingreso (SECURITY DEFINER). Acá solo normalizamos la entrada y
 * traducimos el error. Devuelve el nombre del hogar para la confirmación — es la
 * única vez que se revela (el solicitante no puede leer households por RLS).
 */
export async function solicitarIngreso(codigo: string): Promise<SolicitarResult> {
  const normalizado = normalizarCodigo(codigo)
  if (!normalizado) return { error: "Ingresa el código del hogar." }

  const supabase = await createClient()
  const { data, error } = await supabase.rpc("solicitar_ingreso", {
    p_code: normalizado,
  })

  if (error) {
    // Los mensajes de la RPC ya son legibles en español; caemos a uno genérico
    // si viniera algo inesperado.
    return {
      error:
        error.message || "No pudimos enviar tu solicitud. Intenta de nuevo.",
    }
  }

  const nombre = (data as { household_name?: string } | null)?.household_name
  return { error: null, householdName: nombre ?? "el hogar" }
}

/**
 * Retira la solicitud pendiente del propio usuario (p.ej. tecleó mal el código).
 * La RLS (household_join_requests_delete_propia) acota a su fila y solo si sigue
 * pendiente.
 */
export async function cancelarSolicitud(): Promise<{ error: string | null }> {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return { error: "Tu sesión expiró. Vuelve a iniciar sesión." }

  const { error } = await supabase
    .from("household_join_requests")
    .delete()
    .eq("user_id", user.id)
    .eq("status", "pendiente")
  if (error) return { error: "No pudimos cancelar la solicitud. Intenta de nuevo." }

  return { error: null }
}
