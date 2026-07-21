"use server"

import { headers } from "next/headers"
import { revalidatePath } from "next/cache"

import { createClient } from "@/lib/supabase/server"
import { createAdminClient } from "@/lib/supabase/admin"
import { esAccionSolicitud, type AccionSolicitud } from "@/lib/hogar/estados"

type Resultado = { error?: string }

/**
 * Resuelve una solicitud de ingreso: aprobar (crea el member, opcionalmente
 * vinculado a un perfil administrado), rechazar o bloquear. Toda la autorización
 * (ser responsable del hogar, solicitud pendiente) vive en la RPC resolver_ingreso.
 */
export async function resolverSolicitud(
  requestId: string,
  accion: AccionSolicitud,
  linkMemberId?: string | null,
): Promise<Resultado> {
  if (!esAccionSolicitud(accion)) return { error: "Acción inválida." }

  const supabase = await createClient()
  const { error } = await supabase.rpc("resolver_ingreso", {
    p_request_id: requestId,
    p_accion: accion,
    p_link_member_id: linkMemberId ?? undefined,
  })
  if (error) {
    return { error: error.message || "No se pudo resolver la solicitud." }
  }

  revalidatePath("/ajustes")
  revalidatePath("/")
  return {}
}

/**
 * Invita a un correo a unirse al hogar. La RPC crear_invitacion persiste la
 * invitación (autoriza que seas responsable) y devuelve un token; con él armamos
 * el enlace de aceptación y disparamos el correo por Supabase.
 *
 * Envío: inviteUserByEmail (crea la cuenta si no existe y manda el correo de
 * invitación). Si la persona YA tiene cuenta, ese método falla, así que caemos a
 * un magic link (signInWithOtp). Si tampoco sale el correo, devolvemos el enlace
 * para compartirlo a mano — la invitación ya quedó guardada de todas formas.
 */
export async function invitarPorEmail(
  email: string,
  linkMemberId?: string | null,
): Promise<Resultado & { link?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("crear_invitacion", {
    p_email: email,
    p_link_member_id: linkMemberId ?? undefined,
  })
  if (error) {
    return { error: error.message || "No se pudo crear la invitación." }
  }

  const token = (data as { token?: string } | null)?.token
  const correo = (data as { email?: string } | null)?.email ?? email.trim().toLowerCase()
  if (!token) return { error: "No se pudo generar la invitación." }

  // Origen del sitio desde los headers de la petición (no hay env de site URL).
  const h = await headers()
  const proto = h.get("x-forwarded-proto") ?? "https"
  const host = h.get("x-forwarded-host") ?? h.get("host")
  const origin = `${proto}://${host}`

  // El enlace pasa por /auth/callback (ruta ya permitida) que, tras crear la
  // sesión, redirige a la página de aceptación con el token.
  const destinoInterno = `/onboarding/invitacion?token=${token}`
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(destinoInterno)}`

  const admin = createAdminClient()
  const { error: inviteErr } = await admin.auth.admin.inviteUserByEmail(correo, {
    redirectTo,
  })

  if (inviteErr) {
    // Probablemente la cuenta ya existe: intenta un magic link.
    const { error: otpErr } = await supabase.auth.signInWithOtp({
      email: correo,
      options: { emailRedirectTo: redirectTo, shouldCreateUser: false },
    })
    if (otpErr) {
      revalidatePath("/ajustes")
      return {
        error:
          "La invitación se guardó, pero no pudimos enviar el correo. Comparte este enlace a mano.",
        link: redirectTo,
      }
    }
  }

  revalidatePath("/ajustes")
  return { link: redirectTo }
}

/** Revoca una invitación pendiente. RPC revocar_invitacion (responsable). */
export async function revocarInvitacion(id: string): Promise<Resultado> {
  const supabase = await createClient()
  const { error } = await supabase.rpc("revocar_invitacion", { p_id: id })
  if (error) return { error: error.message || "No se pudo revocar." }

  revalidatePath("/ajustes")
  return {}
}

/** Rota el código del hogar. RPC rotar_codigo_hogar (responsable). Devuelve el nuevo. */
export async function rotarCodigo(): Promise<Resultado & { codigo?: string }> {
  const supabase = await createClient()
  const { data, error } = await supabase.rpc("rotar_codigo_hogar")
  if (error) return { error: error.message || "No se pudo rotar el código." }

  revalidatePath("/ajustes")
  return { codigo: (data as string | null) ?? undefined }
}
