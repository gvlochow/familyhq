"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { Loader2Icon, PlusIcon, UserIcon } from "lucide-react"

import {
  agregarIntegrante,
  completarOnboarding,
} from "@/app/onboarding/integrantes/actions"
import type { Rol } from "@/lib/members/rol"
import type { TipoHorario } from "@/lib/members/tipo-horario"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

// Paso 4 de 4 del onboarding (opcional): la cuenta, el hogar, el tipo de horario
// y su configuración ya existen.
const PASO_ACTUAL = 4
const TOTAL_PASOS = 4

const ROL_OPCIONES: { valor: Rol; label: string }[] = [
  { valor: "sostenedor", label: "Sostenedor" },
  { valor: "integrante", label: "Integrante" },
]

const TIPO_OPCIONES: { valor: TipoHorario; label: string }[] = [
  { valor: "ninguno", label: "Sin horario" },
  { valor: "fijo", label: "Fijo" },
  { valor: "variable", label: "Variable" },
]

const ROL_LABEL: Record<string, string> = {
  sostenedor: "Sostenedor",
  integrante: "Integrante",
}
const TIPO_LABEL: Record<string, string> = {
  ninguno: "Sin horario",
  fijo: "Horario fijo",
  variable: "Variable / turnos",
}

type IntegranteAgregado = {
  id: string
  display_name: string
  rol: string
  tipo_horario: string
}

export function AddMembersForm({
  yaAgregados,
}: {
  yaAgregados: IntegranteAgregado[]
}) {
  const router = useRouter()

  const [nombre, setNombre] = useState("")
  const [rol, setRol] = useState<Rol>("integrante")
  const [tipoHorario, setTipoHorario] = useState<TipoHorario>("ninguno")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function handleAgregar(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    if (!nombre.trim()) {
      setError("Escribe el nombre del integrante.")
      return
    }
    setPending(true)
    const { error: actionError } = await agregarIntegrante({ nombre, rol, tipoHorario })
    if (actionError) {
      setError(actionError)
      setPending(false)
      return
    }
    // Reset del formulario; la lista se actualiza al refrescar (dato de servidor).
    setNombre("")
    setRol("integrante")
    setTipoHorario("ninguno")
    setPending(false)
    router.refresh()
  }

  async function handleFinalizar() {
    setError(null)
    setPending(true)
    const { error: actionError } = await completarOnboarding()
    if (actionError) {
      setError(actionError)
      setPending(false)
      return
    }
    // No calculamos el destino: la guarda server-side manda al home tras el refresh.
    router.refresh()
  }

  const porcentaje = Math.round((PASO_ACTUAL / TOTAL_PASOS) * 100)

  return (
    <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col px-6 pt-8 pb-10">
      {/* Encabezado: marca + progreso (espejo de los pasos anteriores). */}
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
            <span className="text-xs font-medium text-primary">Opcional</span>
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

      <div className="flex flex-1 flex-col gap-6 py-8">
        <div className="flex flex-col gap-2 text-center">
          <h1 className="font-heading text-2xl font-semibold text-foreground">
            Agrega a tu familia
          </h1>
          <p className="text-muted-foreground">
            Suma a las personas del hogar para ver la disponibilidad de todos.
            Puedes hacerlo ahora o más adelante desde Ajustes.
          </p>
        </div>

        {/* Integrantes ya agregados. */}
        {yaAgregados.length > 0 && (
          <ul className="flex flex-col gap-2">
            {yaAgregados.map((m) => (
              <li
                key={m.id}
                className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
              >
                <span
                  className="flex size-9 shrink-0 items-center justify-center rounded-lg bg-secondary/40 text-secondary-foreground"
                  aria-hidden
                >
                  <UserIcon className="size-5" />
                </span>
                <span className="flex flex-col">
                  <span className="text-sm font-medium text-foreground">
                    {m.display_name}
                  </span>
                  <span className="text-xs text-muted-foreground">
                    {ROL_LABEL[m.rol] ?? m.rol} · {TIPO_LABEL[m.tipo_horario] ?? m.tipo_horario}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        )}

        {/* Alta de un integrante. */}
        <form onSubmit={handleAgregar} className="flex flex-col gap-4">
          <fieldset disabled={pending} className="flex flex-col gap-4">
            <div className="flex flex-col gap-1.5">
              <label htmlFor="nombre" className="text-sm font-medium text-foreground">
                Nombre
              </label>
              <Input
                id="nombre"
                value={nombre}
                onChange={(e) => setNombre(e.target.value)}
                placeholder="Nombre del integrante"
                autoComplete="off"
              />
            </div>

            <Segmento
              titulo="Rol"
              opciones={ROL_OPCIONES}
              valor={rol}
              onChange={setRol}
            />
            <Segmento
              titulo="Tipo de horario"
              opciones={TIPO_OPCIONES}
              valor={tipoHorario}
              onChange={setTipoHorario}
            />

            <Button type="submit" variant="outline" className="w-full">
              {pending ? (
                <Loader2Icon className="size-4 animate-spin" />
              ) : (
                <PlusIcon className="size-4" />
              )}
              Agregar integrante
            </Button>
          </fieldset>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      </div>

      {/* Cierre del onboarding (tercio inferior). */}
      <Button
        type="button"
        size="lg"
        onClick={handleFinalizar}
        disabled={pending}
      >
        {yaAgregados.length > 0 ? "Continuar" : "Omitir por ahora"}
      </Button>
    </div>
  )
}

/** Grupo de opciones segmentadas (pills). Genérico sobre el tipo del valor. */
function Segmento<T extends string>({
  titulo,
  opciones,
  valor,
  onChange,
}: {
  titulo: string
  opciones: { valor: T; label: string }[]
  valor: T
  onChange: (v: T) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{titulo}</span>
      <div className="flex gap-2">
        {opciones.map((o) => {
          const activo = o.valor === valor
          return (
            <button
              key={o.valor}
              type="button"
              onClick={() => onChange(o.valor)}
              aria-pressed={activo}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                activo
                  ? "border-primary bg-primary/5 font-medium text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {o.label}
            </button>
          )
        })}
      </div>
    </div>
  )
}
