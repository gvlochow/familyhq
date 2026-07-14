import type {
  GrillaMesFamilia,
  MiembroDia,
} from "@/lib/availability/mes-familia"
import { LETRAS_DIA } from "@/lib/availability/dias"
import { cn } from "@/lib/utils"

/**
 * Grilla mensual FAMILIAR: una celda por día que indica QUIÉN está fuera (o por
 * confirmar) con la inicial del integrante, coloreada por estado. "Todos en casa"
 * = celda tranquila (solo el número). Server component.
 *
 * Muestra solo lo que saca a alguien de casa (fuera / por confirmar); en casa y
 * standby (en casa, llamable) no ponen indicador: el default es estar disponible.
 */

/** Estados que ameritan un indicador en la celda + su color. */
const INDICADOR: Partial<Record<NonNullable<MiembroDia["estado"]>, string>> = {
  fuera: "bg-primary text-primary-foreground",
  por_confirmar: "bg-accent text-accent-foreground",
}

const MAX_CHIPS = 3

export function MonthGridFamily({
  grilla,
  miembros,
  onDiaClick,
}: {
  grilla: GrillaMesFamilia
  miembros: { id: string; inicial: string; nombre: string }[]
  onDiaClick?: (fecha: string) => void
}) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1">
        {LETRAS_DIA.map((letra, i) => (
          <span
            key={i}
            className="pb-1 text-center text-[11px] font-medium text-muted-foreground"
          >
            {letra}
          </span>
        ))}

        {grilla.dias.map((d) => {
          if (!d.delMes) {
            return (
              <span
                key={d.fecha}
                className="flex aspect-square items-start justify-end p-1 text-xs tabular-nums text-muted-foreground/40"
              >
                {d.dia}
              </span>
            )
          }

          const fuera = d.miembros.filter((m) => m.estado && m.estado in INDICADOR)
          const visibles = fuera.slice(0, MAX_CHIPS)
          const resto = fuera.length - visibles.length

          return (
            <button
              key={d.fecha}
              type="button"
              onClick={() => onDiaClick?.(d.fecha)}
              aria-label={`Ver el ${d.dia}`}
              className={cn(
                "flex aspect-square flex-col gap-0.5 rounded-md p-1 text-left transition-colors hover:bg-muted/60",
                d.esHoy ? "ring-2 ring-primary/50" : "ring-1 ring-border/60",
              )}
            >
              <span
                className={cn(
                  "text-right text-xs tabular-nums",
                  d.esHoy ? "font-semibold text-primary" : "text-foreground",
                )}
              >
                {d.dia}
              </span>
              {fuera.length > 0 && (
                <span className="mt-auto flex flex-wrap gap-0.5">
                  {visibles.map((m) => (
                    <span
                      key={m.id}
                      title={`${m.nombre}: ${m.estado === "fuera" ? "fuera" : "por confirmar"}`}
                      className={cn(
                        "flex size-4 items-center justify-center rounded text-[9px] font-semibold",
                        INDICADOR[m.estado!],
                      )}
                    >
                      {m.inicial}
                    </span>
                  ))}
                  {resto > 0 && (
                    <span className="flex size-4 items-center justify-center rounded bg-muted text-[9px] font-semibold text-muted-foreground">
                      +{resto}
                    </span>
                  )}
                </span>
              )}
            </button>
          )
        })}
      </div>

      {/* Leyenda: quién es cada inicial + qué significa el color. */}
      <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
        <ul className="flex flex-wrap gap-x-3 gap-y-1.5">
          {miembros.map((m) => (
            <li key={m.id} className="flex items-center gap-1.5">
              <span className="flex size-4 items-center justify-center rounded bg-muted text-[9px] font-semibold text-foreground">
                {m.inicial}
              </span>
              <span className="text-xs text-muted-foreground">{m.nombre}</span>
            </li>
          ))}
        </ul>
        <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-primary" aria-hidden />
            <span className="text-xs text-muted-foreground">Fuera</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-accent" aria-hidden />
            <span className="text-xs text-muted-foreground">Por confirmar</span>
          </li>
          <li className="flex items-center gap-1.5">
            <span className="size-3 rounded-sm bg-secondary/60" aria-hidden />
            <span className="text-xs text-muted-foreground">En casa (sin marca)</span>
          </li>
        </ul>
      </div>
    </div>
  )
}
