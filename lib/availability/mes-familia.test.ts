import { describe, expect, it } from 'vitest'
import { construirGrillaMesFamilia, type MiembroCalendario } from './mes-familia'
import type { TramoVista } from './dia-resumen'

// UTC-4: día D = D 04:00Z -> D+1 04:00Z.
function diaCompleto(fecha: string, estado: string): TramoVista {
  const [y, m, d] = fecha.split('-').map(Number)
  const sig = new Date(Date.UTC(y, m - 1, d + 1)).toISOString().slice(0, 10)
  return { inicioUtc: `${fecha}T04:00:00Z`, finUtc: `${sig}T04:00:00Z`, estado }
}

const pablo: MiembroCalendario = {
  id: 'p',
  nombre: 'Pablo',
  inicial: 'P',
  tramos: [diaCompleto('2026-07-13', 'fuera')],
}
const ana: MiembroCalendario = {
  id: 'a',
  nombre: 'Ana',
  inicial: 'A',
  tramos: [diaCompleto('2026-07-13', 'en_casa')],
}

describe('construirGrillaMesFamilia', () => {
  it('grilla múltiplo de 7, alineada a lunes', () => {
    const g = construirGrillaMesFamilia([pablo, ana], '2026-07', '2026-07-12')
    expect(g.dias.length % 7).toBe(0)
    expect(g.dias[0].fecha).toBe('2026-06-29') // lunes previo
    expect(g.dias[0].delMes).toBe(false)
  })

  it('cada día del mes resume a todos los integrantes', () => {
    const g = construirGrillaMesFamilia([pablo, ana], '2026-07', '2026-07-13')
    const d13 = g.dias.find((d) => d.fecha === '2026-07-13')!
    expect(d13.miembros).toHaveLength(2)
    expect(d13.miembros.find((m) => m.id === 'p')!.estado).toBe('fuera')
    expect(d13.miembros.find((m) => m.id === 'a')!.estado).toBe('en_casa')
    expect(d13.esHoy).toBe(true)
  })

  it('día sin dato para un integrante -> su estado es null', () => {
    const g = construirGrillaMesFamilia([pablo, ana], '2026-07', '2026-07-13')
    const d14 = g.dias.find((d) => d.fecha === '2026-07-14')!
    expect(d14.miembros.every((m) => m.estado === null)).toBe(true)
  })

  it('los días de relleno no traen resumen de integrantes', () => {
    const g = construirGrillaMesFamilia([pablo, ana], '2026-07', '2026-07-12')
    expect(g.dias.find((d) => d.fecha === '2026-06-29')!.miembros).toHaveLength(0)
  })
})
