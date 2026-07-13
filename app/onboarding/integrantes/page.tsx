import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_CALENDARIO_ROUTE,
  ONBOARDING_HORARIO_FIJO_ROUTE,
  ONBOARDING_INTEGRANTES_ROUTE,
  onboardingStepGuard,
} from "@/lib/supabase/post-login-redirect"
import { AddMembersForm } from "@/components/onboarding/add-members-form"

// Paso 4 del onboarding (opcional): agregar integrantes al hogar. Guarda que
// permite volver atrás: si el hogar ya completó el onboarding, redirige al home.
export default async function OnboardingIntegrantesPage() {
  const supabase = await createClient()

  const destino = await onboardingStepGuard(supabase, ONBOARDING_INTEGRANTES_ROUTE)
  if (destino) {
    redirect(destino)
  }

  const {
    data: { user },
  } = await supabase.auth.getUser()

  // Integrantes ya agregados: todos los del hogar menos el propio usuario.
  const { data: members } = await supabase
    .from("members")
    .select("id, display_name, rol, tipo_horario, user_id")

  const yo = (members ?? []).find((m) => m.user_id === user?.id)
  const yaAgregados = (members ?? []).filter((m) => m.user_id !== user?.id)

  // "Volver" apunta al paso de configuración según el tipo de horario del usuario.
  const backHref =
    yo?.tipo_horario === "fijo"
      ? ONBOARDING_HORARIO_FIJO_ROUTE
      : ONBOARDING_CALENDARIO_ROUTE

  return (
    <main className="bg-background">
      <AddMembersForm yaAgregados={yaAgregados} backHref={backHref} />
    </main>
  )
}
