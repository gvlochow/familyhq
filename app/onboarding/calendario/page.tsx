import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_CALENDARIO_ROUTE,
  onboardingStepGuard,
} from "@/lib/supabase/post-login-redirect"
import { ConnectCalendarForm } from "@/components/onboarding/connect-calendar-form"

// Paso 3, camino 'variable': conectar el feed iCal del rol. Guarda que permite
// volver atrás; solo la ve quien tiene tipo_horario = 'variable'.
export default async function OnboardingCalendarioPage() {
  const supabase = await createClient()

  const destino = await onboardingStepGuard(supabase, ONBOARDING_CALENDARIO_ROUTE)
  if (destino) {
    redirect(destino)
  }

  // ¿Ya conectó su calendario? (posible al volver atrás desde el paso 4). Si es
  // así, el form deja continuar sin re-pegar la URL secreta.
  const {
    data: { user },
  } = await supabase.auth.getUser()
  const { data: yo } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user!.id)
    .maybeSingle()
  const { data: conexion } = yo
    ? await supabase
        .from("roster_connections")
        .select("id")
        .eq("member_id", yo.id)
        .maybeSingle()
    : { data: null }

  return (
    <main className="bg-background">
      <ConnectCalendarForm yaConectado={!!conexion} />
    </main>
  )
}
