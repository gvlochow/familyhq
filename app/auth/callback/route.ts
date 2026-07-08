import { NextResponse, type NextRequest } from "next/server"

import { createClient } from "@/lib/supabase/server"
import { getPostLoginRedirect } from "@/lib/supabase/post-login-redirect"

/**
 * Callback de OAuth (Google). Supabase redirige acá con un `code` en la URL
 * tras el consentimiento; lo intercambiamos por una sesión (esto setea las
 * cookies de auth vía el cliente de servidor) y de ahí aplicamos la misma
 * lógica de routing centralizada que usa el login con email
 * (getPostLoginRedirect): hogar existente -> home, si no -> onboarding.
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const code = searchParams.get("code")

  if (code) {
    const supabase = await createClient()
    const { error } = await supabase.auth.exchangeCodeForSession(code)

    if (!error) {
      const destino = await getPostLoginRedirect(supabase)
      return NextResponse.redirect(`${origin}${destino}`)
    }
  }

  // Sin code o el intercambio falló: de vuelta al login con un error visible.
  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
