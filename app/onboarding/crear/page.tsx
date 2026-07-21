import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"
import { CreateHouseholdForm } from "@/components/onboarding/create-household-form"

// Rama "crear" del paso 1: nombrar el hogar. Alcanzable solo mientras el usuario
// esté en el punto de elección (sin hogar y sin solicitud pendiente).
export default async function OnboardingCrearPage() {
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
      <CreateHouseholdForm backHref={ONBOARDING_ROUTE} />
    </main>
  )
}
