import { describe, expect, it } from 'vitest'
import { componerTramosPorMiembro, type SegmentoRow, type OverrideRow } from './tramos'

const WIN_INI = '2026-07-14T04:00:00Z'
const WIN_FIN = '2026-07-21T04:00:00Z'

function seg(member_id: string, inicio_utc: string, fin_utc: string, estado: string): SegmentoRow {
  return { member_id, inicio_utc, fin_utc, estado }
}
function ov(member_id: string, inicio_utc: string, fin_utc: string, estado: string): OverrideRow {
  return { member_id, inicio_utc, fin_utc, estado }
}

describe('componerTramosPorMiembro', () => {
  it('sin overrides: devuelve la base clasificada por integrante', () => {
    const miembros = [{ id: 'a', tipo_horario: 'variable' }]
    const segs = [seg('a', '2026-07-14T12:00:00Z', '2026-07-14T21:00:00Z', 'fuera')]
    const r = componerTramosPorMiembro(miembros, segs, [], WIN_INI, WIN_FIN)
    expect(r.get('a')).toEqual([
      { inicioUtc: '2026-07-14T12:00:00Z', finUtc: '2026-07-14T21:00:00Z', estado: 'fuera' },
    ])
  })

  it('el override del integrante gana sobre su base', () => {
    const miembros = [{ id: 'a', tipo_horario: 'variable' }]
    const segs = [seg('a', '2026-07-14T12:00:00Z', '2026-07-14T21:00:00Z', 'fuera')]
    const ovs = [ov('a', '2026-07-14T15:00:00Z', '2026-07-14T18:00:00Z', 'en_casa')]
    const r = componerTramosPorMiembro(miembros, segs, ovs, WIN_INI, WIN_FIN)
    expect(r.get('a')).toEqual([
      { inicioUtc: '2026-07-14T12:00:00.000Z', finUtc: '2026-07-14T15:00:00.000Z', estado: 'fuera' },
      { inicioUtc: '2026-07-14T15:00:00.000Z', finUtc: '2026-07-14T18:00:00.000Z', estado: 'en_casa' },
      { inicioUtc: '2026-07-14T18:00:00.000Z', finUtc: '2026-07-14T21:00:00.000Z', estado: 'fuera' },
    ])
  })

  it("integrante 'ninguno' sin tramos recibe el default en_casa, y el override lo pisa", () => {
    const miembros = [{ id: 'k', tipo_horario: 'ninguno' }]
    const ovs = [ov('k', '2026-07-14T15:00:00Z', '2026-07-14T18:00:00Z', 'fuera')]
    const r = componerTramosPorMiembro(miembros, [], ovs, WIN_INI, WIN_FIN)
    // Base = un tramo en_casa que cubre toda la ventana; el override parte al medio.
    expect(r.get('k')).toEqual([
      { inicioUtc: '2026-07-14T04:00:00.000Z', finUtc: '2026-07-14T15:00:00.000Z', estado: 'en_casa' },
      { inicioUtc: '2026-07-14T15:00:00.000Z', finUtc: '2026-07-14T18:00:00.000Z', estado: 'fuera' },
      { inicioUtc: '2026-07-14T18:00:00.000Z', finUtc: '2026-07-21T04:00:00.000Z', estado: 'en_casa' },
    ])
  })

  it('cada integrante recibe solo sus propias filas; todos quedan en el mapa', () => {
    const miembros = [
      { id: 'a', tipo_horario: 'variable' },
      { id: 'b', tipo_horario: 'variable' },
    ]
    const segs = [seg('a', '2026-07-14T12:00:00Z', '2026-07-14T21:00:00Z', 'fuera')]
    const ovs = [ov('b', '2026-07-14T09:00:00Z', '2026-07-14T12:00:00Z', 'standby_casa')]
    const r = componerTramosPorMiembro(miembros, segs, ovs, WIN_INI, WIN_FIN)
    expect(r.get('a')).toHaveLength(1)
    expect(r.get('a')?.[0].estado).toBe('fuera')
    // b no tiene base (variable sin tramos) -> solo su override (bordes reconstruidos).
    expect(r.get('b')).toEqual([
      { inicioUtc: '2026-07-14T09:00:00.000Z', finUtc: '2026-07-14T12:00:00.000Z', estado: 'standby_casa' },
    ])
  })

  it('variable sin tramos ni overrides queda con arreglo vacío (sin información)', () => {
    const miembros = [{ id: 'a', tipo_horario: 'variable' }]
    const r = componerTramosPorMiembro(miembros, [], [], WIN_INI, WIN_FIN)
    expect(r.get('a')).toEqual([])
  })
})
