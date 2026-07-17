import "server-only"
import { lookup } from "node:dns/promises"

import { esIpPublica } from "@/lib/roster/ip-privada"

/**
 * Defensa anti-SSRF para el fetch del feed iCal.
 *
 * El feed lo pega el usuario (onboarding) y luego lo relee el cron. Sin control,
 * una URL apuntando a un host interno (metadata de la nube, 127.0.0.1, red
 * privada) convertiría al servidor en un proxy hacia su propia red. Este helper:
 *
 *  - Resuelve el hostname por DNS y rechaza cualquier IP no pública (loopback,
 *    link-local, privada, CGNAT, reservada), IPv4 e IPv6.
 *  - No sigue redirects a ciegas: los procesa manualmente y revalida el host de
 *    cada salto (un 302 hacia una IP privada también se rechaza).
 *
 * Riesgo residual conocido — DNS rebinding: el hostname podría resolver a una IP
 * distinta entre este lookup y el fetch real. Cerrarlo exige conectar contra la
 * IP ya resuelta (custom agent) y no compensa la complejidad hoy.
 *
 * Excepción de desarrollo: en NODE_ENV !== 'production' se permite localhost /
 * 127.0.0.1 para poder probar el flujo con un fixture .ics servido localmente.
 * El guard por NODE_ENV hace imposible que esto relaje nada en producción.
 */

function esHostLocalDev(hostname: string): boolean {
  return (
    process.env.NODE_ENV !== "production" &&
    (hostname === "localhost" || hostname === "127.0.0.1")
  )
}

async function hostEsPublico(hostname: string): Promise<boolean> {
  const { address } = await lookup(hostname) // resuelve tal como lo hará fetch
  return esIpPublica(address)
}

/** fetch con validación de host y redirects manuales revalidados por salto. */
export async function fetchFeedSeguro(
  urlInicial: string,
  opciones: { signal: AbortSignal; maxRedirects?: number },
): Promise<Response> {
  let url = urlInicial
  const maxRedirects = opciones.maxRedirects ?? 3

  for (let i = 0; i <= maxRedirects; i++) {
    const { hostname } = new URL(url)
    if (!esHostLocalDev(hostname) && !(await hostEsPublico(hostname))) {
      throw new Error("host no permitido")
    }

    const res = await fetch(url, {
      cache: "no-store",
      redirect: "manual", // no seguimos a ciegas: revalidamos cada salto
      signal: opciones.signal,
    })

    if (res.status >= 300 && res.status < 400) {
      const loc = res.headers.get("location")
      if (!loc) return res
      url = new URL(loc, url).toString() // resuelve relativos, sigue el loop
      continue
    }
    return res
  }

  throw new Error("demasiados redirects")
}
