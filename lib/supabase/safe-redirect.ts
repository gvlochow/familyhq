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
