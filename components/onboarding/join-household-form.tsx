"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Loader2Icon } from "lucide-react"

import { solicitarIngreso } from "@/app/onboarding/unirse/actions"
import {
  ONBOARDING_ROUTE,
  ONBOARDING_ESPERANDO_ROUTE,
} from "@/lib/supabase/post-login-redirect"
import {
  JOIN_CODE_LARGO,
  esCodigoValido,
  normalizarCodigo,
} from "@/lib/hogar/join-code"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { OnboardingBackLink } from "@/components/onboarding/onboarding-back-link"

export function JoinHouseholdForm() {
  const router = useRouter()

  const [codigo, setCodigo] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const listo = esCodigoValido(codigo)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!esCodigoValido(codigo)) {
      setError("El código tiene 8 caracteres. Revisa lo que te compartieron.")
      return
    }

    setPending(true)
    const res = await solicitarIngreso(codigo)

    if (res.error) {
      setError(res.error)
      setPending(false)
      return
    }

    // Solicitud creada: la guarda mandará a la pantalla de espera. Dejamos
    // pending en true — la navegación desmonta esta pantalla.
    router.push(ONBOARDING_ESPERANDO_ROUTE)
  }

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex min-h-svh w-full max-w-sm flex-col px-6 pt-8 pb-10"
    >
      <header className="flex flex-col gap-5">
        <OnboardingBackLink href={ONBOARDING_ROUTE} />
        <div className="flex items-center justify-center gap-2">
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
        </div>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-6 py-10">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Únete a un hogar
          </h1>
          <p className="text-muted-foreground">
            Ingresa el código que te compartieron. Un responsable del hogar tendrá
            que aprobar tu ingreso.
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="codigo">Código del hogar</FieldLabel>
          <Input
            id="codigo"
            name="codigo"
            type="text"
            inputMode="text"
            autoComplete="off"
            autoCapitalize="characters"
            autoFocus
            placeholder="ABCD-EFGH"
            // Deja tipear el guion de la presentación (8 + 1).
            maxLength={JOIN_CODE_LARGO + 1}
            disabled={pending}
            value={codigo}
            onChange={(e) => setCodigo(normalizarCodigo(e.target.value))}
            className="text-center font-mono text-lg tracking-widest uppercase"
            required
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
      </div>

      <Button type="submit" size="lg" disabled={pending || !listo}>
        {pending && <Loader2Icon className="size-4 animate-spin" />}
        {pending ? "Enviando solicitud..." : "Solicitar ingreso"}
      </Button>
    </form>
  )
}
