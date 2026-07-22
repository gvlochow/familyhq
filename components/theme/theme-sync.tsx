"use client"

import { useEffect } from "react"

import { aplicarTema } from "@/lib/theme/aplicar-dom"
import {
  STORAGE_MODO,
  STORAGE_TEMA,
  modoValido,
  temaValido,
} from "@/lib/theme/temas"

/**
 * Sincronizador global del tema (sin UI). Va en el layout raíz para correr en
 * todas las páginas. Hace dos cosas que el script anti-FOUC no cubre:
 *  - fija el meta theme-color al color del tema vigente (aplicarTema),
 *  - si el modo es "Sistema", re-aplica cuando el equipo cambia de claro/oscuro.
 * El estado vive en localStorage; el selector (Apariencia) lo escribe.
 */
export function ThemeSync() {
  useEffect(() => {
    const leer = () => ({
      tema: temaValido(localStorage.getItem(STORAGE_TEMA)),
      modo: modoValido(localStorage.getItem(STORAGE_MODO)),
    })

    const { tema, modo } = leer()
    aplicarTema(tema, modo)

    // El listener solo importa para "Sistema"; para claro/oscuro es inocuo
    // (aplicarTema recomputa el modo guardado, que no depende del equipo).
    const mq = window.matchMedia("(prefers-color-scheme: dark)")
    const onCambio = () => {
      const actual = leer()
      if (actual.modo === "sistema") aplicarTema(actual.tema, actual.modo)
    }
    mq.addEventListener("change", onCambio)
    return () => mq.removeEventListener("change", onCambio)
  }, [])

  return null
}
