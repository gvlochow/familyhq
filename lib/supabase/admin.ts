import 'server-only'

import { createClient } from '@supabase/supabase-js'
import type { Database } from '@/lib/database.types'

/**
 * ⚠️ SOLO SERVER — NUNCA importar desde un Client Component.
 *
 * Cliente admin con la service_role key: SALTA todas las políticas RLS.
 * Pensado para el cron de ingesta del rol (proceso de servidor), no para el
 * flujo normal de la app, que siempre pasa por RLS con la anon key.
 *
 * El import de 'server-only' hace fallar el build si este módulo termina en un
 * bundle del browser. La service_role key jamás debe exponerse al cliente.
 *
 * No usa cookies ni sesión: cada operación viene con su household_id explícito.
 * Al saltar RLS, la responsabilidad del aislamiento multi-tenant es de quien
 * llame a este cliente.
 */
export function createAdminClient() {
  return createClient<Database>(
    process.env.NEXT_PUBLIC_SUPABASE_URL!,
    process.env.SUPABASE_SERVICE_ROLE_KEY!,
    {
      auth: {
        autoRefreshToken: false,
        persistSession: false,
      },
    }
  )
}
