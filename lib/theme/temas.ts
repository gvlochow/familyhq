/**
 * Temas (paletas) y modo claro/oscuro. PURO: sin DOM ni Next.js, para poder
 * testear la lógica de resolución. La escritura al DOM vive en aplicar-dom.ts;
 * los tokens de color, en app/globals.css.
 *
 * Persistencia POR DISPOSITIVO (localStorage): el tema y el modo son una
 * preferencia personal —el modo oscuro sobre todo depende del equipo—, no un
 * dato del hogar. Por eso no hay migración ni RLS acá.
 */

export type TemaId = "puerto" | "bosque" | "ciruela"
export type ModoColor = "claro" | "oscuro" | "sistema"

export const TEMA_DEFAULT: TemaId = "puerto"
export const MODO_DEFAULT: ModoColor = "sistema"

/** Claves de localStorage (compartidas con el script anti-FOUC). */
export const STORAGE_TEMA = "fhq-tema"
export const STORAGE_MODO = "fhq-modo"

export interface TemaMeta {
  id: TemaId
  nombre: string
  descripcion: string
  /** Colores del tema en CLARO, para el swatch del selector. */
  swatch: { primary: string; secondary: string; accent: string; bg: string }
}

/** Los 3 temas disponibles. El orden es el del selector; Puerto es el default. */
export const TEMAS: readonly TemaMeta[] = [
  {
    id: "puerto",
    nombre: "Puerto",
    descripcion: "El azul de siempre",
    swatch: { primary: "#284b63", secondary: "#a7c4a0", accent: "#f2b94b", bg: "#fafbfc" },
  },
  {
    id: "bosque",
    nombre: "Bosque",
    descripcion: "Verde calmo",
    swatch: { primary: "#336654", secondary: "#c3d8b9", accent: "#e0a53c", bg: "#f7faf6" },
  },
  {
    id: "ciruela",
    nombre: "Ciruela",
    descripcion: "Cálido y tenue",
    swatch: { primary: "#6a4a6e", secondary: "#ddc9e0", accent: "#e0895c", bg: "#fbf8fb" },
  },
] as const

const IDS_TEMA = new Set<string>(TEMAS.map((t) => t.id))
const MODOS = new Set<string>(["claro", "oscuro", "sistema"])

export function esTemaId(v: unknown): v is TemaId {
  return typeof v === "string" && IDS_TEMA.has(v)
}

export function esModoColor(v: unknown): v is ModoColor {
  return typeof v === "string" && MODOS.has(v)
}

/** Normaliza un valor guardado (o basura) a un tema válido. */
export function temaValido(v: unknown): TemaId {
  return esTemaId(v) ? v : TEMA_DEFAULT
}

/** Normaliza un valor guardado (o basura) a un modo válido. */
export function modoValido(v: unknown): ModoColor {
  return esModoColor(v) ? v : MODO_DEFAULT
}

/**
 * ¿Debe mostrarse en oscuro? "oscuro"/"claro" mandan; "sistema" sigue la
 * preferencia del equipo (prefers-color-scheme).
 */
export function resolverOscuro(modo: ModoColor, sistemaPrefiereOscuro: boolean): boolean {
  if (modo === "oscuro") return true
  if (modo === "claro") return false
  return sistemaPrefiereOscuro
}
