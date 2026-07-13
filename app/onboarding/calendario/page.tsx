import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_CALENDARIO_ROUTE,
  onboardingStepGuard,
} from "@/lib/supabase/post-login-redirect"
import { ConnectCalendarForm } from "@/components/onboarding/connect-calendar-form"

// Paso 3, camino 'variable': conectar el feed iCal del rol. Guarda que permite
// volver atrás; solo la ve quien tiene tipo_horario = 'variable'.
export default async function OnboardingCalendarioPage() {
  const supabase = await createClient()

  const destino = await onboardingStepGuard(supabase, ONBOARDING_CALENDARIO_ROUTE)
  if (destino) {
    redirect(destino)
  }

  return (
    <main className="bg-background">
      <ConnectCalendarForm />
    </main>
  )
}
