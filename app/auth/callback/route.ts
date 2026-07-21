import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getPostLoginRedirect } from "@/lib/supabase/post-login-redirect"
import { esRedirectInternoSeguro } from "@/lib/supabase/safe-redirect"

/**
 * Callback de auth. Supabase redirige acá con un `code` en la URL (OAuth de
 * Google, o el magic link / invitación por email); lo intercambiamos por una
 * sesión (setea las cookies vía el cliente de servidor). El destino:
 *   - si viene un `next` INTERNO seguro (p.ej. aceptar una invitación), va ahí;
 *   - si no, aplica el routing centralizado (getPostLoginRedirect): hogar
 *     existente -> home, si no -> onboarding.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")
  const next = searchParams.get("next")

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      if (esRedirectInternoSeguro(next)) {
        return NextResponse.redirect(`${origin}${next}`)
      }
      const destino = await getPostLoginRedirect(supabase)
      return NextResponse.redirect(`${origin}${destino}`)
    }
  }

  // Sin code o el intercambio falló: de vuelta al login con un error visible.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
