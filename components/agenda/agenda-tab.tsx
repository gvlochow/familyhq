"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import {
  CalendarIcon,
  CircleIcon,
  CircleCheckIcon,
  PlusIcon,
  RepeatIcon,
  Trash2Icon,
} from "lucide-react"

import { TZ_LOCAL } from "@/lib/roster/types"
import type { AgendaItem, MiembroRef } from "@/lib/agenda/tipos"
import { etiquetaCuando } from "@/lib/availability/formato"
import {
  marcarCompletado,
  eliminarAgendaItem,
  marcarOcurrenciaRecurrente,
  eliminarActividadRecurrente,
} from "@/app/(app)/tareas/actions"
import { AsignadosChips } from "./asignados-chips"
import { AgendaSheet } from "./agenda-sheet"
import { cn } from "@/lib/utils"

/** Instante ISO de un item (fecha + hora, o inicio del día) para formatear el "cuándo". */
function cuandoISO(item: AgendaItem): string {
  const base = DateTime.fromISO(item.fecha, { zone: TZ_LOCAL }).startOf("day")
  if (!item.hora) return base.toISO()!
  const [h, m] = item.hora.split(":").map(Number)
  return base.set({ hour: h, minute: m }).toISO()!
}

export function AgendaTab({
  items,
  nowISO,
  miembros,
  agregadoPor,
}: {
  items: AgendaItem[]
  nowISO: string
  miembros: MiembroRef[]
  agregadoPor: string | null
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<AgendaItem | null>(null)
  const [pendiente, startTransition] = useTransition()

  const pendientes = items.filter((i) => !(i.tipo === "tarea" && i.completado))
  const hechas = items.filter((i) => i.tipo === "tarea" && i.completado)

  function toggle(item: AgendaItem) {
    startTransition(async () => {
      if (item.recurrente && item.recurrenteId) {
        await marcarOcurrenciaRecurrente(item.recurrenteId, item.fecha, !item.completado)
      } else {
        await marcarCompletado(item.id, !item.completado)
      }
      router.refresh()
    })
  }
  function borrar(item: AgendaItem) {
    // Una ocurrencia recurrente no se borra sola: se elimina la regla completa.
    if (item.recurrente && item.recurrenteId) {
      if (!confirm(`¿Eliminar la actividad recurrente "${item.titulo}"? Dejará de repetirse.`)) return
      startTransition(async () => {
        await eliminarActividadRecurrente(item.recurrenteId!)
        router.refresh()
      })
      return
    }
    startTransition(async () => {
      await eliminarAgendaItem(item.id)
      router.refresh()
    })
  }

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        className="flex h-11 items-center justify-center gap-2 rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95"
      >
        <PlusIcon className="size-5" aria-hidden />
        Agregar tarea o evento
      </button>

      {pendientes.length === 0 && hechas.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          Nada agendado todavía. Agrega la primera tarea o evento.
        </p>
      ) : (
        <ul className={cn("flex flex-col", pendiente && "opacity-60")}>
          {pendientes.map((item, i) => (
            <Fila key={item.id} item={item} nowISO={nowISO} borde={i > 0} onToggle={toggle} onEditar={setEditando} onBorrar={borrar} />
          ))}
        </ul>
      )}

      {hechas.length > 0 && (
        <div className="mt-4 flex flex-col gap-1">
          <h2 className="px-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
            Hechas
          </h2>
          <ul className={cn("flex flex-col", pendiente && "opacity-60")}>
            {hechas.map((item, i) => (
              <Fila key={item.id} item={item} nowISO={nowISO} borde={i > 0} onToggle={toggle} onEditar={setEditando} onBorrar={borrar} />
            ))}
          </ul>
        </div>
      )}

      {editando && (
        <AgendaSheet
          miembros={miembros}
          agregadoPor={agregadoPor}
          editar={editando}
          onClose={() => setEditando(null)}
        />
      )}

      {abierto && (
        <AgendaSheet
          miembros={miembros}
          agregadoPor={agregadoPor}
          onClose={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function Fila({
  item,
  nowISO,
  borde,
  onToggle,
  onEditar,
  onBorrar,
}: {
  item: AgendaItem
  nowISO: string
  borde: boolean
  onToggle: (i: AgendaItem) => void
  onEditar: (i: AgendaItem) => void
  onBorrar: (i: AgendaItem) => void
}) {
  const esTarea = item.tipo === "tarea"
  const etiqueta = etiquetaCuando(cuandoISO(item), nowISO, item.hora !== null)
  const cuando = esTarea ? `Vence ${etiqueta.toLowerCase()}` : etiqueta

  return (
    <li className={cn("flex items-center gap-3 py-2.5", borde && "border-t border-border/60")}>
      {esTarea ? (
        <button
          type="button"
          onClick={() => onToggle(item)}
          aria-label={item.completado ? "Marcar pendiente" : "Marcar hecha"}
          className={cn("shrink-0", item.completado ? "text-secondary-foreground" : "text-muted-foreground hover:text-foreground")}
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
        <span className={cn("flex items-center gap-1.5 text-sm font-medium text-foreground", item.completado && "text-muted-foreground line-through")}>
          {item.recurrente && <RepeatIcon className="size-3.5 shrink-0 text-muted-foreground" aria-label="Se repite" />}
          <span className="truncate">{item.titulo}</span>
        </span>
        <span className="truncate text-xs text-muted-foreground">
          {cuando}
          {item.recurrente && item.recurrenciaResumen && (
            <span className="text-muted-foreground/70"> · {item.recurrenciaResumen}</span>
          )}
          {item.agregadoPor && <span className="text-muted-foreground/70"> · por {item.agregadoPor}</span>}
        </span>
      </button>

      <AsignadosChips asignados={item.asignados} />

      <button
        type="button"
        onClick={() => onBorrar(item)}
        aria-label={item.recurrente ? "Eliminar actividad recurrente" : "Eliminar"}
        className="shrink-0 text-muted-foreground/60 transition-colors hover:text-destructive"
      >
        <Trash2Icon className="size-4" />
      </button>
    </li>
  )
}
