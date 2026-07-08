import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"

// Placeholder: el flujo real de creación de hogar se construye después.
export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Si ya tiene hogar, no hay nada que onboardear: lo mandamos a su destino real.
  const destino = await getPostLoginRedirect(supabase)
  if (destino !== ONBOARDING_ROUTE) {
    redirect(destino)
  }

  return (
    <main className="flex min-h-svh flex-col items-center justify-center gap-4 bg-background p-6 text-center">
      <h1 className="font-heading text-xl font-semibold text-foreground">
        Crear hogar
      </h1>
      <p className="text-muted-foreground">Pendiente.</p>
    </main>
  )
}
