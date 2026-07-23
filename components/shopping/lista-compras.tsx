"use client"

import { useState, useTransition } from "react"
import { useRouter } from "next/navigation"
import {
  CircleIcon,
  CircleCheckIcon,
  MinusIcon,
  PlusIcon,
  Trash2Icon,
} from "lucide-react"

import { sanearCantidad, separarItems, type ItemCompra } from "@/lib/shopping/tipos"
import {
  agregarItem,
  editarItem,
  marcarComprado,
  eliminarItem,
  vaciarComprados,
} from "@/app/(app)/compras/actions"
import { Input } from "@/components/ui/input"
import { useConfirmar } from "@/components/ui/confirm-dialog"
import { cn } from "@/lib/utils"

export function ListaCompras({ items }: { items: ItemCompra[] }) {
  const router = useRouter()
  const confirmar = useConfirmar()
  const [pendiente, startTransition] = useTransition()
  const [nombre, setNombre] = useState("")
  const [cantidad, setCantidad] = useState("1")
  const [error, setError] = useState<string | null>(null)
  const [editandoId, setEditandoId] = useState<string | null>(null)

  const { pendientes, comprados } = separarItems(items)

  function agregar() {
    const n = nombre.trim()
    if (!n) return
    setError(null)
    startTransition(async () => {
      const res = await agregarItem({ nombre: n, cantidad })
      if (res.error) {
        setError(res.error)
        return
      }
      setNombre("")
      setCantidad("1")
      router.refresh()
    })
  }

  function toggle(item: ItemCompra) {
    startTransition(async () => {
      await marcarComprado(item.id, !item.comprado)
      router.refresh()
    })
  }

  function borrar(item: ItemCompra) {
    startTransition(async () => {
      await eliminarItem(item.id)
      router.refresh()
    })
  }

  async function vaciar() {
    const ok = await confirmar({
      titulo: "¿Vaciar los comprados?",
      descripcion: "Se quitan de la lista todos los ítems ya marcados como comprados.",
      confirmar: "Vaciar",
      destructivo: true,
    })
    if (!ok) return
    startTransition(async () => {
      await vaciarComprados()
      router.refresh()
    })
  }

  return (
    <>
      {/* Agregar: nombre + cantidad opcional. Enter en cualquiera de los dos agrega. */}
      <form
        onSubmit={(e) => {
          e.preventDefault()
          agregar()
        }}
        className="flex flex-col gap-2"
      >
        <div className="flex items-center gap-2">
          <Input
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="Agregar a la lista…"
            aria-label="Qué agregar"
            className="h-11 flex-1"
          />
          <CantidadStepper value={cantidad} onChange={setCantidad} />
          <button
            type="submit"
            disabled={!nombre.trim() || pendiente}
            aria-label="Agregar"
            className="flex size-11 shrink-0 items-center justify-center rounded-xl bg-primary text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-40"
          >
            <PlusIcon className="size-5" aria-hidden />
          </button>
        </div>
        {error && <p className="text-xs text-destructive">{error}</p>}
      </form>

      {pendientes.length === 0 && comprados.length === 0 ? (
        <p className="mt-2 text-sm text-muted-foreground">
          La lista está vacía. Agrega lo primero que falte en casa.
        </p>
      ) : (
        <ul className={cn("flex flex-col", pendiente && "opacity-60")}>
          {pendientes.map((item, i) => (
            <Fila
              key={item.id}
              item={item}
              borde={i > 0}
              editando={editandoId === item.id}
              onToggle={toggle}
              onBorrar={borrar}
              onEditar={() => setEditandoId(item.id)}
              onCerrarEdicion={() => setEditandoId(null)}
              onRefresh={() => router.refresh()}
            />
          ))}
        </ul>
      )}

      {comprados.length > 0 && (
        <div className="mt-4 flex flex-col gap-1">
          <div className="flex items-center justify-between px-1">
            <h2 className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">
              Comprado
            </h2>
            <button
              type="button"
              onClick={vaciar}
              className="text-xs font-medium text-muted-foreground transition-colors hover:text-destructive"
            >
              Vaciar
            </button>
          </div>
          <ul className={cn("flex flex-col", pendiente && "opacity-60")}>
            {comprados.map((item, i) => (
              <Fila
                key={item.id}
                item={item}
                borde={i > 0}
                editando={editandoId === item.id}
                onToggle={toggle}
                onBorrar={borrar}
                onEditar={() => setEditandoId(item.id)}
                onCerrarEdicion={() => setEditandoId(null)}
                onRefresh={() => router.refresh()}
              />
            ))}
          </ul>
        </div>
      )}
    </>
  )
}

