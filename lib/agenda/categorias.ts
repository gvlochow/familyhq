/**
 * Paleta curada de colores para las categorías de la agenda. PURO: sin Next.js ni
 * Supabase. La columna categorias.color guarda la CLAVE de la paleta; la UI la mapea
 * a un hex (dot de color). Guardar la clave (no el hex) permite recolorar toda la
 * paleta sin migrar datos.
 */

export interface ColorCategoria {
  clave: string
  nombre: string
  hex: string
}

/** ~8 colores distinguibles y con buen contraste en claro y oscuro. */
export const PALETA_CATEGORIAS: readonly ColorCategoria[] = [
  { clave: "navy", nombre: "Azul", hex: "#284B63" },
  { clave: "salvia", nombre: "Verde", hex: "#5E9C6B" },
  { clave: "ambar", nombre: "Ámbar", hex: "#E0A020" },
  { clave: "rojo", nombre: "Rojo", hex: "#E05252" },
  { clave: "rosa", nombre: "Rosa", hex: "#E06AA0" },
  { clave: "morado", nombre: "Morado", hex: "#8B6FD1" },
  { clave: "celeste", nombre: "Celeste", hex: "#3FA3DE" },
  { clave: "gris", nombre: "Gris", hex: "#8A94A0" },
]

export const COLOR_CATEGORIA_DEFECTO = "gris"

const POR_CLAVE = new Map(PALETA_CATEGORIAS.map((c) => [c.clave, c]))

export function esColorCategoria(v: unknown): v is string {
  return typeof v === "string" && POR_CLAVE.has(v)
}

/** hex de una clave de la paleta; cae a gris si la clave es desconocida. */
export function hexCategoria(clave: string): string {
  return (POR_CLAVE.get(clave) ?? POR_CLAVE.get(COLOR_CATEGORIA_DEFECTO)!).hex
}

/** Categoría ya resuelta para la vista (subconjunto de categorias). */
export interface CategoriaRef {
  id: string
  nombre: string
  /** clave de la paleta. */
  color: string
}
