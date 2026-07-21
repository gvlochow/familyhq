import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_ESPERANDO_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"
import { WaitingApproval } from "@/components/onboarding/waiting-approval"

// Pantalla de espera: solo para quien tiene una solicitud de ingreso PENDIENTE
// (sin hogar propio todavía). En cuanto lo aprueban, la guarda central lo mueve
// al siguiente paso; si la rechazan, vuelve a la elección.
export default async function OnboardingEsperandoPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const destino = await getPostLoginRedirect(supabase)
  if (destino !== ONBOARDING_ESPERANDO_ROUTE) {
    redirect(destino)
  }

  return (
    <main className="bg-background">
      <WaitingApproval />
    </main>
  )
}
