"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, PencilIcon } from "lucide-react"

import { renombrarHogar } from "@/app/(app)/ajustes/actions"
import { Button } from "@/components/ui/button"
import { Input } from "@/components/ui/input"

/** Sección Hogar de Ajustes: ver y editar el nombre del hogar. */
export function HogarSection({ nombre }: { nombre: string }) {
  const router = useRouter()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState(nombre)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    setError(null)
    setPending(true)
    const res = await renombrarHogar(valor)
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
      <h2 className="text-sm font-medium text-muted-foreground">Hogar</h2>

      {!editando ? (
        <div className="flex items-center gap-3 rounded-xl border border-border bg-background p-3">
          <span className="flex-1 truncate text-sm font-medium text-foreground">{nombre}</span>
          <button
            type="button"
            onClick={() => {
              setValor(nombre)
              setEditando(true)
            }}
            aria-label="Editar nombre del hogar"
            className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
          >
            <PencilIcon className="size-4" />
          </button>
        </div>
      ) : (
        <form onSubmit={guardar} className="flex flex-col gap-2">
          <Input
            value={valor}
            onChange={(e) => setValor(e.target.value)}
            placeholder="Nombre del hogar"
            autoFocus
            disabled={pending}
          />
          <div className="flex gap-2">
            <Button type="submit" size="sm" disabled={pending || !valor.trim()} className="flex-1">
              {pending ? <Loader2Icon className="size-4 animate-spin" /> : "Guardar"}
            </Button>
            <Button
              type="button"
              size="sm"
              variant="outline"
              onClick={() => setEditando(false)}
              disabled={pending}
              className="flex-1"
            >
              Cancelar
            </Button>
          </div>
          {error && (
            <p role="alert" className="text-sm text-destructive">
              {error}
            </p>
          )}
        </form>
      )}
    </section>
  )
}
