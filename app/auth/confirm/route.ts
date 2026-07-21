import { NextResponse, type NextRequest } from "next/server"
import type { EmailOtpType } from "@supabase/supabase-js"

import { createClient } from "@/lib/supabase/server"
import { getPostLoginRedirect } from "@/lib/supabase/post-login-redirect"
import { resolverNextSeguro } from "@/lib/supabase/safe-redirect"

/**
 * Confirmación de enlaces de correo (invitación / magic link / recuperación).
 * A diferencia de /auth/callback (OAuth con `code` + PKCE), los correos traen un
 * `token_hash` + `type` que se canjea con verifyOtp — este es el flujo SSR
 * correcto para links de email, sin depender del code_verifier del browser.
 *
 * Requiere que la plantilla del correo apunte acá, p.ej.:
 *   {{ .SiteURL }}/auth/confirm?token_hash={{ .TokenHash }}&type={{ .Type }}&next={{ .RedirectTo }}
 */
export async function GET(request: NextRequest) {
  const { searchParams, origin } = new URL(request.url)
  const tokenHash = searchParams.get("token_hash")
  const type = searchParams.get("type") as EmailOtpType | null
  const next = resolverNextSeguro(searchParams.get("next"), origin)

  if (tokenHash && type) {
    const supabase = await createClient()
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash })

    if (!error) {
      if (next) {
        return NextResponse.redirect(`${origin}${next}`)
      }
      return NextResponse.redirect(`${origin}${await getPostLoginRedirect(supabase)}`)
    }
  }

  return NextResponse.redirect(`${origin}/login?error=auth_callback_failed`)
}
