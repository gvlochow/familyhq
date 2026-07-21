/**
 * ¿Es `next` una ruta interna segura para redirigir tras el callback de auth?
 *
 * Evita el open-redirect: solo rutas ABSOLUTAS del propio sitio ("/algo"),
 * nunca URLs externas ni protocol-relative ("//host", "/\\host") ni con esquema
 * ("https:..."). Se usa para encadenar el aterrizaje del magic link a una página
 * interna concreta (p.ej. aceptar una invitación) sin abrir un vector de phishing.
 */
export function esRedirectInternoSeguro(next: string | null | undefined): next is string {
  if (!next) return false
  // Debe empezar en "/" pero no en "//" ni "/\" (protocol-relative encubierto).
  if (!next.startsWith("/")) return false
  if (next.startsWith("//") || next.startsWith("/\\")) return false
  // Sin esquema embebido (defensa extra).
  if (next.includes("://")) return false
  return true
}

/**
 * Normaliza un `next` que puede venir como ruta relativa ("/x") o como URL
 * absoluta del propio sitio (lo que produce la plantilla de correo con
 * `{{ .RedirectTo }}`) a una ruta interna segura (pathname+search), o null si es
 * de otro origen o inválido. Bloquea el open-redirect a hosts externos.
 */
export function resolverNextSeguro(
  next: string | null | undefined,
  origin: string,
): string | null {
  if (!next) return null
  try {
    const u = new URL(next, origin)
    if (u.origin !== origin) return null
    return u.pathname + u.search
  } catch {
    return null
  }
}
