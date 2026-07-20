"use client"

import { useEffect, useRef, useState } from "react"

import { cn } from "@/lib/utils"

const ITEM_H = 48 // alto de cada opción en px (h-12)

/**
 * Rueda de selección de minutos (estilo iOS) con scroll real + scroll-snap.
 * Muestra el valor centrado en negrita y los vecinos atenuados; al asentarse el
 * scroll, confirma el valor centrado. Pasos configurables (por defecto 15 min).
 *
 * El snap nativo (scroll-snap) hace el trabajo de "caer" en una opción; leemos la
 * opción centrada desde scrollTop (no desde estado, para evitar closures rancios).
 */
export function BufferWheel({
  value,
  onChange,
  min = 0,
  max = 180,
  step = 15,
  ariaLabel,
}: {
  value: number
  onChange: (v: number) => void
  min?: number
  max?: number
  step?: number
  ariaLabel?: string
}) {
  const valores: number[] = []
  for (let v = min; v <= max; v += step) valores.push(v)

  const ref = useRef<HTMLDivElement>(null)
  const commitTimer = useRef<ReturnType<typeof setTimeout> | null>(null)
  const [centro, setCentro] = useState(value)

  const idxDe = (v: number) => {
    const i = valores.indexOf(v)
    return i >= 0 ? i : Math.round((v - min) / step)
  }

  // Posiciona la rueda en el valor inicial al montar (sin animación).
  useEffect(() => {
    const el = ref.current
    if (el) el.scrollTop = idxDe(value) * ITEM_H
    // Solo al montar: después manda el scroll del usuario.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  function handleScroll() {
    const el = ref.current
    if (!el) return
    const idx = Math.max(0, Math.min(valores.length - 1, Math.round(el.scrollTop / ITEM_H)))
    const v = valores[idx]
    if (v !== centro) setCentro(v)

    // Confirma cuando el scroll se asienta (~120ms sin más eventos).
    if (commitTimer.current) clearTimeout(commitTimer.current)
    commitTimer.current = setTimeout(() => {
      const el2 = ref.current
      if (!el2) return
      const i = Math.max(0, Math.min(valores.length - 1, Math.round(el2.scrollTop / ITEM_H)))
      if (valores[i] !== value) onChange(valores[i])
    }, 120)
  }

  return (
    <div className="relative mx-auto h-36 w-40" role="group" aria-label={ariaLabel}>
      {/* Caja central que enmarca la selección. */}
      <div className="pointer-events-none absolute inset-x-0 top-1/2 h-12 -translate-y-1/2 rounded-xl bg-card shadow-sm ring-1 ring-border/60" />
      <div
        ref={ref}
        onScroll={handleScroll}
        className="scrollbar-none h-full snap-y snap-mandatory overflow-y-auto"
      >
        <div style={{ height: ITEM_H }} aria-hidden />
        {valores.map((v) => (
          <div
            key={v}
            className={cn(
              "flex h-12 snap-center items-center justify-center tabular-nums transition-all",
              v === centro
                ? "text-2xl font-bold text-primary"
                : "text-base text-muted-foreground/45",
            )}
          >
            {v} min
          </div>
        ))}
        <div style={{ height: ITEM_H }} aria-hidden />
      </div>
    </div>
  )
}
