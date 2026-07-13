/**
 * Tests de la ventana de clasificación (lib/roster/ingest). Eventos sintéticos,
 * sin depender del fixture gitignored. La materialización por-día y la regla de
 * override que este módulo tenía se retiraron al migrar a tramos intra-día.
 */
import { describe, expect, it } from 'vitest'
import { ventanaPorDefecto } from './ingest'

describe('ventanaPorDefecto', () => {
  it('abarca el mes en curso + 3 meses hacia adelante', () => {
    expect(ventanaPorDefecto('2026-07-12')).toEqual({ desde: '2026-07-01', hasta: '2026-10-31' })
  })

  it('arranca el día 1 aunque hoy sea a fin de mes', () => {
    expect(ventanaPorDefecto('2026-02-27')).toEqual({ desde: '2026-02-01', hasta: '2026-05-31' })
  })
})
