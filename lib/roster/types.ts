/**
 * Tipos y constantes del dominio de clasificación de rol iFlight NEO -> estado familiar.
 *
 * Puerto TypeScript de reference/roster_classifier.py. Módulo de dominio puro:
 * sin dependencias de Next.js ni Supabase.
 *
 * Decisiones clave (ver PRD FamilyHQ):
 * - Solo se procesan eventos con la firma de iFlight. Todo lo demás se descarta en
 *   memoria, nunca se persiste (requisito de privacidad, Ley 19.628).
 * - El buffer de llegada se aplica al ÚLTIMO evento de una rotación, no a cada tramo.
 * - "Blank/B" es un tercer estado (POR_CONFIRMAR), no "en casa".
 * - Las horas del feed vienen en UTC (con Z); se convierten a America/Santiago con IANA.
 */
import type { DateTime } from 'luxon'

/** Firma de iFlight NEO en X-APPLE-CREATOR-IDENTITY. Solo estos eventos se procesan. */
export const IFLIGHT_MARK = 'com.ibsplc.iflight.crew.mobility'

/**
 * Zona horaria del rol. IANA, NUNCA offset fijo: el rol arrastra meses que cruzan
 * el cambio de hora de Chile, así que un offset hardcodeado correría los días.
 */
export const TZ_LOCAL = 'America/Santiago'

/** Buffers por defecto (minutos). En la app son configurables por integrante. */
export const DEFAULT_BUFFER_SALIDA_MIN = 30 // viaje a trabajo (antes de entrar)
export const DEFAULT_BUFFER_LLEGADA_MIN = 30 // viaje desde trabajo (después de salir)

/** Estado familiar de un integrante en un día calendario. */
export enum Estado {
  EN_CASA = 'en_casa',
  FUERA = 'fuera',
  STANDBY_CASA = 'standby_casa', // HSB: en casa pero llamable
  POR_CONFIRMAR = 'por_confirmar', // Blank/B
}

/** Tipo de evento de rol derivado del SUMMARY. */
export type RosterKind = 'activity' | 'flight' | 'report' | 'window' | 'other'

/**
 * Códigos de actividad (SUMMARY "Activity : XXX at YYY") -> estado.
 * HSB y ASB son el par crítico: mismo concepto "standby", ubicación opuesta.
 */
export const ACTIVITY_MAP: Record<string, Estado> = {
  DO: Estado.EN_CASA, // Day off
  DH: Estado.EN_CASA, // Holiday day off
  HSB1: Estado.STANDBY_CASA, // Home standby
  HSB: Estado.STANDBY_CASA,
  ASB3: Estado.FUERA, // Airport standby (está EN EL AEROPUERTO)
  ASB: Estado.FUERA,
  B: Estado.POR_CONFIRMAR, // Blank
}

/** Evento de rol ya filtrado (tiene la firma iFlight). Horas guardadas en UTC. */
export class RosterEvent {
  constructor(
    readonly uid: string,
    readonly summary: string,
    readonly description: string,
    /** Instante de inicio, en zona UTC. */
    readonly startUtc: DateTime,
    /** Instante de fin, en zona UTC. */
    readonly endUtc: DateTime,
    readonly kind: RosterKind,
    /** Código de actividad (DO, DH, HSB1, ASB3, B) para kind === 'activity'. */
    readonly code: string,
  ) {}

  /** Inicio en hora local de Santiago (IANA, con DST correcto). */
  get startLocal(): DateTime {
    return this.startUtc.setZone(TZ_LOCAL)
  }

  /** Fin en hora local de Santiago. */
  get endLocal(): DateTime {
    return this.endUtc.setZone(TZ_LOCAL)
  }
}
