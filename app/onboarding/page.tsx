import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"
import { CreateHouseholdForm } from "@/components/onboarding/create-household-form"

// Primer paso del onboarding: crear el hogar. La guarda usa la MISMA lógica de
// routing central que el resto de la app: sin sesión -> login; si ya avanzó más
// allá de este paso (ya tiene hogar) -> su destino real (tipo de horario u home).
export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const destino = await getPostLoginRedirect(supabase)
  if (destino !== ONBOARDING_ROUTE) {
    redirect(destino)
  }

  return (
    <main className="bg-background">
      <CreateHouseholdForm />
    </main>
  )
}
