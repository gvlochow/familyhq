import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"
import { JoinHouseholdForm } from "@/components/onboarding/join-household-form"

// Rama "unirse" del paso 1: ingresar el código y solicitar el ingreso.
// Alcanzable solo mientras el usuario esté en el punto de elección.
export default async function OnboardingUnirsePage() {
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
      <JoinHouseholdForm />
    </main>
  )
}
