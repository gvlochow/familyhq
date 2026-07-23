"use client"

import { useEffect, useMemo, useState } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import { XIcon } from "lucide-react"

import { TZ_LOCAL } from "@/lib/roster/types"
import {
  ESTADOS_OVERRIDE,
  PRESETS_FIN,
  PRESET_LABEL,
  intervaloDesde,
  intervaloHorario,
  type EstadoOverride,
  type PresetFin,
} from "@/lib/availability/estado-override"
import { ESTADO_META } from "@/components/availability/estado-meta"
import { actualizarEstados, limpiarEstados } from "@/app/(app)/actions"
import { cn } from "@/lib/utils"

/** Integrante cuyo estado el usuario puede editar (él mismo o un perfil administrado). */
export interface MiembroEditable {
  id: string
  nombre: string
  inicial: string
  esTu: boolean
  /** Si su horario es variable (tripulación). Solo estos pueden fijar "Standby". */
  esVariable: boolean
}

/**
 * Hoja inferior "Actualizar estado": el override manual sobre la disponibilidad
 * clasificada. El usuario elige integrante (sí mismo o un perfil que administra),
 * estado y "hasta cuándo"; el inicio es AHORA. Al guardar hace router.refresh para
 * que el Inicio (y el resto de vistas server) recomponga el estado efectivo.
 *
 * Se monta solo cuando está abierta (el padre hace `{abierto && <EstadoSheet/>}`),
 * así arranca fresca sin efecto de reset.
 */
