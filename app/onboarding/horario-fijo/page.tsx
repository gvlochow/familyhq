import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_HORARIO_FIJO_ROUTE,
  onboardingStepGuard,
} from "@/lib/supabase/post-login-redirect"
import { FixedScheduleForm } from "@/components/onboarding/fixed-schedule-form"

// Paso 3, camino 'fijo': definir el horario por día. Guarda que permite volver
// atrás; solo la ve quien tiene tipo_horario = 'fijo' (onboardingStepGuard valida
// que la ruta de config corresponda al tipo).
export default async function OnboardingHorarioFijoPage() {
  const supabase = await createClient()

  const destino = await onboardingStepGuard(supabase, ONBOARDING_HORARIO_FIJO_ROUTE)
  if (destino) {
    redirect(destino)
  }

  return (
    <main className="bg-background">
      <FixedScheduleForm />
    </main>
  )
}
