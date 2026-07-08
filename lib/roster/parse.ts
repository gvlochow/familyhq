/**
 * Carga y filtrado del .ics. Porta load_roster_events / _classify_kind / _to_utc.
 *
 * Usamos ical.js (kewisch): implementación canónica y mantenida, con acceso
 * explícito a propiedades X- como X-APPLE-CREATOR-IDENTITY.
 */
import ICAL from 'ical.js'
import { DateTime } from 'luxon'
import { IFLIGHT_MARK, TZ_LOCAL, RosterEvent, type RosterKind } from './types'

/**
 * Parsea un .ics y devuelve SOLO los eventos de rol (con firma iFlight).
 * Los eventos personales se descartan aquí y nunca salen de esta función:
 * es el punto donde se cumple el requisito de privacidad (jamás se persisten).
 *
 * @param ics Contenido crudo del archivo .ics (no una ruta: el módulo es puro).
 */
export function loadRosterEvents(ics: string): RosterEvent[] {
  const root = new ICAL.Component(ICAL.parse(ics))
  const events: RosterEvent[] = []

  for (const ve of root.getAllSubcomponents('vevent')) {
    const creator = (ve.getFirstPropertyValue('x-apple-creator-identity') as string | null) ?? ''
    if (!creator.includes(IFLIGHT_MARK)) continue // <- descarte de dato personal, en memoria

    const startUtc = icalTimeToUtc(ve.getFirstPropertyValue('dtstart') as ICAL.Time | null)
    const endUtc = icalTimeToUtc(ve.getFirstPropertyValue('dtend') as ICAL.Time | null)

    const summary = (ve.getFirstPropertyValue('summary') as string | null) ?? ''
    const description = (ve.getFirstPropertyValue('description') as string | null) ?? ''
    const [kind, code] = classifyKind(summary)

    events.push(
      new RosterEvent(
        (ve.getFirstPropertyValue('uid') as string | null) ?? '',
        summary,
        description,
        startUtc,
        endUtc,
        kind,
        code,
      ),
    )
  }

  return events
}

/** Devuelve [kind, code] a partir del SUMMARY. */
export function classifyKind(summary: string): [RosterKind, string] {
  const s = summary.trim()
  if (s.startsWith('Activity :')) {
    // "Activity : DO at SCL" -> DO
    const mid = s.replace('Activity :', '').trim()
    const code = mid.split(' at ')[0].trim()
    return ['activity', code]
  }
  if (s.startsWith('Flight :')) return ['flight', '']
  if (s.startsWith('Report Time') || s.startsWith('Report time')) return ['report', '']
  if (s.startsWith('Start Time')) return ['window', ''] // ventana operacional que envuelve el día
  return ['other', '']
}

/**
 * Normaliza un valor DTSTART/DTEND a un instante en UTC.
 * - date-time (con Z): se toma el instante tal cual.
 * - date puro (all-day): se interpreta como medianoche local de Santiago -> UTC,
 *   igual que el harness original (documentado como supuesto).
 */
function icalTimeToUtc(t: ICAL.Time | null): DateTime {
  if (!t) throw new Error('VEVENT de rol sin DTSTART/DTEND')
  if (t.isDate) {
    return DateTime.fromObject(
      { year: t.year, month: t.month, day: t.day },
      { zone: TZ_LOCAL },
    ).toUTC()
  }
  return DateTime.fromJSDate(t.toJSDate(), { zone: 'utc' })
}
