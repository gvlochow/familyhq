"use client"

import { useEffect, useState } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import { XIcon } from "lucide-react"

import { TZ_LOCAL } from "@/lib/roster/types"
import {
  TIPOS_AGENDA,
  type AgendaItem,
  type MiembroRef,
  type TipoAgenda,
} from "@/lib/agenda/tipos"
import type { Recurrencia } from "@/lib/agenda/recurrencia"
import type { CategoriaRef } from "@/lib/agenda/categorias"
import {
  crearAgendaItem,
  crearActividadRecurrente,
  editarAgendaItem,
  editarActividadRecurrente,
} from "@/app/(app)/tareas/actions"
import { CategoriaPicker } from "./categoria-picker"
import { cn } from "@/lib/utils"

const ETIQUETA: Record<TipoAgenda, string> = { tarea: "Tarea", evento: "Evento" }

/** Patrón de repetición elegible en el formulario. */
type Patron = "mensual" | "semanal"
/** Días de la semana en orden lunes→domingo (ISO 1..7) con su inicial. */
const DIAS_SEMANA: { iso: number; letra: string }[] = [
  { iso: 1, letra: "L" },
  { iso: 2, letra: "M" },
  { iso: 3, letra: "X" },
  { iso: 4, letra: "J" },
  { iso: 5, letra: "V" },
  { iso: 6, letra: "S" },
  { iso: 7, letra: "D" },
]

/**
 * Hoja inferior para crear una tarea o evento puntual. Se monta SOLO cuando está
 * abierta (el padre hace `{abierto && <AgendaSheet .../>}`), así el estado del
 * formulario arranca fresco en cada apertura sin un efecto de reset. La usan la tab
 * Tareas y el "+" del Inicio. Al guardar hace router.refresh para que la vista
 * server (feed / lista) se actualice.
 */
