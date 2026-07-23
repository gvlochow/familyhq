"use server"

import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { sanearCantidad } from "@/lib/shopping/tipos"
import { obtenerListaActivaId } from "../_lib/lista-compras"

/** Resultado uniforme de las acciones: {error} legible o {} si salió bien. */
type Resultado = { error?: string }

const MAX_NOMBRE = 120
const MAX_CANTIDAD = 40

/**
 * Cantidad final para guardar: número con decimales (dígitos + un punto), sin el
 * punto final que se deja mientras se teclea. Vacía -> null. El cliente ya la
 * sanea; esto lo garantiza server-side.
 */
function cantidadParaGuardar(raw: string | null | undefined): string | null {
  return sanearCantidad(raw ?? "").replace(/\.$/, "").slice(0, MAX_CANTIDAD) || null
}

/** Miembro (id + household) del usuario autenticado, para household_id y added_by. */
async function miembroActual(supabase: Awaited<ReturnType<typeof createClient>>) {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return null
  const { data } = await supabase
    .from("members")
    .select("id, household_id")
    .eq("user_id", user.id)
    .maybeSingle()
  return data
}

/** Agrega un ítem a la lista activa del hogar (added_by = el member del usuario). */
export async function agregarItem(input: {
  nombre: string
  cantidad?: string | null
}): Promise<Resultado> {
  const supabase = await createClient()
  const miembro = await miembroActual(supabase)
  if (!miembro) return { error: "No perteneces a un hogar." }

  const nombre = input.nombre.trim().slice(0, MAX_NOMBRE)
  if (!nombre) return { error: "Escribe qué agregar." }
  const cantidad = cantidadParaGuardar(input.cantidad)

  const listaId = await obtenerListaActivaId(supabase, miembro.household_id)
  if (!listaId) return { error: "No se pudo abrir la lista." }

  const { error } = await supabase.from("shopping_items").insert({
    list_id: listaId,
    name: nombre,
    quantity: cantidad,
    added_by: miembro.id,
  })
  if (error) return { error: "No se pudo agregar. Intenta de nuevo." }

  revalidatePath("/compras")
  return {}
}

/** Edita el nombre y/o la cantidad de un ítem (RLS acota a la lista del hogar). */
export async function editarItem(
  id: string,
  input: { nombre: string; cantidad?: string | null },
): Promise<Resultado> {
  const supabase = await createClient()
  const miembro = await miembroActual(supabase)
  if (!miembro) return { error: "No hay sesión." }

  const nombre = input.nombre.trim().slice(0, MAX_NOMBRE)
  if (!nombre) return { error: "Escribe qué agregar." }
  const cantidad = cantidadParaGuardar(input.cantidad)

  const { data, error } = await supabase
    .from("shopping_items")
    .update({ name: nombre, quantity: cantidad })
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) return { error: "No se pudo guardar. Intenta de nuevo." }
  if (!data) return { error: "No se encontró el ítem." }

  revalidatePath("/compras")
  return {}
}

/** Marca/desmarca un ítem como comprado. */
export async function marcarComprado(id: string, comprado: boolean): Promise<Resultado> {
  const supabase = await createClient()
  const { data, error } = await supabase
    .from("shopping_items")
    .update({ is_purchased: comprado })
    .eq("id", id)
    .select("id")
    .maybeSingle()
  if (error) return { error: "No se pudo actualizar." }
  if (!data) return { error: "No se encontró el ítem." }

  revalidatePath("/compras")
  return {}
}

/** Elimina un ítem de la lista. */
export async function eliminarItem(id: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.from("shopping_items").delete().eq("id", id)
  if (error) return { error: "No se pudo eliminar." }

  revalidatePath("/compras")
  return {}
}

/** Borra todos los ítems ya comprados de la lista activa del hogar (limpieza rápida). */
export async function vaciarComprados(): Promise<Resultado> {
  const supabase = await createClient()
  const miembro = await miembroActual(supabase)
  if (!miembro) return { error: "No hay sesión." }

  const listaId = await obtenerListaActivaId(supabase, miembro.household_id)
  if (!listaId) return { error: "No se pudo abrir la lista." }

  const { error } = await supabase
    .from("shopping_items")
    .delete()
    .eq("list_id", listaId)
    .eq("is_purchased", true)
  if (error) return { error: "No se pudo vaciar." }

  revalidatePath("/compras")
  return {}
}
