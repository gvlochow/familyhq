"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import Link from "next/link"
import { DateTime } from "luxon"
import {
  ChevronRightIcon,
  Loader2Icon,
  PencilIcon,
  PlusIcon,
  Trash2Icon,
  UserIcon,
} from "lucide-react"

import { agregarIntegrante } from "@/app/onboarding/integrantes/actions"
import { editarIntegrante, quitarIntegrante } from "@/app/(app)/ajustes/actions"
import { connectCalendar } from "@/app/onboarding/calendario/actions"
import { ROLES, ROL_LABEL, type Rol } from "@/lib/members/rol"
import { TIPOS_HORARIO, type TipoHorario } from "@/lib/members/tipo-horario"
import type { BloqueDia } from "@/lib/members/horario-fijo"
import { TZ_LOCAL } from "@/lib/roster/types"
import { FixedScheduleForm } from "@/components/onboarding/fixed-schedule-form"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { useConfirmar } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"

const TIPO_LABEL: Record<TipoHorario, string> = {
  ninguno: "Sin horario",
  fijo: "Horario fijo",
  variable: "Variable / turnos",
}

export interface IntegranteVista {
  id: string
  nombre: string
  rol: string
  tipo: string
  esTu: boolean
  /** true si es el dueño del hogar (is_owner): no se puede quitar. */
  esDueno: boolean
  /** true si es un perfil administrado (user_id null): editable/eliminable desde acá. */
  administrado: boolean
  /** Bloques del horario fijo (si tipo='fijo'), para prellenar el editor. */
  bloquesFijo?: BloqueDia[]
  /** ¿Tiene conexión de calendario (si tipo='variable')? */
  variableConectado?: boolean
  /** Última sincronización del calendario, o null. */
  ultimaSync?: string | null
}

/**
 * Sección Integrantes de Ajustes: lista los integrantes del hogar, permite agregar
 * perfiles administrados y editar/quitar los ya administrados. Tu propia fila (y la
 * de otras cuentas) es de solo lectura: su nombre viene de su cuenta.
 *
 * Un Responsable (esResponsable) puede además configurar el HORARIO de los perfiles
 * administrados (bloques fijos o conexión de calendario) desde el editor.
 */
