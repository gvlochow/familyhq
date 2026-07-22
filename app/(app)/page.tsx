import Image from "next/image"
import { DateTime } from "luxon"

import { createClient } from "@/lib/supabase/server"
import { TZ_LOCAL } from "@/lib/roster/types"
import { estadoEnInstante } from "@/lib/availability/dia-resumen"
import { ORDEN_PRECEDENCIA, type EstadoDisponibilidad } from "@/lib/availability/estado"
import { construirProximos, type MiembroTramos } from "@/lib/availability/proximo"
import { construirFeed } from "@/lib/agenda/feed"
import { mapearAgendaItem, type AgendaItem, type MiembroRef } from "@/lib/agenda/tipos"
import { cargarTramosEfectivos } from "./_lib/tramos-efectivos"
import { cargarAgendaRecurrente } from "./_lib/agenda-recurrente"
import { cargarCategorias } from "./_lib/categorias"
import { MemberStatusCardLive } from "@/components/home/member-status-card-live"
import { ProximoList } from "@/components/home/proximo-list"
import { HomeActions } from "@/components/home/home-actions"
import { AjustesLauncher } from "@/components/nav/ajustes-launcher"

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
    supabase.from("members").select("id, display_name, user_id, tipo_horario, rol"),
    supabase.from("households").select("name, mostrar_categoria").limit(1).maybeSingle(),
  ])

  const integrantes = members ?? []
  const hoy = DateTime.now().setZone(TZ_LOCAL)
  const nowISO = hoy.toISO()!
  const inicioVentana = hoy.startOf("day")
  const winInicioUtc = inicioVentana.toUTC().toISO()!
  const winFinUtc = inicioVentana.plus({ days: DIAS }).toUTC().toISO()!

  // Tramos EFECTIVOS por integrante: clasificado/fijo + default + overrides
  // manuales, compuestos por el loader compartido (acotado por RLS al hogar).
  const tramosPorMiembro = await cargarTramosEfectivos(
    supabase,
    integrantes,
    winInicioUtc,
    winFinUtc,
  )
  const tramosDe = (m: (typeof integrantes)[number]) => tramosPorMiembro.get(m.id) ?? []

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
        // estado inicial: solo para el orden "excepciones primero" al cargar.
        estado: ahora?.estado ?? null,
        tramos: tramosDe(m),
      }
    })
    .sort(
      (a, b) => rank(a.estado) - rank(b.estado) || a.nombre.localeCompare(b.nombre, "es"),
    )

  // El feed "Próximo en la casa" es para lo NOTABLE, no la rutina. Un horario fijo
  // (9-18 todos los días) generaría "sale/llega" a diario e inundaría el feed con
  // información irrelevante; su estado actual ya se ve en la tarjeta de arriba. Por
  // eso el forecast solo toma la disponibilidad de quienes NO son de horario fijo
  // (los variables/crew, cuyo cambio sí es noticia). Los 'ninguno' no aportan tramos
  // de cambio (quedan en casa por default).
  const miembrosTramos: MiembroTramos[] = integrantes
    .filter((m) => m.tipo_horario !== "fijo")
    .map((m) => ({
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

  // Integrantes a los que el usuario puede editar el estado: él mismo + los perfiles
  // administrados (sin cuenta); si es RESPONSABLE, además cualquier integrante del
  // hogar (incluidas otras cuentas). Tu fila primero.
  const soyResponsable = yo?.rol === "sostenedor"
  const editables = integrantes
    .filter(
      (m) => m.user_id === user?.id || m.user_id === null || soyResponsable,
    )
    .map((m) => ({
      id: m.id,
      nombre: m.display_name.split(" ")[0],
      inicial: m.display_name.trim().charAt(0).toUpperCase() || "?",
      esTu: m.user_id === user?.id,
      esVariable: m.tipo_horario === "variable",
    }))
    .sort((a, b) => Number(b.esTu) - Number(a.esTu))

  // Agenda del hogar en la ventana (para el feed). RLS acota al hogar.
  const [{ data: agendaRaw }, categorias] = await Promise.all([
    supabase
      .from("agenda_items")
      .select("id, tipo, titulo, fecha, hora, hora_fin, afecta_disponibilidad, completado, asignado_a, created_by, categoria_id")
      .gte("fecha", inicioVentana.toISODate()!)
      .lte("fecha", inicioVentana.plus({ days: DIAS }).toISODate()!),
    cargarCategorias(supabase),
  ])

  const puntuales: AgendaItem[] = (agendaRaw ?? [])
    .map((r) => mapearAgendaItem(r, miembrosById, categorias))
    .filter((it): it is AgendaItem => it !== null)

  // Ocurrencias recurrentes de la misma ventana; construirFeed las acota fino.
  const recurrentes = await cargarAgendaRecurrente(
    supabase,
    miembrosById,
    categorias,
    inicioVentana.toISODate()!,
    inicioVentana.plus({ days: DIAS }).toISODate()!,
  )

  const filas = construirFeed(proximos, [...puntuales, ...recurrentes], nowISO, DIAS)

  const fecha = capitalizar(hoy.setLocale("es").toFormat("ccc d LLL")).replace(".", "")

  return (
    <main className="flex min-h-svh w-full flex-col pb-40">
      {/* Cabecera familiar (banda navy full-bleed). La app es una columna
          max-w-sm centrada; sin el full-bleed, en pantallas más anchas que
          384px el navy dejaba franjas blancas a los lados. El contenido interno
          se alinea a la misma columna (max-w-sm) que el cuerpo. */}
      <header className="rounded-b-2xl bg-primary text-primary-foreground">
        <div className="mx-auto w-full max-w-sm px-6 pt-8 pb-6">
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
            <div className="-mr-1.5 flex items-center gap-1">
              <span className="text-sm text-primary-foreground/70">{fecha}</span>
              <AjustesLauncher tone="light" />
            </div>
          </div>
          <h1 className="mt-4 font-heading text-2xl font-semibold">
            ¿Cómo está la casa?
          </h1>
        </div>
      </header>

      <div className="mx-auto flex w-full max-w-sm flex-col gap-6 px-5 pt-5">
        {/* Estado de cada integrante. */}
        <section className="flex flex-col gap-2.5">
          {tarjetas.length > 0 ? (
            tarjetas.map((t) => (
              <MemberStatusCardLive
                key={t.id}
                inicial={t.inicial}
                nombre={t.nombre}
                esTu={t.esTu}
                tramos={t.tramos}
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
        <ProximoList
          filas={filas}
          nowISO={nowISO}
          mostrarCategoria={hogar?.mostrar_categoria ?? true}
          miembros={miembrosRef}
          categorias={[...categorias.values()]}
          agregadoPor={agregadoPor}
        />
      </div>

      <HomeActions
        miembros={miembrosRef}
        categorias={[...categorias.values()]}
        editables={editables}
        agregadoPor={agregadoPor}
      />
    </main>
  )
}

function capitalizar(s: string): string {
  return s.charAt(0).toUpperCase() + s.slice(1)
}
