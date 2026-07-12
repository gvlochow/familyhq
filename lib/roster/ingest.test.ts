/**
 * Tests de la capa de ingesta (lib/roster/ingest). A diferencia de roster.test.ts
 * y golden.test.ts —que corren contra el .ics real de Pablo—, estos usan eventos
 * sintéticos: cubren la ventana de clasificación, el hash por día y la regla de
 * override, sin depender del fixture gitignored.
 */
import { DateTime } from 'luxon'
import { describe, expect, it } from 'vitest'
import { Estado, RosterEvent } from './index'
import {
  aplicarOverrides,
  construirFilasDisponibilidad,
  hashEventos,
  ventanaPorDefecto,
  type FilaDisponibilidad,
} from './ingest'

/** Helper: construye un RosterEvent con horas UTC desde ISO. */
function ev(
  uid: string,
  summary: string,
  kind: 'activity' | 'flight' | 'report' | 'window' | 'other',
  code: string,
  startISO: string,
  endISO: string,
): RosterEvent {
  return new RosterEvent(
    uid,
    summary,
    '',
    DateTime.fromISO(startISO, { zone: 'utc' }),
    DateTime.fromISO(endISO, { zone: 'utc' }),
    kind,
    code,
  )
}

// Chile en julio está en UTC-4: 12:00Z = 08:00 local, dentro del día local.
const hsb15 = ev('a-hsb', 'Activity : HSB1 at SCL', 'activity', 'HSB1', '2026-07-15T12:00:00Z', '2026-07-15T20:00:00Z')
const vuelo20 = ev('f-820', 'Flight : LA820', 'flight', '', '2026-07-20T12:00:00Z', '2026-07-20T18:00:00Z')

describe('ventanaPorDefecto', () => {
  it('abarca el mes en curso + 3 meses hacia adelante', () => {
    expect(ventanaPorDefecto('2026-07-12')).toEqual({ desde: '2026-07-01', hasta: '2026-10-31' })
  })

  it('arranca el día 1 aunque hoy sea a fin de mes', () => {
    expect(ventanaPorDefecto('2026-02-27')).toEqual({ desde: '2026-02-01', hasta: '2026-05-31' })
  })
})

describe('hashEventos', () => {
  it('día sin evidencia -> null', () => {
    expect(hashEventos([])).toBeNull()
  })

  it('es estable e independiente del orden de los eventos', () => {
    expect(hashEventos([hsb15, vuelo20])).toBe(hashEventos([vuelo20, hsb15]))
  })

  it('cambia si cambia un evento subyacente', () => {
    const vuelo20Movido = ev('f-820', 'Flight : LA820', 'flight', '', '2026-07-20T13:00:00Z', '2026-07-20T19:00:00Z')
    expect(hashEventos([vuelo20])).not.toBe(hashEventos([vuelo20Movido]))
  })
})

describe('construirFilasDisponibilidad', () => {
  const filas = construirFilasDisponibilidad([hsb15, vuelo20], '2026-07-14', '2026-07-21')
  const porFecha = (f: string) => filas.find((x) => x.fecha === f)!

  it('una fila por día del rango, ambos extremos inclusive', () => {
    expect(filas).toHaveLength(8)
    expect(filas[0].fecha).toBe('2026-07-14')
    expect(filas[filas.length - 1].fecha).toBe('2026-07-21')
  })

  it('actividad HSB1 -> standby_casa con hash de evidencia', () => {
    const f = porFecha('2026-07-15')
    expect(f.estado).toBe(Estado.STANDBY_CASA)
    expect(f.sourceEventHash).not.toBeNull()
  })

  it('día de vuelo -> fuera con hash de evidencia', () => {
    const f = porFecha('2026-07-20')
    expect(f.estado).toBe(Estado.FUERA)
    expect(f.sourceEventHash).not.toBeNull()
  })

  it('día sin rol -> en_casa por defecto, sin hash', () => {
    const f = porFecha('2026-07-18')
    expect(f.estado).toBe(Estado.EN_CASA)
    expect(f.sourceEventHash).toBeNull()
  })
})

describe('aplicarOverrides', () => {
  const filas: FilaDisponibilidad[] = [
    { fecha: '2026-07-20', estado: Estado.FUERA, sourceEventHash: 'hash-vuelo' },
    { fecha: '2026-07-21', estado: Estado.EN_CASA, sourceEventHash: null },
  ]

  it('sin overrides deja todo como clasificado', () => {
    const out = aplicarOverrides(filas, [])
    expect(out.every((f) => f.source === 'clasificado')).toBe(true)
  })

  it('override vigente (mismo hash) gana sobre el clasificado', () => {
    const out = aplicarOverrides(filas, [
      { fecha: '2026-07-20', estado: Estado.EN_CASA, sourceEventHashAtOverride: 'hash-vuelo' },
    ])
    const f = out.find((x) => x.fecha === '2026-07-20')!
    expect(f.estado).toBe(Estado.EN_CASA)
    expect(f.source).toBe('override')
  })

  it('override obsoleto (el evento cambió) se descarta y vuelve el clasificado', () => {
    const out = aplicarOverrides(filas, [
      { fecha: '2026-07-20', estado: Estado.EN_CASA, sourceEventHashAtOverride: 'hash-viejo' },
    ])
    const f = out.find((x) => x.fecha === '2026-07-20')!
    expect(f.estado).toBe(Estado.FUERA)
    expect(f.source).toBe('clasificado')
  })
})
