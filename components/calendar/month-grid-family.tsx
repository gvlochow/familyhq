import type {
  GrillaMesFamilia,
  MiembroDia,
} from "@/lib/availability/mes-familia"
import type { AgendaItem } from "@/lib/agenda/tipos"
import { COLOR_CATEGORIA_DEFECTO, hexCategoria } from "@/lib/agenda/categorias"
import { LETRAS_DIA } from "@/lib/availability/dias"
import { LeyendaCalendario } from "./leyenda-calendario"
import { cn } from "@/lib/utils"

/** Máximo de puntos de categoría en una celda (superpuestos para no llenar el box). */
const MAX_PUNTOS = 4

/**
 * Colores (hex) de las categorías presentes en la agenda de un día: uno por categoría
 * distinta, más el gris neutro si hay ítems sin categoría. Acotado a MAX_PUNTOS.
 */
function coloresAgenda(items: AgendaItem[]): string[] {
  const claves = new Set<string>()
  let hayNeutro = false
  for (const it of items) {
    if (it.categoria) claves.add(it.categoria.color)
    else hayNeutro = true
  }
  const cols = [...claves].sort().map(hexCategoria)
  if (hayNeutro) cols.push(hexCategoria(COLOR_CATEGORIA_DEFECTO))
  return cols.slice(0, MAX_PUNTOS)
}

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
  agendaPorDia,
  onDiaClick,
  hayVariable = true,
  ocultarSimbologia = false,
}: {
  grilla: GrillaMesFamilia
  miembros: { id: string; inicial: string; nombre: string }[]
  agendaPorDia?: Record<string, AgendaItem[]>
  onDiaClick?: (fecha: string) => void
  /** ¿Hay algún integrante variable? Si no, "Blanco" nunca ocurre y se oculta de la leyenda. */
  hayVariable?: boolean
  /** Preferencia del hogar: la leyenda arranca oculta (el "?" la muestra). */
  ocultarSimbologia?: boolean
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
          const colores = coloresAgenda(agendaPorDia?.[d.fecha] ?? [])

          return (
            <button
              key={d.fecha}
              type="button"
              onClick={() => onDiaClick?.(d.fecha)}
              aria-label={colores.length > 0 ? `Ver el ${d.dia} (con agenda)` : `Ver el ${d.dia}`}
              className={cn(
                "flex aspect-square flex-col gap-0.5 rounded-md p-1 text-left transition-colors hover:bg-muted/60",
                d.esHoy ? "ring-2 ring-primary/50" : "ring-1 ring-border/60",
              )}
            >
              <span className="flex items-center gap-0.5">
                {colores.length > 0 && (
                  <span className="flex -space-x-1">
                    {colores.map((hex, i) => (
                      <span
                        key={i}
                        className="size-2 rounded-full ring-1 ring-background"
                        style={{ backgroundColor: hex }}
                        aria-hidden
                      />
                    ))}
                  </span>
                )}
                <span
                  className={cn(
                    "ml-auto text-xs tabular-nums",
                    d.esHoy ? "font-semibold text-primary" : "text-foreground",
                  )}
                >
                  {d.dia}
                </span>
              </span>
              {fuera.length > 0 && (
                <span className="mt-auto flex flex-wrap gap-0.5">
                  {visibles.map((m) => {
                    const esParcial = m.estado === "fuera" && m.parcial
                    return (
                      <span
                        key={m.id}
                        title={`${m.nombre}: ${
                          m.estado === "fuera"
                            ? m.parcial
                              ? "parte del día fuera"
                              : "fuera"
                            : "por confirmar"
                        }`}
                        className={cn(
                          "flex size-4 items-center justify-center rounded text-[9px] font-semibold",
                          esParcial
                            ? "border border-primary text-primary"
                            : INDICADOR[m.estado!],
                        )}
                      >
                        {m.inicial}
                      </span>
                    )
                  })}
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

      <LeyendaCalendario
        miembros={miembros}
        hayVariable={hayVariable}
        ocultarSimbologia={ocultarSimbologia}
      />
    </div>
  )
}
