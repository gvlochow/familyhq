"use client"

import { useState } from "react"
import { CheckIcon, Share2Icon } from "lucide-react"

import { Button } from "@/components/ui/button"

const TEXTO = "Te comparto FamilyHQ, la app con la que organizamos la familia."

/**
 * "Compartir la app": usa el menú nativo de compartir (Web Share API) en móvil y,
 * si no está disponible, copia el enlace al portapapeles. La URL es el propio
 * origen (funciona en prod y en previews sin hardcodear el dominio).
 */
export function CompartirApp() {
  const [copiado, setCopiado] = useState(false)

  async function compartir() {
    const url = window.location.origin
    if (navigator.share) {
      try {
        await navigator.share({ title: "FamilyHQ", text: TEXTO, url })
        return
      } catch {
        // Cancelado o no permitido: caemos a copiar.
      }
    }
    try {
      await navigator.clipboard.writeText(`${TEXTO} ${url}`)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      // Sin portapapeles: no hay más que ofrecer.
    }
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Compartir</h2>
      <Button
        type="button"
        variant="outline"
        size="lg"
        className="w-full"
        onClick={compartir}
      >
        {copiado ? (
          <>
            <CheckIcon className="size-4 text-primary" />
            Enlace copiado
          </>
        ) : (
          <>
            <Share2Icon className="size-4" />
            Compartir la app
          </>
        )}
      </Button>
    </section>
  )
}
