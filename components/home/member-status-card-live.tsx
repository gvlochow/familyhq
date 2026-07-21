"use client"

import { useEffect, useState } from "react"
import { DateTime } from "luxon"

import { TZ_LOCAL } from "@/lib/roster/types"
import type { TramoVista } from "@/lib/availability/dia-resumen"
import { estadoEnInstante } from "@/lib/availability/dia-resumen"
import { MemberStatusCard } from "@/components/home/member-status-card"

/**
 * Envuelve MemberStatusCard para que su estado "AHORA" se actualice SOLO al cruzar
 * un borde de tramo (o el cambio de día local, que ajusta el "hasta hoy/mañana"),
 * sin polling por segundo: reprograma un único setTimeout al próximo borde.
 *
 * Hidratación: arranca con el `nowISO` del server (el primer render calza con el
 * HTML). Al montar salta al reloj real (útil en una PWA abierta hace rato) y de ahí
 * avanza por bordes.
 */
export function MemberStatusCardLive({
  inicial,
  nombre,
  esTu,
  tramos,
  nowISO,
}: {
  inicial: string
  nombre: string
  esTu: boolean
  tramos: TramoVista[]
  nowISO: string
}) {
  const [now, setNow] = useState(nowISO)

  useEffect(() => {
    let timer: ReturnType<typeof setTimeout> | undefined

    function programar() {
      const ahora = DateTime.now()
      setNow(ahora.toISO()!)

      const nowMs = ahora.toMillis()
      // Candidatos: cada borde de tramo + la próxima medianoche local (para el
      // "hasta hoy/mañana"). El próximo estrictamente mayor a ahora manda.
      let siguiente = Infinity
      for (const t of tramos) {
        for (const iso of [t.inicioUtc, t.finUtc]) {
          const ms = DateTime.fromISO(iso).toMillis()
          if (ms > nowMs && ms < siguiente) siguiente = ms
        }
      }
      const medianoche = ahora.setZone(TZ_LOCAL).startOf("day").plus({ days: 1 }).toMillis()
      if (medianoche > nowMs && medianoche < siguiente) siguiente = medianoche

      if (siguiente === Infinity) return // no hay más cambios en la ventana
      // +1s de colchón para caer del lado correcto del borde.
      timer = setTimeout(programar, siguiente - nowMs + 1000)
    }

    programar()
    return () => {
      if (timer) clearTimeout(timer)
    }
  }, [tramos])

  const ahora = estadoEnInstante(tramos, now)

  return (
    <MemberStatusCard
      inicial={inicial}
      nombre={nombre}
      esTu={esTu}
      estado={ahora?.estado ?? null}
      finUtc={ahora?.finUtc ?? null}
      nowISO={now}
    />
  )
}
