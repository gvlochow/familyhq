"use client"

import { useState } from "react"
import { ChevronUpIcon, HelpCircleIcon } from "lucide-react"

import { hexCategoria } from "@/lib/agenda/categorias"
import { cn } from "@/lib/utils"

/**
 * Leyenda (simbología) del calendario: quién es cada inicial + qué significa cada
 * color. Colapsable con un "?": útil al principio, redundante con el tiempo. El
 * estado inicial (abierta/cerrada) sale de la preferencia del hogar
 * `ocultar_simbologia`; el "?" la muestra/oculta bajo demanda en el dispositivo.
 */
export function LeyendaCalendario({
  miembros,
  hayVariable,
  ocultarSimbologia,
}: {
  miembros: { id: string; inicial: string; nombre: string }[]
  /** Si no hay integrante variable, "Blanco" nunca ocurre y se omite. */
  hayVariable: boolean
  /** Preferencia del hogar: arrancar oculta. */
  ocultarSimbologia: boolean
}) {
  const [abierta, setAbierta] = useState(!ocultarSimbologia)

  return (
    <div className="flex flex-col gap-2 border-t border-border/60 pt-3">
      <div className="flex items-center justify-between">
        <span className={cn("text-xs font-medium text-muted-foreground", !abierta && "sr-only")}>
          Simbología
        </span>
        <button
          type="button"
          onClick={() => setAbierta((a) => !a)}
          aria-expanded={abierta}
          aria-label={abierta ? "Ocultar simbología" : "Mostrar simbología"}
          className="flex size-7 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
        >
          {abierta ? (
            <ChevronUpIcon className="size-4" aria-hidden />
          ) : (
            <HelpCircleIcon className="size-4" aria-hidden />
          )}
        </button>
      </div>

      {abierta && (
        <>
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
              <span className="size-3 rounded-sm border border-primary" aria-hidden />
              <span className="text-xs text-muted-foreground">Parte del día fuera</span>
            </li>
            {hayVariable && (
              <li className="flex items-center gap-1.5">
                <span className="size-3 rounded-sm bg-accent" aria-hidden />
                <span className="text-xs text-muted-foreground">Blanco (hasta 21:00)</span>
              </li>
            )}
            <li className="flex items-center gap-1.5">
              <span className="size-3 rounded-sm bg-secondary/60" aria-hidden />
              <span className="text-xs text-muted-foreground">En casa (sin marca)</span>
            </li>
            <li className="flex items-center gap-1.5">
              <span className="flex -space-x-1" aria-hidden>
                <span className="size-2 rounded-full ring-1 ring-background" style={{ backgroundColor: hexCategoria("ambar") }} />
                <span className="size-2 rounded-full ring-1 ring-background" style={{ backgroundColor: hexCategoria("celeste") }} />
              </span>
              <span className="text-xs text-muted-foreground">Agenda (color = categoría)</span>
            </li>
          </ul>
        </>
      )}
    </div>
  )
}
