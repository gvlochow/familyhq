"use server"

import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"

/**
 * Cierra la sesión. Server Action: el cliente de servidor limpia las cookies de
 * auth y redirige al login. (signOut sí va por Server Action; el signIn/signUp
 * interactivos van por el cliente de browser, patrón SSR de Supabase — ver
 * PROJECT_LOG.)
 */
export async function signOut() {
  const supabase = await createClient()
  await supabase.auth.signOut()
  redirect("/login")
}
