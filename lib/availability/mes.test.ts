import { describe, expect, it } from 'vitest'
import { construirGrillaMes } from './mes'
import type { TramoVista } from './dia-resumen'

// Tramos de días completos (UTC-4: día D = D 04:00Z -> D+1 04:00Z).
function diaCompleto(fecha: string, estado: string): TramoVista {
  const [y, m, d] = fecha.split('-').map(Number)
  const inicio = `${fecha}T04:00:00Z`
  const sig = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  return { inicioUtc: inicio, finUtc: `${sig}T04:00:00Z`, estado }
}

describe('construirGrillaMes', () => {
  const tramos = [
    diaCompleto('2026-07-13', 'fuera'),
    diaCompleto('2026-07-15', 'standby_casa'),
    diaCompleto('2026-07-31', 'por_confirmar'),
  ]

  it('la grilla es múltiplo de 7 y empieza en lunes', () => {
    const g = construirGrillaMes(tramos, '2026-07', '2026-07-12')
    expect(g.dias.length % 7).toBe(0)
    // Julio 2026: el 1 cae miércoles, así que la grilla arranca el lunes 29-jun.
    expect(g.dias[0].fecha).toBe('2026-06-29')
    expect(g.dias[0].delMes).toBe(false)
  })

  it('marca los días del mes vs relleno', () => {
    const g = construirGrillaMes(tramos, '2026-07', '2026-07-12')
    expect(g.dias.find((d) => d.fecha === '2026-07-01')!.delMes).toBe(true)
    expect(g.dias.find((d) => d.fecha === '2026-06-29')!.delMes).toBe(false)
  })

  it('resume el estado del día y marca hoy', () => {
    const g = construirGrillaMes(tramos, '2026-07', '2026-07-13')
    const d13 = g.dias.find((d) => d.fecha === '2026-07-13')!
    expect(d13.estado).toBe('fuera')
    expect(d13.esHoy).toBe(true)
    expect(g.dias.find((d) => d.fecha === '2026-07-14')!.estado).toBeNull()
  })

  it('el resumen del día ignora un fuera marginal (bajo el piso)', () => {
    // Día con fuera 2h de madrugada y en casa el resto -> celda en_casa.
    const g = construirGrillaMes(
      [
        { inicioUtc: '2026-07-10T04:00:00Z', finUtc: '2026-07-10T06:00:00Z', estado: 'fuera' },
        { inicioUtc: '2026-07-10T06:00:00Z', finUtc: '2026-07-11T04:00:00Z', estado: 'en_casa' },
      ],
      '2026-07',
      '2026-07-12',
    )
    expect(g.dias.find((d) => d.fecha === '2026-07-10')!.estado).toBe('en_casa')
  })

  it('acepta una fecha completa como referencia del mes', () => {
    const g = construirGrillaMes(tramos, '2026-07-20', '2026-07-12')
    expect(g.mesISO).toBe('2026-07')
  })
})
