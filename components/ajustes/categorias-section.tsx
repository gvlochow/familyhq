"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon, PencilIcon, PlusIcon, Trash2Icon } from "lucide-react"

import { PALETA_CATEGORIAS, hexCategoria, type CategoriaRef } from "@/lib/agenda/categorias"
import { crearCategoria } from "@/app/(app)/tareas/actions"
import { editarCategoria, eliminarCategoria } from "@/app/(app)/ajustes/actions"
import { PaletaSwatches } from "@/components/agenda/paleta-swatches"
import { Button } from "@/components/ui/button"
import { useConfirmar } from "@/components/ui/confirm-dialog"

/**
 * Sección Categorías de Ajustes: lista las categorías del hogar y permite crear,
 * renombrar/recolorear y eliminar. Borrar una categoría deja sus ítems sin categoría
 * (no los borra).
 */
export function CategoriasSection({ categorias }: { categorias: CategoriaRef[] }) {
  const router = useRouter()
  const confirmar = useConfirmar()
  const [agregando, setAgregando] = useState(false)
  const [editId, setEditId] = useState<string | null>(null)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function borrar(c: CategoriaRef) {
    const ok = await confirmar({
      titulo: `¿Eliminar la categoría "${c.nombre}"?`,
      descripcion: "Los ítems quedarán sin categoría.",
      confirmar: "Eliminar",
      destructivo: true,
    })
    if (!ok) return
    setError(null)
    setPending(true)
    const res = await eliminarCategoria(c.id)
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
        <h2 className="text-sm font-medium text-muted-foreground">Categorías</h2>
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
            Nueva
          </button>
        )}
      </div>

      <ul className="flex flex-col gap-2">
        {categorias.map((c) =>
          editId === c.id ? (
            <li key={c.id}>
              <EditorCategoria
                inicial={c}
                onCancel={() => setEditId(null)}
                onDone={() => {
                  setEditId(null)
                  router.refresh()
                }}
              />
            </li>
          ) : (
            <li
              key={c.id}
              className="flex items-center gap-3 rounded-xl border border-border bg-background p-3"
            >
              <span
                className="size-4 shrink-0 rounded-full"
                style={{ backgroundColor: hexCategoria(c.color) }}
                aria-hidden
              />
              <span className="flex-1 truncate text-sm font-medium text-foreground">{c.nombre}</span>
              <button
                type="button"
                onClick={() => {
                  setError(null)
                  setAgregando(false)
                  setEditId(c.id)
                }}
                aria-label={`Editar ${c.nombre}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
              >
                <PencilIcon className="size-4" />
              </button>
              <button
                type="button"
                onClick={() => borrar(c)}
                disabled={pending}
                aria-label={`Eliminar ${c.nombre}`}
                className="flex size-8 shrink-0 items-center justify-center rounded-lg text-muted-foreground transition-colors hover:bg-destructive/10 hover:text-destructive disabled:opacity-50"
              >
                <Trash2Icon className="size-4" />
              </button>
            </li>
          ),
        )}
      </ul>

      {agregando && (
        <EditorCategoria
          onCancel={() => setAgregando(false)}
          onDone={() => {
            setAgregando(false)
            router.refresh()
          }}
        />
      )}

      {error && (
        <p role="alert" className="text-sm text-destructive">
          {error}
        </p>
      )}
    </section>
  )
}

/** Editor de una categoría (crear si no hay `inicial`, editar si la hay). */
function EditorCategoria({
  inicial,
  onCancel,
  onDone,
}: {
  inicial?: CategoriaRef
  onCancel: () => void
  onDone: () => void
}) {
  const [nombre, setNombre] = useState(inicial?.nombre ?? "")
  const [color, setColor] = useState(inicial?.color ?? PALETA_CATEGORIAS[0].clave)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function guardar(e: React.FormEvent) {
    e.preventDefault()
    if (!nombre.trim()) return
    setPending(true)
    setError(null)
    const res = inicial
      ? await editarCategoria(inicial.id, { nombre, color })
      : await crearCategoria({ nombre, color })
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
      <input
        value={nombre}
        onChange={(e) => setNombre(e.target.value)}
        placeholder="Nombre de la categoría"
        autoFocus
        disabled={pending}
        className="rounded-lg border border-border bg-background px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-ring"
      />
      <PaletaSwatches value={color} onChange={setColor} disabled={pending} />
      <div className="flex gap-2">
        <Button type="submit" size="sm" disabled={pending || !nombre.trim()} className="flex-1">
          {pending ? <Loader2Icon className="size-4 animate-spin" /> : inicial ? "Guardar" : "Crear"}
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
