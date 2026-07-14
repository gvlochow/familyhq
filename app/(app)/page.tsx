import Image from "next/image"
import { DateTime } from "luxon"

import { createClient } from "@/lib/supabase/server"
import { TZ_LOCAL } from "@/lib/roster/types"
import { estadoEnInstante } from "@/lib/availability/dia-resumen"
import { ORDEN_PRECEDENCIA, type EstadoDisponibilidad } from "@/lib/availability/estado"
import { construirProximos, type MiembroTramos } from "@/lib/availability/proximo"
import { tramosConDefault } from "@/lib/availability/miembros"
import { construirFeed } from "@/lib/agenda/feed"
import { mapearAgendaItem, type AgendaItem, type MiembroRef } from "@/lib/agenda/tipos"
import { MemberStatusCard } from "@/components/home/member-status-card"
import { ProximoList } from "@/components/home/proximo-list"
import { HomeActions } from "@/components/home/home-actions"

const DIAS = 7

/**
 * Inicio: tablero familiar "¿Cómo está la casa?" (mockup). Server Component — lee
 * members y los tramos intra-día del hogar (acotado por RLS) y arma UNA vista
 * familiar: el estado de cada integrante + el feed "Próximo en la casa". Reemplaza
 * las agendas semanales por-integrante: la unidad es la familia, no la persona.
 *
 * El feed hoy solo trae cambios de disponibilidad; las tareas/eventos y el botón
 * "Actualizar mi estado" se cablearán cuando existan esas features.
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
  const hoy = DateTime.now().setZone(TZ_LOCAL)
  const nowISO = hoy.toISO()!
  const inicioVentana = hoy.startOf("day")
  const winInicioUtc = inicioVentana.toUTC().toISO()!
  const winFinUtc = inicioVentana.plus({ days: DIAS }).toUTC().toISO()!

  // Un solo query: los tramos de todos los integrantes que solapan la ventana.
  const { data: tramosRaw } = integrantes.length
    ? await supabase
        .from("availability_segments")
        .select("member_id, inicio_utc, fin_utc, estado")
        .in(
          "member_id",
          integrantes.map((m) => m.id),
        )
        .lt("inicio_utc", winFinUtc)
        .gt("fin_utc", winInicioUtc)
    : { data: [] }

  const porMiembro = new Map<string, { inicioUtc: string; finUtc: string; estado: string }[]>()
  for (const t of tramosRaw ?? []) {
    const arr = porMiembro.get(t.member_id) ?? []
    arr.push({ inicioUtc: t.inicio_utc, finUtc: t.fin_utc, estado: t.estado })
    porMiembro.set(t.member_id, arr)
  }

  // Tramos del integrante con el default "en casa" para quien no tiene horario.
  const tramosDe = (m: (typeof integrantes)[number]) =>
    tramosConDefault(m.tipo_horario, porMiembro.get(m.id) ?? [], winInicioUtc, winFinUtc)

  // Estado ACTUAL de cada integrante + orden "excepciones primero" (quién no está
  // en casa se ve arriba); el resto por nombre.
  const rank = (e: EstadoDisponibilidad | null) =>
    e ? ORDEN_PRECEDENCIA.indexOf(e) : ORDEN_PRECEDENCIA.length
  const tarjetas = integrantes
    .map((m) => {
      const ahora = estadoEnInstante(tramosDe(m), nowISO)
      return {
        id: m.id,
        nombre: m.display_name,
        inicial: m.display_name.trim().charAt(0).toUpperCase() || "?",
        esTu: m.user_id === user?.id,
        estado: ahora?.estado ?? null,
        finUtc: ahora?.finUtc ?? null,
      }
    })
    .sort(
      (a, b) => rank(a.estado) - rank(b.estado) || a.nombre.localeCompare(b.nombre, "es"),
    )

  const miembrosTramos: MiembroTramos[] = integrantes.map((m) => ({
    id: m.id,
    nombre: m.display_name.split(" ")[0],
    tramos: tramosDe(m),
  }))
  const proximos = construirProximos(miembrosTramos, nowISO, DIAS)

  // Mapa de integrantes para resolver asignados y "agregado por".
  const miembrosRef: MiembroRef[] = integrantes.map((m) => ({
    id: m.id,
    inicial: m.display_name.trim().charAt(0).toUpperCase() || "?",
    nombre: m.display_name.split(" ")[0],
  }))
  const miembrosById = new Map(miembrosRef.map((m) => [m.id, m]))
  const yo = integrantes.find((m) => m.user_id === user?.id)
  const agregadoPor = yo ? yo.display_name.split(" ")[0] : null

  // Agenda del hogar en la ventana (para el feed). RLS acota al hogar.
  const { data: agendaRaw } = await supabase
    .from("agenda_items")
    .select("id, tipo, titulo, fecha, hora, completado, asignado_a, created_by")
    .gte("fecha", inicioVentana.toISODate()!)
    .lte("fecha", inicioVentana.plus({ days: DIAS }).toISODate()!)

  const agenda: AgendaItem[] = (agendaRaw ?? [])
    .map((r) => mapearAgendaItem(r, miembrosById))
    .filter((it): it is AgendaItem => it !== null)

  const filas = construirFeed(proximos, agenda, nowISO, DIAS)

  const fecha = capitalizar(hoy.setLocale("es").toFormat("ccc d LLL")).replace(".", "")

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col pb-40">
      {/* Cabecera familiar (banda navy). */}
      <header className="rounded-b-2xl bg-primary px-6 pt-8 pb-6 text-primary-foreground">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Image
              src="/brand/Logo_flat.png"
              alt="FamilyHQ"
              width={24}
              height={24}
              className="rounded-md"
              priority
            />
            <span className="font-heading text-sm font-semibold">
              {hogar?.name ?? "FamilyHQ"}
            </span>
          </div>
          <span className="text-sm text-primary-foreground/70">{fecha}</span>
        </div>
        <h1 className="mt-4 font-heading text-2xl font-semibold">
          ¿Cómo está la casa?
        </h1>
      </header>

      <div className="flex flex-col gap-6 px-5 pt-5">
        {/* Estado de cada integrante. */}
        <section className="flex flex-col gap-2.5">
          {tarjetas.length > 0 ? (
            tarjetas.map((t) => (
              <MemberStatusCard
                key={t.id}
                inicial={t.inicial}
                nombre={t.nombre}
                esTu={t.esTu}
                estado={t.estado}
                finUtc={t.finUtc}
                nowISO={nowISO}
              />
            ))
          ) : (
            <p className="text-sm text-muted-foreground">
              Todavía no hay integrantes en el hogar.
            </p>
          )}
        </section>

        {/* Próximo en la casa (forecast): disponibilidad + agenda. */}
        <ProximoList filas={filas} nowISO={nowISO} />
      </div>

      <HomeActions miembros={miembrosRef} agregadoPor={agregadoPor} />
    </main>
  )
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
