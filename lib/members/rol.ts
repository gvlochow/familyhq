/**
 * Rol de un member dentro del hogar. Espeja los valores de members.rol
 * (el esquema lo deja como text libre a propósito, pero el dominio es cerrado):
 *   - 'sostenedor' : adulto que sostiene/administra el hogar.
 *   - 'integrante' : cualquier otro integrante (default del esquema).
 *
 * database.types tipa la columna como `string`; este módulo es la fuente de
 * verdad tipada (CLAUDE.md: enums tipados, no strings sueltos).
 */
export type Rol = "sostenedor" | "integrante"

export const ROLES = ["sostenedor", "integrante"] as const

export function esRol(valor: unknown): valor is Rol {
  return (
    typeof valor === "string" && (ROLES as readonly string[]).includes(valor)
  )
}
