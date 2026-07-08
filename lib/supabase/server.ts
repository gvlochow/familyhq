import { cookies } from 'next/headers'
import { createServerClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

/**
 * Cliente de Supabase para Server Components, Server Actions y route handlers.
 * Lee y escribe las cookies del request para mantener la sesión sincronizada.
 *
 * En Next.js 16 `cookies()` es asíncrono, por lo que este helper es `async`
 * y hay que hacerle `await` en cada uso.
 *
 * Tipado con `Database` para autocompletado y chequeo de tipos en las queries.
 */
export async function createClient() {
  const cookieStore = await cookies()

  return createServerClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
    {
      cookies: {
        getAll() {
          return cookieStore.getAll()
        },
        setAll(cookiesToSet) {
          try {
            cookiesToSet.forEach(({ name, value, options }) =>
              cookieStore.set(name, value, options)
            )
          } catch {
            // `setAll` fue llamado desde un Server Component, donde no se
            // pueden escribir cookies. Se ignora sin problema: el refresco de
            // sesión lo hace el proxy (proxy.ts), que sí puede setearlas.
          }
        },
      },
    }
  )
}
