import {
  ClockIcon,
  HourglassIcon,
  HouseIcon,
  PhoneCallIcon,
} from "lucide-react"

import type { EstadoDisponibilidad } from "@/lib/availability/estado"
import { textoHasta } from "@/lib/availability/formato"
import { cn } from "@/lib/utils"

/**
 * Tarjeta compacta de estado de UN integrante para el Inicio familiar (una fila
 * por persona, no una agenda). Borde izquierdo + avatar + pill coloreados por
 * estado, con el "hasta cuándo" en el subtítulo. Server component (sin interacción).
 *
 * Nota de paleta: el pill de "fuera" es gris (no navy) a propósito, siguiendo el
 * mockup — el navy queda para el borde de acento. Es un tratamiento distinto al
 * chip del calendario (ESTADO_META), donde fuera sí es navy.
 */
type Meta = {
  label: string
  Icono: typeof HouseIcon
  borde: string
  avatar: string
  pill: string
}

const META: Record<EstadoDisponibilidad, Meta> = {
  fuera: {
    label: "Fuera",
    Icono: ClockIcon,
    borde: "border-l-primary",
    avatar: "bg-muted text-foreground",
    pill: "bg-muted text-muted-foreground",
  },
  en_casa: {
    label: "En casa",
    Icono: HouseIcon,
    borde: "border-l-secondary",
    avatar: "bg-secondary/40 text-secondary-foreground",
    pill: "bg-secondary/60 text-secondary-foreground",
  },
  standby_casa: {
    label: "Standby",
    Icono: PhoneCallIcon,
    borde: "border-l-primary/50",
    avatar: "bg-secondary/30 text-secondary-foreground",
    pill: "bg-secondary/50 text-secondary-foreground ring-1 ring-primary/20",
  },
  por_confirmar: {
    label: "Blanco",
    Icono: HourglassIcon,
    borde: "border-l-accent",
    avatar: "bg-accent/25 text-accent-foreground",
    pill: "bg-accent/30 text-accent-foreground",
  },
}

const SIN_INFO: Meta = {
  label: "Sin información",
  Icono: ClockIcon,
  borde: "border-l-border",
  avatar: "bg-muted text-muted-foreground",
  pill: "bg-muted text-muted-foreground",
}

/** Subtítulo bajo el nombre: el "hasta cuándo" donde aporta. */
function subtitulo(
  estado: EstadoDisponibilidad | null,
  finUtc: string | null,
  nowISO: string,
): string {
  if (!estado) return "Sin información"
  const cuando = finUtc ? textoHasta(finUtc, nowISO) : null
  switch (estado) {
    case "fuera":
      return cuando ? `Fuera hasta ${cuando}` : "Fuera"
    case "standby_casa":
      return "En casa, pero llamable"
    case "por_confirmar":
      return "Blanco · llamable hasta las 21:00"
    case "en_casa":
      return "En casa"
  }
}

export function MemberStatusCard({
  inicial,
  nombre,
  esTu,
  estado,
  finUtc,
  nowISO,
}: {
  inicial: string
  nombre: string
  esTu: boolean
  estado: EstadoDisponibilidad | null
  finUtc: string | null
  nowISO: string
}) {
  const meta = estado ? META[estado] : SIN_INFO

  return (
    <div
      className={cn(
        "flex items-center gap-3 rounded-xl border-l-4 bg-card p-3 pr-3.5 shadow-xs ring-1 ring-foreground/10",
        meta.borde,
      )}
    >
      <span
        className={cn(
          "flex size-11 shrink-0 items-center justify-center rounded-lg font-heading text-base font-semibold",
          meta.avatar,
        )}
        aria-hidden
      >
        {inicial}
      </span>

      <div className="flex min-w-0 flex-1 flex-col">
        <div className="flex items-center gap-2">
          <span className="truncate font-heading text-base font-semibold text-foreground">
            {nombre}
          </span>
          {esTu && (
            <span className="rounded-full bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground">
              Tú
            </span>
          )}
        </div>
        <span className="truncate text-sm text-muted-foreground">
          {subtitulo(estado, finUtc, nowISO)}
        </span>
      </div>

      <span
        className={cn(
          "flex shrink-0 items-center gap-1 rounded-full px-2.5 py-1 text-xs font-medium",
          meta.pill,
        )}
      >
        <meta.Icono className="size-3.5" aria-hidden />
        {meta.label}
      </span>
    </div>
  )
}
