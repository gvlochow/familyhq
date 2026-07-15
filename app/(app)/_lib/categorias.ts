import type { SupabaseClient } from "@supabase/supabase-js"

import type { CategoriaRef } from "@/lib/agenda/categorias"

/**
 * Carga las categorías del hogar como mapa id → CategoriaRef (RLS acota al hogar).
 * Lo usan las pantallas de agenda para resolver la categoría de cada ítem.
 */
export async function cargarCategorias(
  supabase: SupabaseClient,
): Promise<Map<string, CategoriaRef>> {
  const { data } = await supabase.from("categorias").select("id, nombre, color")
  return new Map(
    (data ?? []).map((c) => [c.id, { id: c.id, nombre: c.nombre, color: c.color }]),
  )
}
