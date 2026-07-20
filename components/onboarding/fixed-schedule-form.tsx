"use client"

import { useId, useState } from "react"
import { useRouter } from "next/navigation"
import Image from "next/image"
import { ChevronDownIcon, Loader2Icon } from "lucide-react"

import { saveHorarioFijo } from "@/app/onboarding/horario-fijo/actions"
import {
  BLOQUES_POR_DEFECTO,
  DIAS_SEMANA,
  esHoraValida,
  type BloqueDia,
  type DiaSemana,
} from "@/lib/members/horario-fijo"
import {
  ONBOARDING_HORARIO_ROUTE,
  ONBOARDING_INTEGRANTES_ROUTE,
} from "@/lib/supabase/post-login-redirect"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { OnboardingBackLink } from "@/components/onboarding/onboarding-back-link"
import { cn } from "@/lib/utils"

// Paso 3 de 4: la cuenta, el hogar y el tipo de horario ya existen.
const PASO_ACTUAL = 3
const TOTAL_PASOS = 4

const nombreDia = (dia: DiaSemana) =>
  DIAS_SEMANA.find((d) => d.dia === dia)?.nombre ?? ""

/** Switch accesible reutilizable (trabaja / almuerza). */
function Switch({
  checked,
  onChange,
  disabled,
  label,
}: {
  checked: boolean
  onChange: () => void
  disabled?: boolean
  label: string
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      aria-label={label}
      disabled={disabled}
      onClick={onChange}
      className={cn(
        "relative h-5 w-9 shrink-0 rounded-full transition-colors outline-none focus-visible:ring-3 focus-visible:ring-ring/50 disabled:opacity-50",
        checked ? "bg-primary" : "bg-muted-foreground/30"
      )}
    >
      <span
        className={cn(
          "absolute top-0.5 size-4 rounded-full bg-background shadow-xs transition-all",
          checked ? "left-[1.125rem]" : "left-0.5"
        )}
      />
    </button>
  )
}

/** Campo de hora con etiqueta encima; ancho completo (sin desborde). */
function TimeField({
  label,
  value,
  onChange,
  disabled,
}: {
  label: string
  value: string
  onChange: (v: string) => void
  disabled?: boolean
}) {
  return (
    <label className="flex flex-col gap-1">
      <span className="text-xs font-medium text-muted-foreground">{label}</span>
      <Input
        type="time"
        value={value}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value)}
        className="h-9 w-full text-center"
      />
    </label>
  )
}

