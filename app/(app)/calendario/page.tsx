import Link from "next/link"
import { DateTime } from "luxon"
import { ChevronLeftIcon, ChevronRightIcon } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { TZ_LOCAL } from "@/lib/roster/types"
import { construirGrillaMes } from "@/lib/availability/mes"
import { MonthGrid } from "@/components/calendar/month-grid"
import { cn } from "@/lib/utils"

/**
 * Calendario mensual del hogar. Server Component: el mes y el integrante
 * seleccionado viven en la URL (?mes=yyyy-MM & ?member=id), así la navegación es
 * con Links y sin estado de cliente. Lee availability_days (acotado por RLS).
 */
export default async function CalendarioPage({
  searchParams,
}: {
  searchParams: Promise<{ mes?: string; member?: string }>
}) {
  const { mes, member } = await searchParams
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const { data: members } = await supabase
    .from("members")
    .select("id, display_name, user_id")

  const integrantes = members ?? []

  // Integrante seleccionado: el de la URL si es válido, si no el usuario logueado,
  // si no el primero.
  const seleccionado =
    integrantes.find((m) => m.id === member) ??
    integrantes.find((m) => m.user_id === user?.id) ??
    integrantes[0]

  // Mes base: ?mes=yyyy-MM válido, o el mes actual.
  const hoy = DateTime.now().setZone(TZ_LOCAL)
  const parsed = mes ? DateTime.fromFormat(mes, "yyyy-MM", { zone: TZ_LOCAL }) : null
  const base = (parsed?.isValid ? parsed : hoy).startOf("month")

  // Ventana de la grilla (mes ± 7 días de relleno), como instantes UTC para
  // filtrar los tramos que la solapan.
  const winInicioUtc = base.minus({ days: 7 }).startOf("day").toUTC().toISO()!
  const winFinUtc = base.endOf("month").plus({ days: 8 }).startOf("day").toUTC().toISO()!

  const { data: tramosRaw } = seleccionado
    ? await supabase
        .from("availability_segments")
        .select("inicio_utc, fin_utc, estado")
        .eq("member_id", seleccionado.id)
        .lt("inicio_utc", winFinUtc)
        .gt("fin_utc", winInicioUtc)
    : { data: [] }

  const grilla = construirGrillaMes(
    (tramosRaw ?? []).map((t) => ({
      inicioUtc: t.inicio_utc,
      finUtc: t.fin_utc,
      estado: t.estado,
    })),
    base.toFormat("yyyy-MM"),
    hoy.toISODate()!,
  )

  const etiquetaMes = capitalizar(base.setLocale("es").toFormat("LLLL yyyy"))
  const mesPrev = base.minus({ months: 1 }).toFormat("yyyy-MM")
  const mesNext = base.plus({ months: 1 }).toFormat("yyyy-MM")
  const href = (m: string, memberId?: string) =>
    `/calendario?mes=${m}${memberId ? `&member=${memberId}` : ""}`

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-5 px-6 pt-8 pb-28">
      <header className="flex flex-col gap-4">
        <h1 className="font-heading text-2xl font-semibold text-foreground">
          Calendario
        </h1>

        {/* Selector de integrante (solo si hay más de uno). */}
        {integrantes.length > 1 && (
          <ul className="flex flex-wrap gap-2">
            {integrantes.map((m) => {
              const activo = m.id === seleccionado?.id
              return (
                <li key={m.id}>
                  <Link
                    href={href(base.toFormat("yyyy-MM"), m.id)}
                    aria-current={activo ? "true" : undefined}
                    className={cn(
                      "rounded-full border px-3 py-1 text-sm transition-colors",
                      activo
                        ? "border-primary bg-primary/5 font-medium text-primary"
                        : "border-border text-muted-foreground hover:bg-muted",
                    )}
                  >
                    {m.display_name.split(" ")[0]}
                  </Link>
                </li>
              )
            })}
          </ul>
        )}

        {/* Navegación de mes. */}
        <div className="flex items-center justify-between">
          <Link
            href={href(mesPrev, seleccionado?.id)}
            aria-label="Mes anterior"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronLeftIcon className="size-5" />
          </Link>
          <span className="font-heading text-base font-medium text-foreground">
            {etiquetaMes}
          </span>
          <Link
            href={href(mesNext, seleccionado?.id)}
            aria-label="Mes siguiente"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ChevronRightIcon className="size-5" />
          </Link>
        </div>
      </header>

      {seleccionado ? (
        <MonthGrid grilla={grilla} />
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
