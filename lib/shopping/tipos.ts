/**
 * Dominio de la lista de compras familiar. PURO: sin Next.js ni Supabase.
 * database.types tipa las columnas como string; este módulo es la forma que
 * consume la UI (subconjunto de shopping_items resuelto contra el hogar).
 */

/** Un ítem de la lista tal como lo consume la UI (subconjunto de shopping_items). */
export interface ItemCompra {
  id: string
  nombre: string
  /** Cantidad en texto libre ("2 kg", "1 paquete") o null. */
  cantidad: string | null
  comprado: boolean
  /** Nombre de quién lo agregó (registro visual), o null. */
  agregadoPor: string | null
}

/** Fila cruda de shopping_items (subconjunto que lee la pantalla). */
export interface FilaItemDB {
  id: string
  name: string
  quantity: string | null
  is_purchased: boolean
  added_by: string | null
}

/**
 * Mapea una fila de shopping_items a la vista, resolviendo "agregado por" contra
 * los integrantes del hogar (id -> primer nombre). Un added_by que ya no resuelva
 * se muestra sin autor (no rompe).
 */
export function mapearItem(r: FilaItemDB, miembros: Map<string, string>): ItemCompra {
  return {
    id: r.id,
    nombre: r.name,
    cantidad: r.quantity && r.quantity.trim() ? r.quantity : null,
    comprado: r.is_purchased,
    agregadoPor: r.added_by ? (miembros.get(r.added_by) ?? null) : null,
  }
}

/**
 * Separa la lista en pendientes (arriba) y comprados (al fondo, tachados),
 * preservando el orden de entrada de cada grupo. La pantalla ya trae los ítems
 * ordenados por created_at; esto solo los agrupa por estado.
 */
export function separarItems(items: ItemCompra[]): {
  pendientes: ItemCompra[]
  comprados: ItemCompra[]
} {
  const pendientes: ItemCompra[] = []
  const comprados: ItemCompra[] = []
  for (const it of items) (it.comprado ? comprados : pendientes).push(it)
  return { pendientes, comprados }
}
