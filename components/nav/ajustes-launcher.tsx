import { createClient } from "@/lib/supabase/server"
import { AjustesMenu } from "@/components/nav/ajustes-menu"

/**
 * Punto de entrada a Ajustes en el header de cada página (reemplaza a la tab del
 * bottom bar). Server Component: resuelve por su cuenta el nombre del hogar y el
 * email del usuario (una consulta liviana, RLS acota al hogar) y monta el menú
 * cliente. Así cada página solo agrega `<AjustesLauncher />` en su header, sin
 * pasar datos a mano.
 *
 * `tone` adapta el color del botón al fondo del header (banda navy del Inicio vs.
 * fondo claro del resto).
 */
export async function AjustesLauncher({
  tone = "dark",
}: {
  tone?: "light" | "dark"
}) {
  const supabase = await createClient()
  const [{ data: { user } }, { data: hogar }] = await Promise.all([
    supabase.auth.getUser(),
    supabase.from("households").select("name").limit(1).maybeSingle(),
  ])

  return (
    <AjustesMenu
      nombre={hogar?.name ?? "FamilyHQ"}
      email={user?.email ?? null}
      tone={tone}
    />
  )
}
