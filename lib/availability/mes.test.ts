import { describe, expect, it } from 'vitest'
import { construirGrillaMes } from './mes'

describe('construirGrillaMes', () => {
  const rows = [
    { fecha: '2026-07-13', estado: 'fuera' },
    { fecha: '2026-07-15', estado: 'standby_casa' },
    { fecha: '2026-07-31', estado: 'por_confirmar' },
  ]

  it('la grilla es múltiplo de 7 y empieza en lunes', () => {
    const g = construirGrillaMes(rows, '2026-07', '2026-07-12')
    expect(g.dias.length % 7).toBe(0)
    // Julio 2026: el 1 cae miércoles, así que la grilla arranca el lunes 29-jun.
    expect(g.dias[0].fecha).toBe('2026-06-29')
    expect(g.dias[0].delMes).toBe(false)
  })

  it('marca los días del mes vs relleno', () => {
    const g = construirGrillaMes(rows, '2026-07', '2026-07-12')
    const primeroDeJulio = g.dias.find((d) => d.fecha === '2026-07-01')!
    const rellenoJunio = g.dias.find((d) => d.fecha === '2026-06-29')!
    expect(primeroDeJulio.delMes).toBe(true)
    expect(rellenoJunio.delMes).toBe(false)
  })

  it('adjunta el estado normalizado y hoy', () => {
    const g = construirGrillaMes(rows, '2026-07', '2026-07-13')
    const d13 = g.dias.find((d) => d.fecha === '2026-07-13')!
    expect(d13.estado).toBe('fuera')
    expect(d13.esHoy).toBe(true)
    expect(g.dias.find((d) => d.fecha === '2026-07-14')!.estado).toBeNull()
  })

  it('acepta una fecha completa como referencia del mes', () => {
    const g = construirGrillaMes(rows, '2026-07-20', '2026-07-12')
    expect(g.mesISO).toBe('2026-07')
  })

  it('un estado desconocido se normaliza a null', () => {
    const g = construirGrillaMes([{ fecha: '2026-07-10', estado: 'raro' }], '2026-07', '2026-07-12')
    expect(g.dias.find((d) => d.fecha === '2026-07-10')!.estado).toBeNull()
  })
})
