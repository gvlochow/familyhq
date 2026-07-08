import { createBrowserClient } from '@supabase/ssr'
import type { Database } from '@/lib/database.types'

/**
 * Cliente de Supabase para Client Components (corre en el browser).
 *
 * Usa exclusivamente las variables públicas (NEXT_PUBLIC_*). La service_role
 * key NUNCA debe llegar acá: ver lib/supabase/admin.ts (server-only).
 *
 * Tipado con `Database` para autocompletado y chequeo de tipos en las queries.
 */
export function createClient() {
  return createBrowserClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!
  )
}
