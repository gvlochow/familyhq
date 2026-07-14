import {
  CalendarIcon,
  CircleIcon,
  HouseIcon,
  PlaneIcon,
} from "lucide-react"

import type { FilaFeed } from "@/lib/agenda/feed"
import { etiquetaCuando } from "@/lib/availability/formato"
import { cn } from "@/lib/utils"

/**
 * Feed "Próximo en la casa": cambios de disponibilidad + tareas/eventos de la
 * agenda, ya mezclados y ordenados por cuándo (construirFeed). Server component.
 */
export function ProximoList({ filas, nowISO }: { filas: FilaFeed[]; nowISO: string }) {
  return (
    <section className="flex flex-col gap-1">
      <h2 className="px-1 pb-1 text-xs font-semibold tracking-wide text-muted-foreground uppercase">
        Próximo en la casa
      </h2>

      {filas.length === 0 ? (
        <p className="px-1 py-2 text-sm text-muted-foreground">
          Nada a la vista esta semana.
        </p>
      ) : (
        <ul className="flex flex-col">
          {filas.map((f, i) => {
            const p = presentacion(f)
            return (
              <li
                key={f.clave}
                className={cn(
                  "flex items-center gap-3 py-2.5",
                  i > 0 && "border-t border-border/60",
                )}
              >
                <span
                  className={cn(
                    "flex size-9 shrink-0 items-center justify-center rounded-lg",
                    p.iconoClass,
                  )}
                  aria-hidden
                >
                  <p.Icono className="size-5" />
                </span>
                <span className="flex-1 truncate text-sm font-medium text-foreground">
                  {p.titulo}
                </span>
                <span className="shrink-0 text-sm text-muted-foreground">
                  {p.cuando}
                </span>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )

  function presentacion(f: FilaFeed) {
    if (f.clase === "disponibilidad") {
      const llega = f.cambio.tipo === "llega"
      return {
        Icono: llega ? HouseIcon : PlaneIcon,
        iconoClass: llega
          ? "bg-secondary/50 text-secondary-foreground"
          : "bg-muted text-muted-foreground",
        titulo: `${f.cambio.miembro} ${llega ? "llega" : "sale"}`,
        cuando: etiquetaCuando(f.cuandoISO, nowISO),
      }
    }
    const esTarea = f.item.tipo === "tarea"
    const etiqueta = etiquetaCuando(f.cuandoISO, nowISO, f.conHora)
    return {
      Icono: esTarea ? CircleIcon : CalendarIcon,
      iconoClass: esTarea ? "bg-muted text-muted-foreground" : "bg-primary/10 text-primary",
      titulo: f.item.titulo,
      cuando: esTarea ? `Vence ${etiqueta.toLowerCase()}` : etiqueta,
    }
  }
}
