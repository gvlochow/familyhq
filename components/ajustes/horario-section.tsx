"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { DateTime } from "luxon"
import { Loader2Icon } from "lucide-react"

import { TZ_LOCAL } from "@/lib/roster/types"
import type { BloqueDia } from "@/lib/members/horario-fijo"
import { setTipoHorario } from "@/app/onboarding/horario/actions"
import { connectCalendar } from "@/app/onboarding/calendario/actions"
import { FixedScheduleForm } from "@/components/onboarding/fixed-schedule-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const TIPOS: { valor: "variable" | "fijo"; label: string }[] = [
  { valor: "variable", label: "Variable / turnos" },
  { valor: "fijo", label: "Horario fijo" },
]

/**
 * Sección "Mi horario/rol" de Ajustes: ver y cambiar el tipo de horario del usuario,
 * y editar su configuración (reconectar el calendario del rol variable, o editar el
 * horario fijo). Reusa las Server Actions del onboarding (setTipoHorario limpia la
 * config del otro tipo al cambiar).
 */
export function HorarioSection({
  tipo,
  variableConectado,
  ultimaSync,
  bloquesFijo,
}: {
  tipo: string
  variableConectado: boolean
  ultimaSync: string | null
  bloquesFijo: BloqueDia[]
}) {
  const router = useRouter()
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [editando, setEditando] = useState(false)

  async function cambiarTipo(nuevo: "variable" | "fijo") {
    if (nuevo === tipo) return
    setError(null)
    setPending(true)
    const res = await setTipoHorario(nuevo)
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    setEditando(false)
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Mi horario</h2>

      {/* Tipo de horario. */}
      <div className="flex gap-2">
        {TIPOS.map((t) => {
          const activo = t.valor === tipo
          return (
            <button
              key={t.valor}
              type="button"
              disabled={pending}
              onClick={() => cambiarTipo(t.valor)}
              aria-pressed={activo}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors disabled:opacity-50",
                activo
                  ? "border-primary bg-primary/5 font-medium text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {t.label}
            </button>
          )
        })}
      </div>

      {tipo === "ninguno" && (
        <p className="text-sm text-muted-foreground">
          Elige un tipo de horario para configurar tu disponibilidad.
        </p>
      )}

      {/* Config del rol VARIABLE: estado de conexión + reconectar. */}
      {tipo === "variable" && (
        <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-3">
          <p className="text-sm text-foreground">
            {variableConectado ? (
              <>
                Calendario conectado.{" "}
                <span className="text-muted-foreground">
                  {ultimaSync
                    ? `Última sincronización: ${formatoSync(ultimaSync)}.`
                    : "Aún sin sincronizar."}
                </span>
              </>
            ) : (
              "Todavía no conectas el calendario de tu rol."
            )}
          </p>
          {editando ? (
            <ActualizarCalendario
              onCancel={() => setEditando(false)}
              onDone={() => {
                setEditando(false)
                router.refresh()
              }}
            />
          ) : (
            <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)}>
              {variableConectado ? "Actualizar dirección del calendario" : "Conectar calendario"}
            </Button>
          )}
        </div>
      )}

      {/* Config del horario FIJO: editor (reusa el form del onboarding en modo ajustes). */}
      {tipo === "fijo" &&
        (editando ? (
          <div className="rounded-xl border border-border bg-background p-3">
            <FixedScheduleForm
              modo="ajustes"
              bloquesIniciales={bloquesFijo}
              onGuardado={() => {
                setEditando(false)
                router.refresh()
              }}
            />
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="mt-2 w-full"
              onClick={() => setEditando(false)}
            >
              Cancelar
            </Button>
          </div>
        ) : (
          <Button type="button" variant="outline" size="sm" onClick={() => setEditando(true)}>
            Editar mi horario fijo
          </Button>
        ))}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

/** Control compacto para (re)conectar el calendario del rol variable. */
function ActualizarCalendario({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [url, setUrl] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const res = await connectCalendar(url)
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    onDone()
  }

  return (
    <form onSubmit={guardar} className="flex flex-col gap-2">
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://calendar.google.com/…/basic.ics"
        autoFocus
        disabled={pending}
      />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || !url.trim()} className="flex-1">
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : "Guardar"}
        </Button>
        <Button type="button" size="sm" variant="outline" onClick={onCancel} disabled={pending} className="flex-1">
          Cancelar
        </Button>
      </div>
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </form>
  )
}

function formatoSync(iso: string): string {
  return DateTime.fromISO(iso).setZone(TZ_LOCAL).setLocale("es").toFormat("d LLL, HH:mm")
}
