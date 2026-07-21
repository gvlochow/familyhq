import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/**
 * Rutas de destino tras autenticarse. Único lugar donde se definen: la base
 * del "retoma donde quedó" — si esto cambia, cambia acá y en ningún otro
 * lado.
 */
export const APP_HOME_ROUTE = "/"
export const ONBOARDING_ROUTE = "/onboarding"
export const ONBOARDING_CREAR_ROUTE = "/onboarding/crear"
export const ONBOARDING_UNIRSE_ROUTE = "/onboarding/unirse"
export const ONBOARDING_ESPERANDO_ROUTE = "/onboarding/esperando"
export const ONBOARDING_HORARIO_ROUTE = "/onboarding/horario"
export const ONBOARDING_HORARIO_FIJO_ROUTE = "/onboarding/horario-fijo"
export const ONBOARDING_CALENDARIO_ROUTE = "/onboarding/calendario"
export const ONBOARDING_INTEGRANTES_ROUTE = "/onboarding/integrantes"

/**
 * Ruta del paso de configuración según el tipo de horario. Fuente única de ese
 * mapeo: la usan la guarda, el form de tipo de horario y el "volver" del paso 4.
 */
export function rutaConfigDeTipo(tipoHorario: string | null | undefined): string | null {
  if (tipoHorario === "fijo") return ONBOARDING_HORARIO_FIJO_ROUTE
  if (tipoHorario === "variable") return ONBOARDING_CALENDARIO_ROUTE
  return null
}

/**
 * Decide a dónde mandar a alguien recién autenticado (login, registro u OAuth),
 * y también dónde "retoma donde quedó" el onboarding. Es el único lugar donde
 * vive esta decisión: la usan el formulario de auth (cliente, tras signIn/signUp
 * con email), el callback de OAuth (servidor, tras intercambiar el code) y las
 * guardas de las rutas de app y onboarding.
 *
 * Escalones, en orden:
 *   1. Sin member:
 *        - con solicitud de ingreso pendiente -> pantalla de espera.
 *        - sin solicitud                      -> elegir crear/unirse (onboarding).
 *   2. Con member pero tipo_horario = 'ninguno'  -> definir tipo de horario.
 *   3. Con tipo definido pero SIN configurar     -> configuración según el tipo:
 *        'variable' sin roster_connection -> conectar calendario.
 *        'fijo'     sin fixed_schedules    -> bloques por día.
 *   4. Configurado pero onboarding sin completar -> paso opcional de integrantes.
 *   5. Configurado y onboarding completado        -> home de la app.
 *
 * Funciona igual con el cliente de servidor o de browser: ambos exponen el
 * mismo tipo `SupabaseClient<Database>`.
 */
