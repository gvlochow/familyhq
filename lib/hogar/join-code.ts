/**
 * Código de hogar: string corto para compartir e invitar a unirse.
 *
 * Espeja EXACTAMENTE el generador SQL generar_codigo_hogar()
 * (migración 20260721120000): alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L),
 * 8 caracteres. Esta es la fuente de verdad tipada en el cliente; nadie más
 * debería tratar el código como string suelto.
 */
export const JOIN_CODE_ALFABETO = "ABCDEFGHJKMNPQRSTUVWXYZ23456789"
export const JOIN_CODE_LARGO = 8

/**
 * Normaliza lo que el usuario tipea al formato canónico que espera el servidor:
 * mayúsculas y sin espacios ni guiones. Coincide con la normalización de
 * solicitar_ingreso (upper + strip whitespace); además quita guiones porque el
 * código se MUESTRA agrupado ("ABCD-EFGH") y el usuario puede copiarlo así.
 */
export function normalizarCodigo(input: string): string {
  return input.replace(/[\s-]/g, "").toUpperCase()
}

/**
 * Validación de forma para el cliente (evita un viaje al servidor por un código
 * obviamente mal): largo exacto y solo caracteres del alfabeto. La autoridad
 * sigue siendo el servidor (existe/está vivo/no bloqueado).
 */
export function esCodigoValido(input: string): boolean {
  const codigo = normalizarCodigo(input)
  if (codigo.length !== JOIN_CODE_LARGO) return false
  for (const ch of codigo) {
    if (!JOIN_CODE_ALFABETO.includes(ch)) return false
  }
  return true
}

/**
 * Presentación agrupada en dos bloques de 4 ("ABCDEFGH" -> "ABCD-EFGH"), más
 * fácil de leer y dictar. Solo para mostrar; nunca para enviar (se envía
 * normalizado).
 */
export function formatearCodigo(codigo: string): string {
  const c = normalizarCodigo(codigo)
  if (c.length !== JOIN_CODE_LARGO) return c
  return `${c.slice(0, 4)}-${c.slice(4)}`
}
