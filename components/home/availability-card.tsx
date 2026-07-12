import { DateTime } from "luxon"
import {
  HourglassIcon,
  HouseIcon,
  PhoneCallIcon,
  PlaneIcon,
  RadioIcon,
} from "lucide-react"

import type { EstadoDisponibilidad, PanelSemana } from "@/lib/availability/panel"
import { TZ_LOCAL } from "@/lib/roster/types"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

const LETRAS_DIA = ["L", "M", "M", "J", "V", "S", "D"] // luxon weekday 1..7

type EstadoMeta = {
  label: string
  Icono: typeof HouseIcon
  cardClass: string
  iconWrapClass: string
  chipClass: string
}

/**
 * Tres estados = tres tratamientos visuales distintos (DESIGN.md). El verde
 * salvia va SOLO como superficie, nunca como texto. "Por confirmar" tiene su
 * propia identidad (ámbar + reloj de arena), no es un tono de en-casa ni de fuera.
 */
const META: Record<EstadoDisponibilidad, EstadoMeta> = {
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

function diaNombre(fecha: string): string {
  const n = DateTime.fromISO(fecha, { zone: TZ_LOCAL }).setLocale("es").toFormat("cccc")
  return n.charAt(0).toUpperCase() + n.slice(1)
}

/** Subtítulo del estado de hoy: "hasta cuándo" donde aporta información. */
function subtitulo(estado: EstadoDisponibilidad, cambiaEl: string | null): string {
  switch (estado) {
    case "fuera":
      return cambiaEl ? `Hasta el ${diaNombre(cambiaEl).toLowerCase()}` : "Toda la semana"
    case "standby_casa":
      return "En casa, pero llamable"
    case "por_confirmar":
      return "Aún sin definir en el rol"
    case "en_casa":
      return cambiaEl ? `Hasta el ${diaNombre(cambiaEl).toLowerCase()}` : "Sin viajes esta semana"
  }
}

/** Mensaje cuando no hay estado para hoy (rol sin conectar/sincronizar, o fijo). */
function mensajePendiente(tipoHorario: string): string {
  if (tipoHorario === "variable")
    return "Conecta o sincroniza tu rol para ver tu disponibilidad."
  if (tipoHorario === "fijo")
    return "La disponibilidad del horario fijo llegará pronto."
  return "Sin información de disponibilidad todavía."
}

export function AvailabilityCard({
  nombre,
  esTu,
  tipoHorario,
  panel,
}: {
  nombre: string
  esTu: boolean
  tipoHorario: string
  panel: PanelSemana
}) {
  const meta = panel.estadoHoy ? META[panel.estadoHoy] : null

  return (
    <Card>
      <CardHeader>
        <div className="flex items-center gap-2">
          <h2 className="font-heading text-base font-semibold text-foreground">
            {nombre}
          </h2>
          {esTu && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-medium text-muted-foreground">
              Tú
            </span>
          )}
        </div>
      </CardHeader>

      <CardContent className="flex flex-col gap-4">
        {/* Estado ACTUAL en grande. */}
        {meta ? (
          <div className={cn("flex items-center gap-3 rounded-xl p-4", meta.cardClass)}>
            <span
              className={cn(
                "flex size-11 shrink-0 items-center justify-center rounded-lg",
                meta.iconWrapClass,
              )}
              aria-hidden
            >
              <meta.Icono className="size-6" />
            </span>
            <span className="flex flex-col">
              <span className="font-heading text-xl font-semibold leading-tight">
                {meta.label}
              </span>
              <span className="text-sm opacity-80">
                {subtitulo(panel.estadoHoy!, panel.cambiaEl)}
              </span>
            </span>
          </div>
        ) : (
          <div className="flex items-center gap-3 rounded-xl border border-dashed border-border p-4">
            <span
              className="flex size-11 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
              aria-hidden
            >
              <RadioIcon className="size-6" />
            </span>
            <p className="text-sm text-muted-foreground">
              {mensajePendiente(tipoHorario)}
            </p>
          </div>
        )}

        {/* Resto de la semana, en menor peso. */}
        <div className="grid grid-cols-7 gap-1">
          {panel.dias.map((d) => {
            const dt = DateTime.fromISO(d.fecha, { zone: TZ_LOCAL })
            const chip = d.estado ? META[d.estado].chipClass : "bg-muted text-muted-foreground"
            return (
              <div key={d.fecha} className="flex flex-col items-center gap-1">
                <span className="text-[10px] font-medium text-muted-foreground">
                  {LETRAS_DIA[dt.weekday - 1]}
                </span>
                <span
                  className={cn(
                    "flex h-9 w-full items-center justify-center rounded-md text-sm font-medium tabular-nums",
                    chip,
                    d.esHoy && "ring-2 ring-foreground/40",
                  )}
                  title={d.estado ? META[d.estado].label : "Sin información"}
                >
                  {dt.day}
                </span>
              </div>
            )
          })}
        </div>
      </CardContent>
    </Card>
  )
}
