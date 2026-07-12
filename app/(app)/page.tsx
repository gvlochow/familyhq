import Image from "next/image"
import { DateTime } from "luxon"

import { createClient } from "@/lib/supabase/server"
import { construirPanelSemana } from "@/lib/availability/panel"
import { AvailabilityCard } from "@/components/home/availability-card"

const TZ = "America/Santiago"
const DIAS = 7

/**
 * Home real: el panel de disponibilidad de la semana (DESIGN.md). Server
 * Component — lee members y availability_days del hogar (acotado por RLS) y arma
 * el modelo de vista con la lógica pura de lib/availability. Sin estado de cliente.
 *
 * La guarda de acceso vive en el layout de (app); acá asumimos sesión + hogar.
 */
export default async function HomePage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: members }, { data: hogar }] = await Promise.all([
    supabase.from("members").select("id, display_name, user_id, tipo_horario"),
    supabase.from("households").select("name").limit(1).maybeSingle(),
  ])

  const integrantes = members ?? []
  const hoy = DateTime.now().setZone(TZ)
  const hoyISO = hoy.toISODate()!
  const hastaISO = hoy.plus({ days: DIAS - 1 }).toISODate()!

  // Un solo query para la disponibilidad de todos los integrantes de la ventana.
  const { data: dias } = integrantes.length
    ? await supabase
        .from("availability_days")
        .select("member_id, date, estado")
        .in(
          "member_id",
          integrantes.map((m) => m.id),
        )
        .gte("date", hoyISO)
        .lte("date", hastaISO)
    : { data: [] }

  const porMiembro = new Map<string, { fecha: string; estado: string }[]>()
  for (const d of dias ?? []) {
    const arr = porMiembro.get(d.member_id) ?? []
    arr.push({ fecha: d.date, estado: d.estado })
    porMiembro.set(d.member_id, arr)
  }

  // El usuario logueado primero; el resto por nombre.
  const ordenados = [...integrantes].sort((a, b) => {
    if (a.user_id === user?.id) return -1
    if (b.user_id === user?.id) return 1
    return a.display_name.localeCompare(b.display_name, "es")
  })

  const yo = integrantes.find((m) => m.user_id === user?.id)
  const saludo = yo ? `Hola, ${yo.display_name.split(" ")[0]}` : "Hola"

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-6 px-6 pt-8 pb-16">
      <header className="flex flex-col gap-4">
        <div className="flex items-center gap-2">
          <Image
            src="/brand/Logo_flat.png"
            alt="FamilyHQ"
            width={28}
            height={28}
            className="rounded-lg"
            priority
          />
          <span className="font-heading text-sm font-semibold text-foreground">
            {hogar?.name ?? "FamilyHQ"}
          </span>
        </div>

        <div className="flex flex-col gap-0.5">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            {saludo}
          </h1>
          <p className="text-sm text-muted-foreground">
            Disponibilidad de la familia esta semana.
          </p>
        </div>
      </header>

      <section className="flex flex-col gap-4">
        {ordenados.map((m) => (
          <AvailabilityCard
            key={m.id}
            nombre={m.display_name}
            esTu={m.user_id === user?.id}
            tipoHorario={m.tipo_horario}
            panel={construirPanelSemana(porMiembro.get(m.id) ?? [], hoyISO, DIAS)}
          />
        ))}
      </section>
    </main>
  )
}
