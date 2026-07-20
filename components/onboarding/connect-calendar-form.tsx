"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import {
  ExternalLinkIcon,
  Loader2Icon,
  MonitorIcon,
  ShieldCheckIcon,
} from "lucide-react"

import { connectCalendar, omitirCalendario } from "@/app/onboarding/calendario/actions"
import {
  ONBOARDING_HORARIO_ROUTE,
  ONBOARDING_INTEGRANTES_ROUTE,
} from "@/lib/supabase/post-login-redirect"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"
import { OnboardingBackLink } from "@/components/onboarding/onboarding-back-link"

// Paso 3 de 4: la cuenta, el hogar y el tipo de horario ya existen.
const PASO_ACTUAL = 3
const TOTAL_PASOS = 4

/**
 * Paso a paso para encontrar la dirección secreta en formato iCal en Google
 * Calendar. `imagen` (opcional) es el slot para una captura de escritorio; se
 * completa cuando existan los assets en public/onboarding/ (por ahora va solo el
 * texto). OJO al agregar la captura del paso 4: la dirección secreta real debe ir
 * censurada.
 */
const PASOS: { texto: string; imagen?: string }[] = [
  { texto: "Abre Google Calendar en el computador." },
  {
    texto:
      'Pasa el mouse sobre el calendario donde está tu programación, abre "Opciones" (⋮) y elige "Configuración y uso compartido".',
  },
  { texto: 'Baja hasta la sección "Integrar calendario".' },
  {
    texto:
      'Copia la "Dirección secreta en formato iCal" y pégala aquí arriba.',
  },
]

export function ConnectCalendarForm({
  yaConectado = false,
}: {
  yaConectado?: boolean
}) {
  const router = useRouter()

  const [pending, setPending] = useState(false)
  const [skipping, setSkipping] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const url = String(formData.get("ical_url") ?? "").trim()

    if (!url) {
      // Si ya está conectado (volvió atrás a revisar), continuar sin re-pegar.
      if (yaConectado) {
        setPending(true)
        router.push(ONBOARDING_INTEGRANTES_ROUTE)
        return
      }
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

    // Avance explícito al paso de integrantes (la guarda permite volver atrás).
    router.push(ONBOARDING_INTEGRANTES_ROUTE)
  }

  // "Dejar para más tarde": entra a la app sin conectar (lo hará luego en Ajustes).
  async function handleSkip() {
    setError(null)
    setSkipping(true)
    const { error: actionError } = await omitirCalendario()
    if (actionError) {
      setError(actionError)
      setSkipping(false)
      return
    }
    router.push(ONBOARDING_INTEGRANTES_ROUTE)
  }

  const porcentaje = Math.round((PASO_ACTUAL / TOTAL_PASOS) * 100)
  const ocupado = pending || skipping

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex min-h-svh w-full max-w-sm flex-col px-6 pt-8 pb-10"
    >
      <header className="flex flex-col gap-5">
        <OnboardingBackLink href={ONBOARDING_HORARIO_ROUTE} />

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
            <span className="text-xs font-medium text-primary">Casi listo</span>
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
            Conecta tu programación
          </h1>
          <p className="text-muted-foreground">
            Pega la dirección secreta en formato iCal de tu calendario. La
            usamos solo para leer tu programación; se guarda cifrada.
          </p>
          <p className="text-xs text-muted-foreground">
            Esto se hace{" "}
            <span className="font-medium text-foreground">una sola vez</span>, no
            cada vez que abras la app.
          </p>
        </div>

        {yaConectado && (
          <p className="rounded-xl border border-secondary/50 bg-secondary/15 px-4 py-3 text-sm text-muted-foreground">
            Ya tienes un calendario conectado. Puedes{" "}
            <span className="text-foreground">Continuar</span>, o pegar una
            dirección nueva para reemplazarlo.
          </p>
        )}

        <Field>
          <FieldLabel htmlFor="ical_url">Dirección iCal secreta</FieldLabel>
          <Input
            id="ical_url"
            name="ical_url"
            type="url"
            inputMode="url"
            placeholder="https://calendar.google.com/calendar/ical/.../basic.ics"
            autoComplete="off"
            autoFocus={!yaConectado}
            disabled={ocupado}
            required={!yaConectado}
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
            usamos para leer tu programación y nunca se la mostramos a nadie.
          </p>
        </div>

        <details className="rounded-xl border border-border bg-muted/40 px-4 py-3 text-sm">
          <summary className="cursor-pointer font-medium text-foreground">
            ¿Dónde encuentro esta dirección?
          </summary>

          <div className="mt-3 flex flex-col gap-3 text-muted-foreground">
            <div className="flex items-start gap-2.5 rounded-lg border border-secondary/50 bg-secondary/15 px-3 py-2.5">
              <MonitorIcon
                className="mt-0.5 size-4 shrink-0 text-primary"
                aria-hidden
              />
              <p>
                Esto se hace{" "}
                <span className="text-foreground">en el computador</span>. Si
                estás en el teléfono, abre el menú de tu navegador y activa la
                opción <span className="text-foreground">Sitio de escritorio</span>.
              </p>
            </div>

            <ol className="flex list-decimal flex-col gap-3 pl-4">
              {PASOS.map((paso, i) => (
                <li key={i} className="pl-1">
                  <span>{paso.texto}</span>
                  {paso.imagen && (
                    <Image
                      src={paso.imagen}
                      alt=""
                      width={640}
                      height={360}
                      className="mt-2 w-full rounded-lg border border-border"
                    />
                  )}
                </li>
              ))}
            </ol>

            <a
              href="https://calendar.google.com/calendar/r/settings"
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center justify-center gap-2 rounded-lg border border-border bg-background px-3 py-2 font-medium text-foreground transition-colors hover:bg-muted"
            >
              <ExternalLinkIcon className="size-4" aria-hidden />
              Abrir Google Calendar
            </a>
          </div>
        </details>
      </div>

      <div className="flex flex-col gap-2">
        <Button type="submit" size="lg" disabled={ocupado}>
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          {pending
            ? "Un momento..."
            : yaConectado
              ? "Continuar"
              : "Conectar calendario"}
        </Button>

        {!yaConectado && (
          <Button
            type="button"
            variant="ghost"
            size="lg"
            onClick={handleSkip}
            disabled={ocupado}
          >
            {skipping && <Loader2Icon className="size-4 animate-spin" />}
            Dejar para más tarde
          </Button>
        )}
      </div>
    </form>
  )
}
