/**
 * Formato de "cuándo" para la vista familiar (tarjetas de estado + feed "Próximo
 * en la casa"). PURO: sin Next.js ni Supabase. Todo en hora local de Santiago.
 *
 * Escala de cercanía, como una app del clima:
 *   hoy -> "hoy 15:00" · mañana -> "mañana 09:00" · esta semana -> "sáb 15:00" ·
 *   más lejos -> "25 jul".
 */
import { DateTime } from 'luxon'
import { TZ_LOCAL } from '../roster/types'

/** Abreviatura de día capitalizada ("Sáb", "Lun") sin el punto que agrega luxon. */
function diaAbrev(dt: DateTime): string {
  const s = dt.setLocale('es').toFormat('ccc').replace('.', '')
  return s.charAt(0).toUpperCase() + s.slice(1)
}

/**
 * Etiqueta legible de un instante relativo a `nowISO`. `conHora` controla si se
 * incluye la hora (un vencimiento a fecha, p. ej., puede no tenerla).
 */
export function etiquetaCuando(iso: string, nowISO: string, conHora = true): string {
  const dt = DateTime.fromISO(iso).setZone(TZ_LOCAL)
  const now = DateTime.fromISO(nowISO).setZone(TZ_LOCAL)
  const hora = dt.toFormat('HH:mm')
  const sufijo = conHora ? ` ${hora}` : ''

  if (dt.hasSame(now, 'day')) return `Hoy${sufijo}`
  if (dt.hasSame(now.plus({ days: 1 }), 'day')) return `Mañana${sufijo}`

  const enDias = dt.startOf('day').diff(now.startOf('day'), 'days').days
  if (enDias > 0 && enDias < 7) return `${diaAbrev(dt)}${sufijo}`

  // Más lejos (o en el pasado): fecha corta "25 jul".
  return dt.setLocale('es').toFormat('d LLL').replace('.', '')
}

/**
 * Texto para "Fuera hasta ___" en el subtítulo de la tarjeta de estado: en
 * minúscula y natural. Mismo día -> "las 18:00"; mañana -> "mañana 09:00";
 * esta semana -> "sáb 15:00". null si el fin cae a 7+ días (se lee como constante).
 */
export function textoHasta(iso: string, nowISO: string): string | null {
  const dt = DateTime.fromISO(iso).setZone(TZ_LOCAL)
  const now = DateTime.fromISO(nowISO).setZone(TZ_LOCAL)
  const enDias = dt.startOf('day').diff(now.startOf('day'), 'days').days
  if (enDias >= 7) return null

  const hora = dt.toFormat('HH:mm')
  if (dt.hasSame(now, 'day')) return `las ${hora}`
  if (dt.hasSame(now.plus({ days: 1 }), 'day')) return `mañana ${hora}`
  return `${diaAbrev(dt).toLowerCase()} ${hora}`
}
