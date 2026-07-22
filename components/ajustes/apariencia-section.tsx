"use client"

import { useSyncExternalStore } from "react"
import { CheckIcon, MonitorIcon, MoonIcon, SunIcon } from "lucide-react"

import { aplicarTema } from "@/lib/theme/aplicar-dom"
import {
  MODO_DEFAULT,
  STORAGE_MODO,
  STORAGE_TEMA,
  TEMAS,
  TEMA_DEFAULT,
  modoValido,
  temaValido,
  type ModoColor,
  type TemaId,
} from "@/lib/theme/temas"
import { cn } from "@/lib/utils"

const MODOS: { id: ModoColor; label: string; Icono: typeof SunIcon }[] = [
  { id: "claro", label: "Claro", Icono: SunIcon },
  { id: "oscuro", label: "Oscuro", Icono: MoonIcon },
  { id: "sistema", label: "Sistema", Icono: MonitorIcon },
]

/**
 * La preferencia vive en localStorage. Se lee con useSyncExternalStore (en vez de
 * useEffect+setState) para no desincronizar server/cliente ni parpadear: en el
 * render del servidor cae al default, y en el cliente toma lo guardado sin aviso
 * de hidratación. `guardar` notifica a los suscriptores para re-renderizar.
 */
const suscriptores = new Set<() => void>()

function suscribir(cb: () => void) {
  suscriptores.add(cb)
  window.addEventListener("storage", cb) // sincroniza entre pestañas
  return () => {
    suscriptores.delete(cb)
    window.removeEventListener("storage", cb)
  }
}

function guardar(clave: string, valor: string) {
  localStorage.setItem(clave, valor)
  suscriptores.forEach((cb) => cb())
}

/**
 * "Apariencia": elige el TEMA (paleta) y el MODO (claro/oscuro/sistema). La
 * preferencia es por dispositivo (localStorage); al elegir se aplica al instante
 * y se guarda. Los tokens de color viven en globals.css; acá solo se conmutan.
 *
 * El estado arranca en los valores por defecto y se sincroniza con lo guardado
 * en el primer efecto (localStorage no existe en el render del servidor). El
 * script anti-FOUC ya dejó el DOM en el tema correcto antes de pintar.
 */
export function AparienciaSection() {
  const tema = useSyncExternalStore(
    suscribir,
    () => temaValido(localStorage.getItem(STORAGE_TEMA)),
    () => TEMA_DEFAULT,
  )
  const modo = useSyncExternalStore(
    suscribir,
    () => modoValido(localStorage.getItem(STORAGE_MODO)),
    () => MODO_DEFAULT,
  )

  function elegirTema(id: TemaId) {
    guardar(STORAGE_TEMA, id)
    aplicarTema(id, modo)
  }

  function elegirModo(id: ModoColor) {
    guardar(STORAGE_MODO, id)
    aplicarTema(tema, id)
  }

  return (
    <section className="flex flex-col gap-4">
      <div>
        <h2 className="text-sm font-medium text-muted-foreground">Apariencia</h2>
        <p className="text-xs text-muted-foreground/80">
          Se guarda en este dispositivo.
        </p>
      </div>

      {/* Modo claro / oscuro / sistema. */}
      <div
        role="radiogroup"
        aria-label="Modo de color"
        className="grid grid-cols-3 gap-1 rounded-xl bg-muted p-1"
      >
        {MODOS.map(({ id, label, Icono }) => {
          const activo = modo === id
          return (
            <button
              key={id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => elegirModo(id)}
              className={cn(
                "flex items-center justify-center gap-1.5 rounded-lg py-2 text-sm font-medium transition-colors",
                activo
                  ? "bg-card text-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Icono className="size-4" aria-hidden />
              {label}
            </button>
          )
        })}
      </div>

      {/* Temas (paletas). */}
      <div role="radiogroup" aria-label="Tema" className="flex flex-col gap-2">
        {TEMAS.map((t) => {
          const activo = tema === t.id
          return (
            <button
              key={t.id}
              type="button"
              role="radio"
              aria-checked={activo}
              onClick={() => elegirTema(t.id)}
              className={cn(
                "flex items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
                activo
                  ? "border-primary ring-1 ring-primary"
                  : "border-border hover:bg-muted",
              )}
            >
              {/* Muestra de la paleta. */}
              <span
                className="flex size-9 shrink-0 items-center justify-center rounded-lg"
                style={{ backgroundColor: t.swatch.primary }}
                aria-hidden
              >
                <span className="flex gap-0.5">
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: t.swatch.secondary }}
                  />
                  <span
                    className="size-2 rounded-full"
                    style={{ backgroundColor: t.swatch.accent }}
                  />
                </span>
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium text-foreground">{t.nombre}</p>
                <p className="truncate text-xs text-muted-foreground">
                  {t.descripcion}
                </p>
              </div>

              {activo && (
                <CheckIcon className="size-4 shrink-0 text-primary" aria-hidden />
              )}
            </button>
          )
        })}
      </div>
    </section>
  )
}
