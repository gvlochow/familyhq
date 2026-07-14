import { CalendarIcon, HouseIcon, PlaneIcon } from "lucide-react"

import type { FilaFeed } from "@/lib/agenda/feed"
import { etiquetaCuando } from "@/lib/availability/formato"
import { AsignadosChips } from "@/components/agenda/asignados-chips"
import { CompletarTarea } from "@/components/agenda/completar-tarea"
import { cn } from "@/lib/utils"

/**
 * Feed "Próximo en la casa": cambios de disponibilidad + tareas/eventos de la
 * agenda, ya mezclados y ordenados por cuándo (construirFeed). Server component.
 * Las tareas se pueden completar de un click (CompletarTarea, cliente).
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
          {filas.map((f, i) => (
            <li
              key={f.clave}
              className={cn(
                "flex items-center gap-3 py-2.5",
                i > 0 && "border-t border-border/60",
              )}
            >
              {f.clase === "agenda" && f.item.tipo === "tarea" ? (
                <CompletarTarea item={f.item} />
              ) : (
                <Icono fila={f} />
              )}

              <span className="flex-1 truncate text-sm font-medium text-foreground">
                {titulo(f)}
              </span>

              {f.clase === "agenda" && <AsignadosChips asignados={f.item.asignados} />}

              <span className="shrink-0 text-sm text-muted-foreground">
                {cuando(f, nowISO)}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  )
}

function Icono({ fila }: { fila: FilaFeed }) {
  const { Comp, clase } =
    fila.clase === "disponibilidad"
      ? fila.cambio.tipo === "llega"
        ? { Comp: HouseIcon, clase: "bg-secondary/50 text-secondary-foreground" }
        : { Comp: PlaneIcon, clase: "bg-muted text-muted-foreground" }
      : { Comp: CalendarIcon, clase: "bg-primary/10 text-primary" }
  return (
    <span
      className={cn("flex size-9 shrink-0 items-center justify-center rounded-lg", clase)}
      aria-hidden
    >
      <Comp className="size-5" />
    </span>
  )
}

function titulo(f: FilaFeed): string {
  if (f.clase === "disponibilidad") {
    return `${f.cambio.miembro} ${f.cambio.tipo === "llega" ? "llega" : "sale"}`
  }
  return f.item.titulo
}

function cuando(f: FilaFeed, nowISO: string): string {
  if (f.clase === "disponibilidad") return etiquetaCuando(f.cuandoISO, nowISO)
  const etiqueta = etiquetaCuando(f.cuandoISO, nowISO, f.conHora)
  return f.item.tipo === "tarea" ? `Vence ${etiqueta.toLowerCase()}` : etiqueta
}
