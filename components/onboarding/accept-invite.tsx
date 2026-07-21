"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import Image from "next/image"
import { Loader2Icon, MailOpenIcon } from "lucide-react"

import { aceptarInvitacion } from "@/app/onboarding/invitacion/actions"
import { ONBOARDING_ROUTE } from "@/lib/supabase/post-login-redirect"
import { Button } from "@/components/ui/button"

export function AcceptInvite({ token }: { token: string | null }) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function aceptar() {
    if (!token) {
      setError("El enlace de invitación no es válido.")
      return
    }
    setError(null)
    setPending(true)
    const res = await aceptarInvitacion(token)
    if (res.error) {
      setError(res.error)
      setPending(false)
      return
    }
    // Ya tiene member: la guarda central lo lleva al siguiente paso (definir horario).
    router.refresh()
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
          <MailOpenIcon className="size-7" />
        </span>
        <div className="flex flex-col gap-2">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Te invitaron a un hogar
          </h1>
          <p className="text-muted-foreground">
            Acepta la invitación para unirte y empezar a organizar la semana en
            familia.
          </p>
        </div>
        {error && (
          <div className="flex flex-col items-center gap-2">
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
            <Link
              href={ONBOARDING_ROUTE}
              className="text-sm font-medium text-muted-foreground underline transition-colors hover:text-foreground"
            >
              Volver al inicio
            </Link>
          </div>
        )}
      </div>

      <Button size="lg" onClick={aceptar} disabled={pending || !token}>
        {pending && <Loader2Icon className="size-4 animate-spin" />}
        {pending ? "Uniéndote..." : "Aceptar invitación"}
      </Button>
    </div>
  )
}