export function FixedScheduleForm({
  modo = "onboarding",
  bloquesIniciales,
  onGuardado,
  memberId,
}: {
  /** "onboarding": chrome del wizard + avanza al paso siguiente. "ajustes": compacto + onGuardado. */
  modo?: "onboarding" | "ajustes"
  /** Bloques a prellenar (Ajustes usa los guardados); si falta, parte de los por defecto. */
  bloquesIniciales?: BloqueDia[]
  /** Callback tras guardar con éxito (Ajustes hace router.refresh y cierra). */
  onGuardado?: () => void
  /** Si se pasa, guarda el horario de OTRO integrante (Responsable → administrado). */
  memberId?: string
} = {}) {
  const router = useRouter()
  const panelBaseId = useId()
  const esOnboarding = modo === "onboarding"

  const [bloques, setBloques] = useState<BloqueDia[]>(() =>
    (bloquesIniciales ?? BLOQUES_POR_DEFECTO).map((b) => ({ ...b }))
  )
  const [abierto, setAbierto] = useState<DiaSemana | null>(1)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Plantilla rápida: un rango (y opcionalmente el almuerzo) que se aplica de una
  // vez a todos los días de trabajo. Después cada día se ajusta en el acordeón.
  const [plantillaInicio, setPlantillaInicio] = useState("09:00")
  const [plantillaFin, setPlantillaFin] = useState("18:00")
  const [plantillaAlmuerza, setPlantillaAlmuerza] = useState(false)
  const [plantillaAlmuerzoInicio, setPlantillaAlmuerzoInicio] = useState("13:00")
  const [plantillaAlmuerzoFin, setPlantillaAlmuerzoFin] = useState("14:00")

  const rangoPlantillaValido =
    esHoraValida(plantillaInicio) &&
    esHoraValida(plantillaFin) &&
    plantillaFin > plantillaInicio

  // Si la plantilla incluye almuerzo, debe ser un rango válido DENTRO de la jornada.
  const almuerzoPlantillaValido =
    !plantillaAlmuerza ||
    (esHoraValida(plantillaAlmuerzoInicio) &&
      esHoraValida(plantillaAlmuerzoFin) &&
      plantillaAlmuerzoFin > plantillaAlmuerzoInicio &&
      plantillaAlmuerzoInicio >= plantillaInicio &&
      plantillaAlmuerzoFin <= plantillaFin)

  const diasQueTrabaja = bloques.filter((b) => b.trabaja).length

  function actualizar(dia: DiaSemana, cambios: Partial<BloqueDia>) {
    setBloques((prev) =>
      prev.map((b) => (b.dia === dia ? { ...b, ...cambios } : b))
    )
  }

  function aplicarPlantilla() {
    if (!rangoPlantillaValido || !almuerzoPlantillaValido) return
    setError(null)
    setBloques((prev) =>
      prev.map((b) => {
        if (!b.trabaja) return b
        const base = {
          ...b,
          horaInicio: plantillaInicio,
          horaFin: plantillaFin,
          almuerzaEnCasa: plantillaAlmuerza,
        }
        // El rango de almuerzo solo se copia si la plantilla lo incluye.
        return plantillaAlmuerza
          ? {
              ...base,
              horaAlmuerzoInicio: plantillaAlmuerzoInicio,
              horaAlmuerzoFin: plantillaAlmuerzoFin,
            }
          : base
      })
    )
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setPending(true)

    const { error: actionError } = await saveHorarioFijo(
      bloques,
      memberId ? { memberId } : undefined,
    )
    if (actionError) {
      setError(actionError)
      setPending(false)
      return
    }

    if (!esOnboarding) {
      setPending(false)
      onGuardado?.()
      return
    }
    // Avance explícito al paso de integrantes (la guarda permite volver atrás).
    router.push(ONBOARDING_INTEGRANTES_ROUTE)
  }

  const porcentaje = Math.round((PASO_ACTUAL / TOTAL_PASOS) * 100)

  return (
    <form
      onSubmit={handleSubmit}
      className={cn(
        esOnboarding
          ? "mx-auto flex min-h-svh w-full max-w-sm flex-col px-6 pt-8 pb-10"
          : "flex w-full flex-col gap-6",
      )}
    >
      {esOnboarding && (
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
      )}

      <div
        className={cn(
          esOnboarding ? "flex flex-1 flex-col justify-center gap-6 py-10" : "flex flex-col gap-6",
        )}
      >
        {esOnboarding && (
          <div className="flex flex-col gap-2 text-center">
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              Tu horario de trabajo
            </h1>
            <p className="text-muted-foreground">
              Aplica un horario a todos los días y luego ajusta los que cambien.
            </p>
          </div>
        )}

        {/* Plantilla rápida: aplica un rango a todos los días de trabajo. */}
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-muted/30 p-4">
          <div className="flex flex-col gap-0.5">
            <span className="text-sm font-medium text-foreground">
              Horario para todos los días
            </span>
            <span className="text-xs text-muted-foreground">
              Se aplica a los días que trabajas; el fin de semana queda libre.
            </span>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <TimeField
              label="Entrada"
              value={plantillaInicio}
              disabled={pending}
              onChange={setPlantillaInicio}
            />
            <TimeField
              label="Salida"
              value={plantillaFin}
              disabled={pending}
              onChange={setPlantillaFin}
            />
          </div>

          {/* Almuerzo común, opcional: se aplica junto con el horario. */}
          <div className="flex flex-col gap-3 rounded-lg bg-background/60 p-3">
            <label className="flex items-center gap-2.5">
              <Switch
                checked={plantillaAlmuerza}
                disabled={pending}
                onChange={() => setPlantillaAlmuerza((v) => !v)}
                label="Voy a casa a almorzar todos los días"
              />
              <span className="text-sm text-foreground">Voy a casa a almorzar</span>
            </label>
            {plantillaAlmuerza && (
              <div className="grid grid-cols-2 gap-3">
                <TimeField
                  label="Desde"
                  value={plantillaAlmuerzoInicio}
                  disabled={pending}
                  onChange={setPlantillaAlmuerzoInicio}
                />
                <TimeField
                  label="Hasta"
                  value={plantillaAlmuerzoFin}
                  disabled={pending}
                  onChange={setPlantillaAlmuerzoFin}
                />
              </div>
            )}
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={
              pending ||
              !rangoPlantillaValido ||
              !almuerzoPlantillaValido ||
              diasQueTrabaja === 0
            }
            onClick={aplicarPlantilla}
          >
            Aplicar a los días que trabajo
          </Button>
        </div>

        <div className="flex items-center gap-3 text-xs text-muted-foreground">
          <span className="h-px flex-1 bg-border" />
          O ajusta cada día
          <span className="h-px flex-1 bg-border" />
        </div>

        <ul className="flex flex-col gap-2">
          {bloques.map((b) => {
            const estaAbierto = abierto === b.dia
            const panelId = `${panelBaseId}-${b.dia}`
            return (
              <li
                key={b.dia}
                className={cn(
                  "overflow-hidden rounded-xl border border-border bg-background transition-colors",
                  b.trabaja && "border-primary/30"
                )}
              >
                <button
                  type="button"
                  aria-expanded={estaAbierto}
                  aria-controls={panelId}
                  disabled={pending}
                  onClick={() => setAbierto(estaAbierto ? null : b.dia)}
                  className="flex w-full items-center gap-3 px-3 py-3 text-left outline-none focus-visible:bg-muted disabled:opacity-50"
                >
                  <span className="flex-1 text-sm font-medium text-foreground">
                    {nombreDia(b.dia)}
                  </span>
                  <span className="text-sm text-muted-foreground">
                    {b.trabaja ? (
                      <>
                        {b.horaInicio}–{b.horaFin}
                        {b.almuerzaEnCasa && (
                          <span className="text-primary"> · almuerza</span>
                        )}
                      </>
                    ) : (
                      "Libre"
                    )}
                  </span>
                  <ChevronDownIcon
                    className={cn(
                      "size-4 shrink-0 text-muted-foreground transition-transform",
                      estaAbierto && "rotate-180"
                    )}
                    aria-hidden
                  />
                </button>

                {estaAbierto && (
                  <div
                    id={panelId}
                    className="flex flex-col gap-4 border-t border-border px-3 py-4"
                  >
                    <label className="flex items-center gap-2.5">
                      <Switch
                        checked={b.trabaja}
                        disabled={pending}
                        onChange={() =>
                          actualizar(b.dia, { trabaja: !b.trabaja })
                        }
                        label={`Trabajo el ${nombreDia(b.dia)}`}
                      />
                      <span className="text-sm text-foreground">
                        Trabajo este día
                      </span>
                    </label>

                    {b.trabaja && (
                      <>
                        <div className="grid grid-cols-2 gap-3">
                          <TimeField
                            label="Entrada"
                            value={b.horaInicio}
                            disabled={pending}
                            onChange={(v) =>
                              actualizar(b.dia, { horaInicio: v })
                            }
                          />
                          <TimeField
                            label="Salida"
                            value={b.horaFin}
                            disabled={pending}
                            onChange={(v) => actualizar(b.dia, { horaFin: v })}
                          />
                        </div>

                        <div className="flex flex-col gap-3 rounded-lg bg-muted/40 p-3">
                          <label className="flex items-center gap-2.5">
                            <Switch
                              checked={b.almuerzaEnCasa}
                              disabled={pending}
                              onChange={() =>
                                actualizar(b.dia, {
                                  almuerzaEnCasa: !b.almuerzaEnCasa,
                                })
                              }
                              label={`Voy a casa a almorzar el ${nombreDia(b.dia)}`}
                            />
                            <span className="text-sm text-foreground">
                              Voy a casa a almorzar
                            </span>
                          </label>

                          {b.almuerzaEnCasa && (
                            <div className="grid grid-cols-2 gap-3">
                              <TimeField
                                label="Desde"
                                value={b.horaAlmuerzoInicio}
                                disabled={pending}
                                onChange={(v) =>
                                  actualizar(b.dia, { horaAlmuerzoInicio: v })
                                }
                              />
                              <TimeField
                                label="Hasta"
                                value={b.horaAlmuerzoFin}
                                disabled={pending}
                                onChange={(v) =>
                                  actualizar(b.dia, { horaAlmuerzoFin: v })
                                }
                              />
                            </div>
                          )}
                        </div>
                      </>
                    )}
                  </div>
                )}
              </li>
            )
          })}
        </ul>

        {error && (
          <p role="alert" className="text-center text-sm text-destructive">
            {error}
          </p>
        )}
      </div>

      <Button type="submit" size="lg" disabled={pending}>
        {pending && <Loader2Icon className="size-4 animate-spin" />}
        {pending ? "Guardando..." : esOnboarding ? "Continuar" : "Guardar horario"}
      </Button>
    </form>
  )
}
