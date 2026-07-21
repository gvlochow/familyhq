"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { HourglassIcon, Loader2Icon } from "lucide-react"

import { cancelarSolicitud } from "@/app/onboarding/unirse/actions"
import { Button } from "@/components/ui/button"

export function WaitingApproval() {
  const router = useRouter()
  const [pending, setPending] = useState<null | "check" | "cancel">(null)
  const [error, setError] = useState<string | null>(null)

  // Revisa si ya la aprobaron: si hay member, la guarda central lo mueve al
  // siguiente paso (definir horario). Si sigue pendiente, se queda acá.
  function revisar() {
    setError(null)
    setPending("check")
    router.refresh()
    // router.refresh no resuelve una promesa observable; soltamos el spinner
    // tras un instante para no dejarlo colgado si nada cambió.
    setTimeout(() => setPending(null), 1200)
  }

  async function cancelar() {
    setError(null)
    setPending("cancel")
    const { error: err } = await cancelarSolicitud()
    if (err) {
      setError(err)
      setPending(null)
      return
    }
    router.refresh() // sin solicitud pendiente -> vuelve a la elección
  }

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col px-6 pt-8 pb-10">
      <header className="flex items-center justify-center gap-2">
        <Image
          src="/brand/Logo_flat.png"
          alt="FamilyHQ"
          width={32}
          height={32}
          className="rounded-lg"
          priority
        />
        <span className="font-heading text-base font-semibold text-foreground">
          FamilyHQ
        </span>
      </header>

      <div className="flex flex-1 flex-col items-center justify-center gap-6 py-10 text-center">
        <span
          className="flex size-14 items-center justify-center rounded-2xl bg-primary/10 text-primary"
          aria-hidden
        >
          <HourglassIcon className="size-7" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Solicitud enviada
          </h1>
          <p className="text-muted-foreground">
            Un responsable del hogar tiene que aprobar tu ingreso. Cuando lo haga,
            entrarás directo. Te avisamos apenas puedas seguir.
          </p>
        </div>
        {error && (
          <p role="alert" className="text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <div className="flex flex-col gap-3">
        <Button size="lg" onClick={revisar} disabled={pending !== null}>
          {pending === "check" && <Loader2Icon className="size-4 animate-spin" />}
          {pending === "check" ? "Revisando..." : "Ya me aprobaron"}
        </Button>
        <Button
          size="lg"
          variant="ghost"
          onClick={cancelar}
          disabled={pending !== null}
        >
          {pending === "cancel" && (
            <Loader2Icon className="size-4 animate-spin" />
          )}
          Cancelar solicitud
        </Button>
      </div>
    </div>
  )
}
