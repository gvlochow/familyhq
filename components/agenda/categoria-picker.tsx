"use client"

import { useState } from "react"
import { PlusIcon } from "lucide-react"

import { crearCategoria } from "@/app/(app)/tareas/actions"
import { PALETA_CATEGORIAS, hexCategoria, type CategoriaRef } from "@/lib/agenda/categorias"
import { PaletaSwatches } from "./paleta-swatches"
import { cn } from "@/lib/utils"

/**
 * Selector de categoría para el sheet de agenda: elige una existente, "Sin categoría",
 * o crea una nueva al vuelo (nombre + color de la paleta). La nueva se agrega a la
 * lista local y queda seleccionada; la lista de servidor se refresca al guardar el ítem.
 */
export function CategoriaPicker({
  categorias,
  value,
  onChange,
}: {
  categorias: CategoriaRef[]
  value: string | null
  onChange: (id: string | null) => void
}) {
  const [cats, setCats] = useState(categorias)
  const [creando, setCreando] = useState(false)
  const [nombre, setNombre] = useState("")
  const [color, setColor] = useState(PALETA_CATEGORIAS[0].clave)
  const [pending, setPending] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function crear() {
    if (!nombre.trim()) return
    setPending(true)
    setError(null)
    const res = await crearCategoria({ nombre, color })
    setPending(false)
    if (res.error || !res.id) {
      setError(res.error ?? "No se pudo crear.")
      return
    }
    setCats((c) => [...c, { id: res.id!, nombre: nombre.trim(), color }])
    onChange(res.id)
    setCreando(false)
    setNombre("")
    setColor(PALETA_CATEGORIAS[0].clave)
  }

  return (
    <fieldset className="flex flex-col gap-2">
      <legend className="text-sm font-medium text-foreground">Categoría</legend>
      <div className="flex flex-wrap gap-2">
        <Chip activo={value === null} onClick={() => onChange(null)} label="Sin categoría" />
        {cats.map((c) => (
          <Chip
            key={c.id}
            activo={value === c.id}
            onClick={() => onChange(c.id)}
            label={c.nombre}
            hex={hexCategoria(c.color)}
          />
        ))}
        <button
          type="button"
          onClick={() => setCreando((v) => !v)}
          aria-pressed={creando}
          className={cn(
            "flex items-center gap-1 rounded-full border px-2.5 py-1 text-sm transition-colors",
            creando ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted",
          )}
        >
          <PlusIcon className="size-3.5" aria-hidden />
          Nueva
        </button>
      </div>

      {creando && (
        <div className="flex flex-col gap-2 rounded-lg border border-border/70 bg-muted/30 p-3">
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
            <button
              type="button"
              onClick={crear}
              disabled={pending || !nombre.trim()}
              className="flex-1 rounded-lg bg-primary px-3 py-2 text-sm font-medium text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
            >
              {pending ? "Creando…" : "Crear"}
            </button>
            <button
              type="button"
              onClick={() => setCreando(false)}
              disabled={pending}
              className="flex-1 rounded-lg border border-border px-3 py-2 text-sm text-muted-foreground transition-colors hover:bg-muted"
            >
              Cancelar
            </button>
          </div>
          {error && <p className="text-sm text-destructive">{error}</p>}
        </div>
      )}
    </fieldset>
  )
}

function Chip({
  activo,
  onClick,
  label,
  hex,
}: {
  activo: boolean
  onClick: () => void
  label: string
  hex?: string
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      aria-pressed={activo}
      className={cn(
        "flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-sm transition-colors",
        activo ? "border-primary bg-primary/5 text-primary" : "border-border text-muted-foreground hover:bg-muted",
      )}
    >
      {hex && (
        <span className="size-2 shrink-0 rounded-full" style={{ backgroundColor: hex }} aria-hidden />
      )}
      {label}
    </button>
  )
}
