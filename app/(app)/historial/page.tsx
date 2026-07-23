import Link from "next/link"
import { DateTime } from "luxon"
import { RepeatIcon, TrophyIcon } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { TZ_LOCAL } from "@/lib/roster/types"
import {
  contarPorMiembro,
  ordenarRecienteDesc,
  type EventoHistorial,
} from "@/lib/historial/historial"
import { AjustesLauncher } from "@/components/nav/ajustes-launcher"
import { cn } from "@/lib/utils"

/** Cuántas filas de actividad reciente mostrar. */
const MAX_FEED = 40

/** Periodo del puntaje/actividad, elegible por query param (?p=). */
const PERIODOS = ["semana", "mes", "todo"] as const
type Periodo = (typeof PERIODOS)[number]
const PERIODO_LABEL: Record<Periodo, string> = { semana: "Semana", mes: "Mes", todo: "Todo" }

function esPeriodo(v: unknown): v is Periodo {
  return typeof v === "string" && (PERIODOS as readonly string[]).includes(v)
}

/**
 * Historial de tareas: puntaje por integrante + actividad reciente (quién completó
 * qué y cuándo), filtrable por periodo (semana / mes / todo). Server Component: une
 * los dos orígenes de "completado" —tareas puntuales (agenda_items) y ocurrencias
 * recurrentes (recurring_completions)— que ya guardan completado_por/at. RLS acota
 * al hogar. Se llega desde el cajón lateral (no ocupa una tab del bottom nav).
 */
