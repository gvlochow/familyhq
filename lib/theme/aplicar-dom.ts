/**
 * Escritura al DOM del tema/modo (solo cliente). La lógica pura vive en temas.ts;
 * acá se toca <html> y el meta theme-color. Lo usan el selector de Apariencia y el
 * sincronizador global (theme-sync); el primer pintado lo cubre el script inline
 * (theme-script) para no parpadear.
 */
import {
  resolverOscuro,
  type ModoColor,
  type TemaId,
} from "./temas"

/** ¿El equipo prefiere oscuro ahora? (matchMedia; false en SSR/sin soporte). */
export function sistemaPrefiereOscuro(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(prefers-color-scheme: dark)").matches
  )
}

/**
 * Aplica tema + modo a <html>: setea data-theme, alterna la clase .dark y ajusta
 * el meta theme-color (barra del sistema en PWA) al color primario resuelto.
 */
export function aplicarTema(tema: TemaId, modo: ModoColor): void {
  if (typeof document === "undefined") return
  const el = document.documentElement
  const oscuro = resolverOscuro(modo, sistemaPrefiereOscuro())

  el.setAttribute("data-theme", tema)
  el.classList.toggle("dark", oscuro)

  // theme-color = el --primary ya resuelto (la banda del header). Se lee tras
  // aplicar las clases para tomar el valor del tema/modo vigente.
  const primary = getComputedStyle(el).getPropertyValue("--primary").trim()
  if (primary) {
    let meta = document.querySelector<HTMLMetaElement>('meta[name="theme-color"]')
    if (!meta) {
      meta = document.createElement("meta")
      meta.name = "theme-color"
      document.head.appendChild(meta)
    }
    meta.content = primary
  }
}
