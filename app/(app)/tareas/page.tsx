import { DateTime } from "luxon"

import { createClient } from "@/lib/supabase/server"
import { TZ_LOCAL } from "@/lib/roster/types"
import { mapearAgendaItem, type AgendaItem, type MiembroRef } from "@/lib/agenda/tipos"
import { primeraPorRegla, proximaPorRegla } from "@/lib/agenda/recurrente"
import { cargarAgendaRecurrente } from "../_lib/agenda-recurrente"
import { cargarCategorias } from "../_lib/categorias"
import { AgendaTab } from "@/components/agenda/agenda-tab"
import { ProximosCumpleanos } from "@/components/agenda/proximos-cumpleanos"
import { AjustesLauncher } from "@/components/nav/ajustes-launcher"

/**
 * Horizonte de expansión. 366 días para cubrir la próxima ocurrencia de CUALQUIER
 * regla: lo semanal/mensual cae en los primeros días, y lo anual (cumpleaños)
 * dentro del año. La lista principal solo muestra la próxima de cada regla, así que
 * la ventana larga no la infla.
 */
const HORIZONTE_DIAS = 366

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

  const [{ data: members }, { data: agendaRaw }, categorias, { data: hogar }] = await Promise.all([
    supabase.from("members").select("id, display_name, user_id"),
    supabase
      .from("agenda_items")
      .select("id, tipo, titulo, fecha, hora, hora_fin, afecta_disponibilidad, completado, asignado_a, created_by, categoria_id")
      .order("fecha", { ascending: true })
      .order("hora", { ascending: true, nullsFirst: true }),
    cargarCategorias(supabase),
    supabase.from("households").select("mostrar_categoria").limit(1).maybeSingle(),
  ])

  const integrantes = members ?? []
  const miembrosRef: MiembroRef[] = integrantes.map((m) => ({
    id: m.id,
    inicial: m.display_name.trim().charAt(0).toUpperCase() || "?",
    nombre: m.display_name.split(" ")[0],
  }))
  const miembrosById = new Map(miembrosRef.map((m) => [m.id, m]))

  const puntuales: AgendaItem[] = (agendaRaw ?? [])
    .map((r) => mapearAgendaItem(r, miembrosById, categorias))
    .filter((it): it is AgendaItem => it !== null)

  // Ocurrencias recurrentes de la ventana. Se separan las ANUALES (cumpleaños /
  // fechas anuales), que van a su propia vista a futuro, del resto (semanal/mensual),
  // que se colapsa a una fila por regla (su próxima pendiente) en la lista principal.
  const hoy = DateTime.now().setZone(TZ_LOCAL)
  const ocurrencias = await cargarAgendaRecurrente(
    supabase,
    miembrosById,
    categorias,
    hoy.toISODate()!,
    hoy.plus({ days: HORIZONTE_DIAS }).toISODate()!,
  )
  const recurrentes = proximaPorRegla(
    ocurrencias.filter((it) => it.recurrencia?.tipo !== "anual"),
  )
  // Cumpleaños: próxima ocurrencia de cada regla anual (sin saltar completadas).
  const cumples = primeraPorRegla(
    ocurrencias.filter((it) => it.recurrencia?.tipo === "anual"),
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
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-4 px-6 pt-8 pb-40">
      <div className="-mr-1.5 flex items-start justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Actividades</h1>
          <p className="text-sm text-muted-foreground">Lo que hay que hacer y lo que viene.</p>
        </div>
        <AjustesLauncher />
      </div>

      <AgendaTab
        items={items}
        nowISO={nowISO}
        miembros={miembrosRef}
        categorias={[...categorias.values()]}
        agregadoPor={agregadoPor}
        mostrarCategoria={hogar?.mostrar_categoria ?? true}
      />

      <ProximosCumpleanos
        items={cumples}
        nowISO={nowISO}
        miembros={miembrosRef}
        categorias={[...categorias.values()]}
        agregadoPor={agregadoPor}
      />
    </main>
  )
}
