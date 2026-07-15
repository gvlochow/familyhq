import type { SupabaseClient } from "@supabase/supabase-js"

/**
 * Devuelve el id de la lista activa del hogar, creándola si no existe (get-or-create).
 * En la práctica siempre existe (la siembra por trigger + backfill garantiza una
 * lista activa por hogar, ver migración 20260715130000); esto es el cinturón por si
 * un hogar se quedara sin ella. El índice único parcial impide dos activas: ante una
 * carrera, el insert falla y se re-selecciona la que ganó.
 *
 * RLS acota shopping_lists al hogar del usuario, así que no hace falta pasar el
 * household_id para leer; para crear sí (with check exige household_id propio).
 */
export async function obtenerListaActivaId(
  supabase: SupabaseClient,
  householdId: string,
): Promise<string | null> {
  const existente = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("status", "activa")
    .maybeSingle()
  if (existente.data) return existente.data.id

  const creada = await supabase
    .from("shopping_lists")
    .insert({ household_id: householdId, status: "activa" })
    .select("id")
    .maybeSingle()
  if (creada.data) return creada.data.id

  // Carrera: otro request la creó primero (violó el índice único). Re-selecciona.
  const reintento = await supabase
    .from("shopping_lists")
    .select("id")
    .eq("status", "activa")
    .maybeSingle()
  return reintento.data?.id ?? null
}
