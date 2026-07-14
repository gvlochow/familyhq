import { DateTime } from "luxon"

import { createClient } from "@/lib/supabase/server"
import { TZ_LOCAL } from "@/lib/roster/types"
import { esTipoAgenda, type AgendaItem } from "@/lib/agenda/tipos"
import { AgendaTab } from "@/components/agenda/agenda-tab"

/**
 * Tab Tareas: las tareas y eventos puntuales del hogar (agenda_items). Server
 * Component — lee la agenda (acotada por RLS) y delega la interacción (crear,
 * completar, eliminar) al componente cliente. Las horas se guardan en formato
 * local "HH:MM"; la recurrencia y la lista de compras llegarán después.
 */
export default async function TareasPage() {
  const supabase = await createClient()

  const { data } = await supabase
    .from("agenda_items")
    .select("id, tipo, titulo, fecha, hora, completado")
    .order("fecha", { ascending: true })
    .order("hora", { ascending: true, nullsFirst: true })

  const items: AgendaItem[] = (data ?? [])
    .filter((r) => esTipoAgenda(r.tipo))
    .map((r) => ({
      id: r.id,
      tipo: r.tipo as AgendaItem["tipo"],
      titulo: r.titulo,
      fecha: r.fecha,
      hora: r.hora ? r.hora.slice(0, 5) : null, // "HH:MM:SS" -> "HH:MM"
      completado: r.completado,
    }))

  const nowISO = DateTime.now().setZone(TZ_LOCAL).toISO()!

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-4 px-6 pt-8 pb-28">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Tareas</h1>
        <p className="text-sm text-muted-foreground">Lo que hay que hacer y lo que viene.</p>
      </div>

      <AgendaTab items={items} nowISO={nowISO} />
    </main>
  )
}
