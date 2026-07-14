import Link from "next/link"
import { DateTime } from "luxon"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { TZ_LOCAL } from "@/lib/roster/types"
import {
  construirGrillaMesFamilia,
  type MiembroCalendario,
} from "@/lib/availability/mes-familia"
import { CalendarView } from "@/components/calendar/calendar-view"
import { cargarTramosEfectivos } from "../_lib/tramos-efectivos"

/**
 * Calendario FAMILIAR del hogar. Server Component: el mes vive en la URL
 * (?mes=yyyy-MM), así la navegación es con Links y sin estado de cliente. Una sola
 * grilla para toda la familia (no un calendario por integrante): cada día marca
 * quién está fuera. Lee los tramos de todos los integrantes (acotado por RLS).
 */
export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string }>
}) {
  const { mes } = await searchParams
  const supabase = await createClient()

  const { data: members } = await supabase
    .from("members")
    .select("id, display_name, user_id, tipo_horario")
  const integrantes = members ?? []

  // Mes base: ?mes=yyyy-MM válido, o el mes actual.
  const hoy = DateTime.now().setZone(TZ_LOCAL)
  const parsed = mes ? DateTime.fromFormat(mes, "yyyy-MM", { zone: TZ_LOCAL }) : null
  const base = (parsed?.isValid ? parsed : hoy).startOf("month")

  // Ventana de la grilla (mes ± 7 días de relleno) como instantes UTC.
  const winInicioUtc = base.minus({ days: 7 }).startOf("day").toUTC().toISO()!
  const winFinUtc = base.endOf("month").plus({ days: 8 }).startOf("day").toUTC().toISO()!

  // Tramos EFECTIVOS por integrante (clasificado/fijo + default + overrides),
  // compuestos por el loader compartido (acotado por RLS al hogar).
  const tramosPorMiembro = await cargarTramosEfectivos(
    supabase,
    integrantes,
    winInicioUtc,
    winFinUtc,
  )

  const miembros: MiembroCalendario[] = integrantes.map((m) => ({
    id: m.id,
    nombre: m.display_name.split(" ")[0],
    inicial: m.display_name.trim().charAt(0).toUpperCase() || "?",
    tramos: tramosPorMiembro.get(m.id) ?? [],
  }))

  const grilla = construirGrillaMesFamilia(miembros, base.toFormat("yyyy-MM"), hoy.toISODate()!)

  const etiquetaMes = capitalizar(base.setLocale("es").toFormat("LLLL yyyy"))
  const mesPrev = base.minus({ months: 1 }).toFormat("yyyy-MM")
  const mesNext = base.plus({ months: 1 }).toFormat("yyyy-MM")
  const href = (m: string) => `/calendario?mes=${m}`

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-5 px-6 pt-8 pb-28">
      <header className="flex flex-col gap-4">
        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Calendario
          </h1>
          <p className="text-sm text-muted-foreground">Quién está fuera cada día.</p>
        </div>

        {/* Navegación de mes. */}
        <div className="flex items-center justify-between">
          <Link
            href={href(mesPrev)}
            aria-label="Mes anterior"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronLeftIcon className="size-5" />
          </Link>
          <span className="font-heading text-base font-medium text-foreground">
            {etiquetaMes}
          </span>
          <Link
            href={href(mesNext)}
            aria-label="Mes siguiente"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronRightIcon className="size-5" />
          </Link>
        </div>
      </header>

      {integrantes.length > 0 ? (
        <CalendarView grilla={grilla} miembros={miembros} />
      ) : (
        <p className="text-sm text-muted-foreground">
          Todavía no hay integrantes en el hogar.
        </p>
      )}
    </main>
  )
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
