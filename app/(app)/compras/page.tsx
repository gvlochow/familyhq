import { createClient } from "@/lib/supabase/server"
import { mapearItem, type ItemCompra } from "@/lib/shopping/tipos"
import { obtenerListaActivaId } from "../_lib/lista-compras"
import { ListaCompras } from "@/components/shopping/lista-compras"

/**
 * Tab Compras: la lista de compras compartida del hogar (una lista activa perpetua).
 * Server Component — resuelve la lista activa (get-or-create), lee sus ítems y los
 * integrantes (acotado por RLS) para el "agregado por", y delega la interacción
 * (agregar, marcar comprado, editar, eliminar, vaciar) al cliente.
 */
export default async function ComprasPage() {
  const supabase = await createClient()

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // household_id del usuario (para el get-or-create de la lista).
  const { data: yo } = await supabase
    .from("members")
    .select("household_id")
    .eq("user_id", user?.id ?? "")
    .maybeSingle()

  const listaId = yo ? await obtenerListaActivaId(supabase, yo.household_id) : null

  const [{ data: members }, itemsRaw] = await Promise.all([
    supabase.from("members").select("id, display_name"),
    listaId
      ? supabase
          .from("shopping_items")
          .select("id, name, quantity, is_purchased, added_by")
          .eq("list_id", listaId)
          .order("created_at", { ascending: true })
      : Promise.resolve({ data: [] as never[] }),
  ])

  const nombrePorMiembro = new Map(
    (members ?? []).map((m) => [m.id, m.display_name.split(" ")[0]]),
  )
  const items: ItemCompra[] = (itemsRaw.data ?? []).map((r) => mapearItem(r, nombrePorMiembro))

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-4 px-6 pt-8 pb-28">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Compras</h1>
        <p className="text-sm text-muted-foreground">La lista compartida de la casa.</p>
      </div>

      <ListaCompras items={items} />
    </main>
  )
}
