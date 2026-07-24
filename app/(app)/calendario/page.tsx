import Link from "next/link"
import { DateTime } from "luxon"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { TZ_LOCAL } from "@/lib/roster/types"
import {
  construirGrillaMesFamilia,
  type MiembroCalendario,
} from "@/lib/availability/mes-familia"
import { mapearAgendaItem, type AgendaItem, type MiembroRef } from "@/lib/agenda/tipos"
import { CalendarView } from "@/components/calendar/calendar-view"
import { cargarTramosEfectivos } from "../_lib/tramos-efectivos"
import { cargarAgendaRecurrente } from "../_lib/agenda-recurrente"
import { cargarCategorias } from "../_lib/categorias"
import { AjustesLauncher } from "@/components/nav/ajustes-launcher"

/**
 * Calendario FAMILIAR del hogar. Server Component: el mes vive en la URL
 * (?mes=yyyy-MM), así la navegación es con Links y sin estado de cliente. Una sola
 * grilla para toda la familia (no un calendario por integrante): cada día marca
 * quién está fuera. Lee los tramos de todos los integrantes (acotado por RLS).
 */
export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes } = await searchParams
  const supabase = await createClient()

  const [{ data: { user } }, { data: members }, { data: hogar }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("members").select("id, display_name, user_id, tipo_horario"),
    supabase.from("households").select("mostrar_categoria, ocultar_simbologia").limit(1).maybeSingle(),
  ])
  const integrantes = members ?? []
  // El estado "Blanco" (por_confirmar) solo lo genera el clasificador variable;
  // en un hogar sin ningún integrante variable nunca aparece, así que no se muestra
  // en la leyenda (a un horario fijo no le aplica).
  const hayVariable = integrantes.some((m) => m.tipo_horario === "variable")

  // Mes base: ?mes=yyyy-MM válido, o el mes actual.
  const hoy = DateTime.now().setZone(TZ_LOCAL)
  const parsed = mes ? DateTime.fromFormat(mes, "yyyy-MM", { zone: TZ_LOCAL }) : null
  const base = (parsed?.isValid ? parsed : hoy).startOf("month")

  // Ventana de la grilla (mes ± 7 días de relleno) como instantes UTC.
  const winInicioUtc = base.minus({ days: 7 }).startOf("day").toUTC().toISO()!
  const winFinUtc = base.endOf("month").plus({ days: 8 }).startOf("day").toUTC().toISO()!

  // Tramos EFECTIVOS por integrante (clasificado/fijo + default + overrides),
  // compuestos por el loader compartido (acotado por RLS al hogar).
  const tramosPorMiembro = await cargarTramosEfectivos(
    supabase,
    integrantes,
    winInicioUtc,
    winFinUtc,
  )

  // Estaciones de fin de día (nota "Termina en X") del rango visible, por integrante.
  const desdeEst = base.startOf("month").minus({ days: 7 }).toISODate()!
  const hastaEst = base.endOf("month").plus({ days: 8 }).toISODate()!
  const { data: estacionesRaw } = integrantes.length
    ? await supabase
        .from("roster_estaciones_dia")
        .select("member_id, fecha, estacion")
        .gte("fecha", desdeEst)
        .lte("fecha", hastaEst)
    : { data: [] }
  const estacionesPorMiembro = new Map<string, Record<string, string>>()
  for (const e of estacionesRaw ?? []) {
    const mapa = estacionesPorMiembro.get(e.member_id) ?? {}
    mapa[e.fecha] = e.estacion
    estacionesPorMiembro.set(e.member_id, mapa)
  }

  const miembros: MiembroCalendario[] = integrantes.map((m) => ({
    id: m.id,
    nombre: m.display_name.split(" ")[0],
    inicial: m.display_name.trim().charAt(0).toUpperCase() || "?",
    tramos: tramosPorMiembro.get(m.id) ?? [],
    estaciones: estacionesPorMiembro.get(m.id),
  }))

  const grilla = construirGrillaMesFamilia(miembros, base.toFormat("yyyy-MM"), hoy.toISODate()!)

  // Agenda del rango visible de la grilla (mes + días de relleno de semanas vecinas),
  // puntual + ocurrencias recurrentes, agrupada por día para el marcador y el detalle.
  const desdeAgenda = base.startOf("month").startOf("week").toISODate()!
  const hastaAgenda = base.endOf("month").endOf("week").toISODate()!
  const miembrosRef: MiembroRef[] = integrantes.map((m) => ({
    id: m.id,
    inicial: m.display_name.trim().charAt(0).toUpperCase() || "?",
    nombre: m.display_name.split(" ")[0],
  }))
  const miembrosById = new Map(miembrosRef.map((m) => [m.id, m]))

  const categorias = await cargarCategorias(supabase)
  const { data: agendaRaw } = integrantes.length
    ? await supabase
        .from("agenda_items")
        .select("id, tipo, titulo, fecha, hora, hora_fin, afecta_disponibilidad, completado, asignado_a, created_by, categoria_id, notas")
        .gte("fecha", desdeAgenda)
        .lte("fecha", hastaAgenda)
    : { data: [] }
  const puntuales = (agendaRaw ?? [])
    .map((r) => mapearAgendaItem(r, miembrosById, categorias))
    .filter((it): it is AgendaItem => it !== null)
  const recurrentes = integrantes.length
    ? await cargarAgendaRecurrente(supabase, miembrosById, categorias, desdeAgenda, hastaAgenda)
    : []

  const agendaPorDia: Record<string, AgendaItem[]> = {}
  for (const it of [...puntuales, ...recurrentes]) {
    ;(agendaPorDia[it.fecha] ??= []).push(it)
  }
  for (const fecha of Object.keys(agendaPorDia)) {
    agendaPorDia[fecha].sort(
      (a, b) => (a.hora ?? "").localeCompare(b.hora ?? "") || a.titulo.localeCompare(b.titulo, "es"),
    )
  }

  const etiquetaMes = capitalizar(base.setLocale("es").toFormat("LLLL yyyy"))
  const mesPrev = base.minus({ months: 1 }).toFormat("yyyy-MM")
  const mesNext = base.plus({ months: 1 }).toFormat("yyyy-MM")
  const href = (m: string) => `/calendario?mes=${m}`

  const yo = integrantes.find((m) => m.user_id === user?.id)
  const agregadoPor = yo ? yo.display_name.split(" ")[0] : null

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-5 px-6 pt-8 pb-28">
      <header className="flex flex-col gap-4">
        <div className="-mr-1.5 flex items-start justify-between gap-2">
          <div>
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              Calendario
            </h1>
            <p className="text-sm text-muted-foreground">Quién está fuera y qué hay agendado.</p>
          </div>
          <AjustesLauncher />
        </div>

        {/* Navegación de mes. */}
        <div className="flex items-center justify-between">
          <Link
            href={href(mesPrev)}
            aria-label="Mes anterior"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronLeftIcon className="size-5" />
          </Link>
          <span className="font-heading text-base font-medium text-foreground">
            {etiquetaMes}
          </span>
          <Link
            href={href(mesNext)}
            aria-label="Mes siguiente"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronRightIcon className="size-5" />
          </Link>
        </div>
      </header>

      {integrantes.length > 0 ? (
        <CalendarView
          grilla={grilla}
          miembros={miembros}
          agendaPorDia={agendaPorDia}
          miembrosRef={miembrosRef}
          categorias={[...categorias.values()]}
          agregadoPor={agregadoPor}
          mostrarCategoria={hogar?.mostrar_categoria ?? true}
          hayVariable={hayVariable}
          ocultarSimbologia={hogar?.ocultar_simbologia ?? false}
        />
      ) : (
        <p className="text-sm text-muted-foreground">
          Todavía no hay integrantes en el hogar.
        </p>
      )}
    </main>
  )
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
