import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/**
 * Rutas de destino tras autenticarse. Único lugar donde se definen: la base
 * del "retoma donde quedó" — si esto cambia, cambia acá y en ningún otro
 * lado.
 */
export const APP_HOME_ROUTE = "/"
export const ONBOARDING_ROUTE = "/onboarding"
export const ONBOARDING_HORARIO_ROUTE = "/onboarding/horario"

/**
 * Decide a dónde mandar a alguien recién autenticado (login, registro u OAuth),
 * y también dónde "retoma donde quedó" el onboarding. Es el único lugar donde
 * vive esta decisión: la usan el formulario de auth (cliente, tras signIn/signUp
 * con email), el callback de OAuth (servidor, tras intercambiar el code) y las
 * guardas de las rutas de app y onboarding.
 *
 * Escalones, en orden:
 *   1. Sin member (no pertenece a ningún hogar)  -> crear hogar (onboarding).
 *   2. Con member pero tipo_horario = 'ninguno'  -> definir tipo de horario.
 *   3. Con member y tipo_horario ya definido     -> home de la app.
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
    .select("tipo_horario")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    // Si algo falla al resolver la membresía, no dejamos a la persona
    // varada: el onboarding es seguro de reintentar.
    return ONBOARDING_ROUTE
  }

  // Sin member -> todavía no tiene hogar: primer paso del onboarding.
  if (!data) {
    return ONBOARDING_ROUTE
  }

  // Tiene hogar pero aún no definió su tipo de horario: siguiente paso.
  if (data.tipo_horario === "ninguno") {
    return ONBOARDING_HORARIO_ROUTE
  }

  return APP_HOME_ROUTE
}
