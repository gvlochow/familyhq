import { LogOutIcon } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { bloquesDesdeFilas } from "@/lib/members/horario-fijo"
import { Button } from "@/components/ui/button"
import { HogarSection } from "@/components/ajustes/hogar-section"
import { EntradaHogarSection } from "@/components/ajustes/entrada-hogar-section"
import { SolicitudesSection } from "@/components/ajustes/solicitudes-section"
import {
  IntegrantesSection,
  type IntegranteVista,
} from "@/components/ajustes/integrantes-section"
import { HorarioSection } from "@/components/ajustes/horario-section"
import { CategoriasSection } from "@/components/ajustes/categorias-section"
import { SalirHogar } from "@/components/ajustes/salir-hogar"
import { CompartirApp } from "@/components/ajustes/compartir-app"
import { AgendaPrefsSection } from "@/components/ajustes/agenda-prefs-section"
import { AparienciaSection } from "@/components/ajustes/apariencia-section"
import { cargarCategorias } from "../_lib/categorias"
import { signOut } from "./actions"

/**
 * Ajustes: administrar el hogar (nombre), los integrantes (agregar/editar/quitar
 * perfiles administrados) y la sesión. "Mi horario/rol" llega en una segunda pasada.
 * Server Component: lee el hogar + integrantes (RLS acota al hogar) y delega la
 * interacción a las secciones cliente.
 */
export default async function AjustesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  const [{ data: hogar }, { data: members }, categorias] = await Promise.all([
    supabase
      .from("households")
      .select("name, mostrar_categoria, ocultar_simbologia, join_code")
      .limit(1)
      .maybeSingle(),
    supabase.from("members").select("id, display_name, user_id, rol, tipo_horario, is_owner"),
    cargarCategorias(supabase),
  ])

  const yo = (members ?? []).find((m) => m.user_id === user?.id)
  // Solo un Responsable puede configurar el horario de los perfiles administrados.
  const esResponsable = yo?.rol === "sostenedor"

  // Perfiles administrados (sin cuenta): candidatos para vincular al aprobar una
  // solicitud o invitar por correo.
  const administrados = (members ?? [])
    .filter((m) => m.user_id === null)
    .map((m) => ({ id: m.id, nombre: m.display_name }))

  // Entrada al hogar (grupo 3): solicitudes e invitaciones pendientes. La gestión
  // es solo de Responsables, así que solo se cargan para ellos.
  const [{ data: solicitudesRaw }, { data: invitacionesRaw }] = esResponsable
    ? await Promise.all([
        supabase
          .from("household_join_requests")
          .select("id, solicitante_nombre, solicitante_email, created_at")
          .eq("status", "pendiente")
          .order("created_at", { ascending: true }),
        supabase
          .from("household_invites")
          .select("id, email, created_at")
          .eq("status", "pendiente")
          .order("created_at", { ascending: true }),
      ])
    : [{ data: null }, { data: null }]

  const solicitudes = (solicitudesRaw ?? []).map((s) => ({
    id: s.id,
    nombre: s.solicitante_nombre ?? "Alguien",
    email: s.solicitante_email,
  }))
  const invitaciones = (invitacionesRaw ?? []).map((i) => ({ id: i.id, email: i.email }))

  // Horario de TODOS los integrantes del hogar (RLS acota al hogar): bloques del
  // horario fijo + conexión del rol variable, agrupados por integrante. Sirven para
  // "Mi horario" (uno mismo) y para que un Responsable edite el de los administrados.
  const [{ data: filasFijoTodas }, { data: conexionesTodas }] = await Promise.all([
    supabase
      .from("fixed_schedules")
      .select(
        "member_id, dia_semana, hora_inicio, hora_fin, almuerza_en_casa, hora_almuerzo_inicio, hora_almuerzo_fin",
      ),
    supabase.from("roster_connections").select("member_id, last_synced_at"),
  ])

  const fijoPorMiembro = new Map<string, NonNullable<typeof filasFijoTodas>>()
  for (const f of filasFijoTodas ?? []) {
    const arr = fijoPorMiembro.get(f.member_id) ?? []
    arr.push(f)
    fijoPorMiembro.set(f.member_id, arr)
  }
  const syncPorMiembro = new Map(
    (conexionesTodas ?? []).map((c) => [c.member_id, c.last_synced_at]),
  )
  const bloquesDe = (id: string) => {
    const filas = fijoPorMiembro.get(id)
    return filas && filas.length > 0 ? bloquesDesdeFilas(filas) : undefined
  }

  const integrantes: IntegranteVista[] = (members ?? []).map((m) => ({
    id: m.id,
    nombre: m.display_name,
    rol: m.rol,
    tipo: m.tipo_horario,
    esTu: m.user_id === user?.id,
    esDueno: m.is_owner,
    administrado: m.user_id === null,
    bloquesFijo: bloquesDe(m.id),
    variableConectado: syncPorMiembro.has(m.id),
    ultimaSync: syncPorMiembro.get(m.id) ?? null,
  }))
  // Tu fila primero, luego el resto por nombre.
  integrantes.sort(
    (a, b) => Number(b.esTu) - Number(a.esTu) || a.nombre.localeCompare(b.nombre, "es"),
  )

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-8 px-6 pt-8 pb-28">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Ajustes</h1>

      {hogar?.name && <HogarSection nombre={hogar.name} />}

      {hogar?.join_code && (
        <EntradaHogarSection
          codigo={hogar.join_code}
          esResponsable={esResponsable}
          administrados={administrados}
          invitaciones={invitaciones}
        />
      )}

      {esResponsable && (
        <SolicitudesSection solicitudes={solicitudes} administrados={administrados} />
      )}

      <IntegrantesSection integrantes={integrantes} esResponsable={esResponsable} />

      {yo && (
        <HorarioSection
          tipo={yo.tipo_horario}
          memberId={yo.id}
          variableConectado={syncPorMiembro.has(yo.id)}
          ultimaSync={syncPorMiembro.get(yo.id) ?? null}
          bloquesFijo={bloquesDe(yo.id)}
        />
      )}

      <CategoriasSection categorias={[...categorias.values()]} />

      <AgendaPrefsSection
        mostrarCategoria={hogar?.mostrar_categoria ?? true}
        ocultarSimbologia={hogar?.ocultar_simbologia ?? false}
      />

      <AparienciaSection />

      <CompartirApp />

      {yo && <SalirHogar esDueno={yo.is_owner} />}

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Sesión</h2>
        {user?.email && (
          <p className="text-sm text-foreground">
            Conectado como <span className="font-medium">{user.email}</span>
          </p>
        )}
        <form action={signOut}>
          <Button type="submit" variant="outline" size="lg" className="w-full">
            <LogOutIcon className="size-4" />
            Cerrar sesión
          </Button>
        </form>
      </section>
    </main>
  )
}