export function IntegrantesSection({
  integrantes,
  esResponsable,
}: {
  integrantes: IntegranteVista[]
  esResponsable: boolean
}) {
  const router = useRouter()
  const confirmar = useConfirmar()
  const [agregando, setAgregando] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function quitar(m: IntegranteVista) {
    const ok = await confirmar({
      titulo: `¿Quitar a ${m.nombre} del hogar?`,
      descripcion: m.administrado ? undefined : "Perderá su acceso al hogar.",
      confirmar: "Quitar",
      destructivo: true,
    })
    if (!ok) return
    setError(null)
    setPending(true)
    const res = await quitarIntegrante(m.id)
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    router.refresh()
  }

  return (
    <section className="flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <h2 className="text-sm font-medium text-muted-foreground">Integrantes</h2>
        {!agregando && (
          <button
            type="button"
            onClick={() => {
              setError(null)
              setEditId(null)
              setAgregando(true)
            }}
            className="flex items-center gap-1 text-sm font-medium text-primary hover:opacity-80"
          >
            <PlusIcon className="size-4" />
            Agregar
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {integrantes.map((m) =>
          editId === m.id ? (
            <li key={m.id}>
              <EditarIntegrante
                integrante={m}
                esResponsable={esResponsable}
                onCancel={() => setEditId(null)}
                onDone={() => {
                  setEditId(null)
                  router.refresh()
                }}
              />
            </li>
          ) : (
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
              <span className="flex min-w-0 flex-1 flex-col">
                <span className="flex items-center gap-1.5 truncate text-sm font-medium text-foreground">
                  {m.nombre}
                  {m.esTu && <span className="text-xs font-normal text-muted-foreground">(tú)</span>}
                </span>
                <span className="truncate text-xs text-muted-foreground">
                  {ROL_LABEL[m.rol as Rol] ?? m.rol} · {TIPO_LABEL[m.tipo as TipoHorario] ?? m.tipo}
                </span>
              </span>
              {m.administrado && (
                <button
                  type="button"
                  onClick={() => {
                    setError(null)
                    setAgregando(false)
                    setEditId(m.id)
                  }}
                  aria-label={`Editar a ${m.nombre}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
                >
                  <PencilIcon className="size-4" />
                </button>
              )}
              {/* Quitar: un responsable puede quitar a cualquier otro que no sea el
                  dueño (perfil administrado o con cuenta). Para salir uno mismo se
                  usa "Salir del hogar" abajo. */}
              {esResponsable && !m.esTu && !m.esDueno && (
                <button
                  type="button"
                  onClick={() => quitar(m)}
                  disabled={pending}
                  aria-label={`Quitar a ${m.nombre}`}
                  className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                >
                  <Trash2Icon className="size-4" />
                </button>
              )}
            </li>
          ),
        )}
      </ul>

      {agregando && (
        <AgregarIntegrante onCancel={() => setAgregando(false)} onDone={() => {
          setAgregando(false)
          router.refresh()
        }} />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

/** Formulario de alta de un perfil administrado (nombre + rol + tipo de horario). */
function AgregarIntegrante({ onCancel, onDone }: { onCancel: () => void; onDone: () => void }) {
  const [nombre, setNombre] = useState("")
  const [rol, setRol] = useState<Rol>("integrante")
  const [tipo, setTipo] = useState<TipoHorario>("ninguno")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const res = await agregarIntegrante({ nombre, rol, tipoHorario: tipo })
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    onDone()
  }

  return (
    <form
      onSubmit={guardar}
      className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 p-3"
    >
      <Input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre del integrante"
        autoFocus
        disabled={pending}
      />
      <Pills titulo="Rol" opciones={ROLES} label={(r) => ROL_LABEL[r as Rol]} valor={rol} onChange={(v) => setRol(v as Rol)} />
      <Pills titulo="Tipo de horario" opciones={TIPOS_HORARIO} label={(t) => TIPO_LABEL[t as TipoHorario]} valor={tipo} onChange={(v) => setTipo(v as TipoHorario)} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || !nombre.trim()} className="flex-1">
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : "Agregar"}
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

/** Edición inline de un perfil administrado (nombre + rol + tipo, y su horario si soy Responsable). */
function EditarIntegrante({
  integrante,
  esResponsable,
  onCancel,
  onDone,
}: {
  integrante: IntegranteVista
  esResponsable: boolean
  onCancel: () => void
  onDone: () => void
}) {
  const [nombre, setNombre] = useState(integrante.nombre)
  const [rol, setRol] = useState<Rol>((integrante.rol as Rol) ?? "integrante")
  const [tipo, setTipo] = useState<TipoHorario>((integrante.tipo as TipoHorario) ?? "ninguno")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const res = await editarIntegrante(integrante.id, { nombre, rol, tipoHorario: tipo })
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    onDone()
  }

  return (
    <div className="flex flex-col gap-3">
      <form
        onSubmit={guardar}
        className="flex flex-col gap-3 rounded-xl border border-border/70 bg-muted/30 p-3"
      >
        <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" autoFocus disabled={pending} />
        <Pills titulo="Rol" opciones={ROLES} label={(r) => ROL_LABEL[r as Rol]} valor={rol} onChange={(v) => setRol(v as Rol)} />
        <Pills titulo="Tipo de horario" opciones={TIPOS_HORARIO} label={(t) => TIPO_LABEL[t as TipoHorario]} valor={tipo} onChange={(v) => setTipo(v as TipoHorario)} />
        <div className="flex gap-2">
          <Button type="submit" size="sm" disabled={pending || !nombre.trim()} className="flex-1">
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

      {/* Configuración del horario (solo Responsable). Se basa en el tipo GUARDADO
          del integrante; si cambias el tipo arriba, guarda primero y reabre para
          configurar el horario nuevo. */}
      {esResponsable && integrante.tipo === "fijo" && (
        <div className="rounded-xl border border-border/70 bg-muted/30 p-3">
          <p className="mb-2 text-sm font-medium text-foreground">
            Horario fijo de {integrante.nombre}
          </p>
          <FixedScheduleForm
            modo="ajustes"
            memberId={integrante.id}
            bloquesIniciales={integrante.bloquesFijo}
            onGuardado={onDone}
          />
        </div>
      )}

      {esResponsable && integrante.tipo === "variable" && (
        <ConectarCalendarioIntegrante
          memberId={integrante.id}
          nombre={integrante.nombre}
          conectado={integrante.variableConectado ?? false}
          ultimaSync={integrante.ultimaSync ?? null}
          onDone={onDone}
        />
      )}

      {esResponsable && (integrante.tipo === "fijo" || integrante.tipo === "variable") && (
        <Link
          href={`/ajustes/buffers/${integrante.id}`}
          className="flex items-center justify-between rounded-xl border border-border/70 bg-muted/30 px-3 py-2.5 text-sm text-foreground transition-colors hover:bg-muted"
        >
          <span>Buffers de traslado</span>
          <ChevronRightIcon className="size-4 text-muted-foreground" aria-hidden />
        </Link>
      )}
    </div>
  )
}

/** Control compacto para (re)conectar el calendario de un integrante administrado. */
function ConectarCalendarioIntegrante({
  memberId,
  nombre,
  conectado,
  ultimaSync,
  onDone,
}: {
  memberId: string
  nombre: string
  conectado: boolean
  ultimaSync: string | null
  onDone: () => void
}) {
  const [url, setUrl] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const res = await connectCalendar(url, { memberId })
    setPending(false)
    if (res.error) {
      setError(res.error)
      return
    }
    onDone()
  }

  return (
    <form
      onSubmit={guardar}
      className="flex flex-col gap-2 rounded-xl border border-border/70 bg-muted/30 p-3"
    >
      <p className="text-sm font-medium text-foreground">Calendario de {nombre}</p>
      <p className="text-xs text-muted-foreground">
        {conectado
          ? ultimaSync
            ? `Conectado. Última sincronización: ${formatoSync(ultimaSync)}.`
            : "Conectado. Aún sin sincronizar."
          : "Sin conectar. Pega su dirección iCal secreta."}
      </p>
      <Input
        value={url}
        onChange={(e) => setUrl(e.target.value)}
        placeholder="https://calendar.google.com/…/basic.ics"
        disabled={pending}
      />
      <Button type="submit" size="sm" disabled={pending || !url.trim()}>
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : conectado ? (
          "Actualizar calendario"
        ) : (
          "Conectar calendario"
        )}
      </Button>
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

/** Grupo de opciones segmentadas (pills). */
function Pills({
  titulo,
  opciones,
  label,
  valor,
  onChange,
}: {
  titulo: string
  opciones: readonly string[]
  label: (v: string) => string
  valor: string
  onChange: (v: string) => void
}) {
  return (
    <div className="flex flex-col gap-1.5">
      <span className="text-sm font-medium text-foreground">{titulo}</span>
      <div className="flex gap-2">
        {opciones.map((o) => {
          const activo = o === valor
          return (
            <button
              key={o}
              type="button"
              onClick={() => onChange(o)}
              aria-pressed={activo}
              className={cn(
                "flex-1 rounded-lg border px-3 py-2 text-sm transition-colors",
                activo
                  ? "border-primary bg-primary/5 font-medium text-primary"
                  : "border-border text-muted-foreground hover:bg-muted",
              )}
            >
              {label(o)}
            </button>
          )
        })}
      </div>
    </div>
  )
}
