import { createServerClient } from '@supabase/ssr'
import { NextResponse, type NextRequest } from 'next/server'
import type { Database } from '@/lib/database.types'

/**
 * Refresca la sesión de Supabase en cada request desde el proxy (antes
 * "middleware", renombrado en Next.js 16). Reescribe las cookies de auth
 * tanto en el request que sigue hacia la app como en la respuesta al browser,
 * para que la sesión no expire entre navegaciones.
 *
 * Se usa desde el proxy.ts de la raíz. No pongas lógica de autorización acá:
 * el proxy es solo para refrescar la sesión. La autorización real va en cada
 * Server Action / route handler, respaldada por RLS.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request })

  const supabase = createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return request.cookies.getAll()
        },
        setAll(cookiesToSet) {
          cookiesToSet.forEach(({ name, value }) =>
            request.cookies.set(name, value)
          )
          response = NextResponse.next({ request })
          cookiesToSet.forEach(({ name, value, options }) =>
            response.cookies.set(name, value, options)
          )
        },
      },
    }
  )

  // IMPORTANTE: no metas código entre createServerClient y getClaims().
  // Un error acá puede hacer que las sesiones se cierren de forma aleatoria y
  // muy difícil de depurar. getClaims() dispara el refresco del token.
  await supabase.auth.getClaims()

  return response
}
