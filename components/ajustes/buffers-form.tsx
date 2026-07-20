"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import Link from "next/link"
import { ArrowLeftIcon, InfoIcon, Loader2Icon } from "lucide-react"

import { guardarBuffers } from "@/app/(app)/ajustes/actions"
import { Button } from "@/components/ui/button"
import { BufferWheel } from "./buffer-wheel"

/**
 * Pantalla de "Buffers de traslado" de un integrante (mockups/FamilyHQ_Buffers.png):
 * cuánto antes debe salir de casa y cuánto tarda en llegar. Dos ruedas (pasos de
 * 15 min) + guardar. Ambos extienden la ventana "fuera" en la disponibilidad.
 */
export function BuffersForm({
  memberId,
  nombre,
  inicial,
  salidaInicial,
  llegadaInicial,
}: {
  memberId: string
  nombre: string
  inicial: string
  salidaInicial: number
  llegadaInicial: number
}) {
  const router = useRouter()
  const [salida, setSalida] = useState(salidaInicial)
  const [llegada, setLlegada] = useState(llegadaInicial)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar() {
    setError(null)
    setPending(true)
    const res = await guardarBuffers(memberId, { salida, llegada })
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.push("/ajustes")
  }

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col px-6 pt-8 pb-28">
      <header className="flex flex-col gap-3">
        <div className="flex items-center gap-2">
          <Link
            href="/ajustes"
            aria-label="Volver a Ajustes"
            className="flex size-9 items-center justify-center rounded-lg border border-border text-muted-foreground transition-colors hover:bg-muted"
          >
            <ArrowLeftIcon className="size-5" />
          </Link>
          <Image
            src="/brand/Logo_flat.png"
            alt="FamilyHQ"
            width={24}
            height={24}
            className="rounded-md"
          />
        </div>

        <div>
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Buffers de traslado
          </h1>
          <div className="mt-1 flex items-start gap-2">
            <span
              className="mt-0.5 flex size-6 shrink-0 items-center justify-center rounded-md bg-secondary/40 text-xs font-semibold text-secondary-foreground"
              aria-hidden
            >
              {inicial}
            </span>
            <p className="text-sm text-muted-foreground">
              Cuánto antes o después necesita {nombre} para trasladarse.
            </p>
          </div>
        </div>
      </header>

      <div className="mt-6 flex flex-col gap-4">
        <section className="rounded-2xl border border-border bg-background p-4">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Buffer de salida
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuánto antes de un compromiso debe salir de casa.
          </p>
          <div className="mt-3">
            <BufferWheel
              value={salida}
              onChange={setSalida}
              ariaLabel="Buffer de salida en minutos"
            />
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-background p-4">
          <h2 className="font-heading text-base font-semibold text-foreground">
            Buffer de llegada
          </h2>
          <p className="mt-1 text-sm text-muted-foreground">
            Cuánto tiempo después de un evento hasta que se considera{" "}
            <span className="text-foreground">en casa</span>.
          </p>
          <div className="mt-3">
            <BufferWheel
              value={llegada}
              onChange={setLlegada}
              ariaLabel="Buffer de llegada en minutos"
            />
          </div>
        </section>

        <div className="flex items-start gap-2.5 rounded-xl border border-secondary/50 bg-secondary/15 px-4 py-3">
          <InfoIcon className="mt-0.5 size-4 shrink-0 text-primary" aria-hidden />
          <p className="text-sm text-muted-foreground">
            Cada integrante puede tener sus propios tiempos de traslado.
          </p>
        </div>
      </div>

      <div className="mt-auto pt-6">
        {error && (
          <p role="alert" className="mb-2 text-sm text-destructive">
            {error}
          </p>
        )}
        <Button
          type="button"
          size="lg"
          className="w-full"
          disabled={pending}
          onClick={guardar}
        >
          {pending && <Loader2Icon className="size-4 animate-spin" />}
          Guardar cambios
        </Button>
      </div>
    </main>
  )
}
