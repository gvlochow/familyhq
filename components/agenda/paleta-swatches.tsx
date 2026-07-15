"use client"

import { CheckIcon } from "lucide-react"

import { PALETA_CATEGORIAS } from "@/lib/agenda/categorias"
import { cn } from "@/lib/utils"

/** Selector de color de la paleta curada (swatches). Compartido por el picker y Ajustes. */
export function PaletaSwatches({
  value,
  onChange,
  disabled,
}: {
  value: string
  onChange: (clave: string) => void
  disabled?: boolean
}) {
  return (
    <div className="flex flex-wrap gap-1.5">
      {PALETA_CATEGORIAS.map((p) => (
        <button
          key={p.clave}
          type="button"
          disabled={disabled}
          onClick={() => onChange(p.clave)}
          aria-label={p.nombre}
          aria-pressed={value === p.clave}
          className={cn(
            "flex size-7 items-center justify-center rounded-full ring-2 transition-transform disabled:opacity-50",
            value === p.clave ? "ring-foreground/40" : "ring-transparent hover:scale-110",
          )}
          style={{ backgroundColor: p.hex }}
        >
          {value === p.clave && <CheckIcon className="size-4 text-white" aria-hidden />}
        </button>
      ))}
    </div>
  )
}
