import {
  HourglassIcon,
  HouseIcon,
  PhoneCallIcon,
  PlaneIcon,
} from "lucide-react"

import type { EstadoDisponibilidad } from "@/lib/availability/panel"

/**
 * Fuente única del tratamiento visual de cada estado de disponibilidad. La usan
 * el panel del home y el calendario mensual, para que ambos hablen el mismo
 * idioma de color/ícono (DESIGN.md: tres estados = tres tratamientos distintos;
 * verde salvia SOLO como superficie; "por confirmar" con identidad propia,
 * ámbar + reloj de arena).
 */
export type EstadoMeta = {
  label: string
  Icono: typeof HouseIcon
  /** Superficie + texto del bloque "estado de hoy" en grande (home). */
  cardClass: string
  /** Fondo del recuadro del ícono en ese bloque. */
  iconWrapClass: string
  /** Superficie + texto de un chip/celda compacta (tira semanal, celda de mes). */
  chipClass: string
}

export const ESTADO_META: Record<EstadoDisponibilidad, EstadoMeta> = {
  en_casa: {
    label: "En casa",
    Icono: HouseIcon,
    cardClass: "bg-secondary text-secondary-foreground",
    iconWrapClass: "bg-white/40 text-secondary-foreground",
    chipClass: "bg-secondary text-secondary-foreground",
  },
  fuera: {
    label: "Fuera",
    Icono: PlaneIcon,
    cardClass: "bg-primary text-primary-foreground",
    iconWrapClass: "bg-white/15 text-primary-foreground",
    chipClass: "bg-primary text-primary-foreground",
  },
  standby_casa: {
    label: "Standby en casa",
    Icono: PhoneCallIcon,
    cardClass: "bg-secondary/50 text-secondary-foreground ring-1 ring-primary/20",
    iconWrapClass: "bg-white/50 text-primary",
    chipClass: "bg-secondary/60 text-secondary-foreground ring-1 ring-primary/20",
  },
  por_confirmar: {
    label: "Por confirmar",
    Icono: HourglassIcon,
    cardClass: "bg-accent/20 text-foreground",
    iconWrapClass: "bg-accent/30 text-accent-foreground",
    chipClass: "bg-accent text-accent-foreground",
  },
}
