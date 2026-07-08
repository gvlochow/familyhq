import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_CALENDARIO_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"
import { ConnectCalendarForm } from "@/components/onboarding/connect-calendar-form"

// Paso 3, camino 'variable': conectar el feed iCal del rol. La guarda usa la
// MISMA lógica de routing central: solo llega acá quien tiene tipo_horario =
// 'variable' sin roster_connection todavía.
export default async function OnboardingCalendarioPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const destino = await getPostLoginRedirect(supabase)
  if (destino !== ONBOARDING_CALENDARIO_ROUTE) {
    redirect(destino)
  }

  return (
    <main className="bg-background">
      <ConnectCalendarForm />
    </main>
  )
}
