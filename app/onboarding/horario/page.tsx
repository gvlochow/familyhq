import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_HORARIO_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"
import { ChooseScheduleForm } from "@/components/onboarding/choose-schedule-form"

// Paso 2 del onboarding: definir el tipo de horario. La guarda usa la MISMA
// lógica de routing central que el resto de la app: sin sesión -> login; sin
// hogar todavía -> crear hogar; si ya definió su tipo de horario -> home.
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
    <main className="bg-background">
      <ChooseScheduleForm />
    </main>
  )
}
