import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { getPostLoginRedirect } from "@/lib/supabase/post-login-redirect"
import { AcceptInvite } from "@/components/onboarding/accept-invite"

/**
 * Aterrizaje del enlace de invitación por correo. Llega autenticado (vía
 * /auth/callback). Si ya pertenece a un hogar, la aceptación no aplica: lo
 * mandamos a su destino real. Si no, muestra el botón para aceptar (la RPC
 * aceptar_invitacion valida que el correo de la sesión sea el invitado).
 */
export default async function OnboardingInvitacionPage({
  searchParams,
}: {
  searchParams: Promise<{ token?: string }>
}) {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  // Si ya tiene member (o solicitud pendiente, etc.), no hay invitación que
  // aceptar: routing central decide a dónde va.
  const { data: yo } = await supabase
    .from("members")
    .select("id")
    .eq("user_id", user.id)
    .maybeSingle()
  if (yo) {
    redirect(await getPostLoginRedirect(supabase))
  }

  const { token } = await searchParams

  return (
    <main className="bg-background">
      <AcceptInvite token={token ?? null} />
    </main>
  )
}