export function EstadoSheet({
  editables,
  onClose,
}: {
  editables: MiembroEditable[]
  onClose: () => void
}) {
  const router = useRouter()
  // "Ahora" se captura al ABRIR el sheet (que solo se monta al tocar el botón), no
  // desde el render server: en una PWA abierta hace rato, la hora del render sería
  // rancia y el intervalo "desde ahora" quedaría en el pasado.
  const [nowISO] = useState(() => DateTime.now().toUTC().toISO()!)
  // Multi-selección: por defecto viene marcado el propio usuario (o el primero).
  const [memberIds, setMemberIds] = useState<Set<string>>(
    () => new Set([(editables.find((m) => m.esTu) ?? editables[0])?.id ?? ""]),
  )
  const [estado, setEstado] = useState<EstadoOverride>("en_casa")
  const [preset, setPreset] = useState<PresetFin>("3h")
  // "ahora" = desde ahora hasta un preset; "horario" = ventana explícita de hoy.
  const [modo, setModo] = useState<"ahora" | "horario">("ahora")
  const [horaInicio, setHoraInicio] = useState(() =>
    DateTime.fromISO(nowISO).setZone(TZ_LOCAL).toFormat("HH:mm"),
  )
  const [horaFin, setHoraFin] = useState(() =>
    DateTime.fromISO(nowISO).setZone(TZ_LOCAL).plus({ hours: 1 }).toFormat("HH:mm"),
  )
  const [error, setError] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const fechaHoy = DateTime.fromISO(nowISO).setZone(TZ_LOCAL).toISODate()!
  const horarioInvalido = modo === "horario" && horaFin <= horaInicio

  const seleccionados = editables.filter((m) => memberIds.has(m.id))
  const hastaTexto = useMemo(() => describirFin(preset, nowISO), [preset, nowISO])

  function alternar(id: string) {
    setMemberIds((prev) => {
      const next = new Set(prev)
      if (next.has(id)) {
        if (next.size === 1) return prev // no dejar la selección vacía
        next.delete(id)
      } else {
        next.add(id)
      }
      return next
    })
  }

  // "Standby en casa" es un concepto de tripulación (rol variable): solo se ofrece
  // si TODOS los seleccionados son variables. El resto vale para cualquiera.
  const estadosDisponibles = ESTADOS_OVERRIDE.filter(
    (e) =>
      e !== "standby_casa" ||
      (seleccionados.length > 0 && seleccionados.every((m) => m.esVariable)),
  )
  // Estado efectivo: si el elegido dejó de estar disponible al cambiar de integrante
  // (standby en un fijo), cae a "en casa". Derivado en el render, sin efecto.
  const estadoEfectivo: EstadoOverride = (estadosDisponibles as readonly string[]).includes(estado)
    ? estado
    : "en_casa"

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (memberIds.size === 0) return
    if (horarioInvalido) {
      setError("El término debe ser posterior al inicio.")
      return
    }
    setGuardando(true)
    setError(null)
    const { inicioUtc, finUtc } =
      modo === "horario"
        ? intervaloHorario(fechaHoy, horaInicio, horaFin)
        : intervaloDesde(preset, nowISO)
    const res = await actualizarEstados({
      memberIds: [...memberIds],
      estado: estadoEfectivo,
      inicioUtc,
      finUtc,
    })
    setGuardando(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
    onClose()
  }

  async function volverAutomatico() {
    if (memberIds.size === 0) return
    setGuardando(true)
    setError(null)
    const res = await limpiarEstados([...memberIds])
    setGuardando(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
    onClose()
  }

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      role="dialog"
      aria-modal="true"
      aria-label="Actualizar estado"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px] dark:bg-black/60"
      />

      <form
        onSubmit={guardar}
        className="relative flex w-full max-w-sm flex-col gap-4 rounded-t-2xl bg-card px-5 pt-4 pb-[max(1.25rem,env(safe-area-inset-bottom))] shadow-xl"
      >
        <div className="mx-auto h-1 w-10 rounded-full bg-border" aria-hidden />

        <div className="flex items-center justify-between">
          <h2 className="font-heading text-lg font-semibold text-foreground">Actualizar estado</h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Integrantes (multi-selección; solo si hay más de uno editable). */}
        {editables.length > 1 && (
          <fieldset className="flex flex-col gap-2">
            <legend className="text-sm font-medium text-foreground">¿De quiénes?</legend>
            <div className="flex flex-wrap gap-2">
              {editables.map((m) => {
                const activo = memberIds.has(m.id)
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => alternar(m.id)}
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
                    {m.esTu ? "Tú" : m.nombre}
                  </button>
                )
              })}
            </div>
          </fieldset>
        )}

        {/* Estado a fijar. */}
        <fieldset className="flex flex-col gap-2">
          <legend className="text-sm font-medium text-foreground">Estado</legend>
          <div className={cn("grid gap-2", estadosDisponibles.length >= 3 ? "grid-cols-3" : "grid-cols-2")}>
            {estadosDisponibles.map((e) => {
              const meta = ESTADO_META[e]
              const activo = estadoEfectivo === e
              const Icono = meta.Icono
              return (
                <button
                  key={e}
                  type="button"
                  onClick={() => setEstado(e)}
                  aria-pressed={activo}
                  className={cn(
                    "flex flex-col items-center gap-1 rounded-lg border px-2 py-2.5 text-xs font-medium transition-colors",
                    activo
                      ? "border-primary bg-primary/5 text-primary"
                      : "border-border text-muted-foreground hover:bg-muted",
                  )}
                >
                  <Icono className="size-5" aria-hidden />
                  {meta.label}
                </button>
              )
            })}
          </div>
        </fieldset>

        {/* ¿Cuándo? Desde ahora (preset) o una ventana horaria explícita. */}
        <fieldset className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <legend className="text-sm font-medium text-foreground">¿Cuándo?</legend>
            <div className="flex rounded-lg bg-muted p-0.5 text-xs font-medium">
              {(["ahora", "horario"] as const).map((m) => (
                <button
                  key={m}
                  type="button"
                  onClick={() => setModo(m)}
                  aria-pressed={modo === m}
                  className={cn(
                    "rounded-md px-2.5 py-1 transition-colors",
                    modo === m
                      ? "bg-card text-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {m === "ahora" ? "Desde ahora" : "Horario"}
                </button>
              ))}
            </div>
          </div>

          {modo === "ahora" ? (
            <div className="grid grid-cols-2 gap-2">
              {PRESETS_FIN.map((p) => {
                const activo = preset === p
                return (
                  <button
                    key={p}
                    type="button"
                    onClick={() => setPreset(p)}
                    aria-pressed={activo}
                    className={cn(
                      "rounded-lg border px-3 py-2 text-sm font-medium transition-colors",
                      activo
                        ? "border-primary bg-primary/5 text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {PRESET_LABEL[p]}
                  </button>
                )
              })}
            </div>
          ) : (
            <div className="flex items-end gap-2">
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs text-muted-foreground">Desde</span>
                <input
                  type="time"
                  value={horaInicio}
                  onChange={(e) => setHoraInicio(e.target.value)}
                  className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
                />
              </label>
              <label className="flex flex-1 flex-col gap-1">
                <span className="text-xs text-muted-foreground">Hasta</span>
                <input
                  type="time"
                  value={horaFin}
                  onChange={(e) => setHoraFin(e.target.value)}
                  aria-invalid={horarioInvalido}
                  className={cn(
                    "rounded-lg border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring",
                    horarioInvalido ? "border-destructive" : "border-border",
                  )}
                />
              </label>
            </div>
          )}
        </fieldset>

        {seleccionados.length > 0 && !horarioInvalido && (
          <p className="text-sm text-muted-foreground">
            {describirSujeto(seleccionados)}{" "}
            <span className="font-medium text-foreground">
              {ESTADO_META[estadoEfectivo].label.toLowerCase()}
            </span>{" "}
            {modo === "horario" ? `de ${horaInicio} a ${horaFin}` : hastaTexto}.
          </p>
        )}

        {error && <p className="text-sm text-destructive">{error}</p>}

        <button
          type="submit"
          disabled={guardando || memberIds.size === 0 || horarioInvalido}
          className="flex h-11 items-center justify-center rounded-xl bg-primary text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          {guardando ? "Guardando…" : "Guardar"}
        </button>

        <button
          type="button"
          onClick={volverAutomatico}
          disabled={guardando}
          className="text-center text-sm font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-50"
        >
          Volver a lo automático
        </button>
      </form>
    </div>
  )
}

/** Sujeto del preview según cuántos integrantes estén seleccionados. */
function describirSujeto(sel: MiembroEditable[]): string {
  if (sel.length === 1) {
    const m = sel[0]
    return m.esTu ? "Estarás" : `${m.nombre} estará`
  }
  return `${sel.length} integrantes estarán`
}

/** Frase de duración para el preview ("hasta las 18:00", "hasta el final del día"). */
function describirFin(preset: PresetFin, nowISO: string): string {
  const { finUtc } = intervaloDesde(preset, nowISO)
  const fin = DateTime.fromISO(finUtc).setZone(TZ_LOCAL)
  const ahora = DateTime.fromISO(nowISO).setZone(TZ_LOCAL)

  if (preset === "restoDia" || preset === "todoElDia") return "hasta el final del día"

  const mismaFecha = fin.hasSame(ahora, "day")
  const hora = fin.toFormat("HH:mm")
  return mismaFecha ? `hasta las ${hora}` : `hasta mañana a las ${hora}`
}
