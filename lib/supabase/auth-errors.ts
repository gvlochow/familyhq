/**
 * Traduce los mensajes de error de Supabase Auth (GoTrue) a español chileno
 * legible. Los mensajes de GoTrue vienen en inglés y en texto libre (no hay
 * códigos estables para todos los casos), así que se matchea por substring.
 *
 * Si no reconocemos el mensaje, mostramos el original de todas formas (con
 * prefijo) para no ocultar información útil al depurar.
 */
const MENSAJES: Array<[patron: RegExp, mensaje: string]> = [
  [/invalid login credentials/i, "Correo o contraseña incorrectos."],
  [/email not confirmed/i, "Debes confirmar tu correo antes de iniciar sesión. Revisa tu bandeja de entrada."],
  [/user already registered/i, "Ya existe una cuenta con ese correo. Intenta iniciar sesión."],
  [/password should be at least/i, "La contraseña es muy corta. Debe tener al menos 6 caracteres."],
  [/unable to validate email address/i, "El correo ingresado no tiene un formato válido."],
  [/email rate limit exceeded/i, "Se enviaron demasiados correos en poco tiempo. Espera unos minutos e intenta de nuevo."],
  [/for security purposes.*after \d+ seconds/i, "Espera unos segundos antes de intentar de nuevo."],
  [/network|fetch failed|failed to fetch/i, "No se pudo conectar. Revisa tu conexión a internet e intenta de nuevo."],
]

export function translateAuthError(message: string): string {
  const match = MENSAJES.find(([patron]) => patron.test(message))
  if (match) return match[1]
  return `No se pudo completar la operación: ${message}`
}
