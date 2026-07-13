import { DateTime } from "luxon"
import { RadioIcon } from "lucide-react"

import type { EstadoDisponibilidad, PanelSemana } from "@/lib/availability/panel"
import { TZ_LOCAL } from "@/lib/roster/types"
import { LETRAS_DIA } from "@/lib/availability/dias"
import { ESTADO_META } from "@/components/availability/estado-meta"
import { Card, CardContent, CardHeader } from "@/components/ui/card"
import { cn } from "@/lib/utils"

/**
 * "Hasta cuándo" del tramo actual, en hora local. Mismo día -> "las 18:00";
 * mañana -> "mañana 09:00"; más adelante en la semana -> "el sáb 15:00".
 */
function hasta(finISO: string, nowISO: string): string {
  const fin = DateTime.fromISO(finISO).setZone(TZ_LOCAL)
  const now = DateTime.fromISO(nowISO).setZone(TZ_LOCAL)
  const hora = fin.toFormat("HH:mm")
  if (fin.hasSame(now, "day")) return `las ${hora}`
  if (fin.hasSame(now.plus({ days: 1 }), "day")) return `mañana ${hora}`
  const dia = fin.setLocale("es").toFormat("ccc").replace(".", "")
  return `el ${dia} ${hora}`
}

/** Subtítulo del estado actual: "hasta cuándo" donde aporta información. */
function subtitulo(
  estado: EstadoDisponibilidad,
  finActualISO: string | null,
  nowISO: string,
): string {
  const cuando = finActualISO ? hasta(finActualISO, nowISO) : null
  switch (estado) {
    case "fuera":
      return cuando ? `Hasta ${cuando}` : "Toda la semana"
    case "standby_casa":
      return cuando ? `Llamable hasta ${cuando}` : "En casa, pero llamable"
    case "por_confirmar":
      return "Aún sin definir en el rol"
    case "en_casa":
      return cuando ? `Hasta ${cuando}` : "Sin viajes esta semana"
  }
}

/** Mensaje cuando no hay estado ahora (rol sin conectar/sincronizar, o fijo sin configurar). */
function mensajePendiente(tipoHorario: string): string {
  if (tipoHorario === "variable")
    return "Conecta o sincroniza tu rol para ver tu disponibilidad."
  if (tipoHorario === "fijo")
    return "Configura tu horario fijo para ver tu disponibilidad."
  return "Sin información de disponibilidad todavía."
}

export function AvailabilityCard({
  nombre,
  esTu,
  tipoHorario,
  panel,
  nowISO,
}: {
  nombre: string
  esTu: boolean
  tipoHorario: string
  panel: PanelSemana
  nowISO: string
}) {
  const meta = panel.estadoAhora ? ESTADO_META[panel.estadoAhora] : null

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
                {subtitulo(panel.estadoAhora!, panel.finActualISO, nowISO)}
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
            const chip = d.estado ? ESTADO_META[d.estado].chipClass : "bg-muted text-muted-foreground"
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
                  title={d.estado ? ESTADO_META[d.estado].label : "Sin información"}
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
