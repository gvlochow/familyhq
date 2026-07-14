"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon, UserIcon } from "lucide-react"

import { agregarIntegrante, eliminarIntegrante } from "@/app/onboarding/integrantes/actions"
import { editarIntegrante } from "@/app/(app)/ajustes/actions"
import { ROLES, type Rol } from "@/lib/members/rol"
import { TIPOS_HORARIO, type TipoHorario } from "@/lib/members/tipo-horario"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"
import { cn } from "@/lib/utils"

const ROL_LABEL: Record<Rol, string> = { sostenedor: "Sostenedor", integrante: "Integrante" }
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
  /** true si es un perfil administrado (user_id null): editable/eliminable desde acá. */
  administrado: boolean
}

/**
 * Sección Integrantes de Ajustes: lista los integrantes del hogar, permite agregar
 * perfiles administrados y editar/quitar los ya administrados. Tu propia fila (y la
 * de otras cuentas) es de solo lectura: su nombre viene de su cuenta.
 */
export function IntegrantesSection({ integrantes }: { integrantes: IntegranteVista[] }) {
  const router = useRouter()
  const [agregando, setAgregando] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function quitar(m: IntegranteVista) {
    if (!confirm(`¿Quitar a ${m.nombre} del hogar?`)) return
    setError(null)
    setPending(true)
    const res = await eliminarIntegrante(m.id)
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
                <>
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
                  <button
                    type="button"
                    onClick={() => quitar(m)}
                    disabled={pending}
                    aria-label={`Quitar a ${m.nombre}`}
                    className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
                  >
                    <Trash2Icon className="size-4" />
                  </button>
                </>
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

/** Edición inline de un perfil administrado (nombre + rol). */
function EditarIntegrante({
  integrante,
  onCancel,
  onDone,
}: {
  integrante: IntegranteVista
  onCancel: () => void
  onDone: () => void
}) {
  const [nombre, setNombre] = useState(integrante.nombre)
  const [rol, setRol] = useState<Rol>((integrante.rol as Rol) ?? "integrante")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const res = await editarIntegrante(integrante.id, { nombre, rol })
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
      <Input value={nombre} onChange={(e) => setNombre(e.target.value)} placeholder="Nombre" autoFocus disabled={pending} />
      <Pills titulo="Rol" opciones={ROLES} label={(r) => ROL_LABEL[r as Rol]} valor={rol} onChange={(v) => setRol(v as Rol)} />
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
  )
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
