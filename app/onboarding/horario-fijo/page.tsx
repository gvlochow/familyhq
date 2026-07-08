import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_HORARIO_FIJO_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"
import { FixedScheduleForm } from "@/components/onboarding/fixed-schedule-form"

// Paso 3, camino 'fijo': definir el horario por día. La guarda usa la MISMA
// lógica de routing central: solo llega acá quien tiene tipo_horario = 'fijo'
// sin bloques configurados todavía.
export default async function OnboardingHorarioFijoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const destino = await getPostLoginRedirect(supabase)
  if (destino !== ONBOARDING_HORARIO_FIJO_ROUTE) {
    redirect(destino)
  }

  return (
    <main className="bg-background">
      <FixedScheduleForm />
    </main>
  )
}
