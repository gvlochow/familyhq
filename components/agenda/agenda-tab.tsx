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
import type { CategoriaRef } from "@/lib/agenda/categorias"
import { etiquetaCuando } from "@/lib/availability/formato"
import {
  marcarCompletado,
  eliminarAgendaItem,
  marcarOcurrenciaRecurrente,
  eliminarActividadRecurrente,
  omitirOcurrenciaRecurrente,
} from "@/app/(app)/tareas/actions"
import { AsignadosChips } from "./asignados-chips"
import { CategoriaChip } from "./categoria-chip"
import { AgendaSheet } from "./agenda-sheet"
import { EliminarRecurrenteDialog } from "./eliminar-recurrente-dialog"
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
  categorias,
  agregadoPor,
  mostrarCategoria,
}: {
  items: AgendaItem[]
  nowISO: string
  miembros: MiembroRef[]
  categorias: CategoriaRef[]
  agregadoPor: string | null
  mostrarCategoria: boolean
}) {
  const router = useRouter()
  const [abierto, setAbierto] = useState(false)
  const [editando, setEditando] = useState<AgendaItem | null>(null)
  const [borrarRec, setBorrarRec] = useState<AgendaItem | null>(null)
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
    // Una ocurrencia recurrente ofrece elegir: omitir solo esta o borrar la regla.
    if (item.recurrente && item.recurrenteId) {
      setBorrarRec(item)
      return
    }
    startTransition(async () => {
      await eliminarAgendaItem(item.id)
      router.refresh()
    })
  }

  function omitirOcurrencia(item: AgendaItem) {
    setBorrarRec(null)
    if (!item.recurrenteId) return
    startTransition(async () => {
      await omitirOcurrenciaRecurrente(item.recurrenteId!, item.fecha)
      router.refresh()
    })
  }

  function eliminarRegla(item: AgendaItem) {
    setBorrarRec(null)
    if (!item.recurrenteId) return
    startTransition(async () => {
      await eliminarActividadRecurrente(item.recurrenteId!)
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
            <Fila key={item.id} item={item} nowISO={nowISO} borde={i > 0} mostrarCategoria={mostrarCategoria} onToggle={toggle} onEditar={setEditando} onBorrar={borrar} />
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
              <Fila key={item.id} item={item} nowISO={nowISO} borde={i > 0} mostrarCategoria={mostrarCategoria} onToggle={toggle} onEditar={setEditando} onBorrar={borrar} />
            ))}
          </ul>
        </div>
      )}

      {editando && (
        <AgendaSheet
          miembros={miembros}
          categorias={categorias}
          agregadoPor={agregadoPor}
          editar={editando}
          onClose={() => setEditando(null)}
        />
      )}

      {abierto && (
        <AgendaSheet
          miembros={miembros}
          categorias={categorias}
          agregadoPor={agregadoPor}
          onClose={() => setAbierto(false)}
        />
      )}

      {borrarRec && (
        <EliminarRecurrenteDialog
          item={borrarRec}
          onOmitir={() => omitirOcurrencia(borrarRec)}
          onEliminarTodo={() => eliminarRegla(borrarRec)}
          onClose={() => setBorrarRec(null)}
        />
      )}
    </>
  )
}

function Fila({
  item,
  nowISO,
  borde,
  mostrarCategoria,
  onToggle,
  onEditar,
  onBorrar,
}: {
  item: AgendaItem
  nowISO: string
  borde: boolean
  mostrarCategoria: boolean
  onToggle: (i: AgendaItem) => void
  onEditar: (i: AgendaItem) => void
  onBorrar: (i: AgendaItem) => void
}) {
  const esTarea = item.tipo === "tarea"
  let etiqueta = etiquetaCuando(cuandoISO(item), nowISO, item.hora !== null)
  // Evento con término: muestra el rango cuando la etiqueta ya incluye la hora de
  // inicio (fechas cercanas; en las lejanas se lee solo la fecha, sin hora).
  if (!esTarea && item.horaFin && item.hora && etiqueta.endsWith(item.hora)) {
    etiqueta = `${etiqueta}–${item.horaFin}`
  }
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
        <span className="flex items-center gap-1 truncate text-xs text-muted-foreground">
          {item.categoria && (
            <CategoriaChip categoria={item.categoria} conNombre={mostrarCategoria} className="text-muted-foreground/80" />
          )}
          {item.categoria && <span className="text-muted-foreground/50">·</span>}
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
