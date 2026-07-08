import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_HORARIO_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"

// Placeholder: el paso real de "tipo de horario" se construye después. La guarda
// reusa la lógica de routing central — sin sesión -> login; sin hogar todavía ->
// crear hogar; si ya definió su tipo de horario -> home.
export default async function OnboardingHorarioPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const destino = await getPostLoginRedirect(supabase)
  if (destino !== ONBOARDING_HORARIO_ROUTE) {
    redirect(destino)
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="font-heading text-xl font-semibold text-foreground">
        Tipo de horario
      </h1>
      <p className="text-muted-foreground">Pendiente.</p>
    </main>
  )
}
