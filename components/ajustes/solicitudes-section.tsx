"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"

import { resolverSolicitud } from "@/app/(app)/ajustes/entrada-actions"
import type { AccionSolicitud } from "@/lib/hogar/estados"
import { Button } from "@/components/ui/button"

type Administrado = { id: string; nombre: string }
type SolicitudVista = { id: string; nombre: string; email: string | null }

/**
 * Bandeja de solicitudes de ingreso (solo Responsables). Cada solicitud se puede
 * aprobar —creando un integrante nuevo o vinculando la cuenta a un perfil
 * administrado existente—, rechazar o bloquear.
 */
export function SolicitudesSection({
  solicitudes,
  administrados,
}: {
  solicitudes: SolicitudVista[]
  administrados: Administrado[]
}) {
  if (solicitudes.length === 0) return null

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-sm font-medium text-muted-foreground">
        Solicitudes de ingreso
      </h2>
      <div className="flex flex-col gap-3">
        {solicitudes.map((s) => (
          <SolicitudFila key={s.id} solicitud={s} administrados={administrados} />
        ))}
      </div>
    </section>
  )
}

function SolicitudFila({
  solicitud,
  administrados,
}: {
  solicitud: SolicitudVista
  administrados: Administrado[]
}) {
  const router = useRouter()
  const [linkId, setLinkId] = useState("")
  const [pending, setPending] = useState<AccionSolicitud | null>(null)
  const [confirmarBloqueo, setConfirmarBloqueo] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function resolver(accion: AccionSolicitud) {
    setError(null)
    setPending(accion)
    const res = await resolverSolicitud(
      solicitud.id,
      accion,
      accion === "aprobar" ? linkId || null : null,
    )
    if (res.error) {
      setError(res.error)
      setPending(null)
      return
    }
    router.refresh()
  }

  const ocupado = pending !== null

  return (
    <div className="flex flex-col gap-3 rounded-xl border border-border bg-background p-4">
      <div className="flex flex-col gap-0.5">
        <span className="text-sm font-medium text-foreground">{solicitud.nombre}</span>
        {solicitud.email && (
          <span className="truncate text-xs text-muted-foreground">
            {solicitud.email}
          </span>
        )}
      </div>

      {administrados.length > 0 && (
        <label className="flex flex-col gap-1 text-sm">
          <span className="text-muted-foreground">Al aprobar</span>
          <select
            value={linkId}
            onChange={(e) => setLinkId(e.target.value)}
            disabled={ocupado}
            className="h-9 rounded-lg border border-border bg-background px-3 text-sm text-foreground focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
          >
            <option value="">Crear un integrante nuevo</option>
            {administrados.map((a) => (
              <option key={a.id} value={a.id}>
                Vincular a {a.nombre}
              </option>
            ))}
          </select>
        </label>
      )}

      <div className="flex flex-wrap gap-2">
        <Button
          type="button"
          size="sm"
          onClick={() => resolver("aprobar")}
          disabled={ocupado}
          className="flex-1"
        >
          {pending === "aprobar" && <Loader2Icon className="size-4 animate-spin" />}
          Aprobar
        </Button>
        <Button
          type="button"
          size="sm"
          variant="outline"
          onClick={() => resolver("rechazar")}
          disabled={ocupado}
          className="flex-1"
        >
          {pending === "rechazar" && <Loader2Icon className="size-4 animate-spin" />}
          Rechazar
        </Button>
      </div>

      {!confirmarBloqueo ? (
        <button
          type="button"
          onClick={() => setConfirmarBloqueo(true)}
          disabled={ocupado}
          className="self-start text-xs font-medium text-muted-foreground transition-colors hover:text-destructive disabled:opacity-60"
        >
          Bloquear a esta persona
        </button>
      ) : (
        <div className="flex items-center gap-2 text-xs">
          <span className="text-muted-foreground">
            No podrá volver a solicitar ingreso.
          </span>
          <button
            type="button"
            onClick={() => resolver("bloquear")}
            disabled={ocupado}
            className="font-medium text-destructive transition-colors hover:underline disabled:opacity-60"
          >
            {pending === "bloquear" ? "Bloqueando..." : "Bloquear"}
          </button>
          <button
            type="button"
            onClick={() => setConfirmarBloqueo(false)}
            disabled={ocupado}
            className="font-medium text-muted-foreground transition-colors hover:text-foreground"
          >
            Cancelar
          </button>
        </div>
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </div>
  )
}
