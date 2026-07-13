import { HouseIcon, PlaneIcon } from "lucide-react"

import type { CambioDisponibilidad } from "@/lib/availability/proximo"
import { etiquetaCuando } from "@/lib/availability/formato"
import { cn } from "@/lib/utils"

/**
 * Feed "Próximo en la casa": los próximos cambios de disponibilidad de la familia,
 * estilo forecast. Server component. Por ahora solo trae disponibilidad (llega /
 * sale); tareas y eventos se sumarán a esta misma lista cuando existan.
 */
export function ProximoList({
  items,
  nowISO,
}: {
  items: CambioDisponibilidad[]
  nowISO: string
}) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="px-1 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Próximo en la casa
      </h2>

      {items.length === 0 ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">
          Sin cambios de disponibilidad esta semana.
        </p>
      ) : (
        <ul className="flex flex-col">
          {items.map((c, i) => {
            const llega = c.tipo === "llega"
            const Icono = llega ? HouseIcon : PlaneIcon
            return (
              <li
                key={`${c.miembroId}-${c.cuando}`}
                className={cn(
                  "flex items-center gap-3 py-2.5",
                  i > 0 && "border-t border-border/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    llega
                      ? "bg-secondary/50 text-secondary-foreground"
                      : "bg-muted text-muted-foreground",
                  )}
                  aria-hidden
                >
                  <Icono className="size-5" />
                </span>
                <span className="flex-1 truncate text-sm font-medium text-foreground">
                  {c.miembro} {llega ? "llega" : "sale"}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {etiquetaCuando(c.cuando, nowISO)}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