export function AgendaSheet({
  miembros,
  categorias,
  agregadoPor,
  editar,
  onClose,
}: {
  miembros: MiembroRef[]
  categorias: CategoriaRef[]
  agregadoPor: string | null
  /** Item a editar. Si está presente, la hoja es de EDICIÓN (prellena y actualiza). */
  editar?: AgendaItem
  onClose: () => void
}) {
  const router = useRouter()
  const esEdicion = !!editar
  const rec = editar?.recurrencia
  const [tipo, setTipo] = useState<TipoAgenda>(editar?.tipo ?? "tarea")
  const [titulo, setTitulo] = useState(editar?.titulo ?? "")
  const [fecha, setFecha] = useState(() =>
    editar && !editar.recurrente ? editar.fecha : DateTime.now().setZone(TZ_LOCAL).toISODate()!,
  )
  const [todoElDia, setTodoElDia] = useState(editar ? editar.hora === null : true)
  const [hora, setHora] = useState(editar?.hora ?? "09:00")
  // Hora de término (solo eventos con hora). Vacío = sin término.
  const [horaFin, setHoraFin] = useState(editar?.horaFin ?? "")
  // Opt-in: marcar 'fuera' a los asignados durante el evento.
  const [afectaDisp, setAfectaDisp] = useState(editar?.afectaDisponibilidad ?? false)
  const [asignados, setAsignados] = useState<string[]>(
    editar?.asignados.map((a) => a.id) ?? [],
  )
  const [categoriaId, setCategoriaId] = useState<string | null>(editar?.categoria?.id ?? null)
  // Recurrencia. En edición, el tipo (puntual/recurrente) queda fijo: no se ofrece el toggle.
  const [repite, setRepite] = useState(editar?.recurrente ?? false)
  const [patron, setPatron] = useState<Patron>(rec?.tipo === "dias_semana" ? "semanal" : "mensual")
  const [diaMes, setDiaMes] = useState(rec?.tipo === "dia_mes" ? rec.dia : 1)
  const [diasSemana, setDiasSemana] = useState<number[]>(rec?.tipo === "dias_semana" ? rec.dias : [])
  const [fechaFin, setFechaFin] = useState(editar?.recurrenteFechaFin ?? "")
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const toggleAsignado = (id: string) =>
    setAsignados((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  const toggleDiaSemana = (iso: number) =>
    setDiasSemana((prev) => (prev.includes(iso) ? prev.filter((x) => x !== iso) : [...prev, iso]))

  const faltanDiasSemana = repite && patron === "semanal" && diasSemana.length === 0
  // "Hasta" solo aplica a eventos con hora; si está y no es posterior al inicio, es inválida.
  const muestraHoraFin = tipo === "evento" && !todoElDia
  const horaFinInvalida = muestraHoraFin && horaFin !== "" && horaFin <= hora
  // El opt-in de disponibilidad necesita una ventana (hora de término válida).
  const afectaSinFin = muestraHoraFin && afectaDisp && (horaFin === "" || horaFinInvalida)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setGuardando(true)
    setError(null)

    const horaFinal = todoElDia ? null : hora
    const horaFinFinal = muestraHoraFin && horaFin !== "" ? horaFin : null
    const afectaFinal = muestraHoraFin && afectaDisp
    const recurrence: Recurrencia =
      patron === "mensual"
        ? { tipo: "dia_mes", dia: diaMes }
        : { tipo: "dias_semana", dias: diasSemana }

    let res: { error?: string }
    if (esEdicion && editar!.recurrente && editar!.recurrenteId) {
      res = await editarActividadRecurrente(editar!.recurrenteId, {
        tipo,
        titulo,
        hora: horaFinal,
        horaFin: horaFinFinal,
        afectaDisponibilidad: afectaFinal,
        recurrence,
        asignadoA: asignados,
        fechaFin: fechaFin || null,
        categoriaId,
      })
    } else if (esEdicion) {
      res = await editarAgendaItem(editar!.id, {
        tipo,
        titulo,
        fecha,
        hora: horaFinal,
        horaFin: horaFinFinal,
        afectaDisponibilidad: afectaFinal,
        asignadoA: asignados,
        categoriaId,
      })
    } else if (repite) {
      res = await crearActividadRecurrente({
        tipo,
        titulo,
        hora: horaFinal,
        horaFin: horaFinFinal,
        afectaDisponibilidad: afectaFinal,
        recurrence,
        asignadoA: asignados,
        fechaFin: fechaFin || null,
        categoriaId,
      })
    } else {
      res = await crearAgendaItem({ tipo, titulo, fecha, hora: horaFinal, horaFin: horaFinFinal, afectaDisponibilidad: afectaFinal, asignadoA: asignados, categoriaId })
    }

    setGuardando(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
    onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center" role="dialog" aria-modal="true" aria-label={esEdicion ? "Editar tarea o evento" : "Nueva tarea o evento"}>
      <button type="button" aria-label="Cerrar" onClick={onClose} className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px]" />

      <form
        onSubmit={guardar}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-t-2xl bg-card px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" aria-hidden />

        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            {esEdicion ? "Editar" : "Agregar"}
          </h2>
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

        {esEdicion && editar!.recurrente && (
          <p className="text-xs text-muted-foreground">
            Editas toda la serie recurrente, no solo esta fecha.
          </p>
        )}

        {/* Se repite (recurrencia). En edición el tipo queda fijo (no se puede convertir
            un puntual en recurrente ni viceversa), así que no se ofrece el toggle. */}
        {!esEdicion && (
          <label className="flex items-center gap-2 text-sm text-foreground">
            <input
              type="checkbox"
              checked={repite}
              onChange={(e) => setRepite(e.target.checked)}
              className="size-4 rounded border-border accent-primary"
            />
            Se repite
          </label>
        )}

        {!repite ? (
          <label className="flex flex-col gap-1">
            <span className="text-sm font-medium text-foreground">{tipo === "tarea" ? "Vence" : "Fecha"}</span>
            <input
              type="date"
              value={fecha}
              onChange={(e) => setFecha(e.target.value)}
              className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
            />
          </label>
        ) : (
          <div className="flex flex-col gap-3 rounded-lg border border-border/70 bg-muted/30 p-3">
            <fieldset className="flex gap-2">
              <legend className="sr-only">Cada cuánto</legend>
              {(["mensual", "semanal"] as const).map((p) => (
                <button
                  key={p}
                  type="button"
                  onClick={() => setPatron(p)}
                  aria-pressed={patron === p}
                  className={cn(
                    "flex-1 rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                    patron === p
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border bg-background text-muted-foreground hover:bg-muted",
                  )}
                >
                  {p === "mensual" ? "Cada mes" : "Cada semana"}
                </button>
              ))}
            </fieldset>

            {patron === "mensual" ? (
              <label className="flex items-center justify-between gap-2 text-sm">
                <span className="font-medium text-foreground">Día del mes</span>
                <input
                  type="number"
                  min={1}
                  max={31}
                  value={diaMes}
                  onChange={(e) => setDiaMes(Math.min(31, Math.max(1, Number(e.target.value) || 1)))}
                  className="w-20 rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
            ) : (
              <fieldset className="flex flex-col gap-1.5">
                <legend className="text-sm font-medium text-foreground">Días</legend>
                <div className="flex justify-between gap-1">
                  {DIAS_SEMANA.map((d) => {
                    const activo = diasSemana.includes(d.iso)
                    return (
                      <button
                        key={d.iso}
                        type="button"
                        onClick={() => toggleDiaSemana(d.iso)}
                        aria-pressed={activo}
                        aria-label={`Día ${d.letra}`}
                        className={cn(
                          "flex size-9 items-center justify-center rounded-full border text-sm font-medium transition-colors",
                          activo
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-border bg-background text-muted-foreground hover:bg-muted",
                        )}
                      >
                        {d.letra}
                      </button>
                    )
                  })}
                </div>
              </fieldset>
            )}

            <label className="flex items-center justify-between gap-2 text-sm">
              <span className="font-medium text-foreground">
                Termina <span className="text-muted-foreground">(opcional)</span>
              </span>
              <input
                type="date"
                value={fechaFin}
                onChange={(e) => setFechaFin(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
          </div>
        )}

        <label className="flex items-center gap-2 text-sm text-foreground">
          <input
            type="checkbox"
            checked={todoElDia}
            onChange={(e) => setTodoElDia(e.target.checked)}
            className="size-4 rounded border-border accent-primary"
          />
          Todo el día
        </label>

        {!todoElDia && (
          <div className="flex gap-3">
            <label className="flex flex-1 flex-col gap-1">
              <span className="text-sm font-medium text-foreground">
                {muestraHoraFin ? "Desde" : "Hora"}
              </span>
              <input
                type="time"
                value={hora}
                onChange={(e) => setHora(e.target.value)}
                className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
              />
            </label>
            {muestraHoraFin && (
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-sm font-medium text-foreground">
                  Hasta <span className="text-muted-foreground">(opcional)</span>
                </span>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  aria-invalid={horaFinInvalida}
                  className={cn(
                    "rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                    horaFinInvalida ? "border-destructive" : "border-border",
                  )}
                />
              </label>
            )}
          </div>
        )}

        {horaFinInvalida && (
          <p className="text-sm text-destructive">
            La hora de término debe ser posterior al inicio.
          </p>
        )}

        {/* Asignar a integrantes (opcional). */}
        {miembros.length > 0 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">Asignar a</legend>
            <div className="flex flex-wrap gap-2">
              {miembros.map((m) => {
                const activo = asignados.includes(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleAsignado(m.id)}
                    aria-pressed={activo}
                    className={cn(
                      "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors",
                      activo
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    <span
                      className={cn(
                        "flex size-5 items-center justify-center rounded-full text-[10px] font-semibold",
                        activo ? "bg-primary text-primary-foreground" : "bg-muted text-foreground",
                      )}
                    >
                      {m.inicial}
                    </span>
                    {m.nombre}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {/* Opt-in: el evento marca 'fuera' a sus asignados durante su ventana. */}
        {muestraHoraFin && (
          <div className="flex flex-col gap-1">
            <label className="flex items-center gap-2 text-sm text-foreground">
              <input
                type="checkbox"
                checked={afectaDisp}
                onChange={(e) => setAfectaDisp(e.target.checked)}
                className="size-4 rounded border-border accent-primary"
              />
              Marcar “fuera” a los asignados durante el evento
            </label>
            {afectaDisp && (horaFin === "" || horaFinInvalida) && (
              <p className="text-xs text-destructive">
                Necesita una hora de término válida para definir el rango.
              </p>
            )}
            {afectaDisp && asignados.length === 0 && (
              <p className="text-xs text-muted-foreground">
                Asigna al menos un integrante para que tenga efecto.
              </p>
            )}
          </div>
        )}

        {/* Categoría (opcional). */}
        <CategoriaPicker categorias={categorias} value={categoriaId} onChange={setCategoriaId} />

        {error && <p className="text-sm text-destructive">{error}</p>}

        {!esEdicion && agregadoPor && (
          <p className="text-xs text-muted-foreground">Lo agregas tú ({agregadoPor}).</p>
        )}

        <button
          type="submit"
          disabled={guardando || !titulo.trim() || faltanDiasSemana || horaFinInvalida || afectaSinFin}
          className="flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : esEdicion ? "Guardar cambios" : "Guardar"}
        </button>
      </form>
    </div>
  )
}
