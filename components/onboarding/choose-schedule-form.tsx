"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { CheckIcon, ClockIcon, Loader2Icon, PlaneIcon } from "lucide-react"

import { setTipoHorario } from "@/app/onboarding/horario/actions"
import type { TipoHorarioSeleccionable } from "@/lib/members/tipo-horario"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

// Paso 2 de 3 del onboarding (la cuenta y el hogar ya existen).
const PASO_ACTUAL = 2
const TOTAL_PASOS = 3

type Opcion = {
  valor: TipoHorarioSeleccionable
  titulo: string
  descripcion: string
  Icono: typeof PlaneIcon
}

// 'variable' primero: es el diferenciador de entrada (rol de tripulación).
const OPCIONES: readonly Opcion[] = [
  {
    valor: "variable",
    titulo: "Variable o por turnos",
    descripcion:
      "Mi horario cambia semana a semana — por ejemplo, tripulación de vuelo.",
    Icono: PlaneIcon,
  },
  {
    valor: "fijo",
    titulo: "Fijo",
    descripcion: "Trabajo el mismo horario la mayoría de los días.",
    Icono: ClockIcon,
  },
]

export function ChooseScheduleForm() {
  const router = useRouter()

  const [seleccion, setSeleccion] = useState<TipoHorarioSeleccionable | null>(
    null
  )
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    if (!seleccion) {
      setError("Elige un tipo de horario para continuar.")
      return
    }

    setPending(true)
    const { error: actionError } = await setTipoHorario(seleccion)

    if (actionError) {
      setError(actionError)
      setPending(false)
      return
    }

    // No calculamos el destino: la guarda server-side de la ruta decide tras el
    // refresh (mismo patrón que crear hogar). Dejamos pending en true: la
    // navegación desmonta esta pantalla.
    router.refresh()
  }

  const porcentaje = Math.round((PASO_ACTUAL / TOTAL_PASOS) * 100)

  return (
    <form
      onSubmit={handleSubmit}
      className="mx-auto flex min-h-svh w-full max-w-sm flex-col px-6 pt-8 pb-10"
    >
      {/* Encabezado: marca discreta + progreso del onboarding. */}
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
            <span className="text-xs font-medium text-primary">Hogar creado</span>
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

      {/* Pregunta + opciones. Ocupa el espacio central y empuja el botón al
          tercio inferior (alcance del pulgar). */}
      <div className="flex flex-1 flex-col justify-center gap-6 py-10">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            ¿Cómo es tu horario de trabajo?
          </h1>
          <p className="text-muted-foreground">
            Así traducimos tu semana a un calendario que tu familia entiende.
          </p>
        </div>

        <fieldset
          className="flex flex-col gap-3"
          disabled={pending}
          aria-invalid={error ? true : undefined}
        >
          <legend className="sr-only">Tipo de horario</legend>
          {OPCIONES.map(({ valor, titulo, descripcion, Icono }) => {
            const activo = seleccion === valor
            return (
              <label
                key={valor}
                className={cn(
                  "flex cursor-pointer items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors",
                  "hover:bg-muted has-[:focus-visible]:border-ring has-[:focus-visible]:ring-3 has-[:focus-visible]:ring-ring/50",
                  activo && "border-primary bg-primary/5 hover:bg-primary/5"
                )}
              >
                <input
                  type="radio"
                  name="tipo_horario"
                  value={valor}
                  checked={activo}
                  onChange={() => setSeleccion(valor)}
                  className="sr-only"
                />
                <span
                  className={cn(
                    "mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground transition-colors",
                    activo && "bg-primary/10 text-primary"
                  )}
                  aria-hidden
                >
                  <Icono className="size-5" />
                </span>
                <span className="flex flex-1 flex-col gap-0.5">
                  <span className="font-heading text-sm font-semibold text-foreground">
                    {titulo}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {descripcion}
                  </span>
                </span>
                <span
                  className={cn(
                    "mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full border border-border text-transparent transition-colors",
                    activo && "border-primary bg-primary text-primary-foreground"
                  )}
                  aria-hidden
                >
                  <CheckIcon className="size-3.5" />
                </span>
              </label>
            )
          })}
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </fieldset>
      </div>

      {/* Acción principal en el tercio inferior. */}
      <Button type="submit" size="lg" disabled={pending || !seleccion}>
        {pending && <Loader2Icon className="size-4 animate-spin" />}
        {pending ? "Guardando..." : "Continuar"}
      </Button>
    </form>
  )
}
