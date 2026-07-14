"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import { XIcon } from "lucide-react"

import { TZ_LOCAL } from "@/lib/roster/types"
import { TIPOS_AGENDA, type TipoAgenda } from "@/lib/agenda/tipos"
import { crearAgendaItem } from "@/app/(app)/tareas/actions"
import { cn } from "@/lib/utils"

const ETIQUETA: Record<TipoAgenda, string> = { tarea: "Tarea", evento: "Evento" }

/**
 * Hoja inferior para crear una tarea o evento puntual. Se monta SOLO cuando está
 * abierta (el padre hace `{abierto && <AgendaSheet .../>}`), así el estado del
 * formulario arranca fresco en cada apertura sin un efecto de reset. La usan la tab
 * Tareas y el "+" del Inicio. Al guardar hace router.refresh para que la vista
 * server (feed / lista) se actualice.
 */
export function AgendaSheet({ onClose }: { onClose: () => void }) {
  const router = useRouter()
  const [tipo, setTipo] = useState<TipoAgenda>("tarea")
  const [titulo, setTitulo] = useState("")
  const [fecha, setFecha] = useState(() => DateTime.now().setZone(TZ_LOCAL).toISODate()!)
  const [hora, setHora] = useState("")
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)
    const res = await crearAgendaItem({ tipo, titulo, fecha, hora: hora || null })
    setGuardando(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label="Nueva tarea o evento">
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]" />

      <form
        onSubmit={guardar}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-t-2xl bg-card px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" aria-hidden />

        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">Agregar</h2>
          <button type="button" onClick={onClose} aria-label="Cerrar" className="-mr-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted">
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Tipo. */}
        <fieldset className="flex gap-2">
          <legend className="sr-only">Tipo</legend>
          {TIPOS_AGENDA.map((t) => (
            <button
              key={t}
              type="button"
              onClick={() => setTipo(t)}
              aria-pressed={tipo === t}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                tipo === t
                  ? "border-primary bg-primary/5 text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {ETIQUETA[t]}
            </button>
          ))}
        </fieldset>

        <label className="flex flex-col gap-1">
          <span className="text-sm font-medium text-foreground">Título</span>
          <input
            value={titulo}
            onChange={(e) => setTitulo(e.target.value)}
            placeholder={tipo === "tarea" ? "Pagar cuenta de luz" : "Reunión de apoderados"}
            autoFocus
            className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
          />
        </label>

        <div className="flex gap-3">
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{tipo === "tarea" ? "Vence" : "Fecha"}</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
          <label className="flex flex-1 flex-col gap-1">
            <span className="text-sm font-medium text-foreground">
              Hora <span className="text-muted-foreground">(opcional)</span>
            </span>
            <input
              type="time"
              value={hora}
              onChange={(e) => setHora(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        </div>

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={guardando || !titulo.trim()}
          className="flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>
      </form>
    </div>
  )
}
