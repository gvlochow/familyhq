"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Loader2Icon } from "lucide-react"

import { createClient } from "@/lib/supabase/client"
import { Button } from "@/components/ui/button"
import { Field, FieldError, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

// El onboarding tiene 3 pasos; la cuenta ya está creada, así que arrancamos en
// el paso 1 (no en 0%) — ver DESIGN.md ("no empieza en 0% si ya hubo pasos").
const PASO_ACTUAL = 1
const TOTAL_PASOS = 3

export function CreateHouseholdForm() {
  const router = useRouter()
  const supabase = createClient()

  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)

    const formData = new FormData(e.currentTarget)
    const nombre = String(formData.get("nombre") ?? "").trim()

    if (!nombre) {
      setError("Dale un nombre a tu hogar para continuar.")
      return
    }

    setPending(true)
    try {
      const { error: rpcError } = await supabase.rpc("create_household", {
        p_name: nombre,
      })

      if (rpcError) {
        setError(
          rpcError.message ||
            "No pudimos crear tu hogar. Intenta de nuevo en un momento."
        )
        setPending(false)
        return
      }

      // No encadenamos el siguiente paso a mano: la lógica central de routing
      // decide el destino (será el paso de tipo de horario). Dejamos `pending`
      // en true: la navegación desmonta esta pantalla.
      router.refresh()
    } catch {
      setError("No pudimos crear tu hogar. Intenta de nuevo en un momento.")
      setPending(false)
    }
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
            <span className="text-xs font-medium text-primary">Cuenta creada</span>
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

      {/* Bienvenida + campo. Ocupa el espacio central y empuja el botón al
          tercio inferior (alcance del pulgar). */}
      <div className="flex flex-1 flex-col justify-center gap-6 py-10">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Creemos tu hogar
          </h1>
          <p className="text-muted-foreground">
            Dale un nombre a tu hogar para empezar. Más adelante podrás invitar a
            tu familia.
          </p>
        </div>

        <Field>
          <FieldLabel htmlFor="nombre">Nombre del hogar</FieldLabel>
          <Input
            id="nombre"
            name="nombre"
            type="text"
            placeholder="Casa von Lochow"
            autoComplete="off"
            autoFocus
            maxLength={60}
            disabled={pending}
            required
          />
          {error && <FieldError>{error}</FieldError>}
        </Field>
      </div>

      {/* Acción principal en el tercio inferior. */}
      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2Icon className="size-4 animate-spin" />}
        {pending ? "Creando hogar..." : "Crear hogar"}
      </Button>
    </form>
  )
}
