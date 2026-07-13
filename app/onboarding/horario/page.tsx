import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_HORARIO_ROUTE,
  onboardingStepGuard,
} from "@/lib/supabase/post-login-redirect"
import { ChooseScheduleForm } from "@/components/onboarding/choose-schedule-form"

// Paso 2 del onboarding: definir el tipo de horario. Guarda que permite volver
// atrás (onboardingStepGuard): deja renderizar este paso si ya se alcanzó, y
// redirige si se salta adelante o si el onboarding ya terminó.
export default async function OnboardingHorarioPage() {
  const supabase = await createClient()

  const destino = await onboardingStepGuard(supabase, ONBOARDING_HORARIO_ROUTE)
  if (destino) {
    redirect(destino)
  }

  return (
    <main className="bg-background">
      <ChooseScheduleForm />
    </main>
  )
}
