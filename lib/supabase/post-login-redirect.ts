import type { SupabaseClient } from "@supabase/supabase-js"
import type { Database } from "@/lib/database.types"

/**
 * Rutas de destino tras autenticarse. Único lugar donde se definen: la base
 * del "retoma donde quedó" — si esto cambia, cambia acá y en ningún otro
 * lado.
 */
export const APP_HOME_ROUTE = "/"
export const ONBOARDING_ROUTE = "/onboarding"

/**
 * Decide a dónde mandar a alguien recién autenticado (login, registro u
 * OAuth): si ya tiene un member (o sea, pertenece a un hogar) va al home de
 * la app; si no, al onboarding de creación de hogar.
 *
 * Punto único de esta decisión: la usan tanto el formulario de auth (cliente,
 * tras signIn/signUp con email) como el callback de OAuth (servidor, tras
 * intercambiar el code), para que la lógica de routing no quede dispersa.
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
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()

  if (error) {
    // Si algo falla al resolver la membresía, no dejamos a la persona
    // varada: el onboarding es seguro de reintentar.
    return ONBOARDING_ROUTE
  }

  return data ? APP_HOME_ROUTE : ONBOARDING_ROUTE
}
