import net from "node:net"

/**
 * Clasificación de IPs para la defensa anti-SSRF del fetch del feed. Puro y sin
 * dependencias server-only para poder testearlo aislado (ver ip-privada.test.ts).
 * Lo consume fetch-seguro.ts, que agrega la resolución DNS y el fetch.
 */

/** Rechaza loopback, link-local, privados, CGNAT y reservados (IPv4 e IPv6). */
export function esIpPublica(ip: string): boolean {
  if (net.isIPv4(ip)) {
    const [a, b] = ip.split(".").map(Number)
    if (a === 0 || a === 10 || a === 127) return false
    if (a === 172 && b >= 16 && b <= 31) return false
    if (a === 192 && b === 168) return false
    if (a === 169 && b === 254) return false // link-local / metadata cloud
    if (a === 100 && b >= 64 && b <= 127) return false // CGNAT
    return true
  }
  const low = ip.toLowerCase()
  if (low === "::1" || low === "::") return false
  if (low.startsWith("fe80")) return false // link-local
  if (low.startsWith("fc") || low.startsWith("fd")) return false // ULA privada
  if (low.startsWith("::ffff:")) return esIpPublica(low.slice(7)) // IPv4 mapeada
  return true
}
