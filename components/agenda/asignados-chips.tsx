import type { MiembroRef } from "@/lib/agenda/tipos"

/** Iniciales apiladas de los integrantes asignados a un item. Presentacional. */
export function AsignadosChips({ asignados }: { asignados: MiembroRef[] }) {
  if (asignados.length === 0) return null
  return (
    <span className="flex -space-x-1" aria-label={`Asignado a ${asignados.map((m) => m.nombre).join(", ")}`}>
      {asignados.map((m) => (
        <span
          key={m.id}
          title={m.nombre}
          className="flex size-5 items-center justify-center rounded-full bg-muted text-[9px] font-semibold text-foreground ring-1 ring-card"
        >
          {m.inicial}
        </span>
      ))}
    </span>
  )
}
