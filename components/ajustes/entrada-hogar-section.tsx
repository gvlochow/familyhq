"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { CheckIcon, CopyIcon, Loader2Icon, RefreshCwIcon, XIcon } from "lucide-react"

import {
  invitarPorEmail,
  revocarInvitacion,
  rotarCodigo,
} from "@/app/(app)/ajustes/entrada-actions"
import { formatearCodigo } from "@/lib/hogar/join-code"
import { Button } from "@/components/ui/button"
import { Field, FieldLabel } from "@/components/ui/field"
import { Input } from "@/components/ui/input"

type Administrado = { id: string; nombre: string }
type InvitacionVista = { id: string; email: string }

/**
 * Sección "Entrada al hogar" de Ajustes. Cualquier integrante ve y comparte el
 * código; solo un Responsable puede rotarlo, invitar por correo y gestionar las
 * invitaciones pendientes.
 */
export function EntradaHogarSection({
  codigo: codigoInicial,
  esResponsable,
  administrados,
  invitaciones,
}: {
  codigo: string
  esResponsable: boolean
  administrados: Administrado[]
  invitaciones: InvitacionVista[]
}) {
  const router = useRouter()
  const [codigo, setCodigo] = useState(codigoInicial)
  const [copiado, setCopiado] = useState(false)
  const [rotando, setRotando] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function copiar() {
    try {
      await navigator.clipboard.writeText(codigo)
      setCopiado(true)
      setTimeout(() => setCopiado(false), 1500)
    } catch {
      setError("No se pudo copiar. Cópialo manualmente.")
    }
  }

  async function rotar() {
    setError(null)
    setRotando(true)
    const res = await rotarCodigo()
    setRotando(false)
    if (res.error) {
      setError(res.error)
      return
    }
    if (res.codigo) setCodigo(res.codigo)
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">Entrada al hogar</h2>

      {/* Código para compartir. */}
      <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
        <p className="text-sm text-muted-foreground">
          Comparte este código para que alguien pida unirse al hogar. Tendrás que
          aprobar su ingreso.
        </p>
        <div className="flex items-center gap-2">
          <span className="flex-1 rounded-lg bg-muted px-3 py-2 text-center font-mono text-lg font-semibold tracking-widest text-foreground">
            {formatearCodigo(codigo)}
          </span>
          <Button
            type="button"
            variant="outline"
            size="icon"
            onClick={copiar}
            aria-label="Copiar código"
          >
            {copiado ? (
              <CheckIcon className="size-4 text-primary" />
            ) : (
              <CopyIcon className="size-4" />
            )}
          </Button>
        </div>
        {esResponsable && (
          <button
            type="button"
            onClick={rotar}
            disabled={rotando}
            className="flex items-center gap-1.5 self-start text-xs font-medium text-muted-foreground transition-colors hover:text-foreground disabled:opacity-60"
          >
            {rotando ? (
              <Loader2Icon className="size-3.5 animate-spin" />
            ) : (
              <RefreshCwIcon className="size-3.5" />
            )}
            Cambiar código
          </button>
        )}
      </div>

      {esResponsable && (
        <>
          <InvitarPorEmail administrados={administrados} onDone={() => router.refresh()} />

          {invitaciones.length > 0 && (
            <div className="flex flex-col gap-2">
              <p className="text-xs font-medium text-muted-foreground">
                Invitaciones pendientes
              </p>
              {invitaciones.map((inv) => (
                <InvitacionFila
                  key={inv.id}
                  invitacion={inv}
                  onDone={() => router.refresh()}
                />
              ))}
            </div>
          )}
        </>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

/** Formulario de invitación por correo, con vinculación opcional a un perfil. */
function InvitarPorEmail({
  administrados,
  onDone,
}: {
  administrados: Administrado[]
  onDone: () => void
}) {
  const [email, setEmail] = useState("")
  const [linkId, setLinkId] = useState("")
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [linkManual, setLinkManual] = useState<string | null>(null)

  async function enviar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setOk(null)
    setLinkManual(null)
    setPending(true)
    const res = await invitarPorEmail(email.trim(), linkId || null)
    setPending(false)
    if (res.error) {
      setError(res.error)
      if (res.link) setLinkManual(res.link)
      return
    }
    setOk(`Invitación enviada a ${email.trim()}.`)
    setEmail("")
    setLinkId("")
    onDone()
  }

  return (
    <form onSubmit={enviar} className="flex flex-col gap-2 rounded-xl border border-border bg-background p-4">
      <Field>
        <FieldLabel htmlFor="invite-email">Invitar por correo</FieldLabel>
        <Input
          id="invite-email"
          type="email"
          inputMode="email"
          autoComplete="off"
          placeholder="persona@correo.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={pending}
        />
      </Field>

      {administrados.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Vincular a un integrante (opcional)</span>
          <select
            value={linkId}
            onChange={(e) => setLinkId(e.target.value)}
            disabled={pending}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="">Crear un integrante nuevo</option>
            {administrados.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      <Button type="submit" size="sm" disabled={pending || !email.trim()}>
        {pending && <Loader2Icon className="size-4 animate-spin" />}
        {pending ? "Enviando..." : "Enviar invitación"}
      </Button>

      {ok && <p className="text-sm text-primary">{ok}</p>}
      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
      {linkManual && (
        <button
          type="button"
          onClick={() => navigator.clipboard.writeText(linkManual)}
          className="self-start text-xs font-medium text-muted-foreground underline transition-colors hover:text-foreground"
        >
          Copiar enlace de invitación
        </button>
      )}
    </form>
  )
}

/** Fila de una invitación pendiente, con acción de revocar. */
function InvitacionFila({
  invitacion,
  onDone,
}: {
  invitacion: InvitacionVista
  onDone: () => void
}) {
  const [pending, setPending] = useState(false)

  async function revocar() {
    setPending(true)
    await revocarInvitacion(invitacion.id)
    setPending(false)
    onDone()
  }

  return (
    <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
      <span className="flex-1 truncate text-sm text-foreground">{invitacion.email}</span>
      <button
        type="button"
        onClick={revocar}
        disabled={pending}
        aria-label={`Revocar invitación a ${invitacion.email}`}
        className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground disabled:opacity-60"
      >
        {pending ? (
          <Loader2Icon className="size-4 animate-spin" />
        ) : (
          <XIcon className="size-4" />
        )}
      </button>
    </div>
  )
}
