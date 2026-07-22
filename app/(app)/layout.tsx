import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  APP_HOME_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"
import { TabBar } from "@/components/nav/tab-bar"
import { ConfirmProvider } from "@/components/ui/confirm-dialog"

/**
 * Guarda de acceso para toda la app autenticada (grupo de rutas (app), sin
 * efecto en la URL). Centraliza acá el "retoma donde quedó": sin sesión -> al
 * login; con sesión pero sin hogar -> al onboarding; si no, deja pasar.
 *
 * Esto es una revisión optimista (afecta el renderizado inicial de la ruta),
 * no el único mecanismo de seguridad: RLS sigue siendo la barrera real sobre
 * los datos.
 */
export default async function AppLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const destino = await getPostLoginRedirect(supabase)
  if (destino !== APP_HOME_ROUTE) {
    redirect(destino)
  }

  return (
    <ConfirmProvider>
      {children}
      <TabBar />
    </ConfirmProvider>
  )
}