export async function getPostLoginRedirect(
  supabase: SupabaseClient<Database>
): Promise<string> {
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    // No debería pasar (se llama justo después de autenticarse), pero si
    // pasa no hay sesión que resolver: de vuelta al login.
    return "/login"
  }

  const { data, error } = await supabase
    .from("members")
    .select("id, tipo_horario, calendario_omitido, households(onboarding_completed)")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    // Si algo falla al resolver la membresía, no dejamos a la persona
    // varada: el onboarding es seguro de reintentar.
    return ONBOARDING_ROUTE
  }

  // Sin member -> todavía no tiene hogar. Si ya solicitó ingreso a un hogar y
  // sigue pendiente, va a la pantalla de espera; si no, a elegir crear/unirse.
  if (!data) {
    const { data: solicitud } = await supabase
      .from("household_join_requests")
      .select("id")
      .eq("user_id", user.id)
      .eq("status", "pendiente")
      .maybeSingle()

    return solicitud ? ONBOARDING_ESPERANDO_ROUTE : ONBOARDING_ROUTE
  }

  // Tiene hogar pero aún no definió su tipo de horario: siguiente paso.
  if (data.tipo_horario === "ninguno") {
    return ONBOARDING_HORARIO_ROUTE
  }

  // Tiene tipo definido: falta la configuración correspondiente. Se considera
  // configurado cuando existe al menos una fila en la tabla de su tipo.
  if (data.tipo_horario === "variable") {
    const { data: conexion } = await supabase
      .from("roster_connections")
      .select("id")
      .eq("member_id", data.id)
      .maybeSingle()

    // "Configurado" = conectó el calendario O eligió dejarlo para más tarde
    // (calendario_omitido). Sin la segunda condición, omitir devolvería al mismo
    // paso en loop. Conecta después desde Ajustes.
    if (!conexion && !data.calendario_omitido) {
      return ONBOARDING_CALENDARIO_ROUTE
    }
  } else if (data.tipo_horario === "fijo") {
    const { data: bloque } = await supabase
      .from("fixed_schedules")
      .select("id")
      .eq("member_id", data.id)
      .limit(1)
      .maybeSingle()

    if (!bloque) {
      return ONBOARDING_HORARIO_FIJO_ROUTE
    }
  }

  // Configurado. Falta el paso OPCIONAL de integrantes si el hogar todavía no
  // marcó el onboarding como completado. El dato viene embebido en el select de
  // arriba (households es to-one vía members.household_id).
  const hogar = Array.isArray(data.households) ? data.households[0] : data.households
  if (hogar && !hogar.onboarding_completed) {
    return ONBOARDING_INTEGRANTES_ROUTE
  }

  return APP_HOME_ROUTE
}

/**
 * Índice ordinal de cada paso del onboarding. Las dos rutas de configuración
 * (fijo / calendario) comparten índice 2: son el mismo paso, distinto según el
 * tipo de horario.
 */
const ONBOARDING_STEP_INDEX: Record<string, number> = {
  [ONBOARDING_ROUTE]: 0,
  [ONBOARDING_HORARIO_ROUTE]: 1,
  [ONBOARDING_HORARIO_FIJO_ROUTE]: 2,
  [ONBOARDING_CALENDARIO_ROUTE]: 2,
  [ONBOARDING_INTEGRANTES_ROUTE]: 3,
}

/**
 * Guarda de un paso del onboarding que PERMITE volver atrás. A diferencia del
 * chequeo estricto (destino === estaRuta), deja renderizar cualquier paso YA
 * alcanzado, y solo redirige si:
 *   - no hay sesión -> login;
 *   - el onboarding ya terminó -> home;
 *   - se intenta saltar a un paso posterior al actual -> paso actual;
 *   - es una ruta de config que no corresponde al tipo del usuario -> la correcta.
 *
 * Devuelve la ruta a la que redirigir, o null si esta pantalla puede renderizar.
 * Como habilita volver, el AVANCE de cada paso ya no puede depender del rebote de
 * la guarda (router.refresh): los formularios navegan explícitamente (router.push).
 */
export async function onboardingStepGuard(
  supabase: SupabaseClient<Database>,
  estaRuta: string
): Promise<string | null> {
  const {
    data: { user },
  } = await supabase.auth.getUser()
  if (!user) return "/login"

  const actual = await getPostLoginRedirect(supabase)
  if (actual === "/login") return "/login"
  if (actual === APP_HOME_ROUTE) return APP_HOME_ROUTE // onboarding ya terminado

  const idxEsta = ONBOARDING_STEP_INDEX[estaRuta]
  const idxActual = ONBOARDING_STEP_INDEX[actual]

  // No saltar hacia adelante a un paso que aún no corresponde.
  if (idxEsta > idxActual) return actual

  // Paso de configuración (idx 2): solo la ruta que corresponde al tipo del
  // usuario (un 'variable' no debe ver el form de horario fijo y viceversa).
  if (idxEsta === 2) {
    const { data: m } = await supabase
      .from("members")
      .select("tipo_horario")
      .eq("user_id", user.id)
      .maybeSingle()
    const rutaConfig = rutaConfigDeTipo(m?.tipo_horario)
    if (rutaConfig && estaRuta !== rutaConfig) return rutaConfig
  }

  return null
}
