"use client"

import { useEffect } from "react"
import { DateTime } from "luxon"
import { XIcon } from "lucide-react"

import { TZ_LOCAL } from "@/lib/roster/types"
import type { EstadoDisponibilidad } from "@/lib/availability/estado"
import { detalleDelDia, fraseFuera } from "@/lib/availability/dia-detalle"
import type { MiembroCalendario } from "@/lib/availability/mes-familia"
import { ESTADO_META } from "@/components/availability/estado-meta"
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
  onClose,
}: {
  fecha: string
  miembros: MiembroCalendario[]
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
      </div>
    </div>
  )
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
