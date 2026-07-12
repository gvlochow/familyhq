import { describe, expect, it } from 'vitest'
import { construirPanelSemana } from './panel'

// Semana base de referencia (lunes 2026-07-13 en adelante).
const rows = [
  { fecha: '2026-07-13', estado: 'fuera' },
  { fecha: '2026-07-14', estado: 'fuera' },
  { fecha: '2026-07-15', estado: 'standby_casa' },
  { fecha: '2026-07-16', estado: 'fuera' },
  { fecha: '2026-07-17', estado: 'en_casa' },
]

describe('construirPanelSemana', () => {
  it('toma el estado de hoy y arma la ventana pedida', () => {
    const p = construirPanelSemana(rows, '2026-07-13', 7)
    expect(p.estadoHoy).toBe('fuera')
    expect(p.dias).toHaveLength(7)
    expect(p.dias[0]).toMatchObject({ fecha: '2026-07-13', esHoy: true })
    expect(p.dias[1].esHoy).toBe(false)
  })

  it('cambiaEl es el primer día que difiere del estado de hoy', () => {
    // fuera 13 y 14, cambia el 15 (standby).
    const p = construirPanelSemana(rows, '2026-07-13', 7)
    expect(p.cambiaEl).toBe('2026-07-15')
  })

  it('días sin dato quedan con estado null', () => {
    const p = construirPanelSemana(rows, '2026-07-13', 7)
    // 18 y 19 no están en rows.
    expect(p.dias.find((d) => d.fecha === '2026-07-18')!.estado).toBeNull()
    expect(p.dias.find((d) => d.fecha === '2026-07-19')!.estado).toBeNull()
  })

  it('un gap tras hoy NO cuenta como cambio (cambiaEl null)', () => {
    // Solo hoy tiene dato; los días siguientes son huecos. No sabemos si el estado
    // cambia, así que no se anuncia un falso "hasta el X".
    const p = construirPanelSemana(
      [{ fecha: '2026-07-13', estado: 'fuera' }],
      '2026-07-13',
      3,
    )
    expect(p.estadoHoy).toBe('fuera')
    expect(p.cambiaEl).toBeNull()
  })

  it('un hueco entre dos días iguales no rompe la racha', () => {
    // fuera hoy, hueco mañana, fuera pasado -> sigue "toda la semana".
    const p = construirPanelSemana(
      [
        { fecha: '2026-07-13', estado: 'fuera' },
        { fecha: '2026-07-15', estado: 'fuera' },
      ],
      '2026-07-13',
      3,
    )
    expect(p.cambiaEl).toBeNull()
  })

  it('sin dato para hoy -> estadoHoy null y cambiaEl null', () => {
    const p = construirPanelSemana(rows, '2026-07-20', 7)
    expect(p.estadoHoy).toBeNull()
    expect(p.cambiaEl).toBeNull()
  })

  it('un estado desconocido se normaliza a null (no crashea la UI)', () => {
    const p = construirPanelSemana(
      [{ fecha: '2026-07-13', estado: 'estado_raro' }],
      '2026-07-13',
      2,
    )
    expect(p.estadoHoy).toBeNull()
    expect(p.dias[0].estado).toBeNull()
  })

  it('estado constante toda la ventana -> cambiaEl null', () => {
    const constante = ['2026-07-13', '2026-07-14', '2026-07-15'].map((fecha) => ({
      fecha,
      estado: 'en_casa',
    }))
    const p = construirPanelSemana(constante, '2026-07-13', 3)
    expect(p.cambiaEl).toBeNull()
  })
})
