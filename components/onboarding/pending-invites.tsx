"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, MailOpenIcon } from "lucide-react"

import { aceptarInvitacion } from "@/app/onboarding/invitacion/actions"
import { Button } from "@/components/ui/button"

export type InvitacionPendiente = { token: string; householdName: string }

/**
 * Banner de invitaciones pendientes dirigidas al correo del usuario (las trae
 * mis_invitaciones). Deja aceptar sin depender del link del correo: basta con
 * haber iniciado sesión con el correo invitado.
 */
export function PendingInvites({ invitaciones }: { invitaciones: InvitacionPendiente[] }) {
  if (invitaciones.length === 0) return null

  return (
    <div className="flex flex-col gap-3">
      {invitaciones.map((inv) => (
        <InvitacionCard key={inv.token} invitacion={inv} />
      ))}
    </div>
  )
}

function InvitacionCard({ invitacion }: { invitacion: InvitacionPendiente }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function aceptar() {
    setError(null)
    setPending(true)
    const res = await aceptarInvitacion(invitacion.token)
    if (res.error) {
      setError(res.error)
      setPending(false)
      return
    }
    // Ya tiene member: la guarda central lo lleva al siguiente paso.
    router.refresh()
  }

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-primary/30 bg-primary/5 p-4">
      <div className="flex items-start gap-3">
        <span
          className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
          aria-hidden
        >
          <MailOpenIcon className="size-5" />
        </span>
        <div className="flex flex-1 flex-col gap-0.5">
          <span className="font-heading text-sm font-semibold text-foreground">
            Te invitaron a {invitacion.householdName}
          </span>
          <span className="text-sm text-muted-foreground">
            Acepta para unirte a este hogar.
          </span>
        </div>
      </div>
      <Button size="sm" onClick={aceptar} disabled={pending}>
        {pending && <Loader2Icon className="size-4 animate-spin" />}
        {pending ? "Uniéndote..." : "Aceptar invitación"}
      </Button>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
