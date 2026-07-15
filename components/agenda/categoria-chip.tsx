import { hexCategoria, type CategoriaRef } from "@/lib/agenda/categorias"
import { cn } from "@/lib/utils"

/**
 * Identidad visual de una categoría: un punto de color (hex de la paleta, vía inline
 * style para no depender de clases dinámicas de Tailwind) + opcionalmente el nombre.
 * Devuelve null si el ítem no tiene categoría.
 */
export function CategoriaChip({
  categoria,
  conNombre = false,
  className,
}: {
  categoria: CategoriaRef | null
  conNombre?: boolean
  className?: string
}) {
  if (!categoria) return null
  return (
    <span className={cn("inline-flex items-center gap-1", className)}>
      <span
        className="size-2 shrink-0 rounded-full"
        style={{ backgroundColor: hexCategoria(categoria.color) }}
        aria-hidden
      />
      {conNombre && <span className="truncate">{categoria.nombre}</span>}
    </span>
  )
}