export default async function HistorialPage({
  searchParams,
}: {
  searchParams: Promise<{ p?: string }>
}) {
  const supabase = await createClient()

  const { p } = await searchParams
  const periodo: Periodo = esPeriodo(p) ? p : "mes"

  const hoy = DateTime.now().setZone(TZ_LOCAL)
  const desde =
    periodo === "semana"
      ? hoy.startOf("week")
      : periodo === "mes"
        ? hoy.startOf("month")
        : DateTime.fromMillis(0, { zone: TZ_LOCAL }) // "todo": sin corte inferior
  const desdeISO = desde.toUTC().toISO()!

  const [{ data: members }, { data: puntualesRaw }, { data: recurrentesRaw }] =
    await Promise.all([
      supabase.from("members").select("id, display_name"),
      supabase
        .from("agenda_items")
        .select("titulo, completado_at, completado_por")
        .eq("completado", true)
        .eq("tipo", "tarea")
        .not("completado_at", "is", null)
        .gte("completado_at", desdeISO),
      supabase
        .from("recurring_completions")
        .select("completado_at, completado_por, recurring_activities(titulo)")
        .not("completado_at", "is", null)
        .gte("completado_at", desdeISO),
    ])

  const eventos: EventoHistorial[] = []
  for (const pt of puntualesRaw ?? []) {
    if (!pt.completado_at) continue
    eventos.push({
      titulo: pt.titulo,
      memberId: pt.completado_por,
      completadoAt: pt.completado_at,
      recurrente: false,
    })
  }
  for (const r of recurrentesRaw ?? []) {
    if (!r.completado_at) continue
    // El embed puede venir como objeto o (según el tipado) arreglo; tomamos el título.
    const rel = r.recurring_activities as { titulo: string } | { titulo: string }[] | null
    const titulo = Array.isArray(rel) ? rel[0]?.titulo : rel?.titulo
    eventos.push({
      titulo: titulo ?? "Actividad recurrente",
      memberId: r.completado_por,
      completadoAt: r.completado_at,
      recurrente: true,
    })
  }

  const nombrePorId = new Map(
    (members ?? []).map((m) => [
      m.id,
      {
        nombre: m.display_name.split(" ")[0],
        inicial: m.display_name.trim().charAt(0).toUpperCase() || "?",
      },
    ]),
  )

  // Puntaje del periodo: todos los integrantes (0 incluido), ordenados por conteo.
  const conteo = contarPorMiembro(eventos, desdeISO)
  const board = (members ?? [])
    .map((m) => ({
      id: m.id,
      nombre: m.display_name.split(" ")[0],
      inicial: m.display_name.trim().charAt(0).toUpperCase() || "?",
      conteo: conteo.get(m.id) ?? 0,
    }))
    .sort((a, b) => b.conteo - a.conteo || a.nombre.localeCompare(b.nombre, "es"))
  const lider = board[0]?.conteo > 0 ? board[0].id : null

  const feed = ordenarRecienteDesc(eventos).slice(0, MAX_FEED)

  const tituloPuntaje =
    periodo === "semana"
      ? "Puntaje de esta semana"
      : periodo === "mes"
        ? `Puntaje de ${capitalizar(hoy.setLocale("es").toFormat("LLLL"))}`
        : "Puntaje de siempre"
  const vacioTxt =
    periodo === "semana"
      ? "Nadie completó actividades esta semana."
      : periodo === "mes"
        ? "Nadie completó actividades este mes."
        : "Cuando alguien complete una actividad, aparece acá con su puntaje."

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-6 px-6 pt-8 pb-28">
      <div className="-mr-1.5 flex items-start justify-between gap-2">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">Historial</h1>
          <p className="text-sm text-muted-foreground">Quién hizo qué en casa.</p>
        </div>
        <AjustesLauncher />
      </div>

      {/* Selector de periodo (siempre visible, aunque el periodo esté vacío). */}
      <div
        role="tablist"
        aria-label="Periodo"
        className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
      >
        {PERIODOS.map((per) => {
          const activo = per === periodo
          return (
            <Link
              key={per}
              href={per === "mes" ? "/historial" : `/historial?p=${per}`}
              role="tab"
              aria-selected={activo}
              className={cn(
                "rounded-lg py-2 text-center text-sm font-medium transition-colors",
                activo
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {PERIODO_LABEL[per]}
            </Link>
          )
        })}
      </div>

      {eventos.length === 0 ? (
        <p className="text-sm text-muted-foreground">{vacioTxt}</p>
      ) : (
        <>
          {/* Puntaje del periodo. */}
          <section className="flex flex-col gap-2">
            <h2 className="flex items-center gap-1.5 px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              <TrophyIcon className="size-3.5" aria-hidden />
              {tituloPuntaje}
            </h2>
            <ul className="flex flex-col gap-1.5">
              {board.map((m) => {
                const esLider = m.id === lider
                return (
                  <li
                    key={m.id}
                    className={cn(
                      "flex items-center gap-3 rounded-xl border px-3 py-2.5",
                      esLider ? "border-accent/50 bg-accent/10" : "border-border",
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-semibold text-primary-foreground">
                      {m.inicial}
                    </span>
                    <span className="flex-1 truncate text-sm font-medium text-foreground">
                      {m.nombre}
                    </span>
                    {esLider && <TrophyIcon className="size-4 text-accent" aria-label="Líder" />}
                    <span className="text-sm font-semibold tabular-nums text-foreground">
                      {m.conteo}
                    </span>
                    <span className="text-xs text-muted-foreground">
                      {m.conteo === 1 ? "actividad" : "actividades"}
                    </span>
                  </li>
                )
              })}
            </ul>
          </section>

          {/* Actividad reciente. */}
          <section className="flex flex-col gap-1">
            <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Actividad
            </h2>
            <ul className="flex flex-col">
              {feed.map((e, i) => {
                const quien = e.memberId ? nombrePorId.get(e.memberId) : undefined
                return (
                  <li
                    key={`${e.completadoAt}-${i}`}
                    className={cn(
                      "flex items-center gap-3 py-2.5",
                      i > 0 && "border-t border-border/60",
                    )}
                  >
                    <span className="flex size-8 shrink-0 items-center justify-center rounded-full bg-muted text-xs font-semibold text-foreground">
                      {quien?.inicial ?? "?"}
                    </span>
                    <div className="flex min-w-0 flex-1 flex-col gap-0.5">
                      <span className="truncate text-sm text-foreground">
                        <span className="font-medium">{quien?.nombre ?? "Alguien"}</span> completó{" "}
                        <span className="text-muted-foreground">{e.titulo}</span>
                      </span>
                      <span className="flex items-center gap-1 text-xs text-muted-foreground">
                        {e.recurrente && (
                          <RepeatIcon className="size-3 shrink-0" aria-label="Recurrente" />
                        )}
                        {etiquetaMomento(e.completadoAt, hoy)}
                      </span>
                    </div>
                  </li>
                )
              })}
            </ul>
          </section>
        </>
      )}
    </main>
  )
}

/** "hoy 14:30" / "ayer 09:10" / "lun 20 jul" según cuán reciente sea. */
function etiquetaMomento(iso: string, hoy: DateTime): string {
  const dt = DateTime.fromISO(iso).setZone(TZ_LOCAL)
  const dias = Math.round(hoy.startOf("day").diff(dt.startOf("day"), "days").days)
  if (dias <= 0) return `hoy ${dt.toFormat("HH:mm")}`
  if (dias === 1) return `ayer ${dt.toFormat("HH:mm")}`
  return capitalizar(dt.setLocale("es").toFormat("ccc d LLL")).replace(".", "")
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
