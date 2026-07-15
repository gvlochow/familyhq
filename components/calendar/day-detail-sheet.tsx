"use client"

import { useEffect } from "react"
import { DateTime } from "luxon"
import { CalendarIcon, CircleIcon, CircleCheckIcon, RepeatIcon, XIcon } from "lucide-react"

import { TZ_LOCAL } from "@/lib/roster/types"
import type { EstadoDisponibilidad } from "@/lib/availability/estado"
import { detalleDelDia, fraseFuera } from "@/lib/availability/dia-detalle"
import type { MiembroCalendario } from "@/lib/availability/mes-familia"
import type { AgendaItem } from "@/lib/agenda/tipos"
import { ESTADO_META } from "@/components/availability/estado-meta"
import { AsignadosChips } from "@/components/agenda/asignados-chips"
import { CategoriaChip } from "@/components/agenda/categoria-chip"
import { cn } from "@/lib/utils"

/** Color de relleno de la barra por estado. */
const BARRA: Record<EstadoDisponibilidad, string> = {
  fuera: "bg-primary",
  en_casa: "bg-secondary",
  standby_casa: "bg-secondary/60",
  por_confirmar: "bg-accent",
}

/**
 * Hoja inferior con el detalle intra-día de un día: por integrante, una barra de
 * 24h con sus tramos + la frase "Fuera 09:00–18:00". Es el payoff intra-día sobre
 * el calendario. Client component (estado de apertura + Escape/click-fuera).
 */
export function DayDetailSheet({
  fecha,
  miembros,
  agenda,
  onToggle,
  onEditar,
  onClose,
}: {
  fecha: string
  miembros: MiembroCalendario[]
  agenda: AgendaItem[]
  onToggle: (i: AgendaItem) => void
  onEditar: (i: AgendaItem) => void
  onClose: () => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  const detalle = detalleDelDia(miembros, fecha)
  const titulo = capitalizar(
    DateTime.fromISO(fecha, { zone: TZ_LOCAL }).setLocale("es").toFormat("cccc d 'de' LLLL"),
  )

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={`Detalle de ${titulo}`}>
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]"
      />

      <div className="relative flex max-h-[75svh] w-full max-w-sm flex-col gap-4 overflow-y-auto rounded-t-2xl bg-card px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl">
        <div className="mx-auto h-1 w-10 shrink-0 rounded-full bg-border" aria-hidden />

        <div className="flex items-start justify-between gap-2">
          <h2 className="font-heading text-lg font-semibold text-foreground">{titulo}</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
          Quién está en casa
        </h3>
        <ul className="flex flex-col gap-4">
          {detalle.map((m) => {
            const meta = m.resumen ? ESTADO_META[m.resumen] : null
            return (
              <li key={m.id} className="flex flex-col gap-1.5">
                <div className="flex items-center gap-2">
                  <span className="flex size-6 shrink-0 items-center justify-center rounded-md bg-muted text-[11px] font-semibold text-foreground">
                    {m.inicial}
                  </span>
                  <span className="flex-1 truncate text-sm font-semibold text-foreground">
                    {m.nombre}
                  </span>
                  {meta && (
                    <span
                      className={cn(
                        "shrink-0 rounded-full px-2 py-0.5 text-[11px] font-medium",
                        meta.chipClass,
                      )}
                    >
                      {meta.label}
                    </span>
                  )}
                </div>

                {/* Barra de 24h con los tramos del día. */}
                <div className="flex h-3 w-full overflow-hidden rounded-full ring-1 ring-border/60">
                  {m.segmentos.map((s, i) => (
                    <div
                      key={i}
                      title={`${s.inicioHHMM}–${s.finHHMM}`}
                      style={{ width: `${(s.finFrac - s.inicioFrac) * 100}%` }}
                      className={cn(s.estado ? BARRA[s.estado] : "bg-muted")}
                    />
                  ))}
                </div>

                <div className="flex items-center justify-between">
                  <span className="text-xs text-muted-foreground">{fraseFuera(m.segmentos)}</span>
                </div>
              </li>
            )
          })}
        </ul>

        {agenda.length > 0 && (
          <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
            <h3 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Agenda
            </h3>
            <ul className="flex flex-col">
              {agenda.map((item, i) => (
                <AgendaFila
                  key={item.id}
                  item={item}
                  borde={i > 0}
                  onToggle={onToggle}
                  onEditar={onEditar}
                />
              ))}
            </ul>
          </div>
        )}
      </div>
    </div>
  )
}

/** Una tarea/evento del día: la tarea se marca/desmarca; tocar el cuerpo edita. */
function AgendaFila({
  item,
  borde,
  onToggle,
  onEditar,
}: {
  item: AgendaItem
  borde: boolean
  onToggle: (i: AgendaItem) => void
  onEditar: (i: AgendaItem) => void
}) {
  const esTarea = item.tipo === "tarea"
  return (
    <li className={cn("flex items-center gap-3 py-2", borde && "border-t border-border/60")}>
      {esTarea ? (
        <button
          type="button"
          onClick={() => onToggle(item)}
          aria-label={item.completado ? "Marcar pendiente" : "Marcar hecha"}
          className={cn(
            "shrink-0",
            item.completado ? "text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
          )}
        >
          {item.completado ? <CircleCheckIcon className="size-5" /> : <CircleIcon className="size-5" />}
        </button>
      ) : (
        <span className="flex size-5 shrink-0 items-center justify-center text-primary" aria-hidden>
          <CalendarIcon className="size-4" />
        </span>
      )}

      <button
        type="button"
        onClick={() => onEditar(item)}
        aria-label={`Editar ${item.titulo}`}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
      >
        <span
          className={cn(
            "flex items-center gap-1.5 text-sm font-medium text-foreground",
            item.completado && "text-muted-foreground line-through",
          )}
        >
          {item.recurrente && (
            <RepeatIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Se repite" />
          )}
          <span className="truncate">{item.titulo}</span>
        </span>
        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {item.categoria && (
            <>
              <CategoriaChip categoria={item.categoria} conNombre className="text-muted-foreground/80" />
              <span className="text-muted-foreground/50">·</span>
            </>
          )}
          {item.hora ?? "Todo el día"}
          {item.recurrente && item.recurrenciaResumen && (
            <span className="text-muted-foreground/70"> · {item.recurrenciaResumen}</span>
          )}
        </span>
      </button>

      <AsignadosChips asignados={item.asignados} />
    </li>
  )
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