function Fila({
  item,
  borde,
  editando,
  onToggle,
  onBorrar,
  onEditar,
  onCerrarEdicion,
  onRefresh,
}: {
  item: ItemCompra
  borde: boolean
  editando: boolean
  onToggle: (i: ItemCompra) => void
  onBorrar: (i: ItemCompra) => void
  onEditar: () => void
  onCerrarEdicion: () => void
  onRefresh: () => void
}) {
  if (editando) {
    return (
      <li className={cn("py-2", borde && "border-t border-border/60")}>
        <FilaEdicion item={item} onCerrar={onCerrarEdicion} onRefresh={onRefresh} />
      </li>
    )
  }

  return (
    <li className={cn("flex items-center gap-3 py-2.5", borde && "border-t border-border/60")}>
      <button
        type="button"
        onClick={() => onToggle(item)}
        aria-label={item.comprado ? "Marcar pendiente" : "Marcar comprado"}
        className={cn(
          "shrink-0",
          item.comprado ? "text-secondary-foreground" : "text-muted-foreground hover:text-foreground",
        )}
      >
        {item.comprado ? <CircleCheckIcon className="size-5" /> : <CircleIcon className="size-5" />}
      </button>

      <button
        type="button"
        onClick={onEditar}
        aria-label={`Editar ${item.nombre}`}
        className="flex min-w-0 flex-1 flex-col gap-0.5 text-left"
      >
        <span
          className={cn(
            "truncate text-sm font-medium text-foreground",
            item.comprado && "text-muted-foreground line-through",
          )}
        >
          {item.nombre}
          {item.cantidad && (
            <span className={cn("ml-1.5 font-normal text-muted-foreground", item.comprado && "line-through")}>
              {item.cantidad}
            </span>
          )}
        </span>
        {item.agregadoPor && (
          <span className="truncate text-xs text-muted-foreground/70">por {item.agregadoPor}</span>
        )}
      </button>

      <button
        type="button"
        onClick={() => onBorrar(item)}
        aria-label={`Eliminar ${item.nombre}`}
        className="shrink-0 text-muted-foreground/60 transition-colors hover:text-destructive"
      >
        <Trash2Icon className="size-4" />
      </button>
    </li>
  )
}

function FilaEdicion({
  item,
  onCerrar,
  onRefresh,
}: {
  item: ItemCompra
  onCerrar: () => void
  onRefresh: () => void
}) {
  const [nombre, setNombre] = useState(item.nombre)
  const [cantidad, setCantidad] = useState(item.cantidad ?? "1")
  const [pendiente, startTransition] = useTransition()
  const [error, setError] = useState<string | null>(null)

  function guardar() {
    const n = nombre.trim()
    if (!n) {
      setError("Escribe qué agregar.")
      return
    }
    startTransition(async () => {
      const res = await editarItem(item.id, { nombre: n, cantidad })
      if (res.error) {
        setError(res.error)
        return
      }
      onCerrar()
      onRefresh()
    })
  }

  return (
    <form
      onSubmit={(e) => {
        e.preventDefault()
        guardar()
      }}
      className="flex flex-col gap-2"
    >
      <div className="flex items-center gap-2">
        <Input
          value={nombre}
          onChange={(e) => setNombre(e.target.value)}
          aria-label="Nombre del ítem"
          autoFocus
          className="h-10 flex-1"
        />
        <CantidadStepper value={cantidad} onChange={setCantidad} />
      </div>
      <div className="flex items-center gap-2">
        <button
          type="submit"
          disabled={pendiente}
          className="h-9 rounded-lg bg-primary px-4 text-sm font-semibold text-primary-foreground transition-opacity hover:opacity-95 disabled:opacity-50"
        >
          Guardar
        </button>
        <button
          type="button"
          onClick={onCerrar}
          className="h-9 rounded-lg px-3 text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
        >
          Cancelar
        </button>
        {error && <span className="text-xs text-destructive">{error}</span>}
      </div>
    </form>
  )
}

/**
 * Control de cantidad: [−] [input] [+]. Los botones suben/bajan de a 1 (mínimo 1);
 * el input acepta decimales (inputMode="decimal", saneado con sanearCantidad). La
 * cantidad se guarda como texto ("1", "1.5").
 */
function CantidadStepper({
  value,
  onChange,
}: {
  value: string
  onChange: (v: string) => void
}) {
  const paso = (delta: number) => {
    const n = parseFloat(value.replace(",", ".")) || 0
    const siguiente = Math.max(1, Math.round((n + delta) * 100) / 100)
    onChange(String(siguiente))
  }

  return (
    <div className="flex h-11 shrink-0 items-center rounded-xl border border-border">
      <button
        type="button"
        aria-label="Menos uno"
        onClick={() => paso(-1)}
        className="flex h-full w-9 items-center justify-center rounded-l-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <MinusIcon className="size-4" aria-hidden />
      </button>
      <input
        value={value}
        onChange={(e) => onChange(sanearCantidad(e.target.value))}
        inputMode="decimal"
        aria-label="Cantidad"
        className="h-full w-9 border-x border-border bg-transparent text-center text-sm outline-none focus:bg-muted/40"
      />
      <button
        type="button"
        aria-label="Más uno"
        onClick={() => paso(1)}
        className="flex h-full w-9 items-center justify-center rounded-r-xl text-muted-foreground transition-colors hover:bg-muted hover:text-foreground"
      >
        <PlusIcon className="size-4" aria-hidden />
      </button>
    </div>
  )
}
