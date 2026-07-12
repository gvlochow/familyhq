import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_INTEGRANTES_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"
import { AddMembersForm } from "@/components/onboarding/add-members-form"

// Paso 4 del onboarding (opcional): agregar integrantes al hogar. Misma guarda
// central que el resto: si el hogar ya completó el onboarding, getPostLoginRedirect
// manda al home y esta pantalla no se muestra.
export default async function OnboardingIntegrantesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const destino = await getPostLoginRedirect(supabase)
  if (destino !== ONBOARDING_INTEGRANTES_ROUTE) {
    redirect(destino)
  }

  // Integrantes ya agregados: todos los del hogar menos el propio usuario.
  const { data: members } = await supabase
    .from("members")
    .select("id, display_name, rol, tipo_horario, user_id")

  const yaAgregados = (members ?? []).filter((m) => m.user_id !== user.id)

  return (
    <main className="bg-background">
      <AddMembersForm yaAgregados={yaAgregados} />
    </main>
  )
}
