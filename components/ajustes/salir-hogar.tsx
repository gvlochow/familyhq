"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, LogOutIcon } from "lucide-react"

import { salirDelHogar } from "@/app/(app)/ajustes/actions"
import { Button } from "@/components/ui/button"

/**
 * "Salir del hogar" — borra la propia membresía. Oculto para el dueño (por ahora
 * no puede salir; primero habría que transferir la propiedad). Tras salir, la
 * persona queda sin hogar y el routing la lleva al onboarding.
 */
export function SalirHogar({ esDueno }: { esDueno: boolean }) {
  const router = useRouter()
  const [confirmando, setConfirmando] = useState(false)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  if (esDueno) return null

  async function salir() {
    setError(null)
    setPending(true)
    const res = await salirDelHogar()
    if (res.error) {
      setError(res.error)
      setPending(false)
      return
    }
    // Sin hogar: el onboarding decide (crear / unirse).
    router.push("/onboarding")
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Hogar</h2>
      {!confirmando ? (
        <Button
          type="button"
          variant="outline"
          size="lg"
          className="w-full text-destructive hover:text-destructive"
          onClick={() => setConfirmando(true)}
        >
          <LogOutIcon className="size-4" />
          Salir del hogar
        </Button>
      ) : (
        <div className="flex flex-col gap-2 rounded-xl border border-destructive/30 bg-destructive/5 p-4">
          <p className="text-sm text-foreground">
            Vas a salir del hogar. Perderás el acceso a su calendario, agenda y
            lista de compras. Podrás crear o unirte a otro después.
          </p>
          <div className="flex gap-2">
            <Button
              type="button"
              size="sm"
              className="flex-1 bg-destructive text-white hover:bg-destructive/90"
              onClick={salir}
              disabled={pending}
            >
              {pending && <Loader2Icon className="size-4 animate-spin" />}
              {pending ? "Saliendo..." : "Sí, salir"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              className="flex-1"
              onClick={() => setConfirmando(false)}
              disabled={pending}
            >
              Cancelar
            </Button>
          </div>
        </div>
      )}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}
