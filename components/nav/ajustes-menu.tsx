"use client"

import { useEffect, useState } from "react"
import Link from "next/link"
import {
  CheckIcon,
  ChevronRightIcon,
  HistoryIcon,
  HouseIcon,
  LogOutIcon,
  Share2Icon,
  SettingsIcon,
  XIcon,
} from "lucide-react"

import { signOut } from "@/app/(app)/ajustes/actions"
import { cn } from "@/lib/utils"

const TEXTO_COMPARTIR =
  "Te comparto FamilyHQ, la app con la que organizamos la familia."

/**
 * Lanzador de "Ajustes" que reemplaza a la tab del bottom bar: un botón (engranaje)
 * en el header de cada página que abre un CAJÓN lateral desde la derecha. El cajón
 * es un menú liviano —identidad del hogar, un enlace a la página completa de
 * Ajustes, compartir la app y cerrar sesión—, no duplica el contenido de /ajustes.
 *
 * `tone` adapta el color del botón al fondo del header: "light" sobre la banda navy
 * del Inicio, "dark" sobre el fondo claro del resto de las páginas.
 *
 * Los datos (nombre del hogar, email) los provee el Server Component AjustesLauncher;
 * este componente solo maneja la interacción (abrir/cerrar, compartir, cerrar sesión).
 */
export function AjustesMenu({
  nombre,
  email,
  tone = "dark",
}: {
  nombre: string
  email: string | null
  tone?: "light" | "dark"
}) {
  const [abierto, setAbierto] = useState(false)

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierto(true)}
        aria-label="Ajustes"
        aria-haspopup="dialog"
        className={cn(
          "flex size-9 items-center justify-center rounded-lg transition-colors",
          tone === "light"
            ? "text-primary-foreground/90 hover:bg-white/10"
            : "text-muted-foreground hover:bg-muted hover:text-foreground",
        )}
      >
        <SettingsIcon className="size-5" />
      </button>

      {abierto && (
        <AjustesDrawer
          nombre={nombre}
          email={email}
          onClose={() => setAbierto(false)}
        />
      )}
    </>
  )
}

function AjustesDrawer({
  nombre,
  email,
  onClose,
}: {
  nombre: string
  email: string | null
  onClose: () => void
}) {
  const [copiado, setCopiado] = useState(false)

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === "Escape" && onClose()
    document.addEventListener("keydown", onKey)
    return () => document.removeEventListener("keydown", onKey)
  }, [onClose])

  async function compartir() {
    const url = window.location.origin
    if (navigator.share) {
      try {
        await navigator.share({ title: "FamilyHQ", text: TEXTO_COMPARTIR, url })
        return
      } catch {
        // Cancelado o no permitido: caemos a copiar.
      }
    }
    try {
      await navigator.clipboard.writeText(`${TEXTO_COMPARTIR} ${url}`)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Sin portapapeles: no hay más que ofrecer.
    }
  }

  return (
    <div
      className="fixed inset-0 z-50 flex justify-end"
      role="dialog"
      aria-modal="true"
      aria-label="Ajustes"
    >
      <button
        type="button"
        aria-label="Cerrar"
        onClick={onClose}
        className="absolute inset-0 bg-foreground/40 backdrop-blur-[1px] animate-in fade-in dark:bg-black/60"
      />

      <div className="relative flex h-full w-full max-w-[17rem] flex-col bg-card shadow-xl animate-in slide-in-from-right duration-200 pt-[max(0.75rem,env(safe-area-inset-top))] pb-[max(0.75rem,env(safe-area-inset-bottom))]">
        <div className="flex items-center justify-between px-4 pb-3">
          <h2 className="font-heading text-lg font-semibold text-foreground">
            Ajustes
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar"
            className="-mr-1 flex size-8 items-center justify-center rounded-lg text-muted-foreground hover:bg-muted"
          >
            <XIcon className="size-5" />
          </button>
        </div>

        {/* Identidad del hogar. */}
        <div className="flex items-center gap-3 px-4 pb-3">
          <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground">
            <HouseIcon className="size-5" aria-hidden />
          </span>
          <div className="min-w-0">
            <p className="truncate font-heading text-sm font-semibold text-foreground">
              {nombre}
            </p>
            {email && (
              <p className="truncate text-xs text-muted-foreground">{email}</p>
            )}
          </div>
        </div>

        <div className="mx-4 h-px bg-border" aria-hidden />

        {/* Menú. */}
        <nav className="flex flex-1 flex-col gap-0.5 px-2 py-2">
          <Link
            href="/historial"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            <HistoryIcon className="size-4 text-muted-foreground" aria-hidden />
            <span className="flex-1">Historial</span>
            <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
          </Link>

          <Link
            href="/ajustes"
            onClick={onClose}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            <SettingsIcon className="size-4 text-muted-foreground" aria-hidden />
            <span className="flex-1">Todos los ajustes</span>
            <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
          </Link>

          <button
            type="button"
            onClick={compartir}
            className="flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            {copiado ? (
              <>
                <CheckIcon className="size-4 text-primary" aria-hidden />
                <span className="flex-1 text-left">Enlace copiado</span>
              </>
            ) : (
              <>
                <Share2Icon className="size-4 text-muted-foreground" aria-hidden />
                <span className="flex-1 text-left">Compartir la app</span>
              </>
            )}
          </button>
        </nav>

        <div className="mx-4 h-px bg-border" aria-hidden />

        {/* Sesión. */}
        <form action={signOut} className="px-2 pt-2">
          <button
            type="submit"
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-foreground hover:bg-muted"
          >
            <LogOutIcon className="size-4 text-muted-foreground" aria-hidden />
            <span className="flex-1 text-left">Cerrar sesión</span>
          </button>
        </form>
      </div>
    </div>
  )
}
