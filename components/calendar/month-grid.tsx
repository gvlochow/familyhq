import type { GrillaMes } from "@/lib/availability/mes"
import type { EstadoDisponibilidad } from "@/lib/availability/panel"
import { ESTADO_META } from "@/components/availability/estado-meta"
import { cn } from "@/lib/utils"

const CABECERA = ["L", "M", "M", "J", "V", "S", "D"]

// Orden de la leyenda (mismo criterio de prioridad del clasificador).
const LEYENDA: EstadoDisponibilidad[] = [
  "fuera",
  "standby_casa",
  "por_confirmar",
  "en_casa",
]

/** Grilla mensual: una celda por día, coloreada por estado. Con leyenda. */
export function MonthGrid({ grilla }: { grilla: GrillaMes }) {
  return (
    <div className="flex flex-col gap-3">
      <div className="grid grid-cols-7 gap-1">
        {CABECERA.map((letra, i) => (
          <span
            key={i}
            className="pb-1 text-center text-[11px] font-medium text-muted-foreground"
          >
            {letra}
          </span>
        ))}

        {grilla.dias.map((d) => {
          // Días de relleno (mes vecino): atenuados, sin color de estado.
          if (!d.delMes) {
            return (
              <span
                key={d.fecha}
                className="flex aspect-square items-center justify-center rounded-md text-sm tabular-nums text-muted-foreground/40"
              >
                {d.dia}
              </span>
            )
          }
          const clase = d.estado
            ? ESTADO_META[d.estado].chipClass
            : "bg-muted/50 text-foreground"
          return (
            <span
              key={d.fecha}
              title={d.estado ? ESTADO_META[d.estado].label : "Sin información"}
              className={cn(
                "flex aspect-square items-center justify-center rounded-md text-sm font-medium tabular-nums",
                clase,
                d.esHoy && "ring-2 ring-foreground/40",
              )}
            >
              {d.dia}
            </span>
          )
        })}
      </div>

      {/* Leyenda: tres tratamientos + en casa. */}
      <ul className="flex flex-wrap gap-x-4 gap-y-1.5">
        {LEYENDA.map((estado) => (
          <li key={estado} className="flex items-center gap-1.5">
            <span
              className={cn(
                "size-3 shrink-0 rounded-sm",
                ESTADO_META[estado].chipClass,
              )}
              aria-hidden
            />
            <span className="text-xs text-muted-foreground">
              {ESTADO_META[estado].label}
            </span>
          </li>
        ))}
      </ul>
    </div>
  )
}
