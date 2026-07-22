"use client"

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react"

import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

/**
 * Confirmación dentro de la app (reemplaza a window.confirm). El confirm nativo
 * antepone el dominio ("familyhq-xxx.vercel.app dice…"), que el navegador NO deja
 * personalizar; este diálogo es nuestro, así que se rotula y estila como el resto.
 *
 * Uso: `const confirmar = useConfirmar()` y luego
 * `if (!(await confirmar({ titulo, descripcion?, confirmar?, destructivo? }))) return`.
 * Devuelve una promesa que resuelve true/false. El <ConfirmProvider> va una sola
 * vez, en el layout de la app.
 */
export interface ConfirmOpts {
  titulo: string
  descripcion?: string
  /** Texto del botón de acción (default "Confirmar"). */
  confirmar?: string
  /** Texto del botón de cancelar (default "Cancelar"). */
  cancelar?: string
  /** Acción peligrosa (borrar): botón en rojo. */
  destructivo?: boolean
}

type Confirmar = (opts: ConfirmOpts) => Promise<boolean>

const ConfirmContext = createContext<Confirmar | null>(null)

export function ConfirmProvider({ children }: { children: ReactNode }) {
  const [opts, setOpts] = useState<ConfirmOpts | null>(null)
  const resolverRef = useRef<((v: boolean) => void) | null>(null)

  const confirmar = useCallback<Confirmar>((o) => {
    return new Promise<boolean>((resolve) => {
      resolverRef.current = resolve
      setOpts(o)
    })
  }, [])

  const cerrar = useCallback((valor: boolean) => {
    resolverRef.current?.(valor)
    resolverRef.current = null
    setOpts(null)
  }, [])

  return (
    <ConfirmContext.Provider value={confirmar}>
      {children}
      {opts && <ConfirmDialog opts={opts} onCerrar={cerrar} />}
    </ConfirmContext.Provider>
  )
}

export function useConfirmar(): Confirmar {
  const ctx = useContext(ConfirmContext)
  if (!ctx) throw new Error("useConfirmar requiere <ConfirmProvider>")
  return ctx
}

function ConfirmDialog({
  opts,
  onCerrar,
}: {
  opts: ConfirmOpts
  onCerrar: (valor: boolean) => void
}) {
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onCerrar(false)
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onCerrar])

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      role="alertdialog"
      aria-modal="true"
      aria-label={opts.titulo}
    >
      <button
        type="button"
        aria-label="Cancelar"
        onClick={() => onCerrar(false)}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px] dark:bg-black/60"
      />

      <div className="relative flex w-full max-w-xs flex-col gap-4 rounded-2xl bg-card p-5 shadow-xl animate-in fade-in zoom-in-95 duration-150">
        <div className="flex flex-col gap-1.5">
          <h2 className="font-heading text-base font-semibold text-foreground">
            {opts.titulo}
          </h2>
          {opts.descripcion && (
            <p className="text-sm text-muted-foreground">{opts.descripcion}</p>
          )}
        </div>

        <div className="flex justify-end gap-2">
          <Button variant="outline" size="lg" onClick={() => onCerrar(false)}>
            {opts.cancelar ?? "Cancelar"}
          </Button>
          <Button
            autoFocus
            size="lg"
            onClick={() => onCerrar(true)}
            className={cn(
              opts.destructivo &&
                "bg-destructive text-white hover:bg-destructive/90",
            )}
          >
            {opts.confirmar ?? "Confirmar"}
          </Button>
        </div>
      </div>
    </div>
  )
}
