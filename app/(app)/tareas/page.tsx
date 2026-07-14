import { DateTime } from "luxon"

import { createClient } from "@/lib/supabase/server"
import { TZ_LOCAL } from "@/lib/roster/types"
import { mapearAgendaItem, type AgendaItem, type MiembroRef } from "@/lib/agenda/tipos"
import { cargarAgendaRecurrente } from "../_lib/agenda-recurrente"
import { AgendaTab } from "@/components/agenda/agenda-tab"

/** Horizonte de expansión de las recurrentes en la tab (los puntuales no se acotan). */
const HORIZONTE_DIAS = 60

/**
 * Tab Tareas: las tareas y eventos puntuales del hogar (agenda_items). Server
 * Component — lee la agenda + integrantes (acotado por RLS), resuelve asignados y
 * "agregado por", y delega la interacción (crear, completar, eliminar) al cliente.
 */
export default async function TareasPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: members }, { data: agendaRaw }] = await Promise.all([
    supabase.from("members").select("id, display_name, user_id"),
    supabase
      .from("agenda_items")
      .select("id, tipo, titulo, fecha, hora, completado, asignado_a, created_by")
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true, nullsFirst: true }),
  ])

  const integrantes = members ?? []
  const miembrosRef: MiembroRef[] = integrantes.map((m) => ({
    id: m.id,
    inicial: m.display_name.trim().charAt(0).toUpperCase() || "?",
    nombre: m.display_name.split(" ")[0],
  }))
  const miembrosById = new Map(miembrosRef.map((m) => [m.id, m]))

  const puntuales: AgendaItem[] = (agendaRaw ?? [])
    .map((r) => mapearAgendaItem(r, miembrosById))
    .filter((it): it is AgendaItem => it !== null)

  // Ocurrencias recurrentes desde hoy hasta el horizonte (los puntuales no se acotan).
  const hoy = DateTime.now().setZone(TZ_LOCAL)
  const recurrentes = await cargarAgendaRecurrente(
    supabase,
    miembrosById,
    hoy.toISODate()!,
    hoy.plus({ days: HORIZONTE_DIAS }).toISODate()!,
  )

  // Mezcla ordenada por fecha y luego hora (sin hora primero).
  const items: AgendaItem[] = [...puntuales, ...recurrentes].sort((a, b) => {
    if (a.fecha !== b.fecha) return a.fecha < b.fecha ? -1 : 1
    return (a.hora ?? "").localeCompare(b.hora ?? "")
  })

  const yo = integrantes.find((m) => m.user_id === user?.id)
  const agregadoPor = yo ? yo.display_name.split(" ")[0] : null
  const nowISO = hoy.toISO()!

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-4 px-6 pt-8 pb-28">
      <div>
        <h1 className="font-heading text-2xl font-semibold text-foreground">Tareas</h1>
        <p className="text-sm text-muted-foreground">Lo que hay que hacer y lo que viene.</p>
      </div>

      <AgendaTab items={items} nowISO={nowISO} miembros={miembrosRef} agregadoPor={agregadoPor} />
    </main>
  )
}
