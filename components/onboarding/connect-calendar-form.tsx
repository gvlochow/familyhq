"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Loader2Icon, ShieldCheckIcon } from "lucide-react"

import { connectCalendar } from "@/app/onboarding/calendario/actions"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

// Paso 3 de 4: la cuenta, el hogar y el tipo de horario ya existen.
const PASO_ACTUAL = 3
const TOTAL_PASOS = 4

export function ConnectCalendarForm() {
  const router = useRouter()

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const url = String(formData.get("ical_url") ?? "").trim()

    if (!url) {
      setError("Pega la dirección iCal de tu calendario para continuar.")
      return
    }

    setPending(true)
    const { error: actionError } = await connectCalendar(url)
    if (actionError) {
      setError(actionError)
      setPending(false)
      return
    }

    // La guarda server-side decide el destino tras el refresh.
    router.refresh()
  }

  const porcentaje = Math.round((PASO_ACTUAL / TOTAL_PASOS) * 100)

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex min-h-svh w-full max-w-sm flex-col px-6 pt-8 pb-10"
    >
      <header className="flex flex-col gap-5">
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

        <div className="flex flex-col gap-2">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Paso {PASO_ACTUAL} de {TOTAL_PASOS}
            </span>
            <span className="text-xs font-medium text-primary">Último paso</span>
          </div>
          <div
            className="h-1.5 w-full overflow-hidden rounded-full bg-muted"
            role="progressbar"
            aria-valuenow={porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Progreso del onboarding"
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        </div>
      </header>

      <div className="flex flex-1 flex-col justify-center gap-6 py-10">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Conecta tu calendario de rol
          </h1>
          <p className="text-muted-foreground">
            Pega la dirección secreta en formato iCal de tu calendario. La
            usamos solo para leer tu rol; se guarda cifrada.
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="ical_url">Dirección iCal secreta</FieldLabel>
          <Input
            id="ical_url"
            name="ical_url"
            type="url"
            inputMode="url"
            placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            autoComplete="off"
            autoFocus
            disabled={pending}
            required
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>

        <div className="flex items-start gap-2.5 rounded-xl border border-secondary/50 bg-secondary/15 px-4 py-3">
          <ShieldCheckIcon
            className="mt-0.5 size-4 shrink-0 text-primary"
            aria-hidden
          />
          <p className="text-sm text-muted-foreground">
            Google te advertirá que no compartas esta dirección. Es normal: aquí
            se guarda <span className="text-foreground">cifrada</span>, solo la
            usamos para leer tu rol y nunca se la mostramos a nadie.
          </p>
        </div>

        <details className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">
            ¿Dónde encuentro esta dirección?
          </summary>
          <ol className="mt-3 flex list-decimal flex-col gap-1.5 pl-4 text-muted-foreground">
            <li>Abre Google Calendar en el computador.</li>
            <li>
              En la lista de calendarios, pasa el mouse sobre tu calendario de
              rol y abre <span className="text-foreground">Configuración</span>.
            </li>
            <li>
              Baja hasta{" "}
              <span className="text-foreground">
                Dirección secreta en formato iCal
              </span>{" "}
              y cópiala.
            </li>
            <li>Pégala aquí arriba.</li>
          </ol>
        </details>
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2Icon className="size-4 animate-spin" />}
        {pending ? "Validando calendario..." : "Conectar calendario"}
      </Button>
    </form>
  )
}
