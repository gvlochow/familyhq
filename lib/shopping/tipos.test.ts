import { describe, expect, it } from 'vitest'
import { mapearItem, sanearCantidad, separarItems, type FilaItemDB, type ItemCompra } from './tipos'

const miembros = new Map<string, string>([
  ['m1', 'Gino'],
  ['m2', 'Ana'],
])

function fila(over: Partial<FilaItemDB> = {}): FilaItemDB {
  return { id: 'i1', name: 'Leche', quantity: '2 L', is_purchased: false, added_by: 'm1', ...over }
}

describe('mapearItem', () => {
  it('mapea columnas y resuelve el autor a su primer nombre', () => {
    const it = mapearItem(fila(), miembros)
    expect(it).toEqual<ItemCompra>({
      id: 'i1',
      nombre: 'Leche',
      cantidad: '2 L',
      comprado: false,
      agregadoPor: 'Gino',
    })
  })

  it('cantidad vacía o solo espacios queda en null', () => {
    expect(mapearItem(fila({ quantity: '' }), miembros).cantidad).toBeNull()
    expect(mapearItem(fila({ quantity: '   ' }), miembros).cantidad).toBeNull()
    expect(mapearItem(fila({ quantity: null }), miembros).cantidad).toBeNull()
  })

  it('added_by null o que no resuelve deja agregadoPor en null (no rompe)', () => {
    expect(mapearItem(fila({ added_by: null }), miembros).agregadoPor).toBeNull()
    expect(mapearItem(fila({ added_by: 'fantasma' }), miembros).agregadoPor).toBeNull()
  })
})

describe('separarItems', () => {
  it('agrupa pendientes y comprados preservando el orden de entrada', () => {
    const items: ItemCompra[] = [
      { id: 'a', nombre: 'Pan', cantidad: null, comprado: false, agregadoPor: null },
      { id: 'b', nombre: 'Huevos', cantidad: null, comprado: true, agregadoPor: null },
      { id: 'c', nombre: 'Café', cantidad: null, comprado: false, agregadoPor: null },
      { id: 'd', nombre: 'Sal', cantidad: null, comprado: true, agregadoPor: null },
    ]
    const { pendientes, comprados } = separarItems(items)
    expect(pendientes.map((i) => i.id)).toEqual(['a', 'c'])
    expect(comprados.map((i) => i.id)).toEqual(['b', 'd'])
  })

  it('lista vacía devuelve ambos grupos vacíos', () => {
    expect(separarItems([])).toEqual({ pendientes: [], comprados: [] })
  })
})

describe('sanearCantidad', () => {
  it('deja solo dígitos', () => {
    expect(sanearCantidad('2 kg')).toBe('2')
    expect(sanearCantidad('abc10def')).toBe('10')
  })
  it('permite un separador decimal y normaliza la coma', () => {
    expect(sanearCantidad('1,5')).toBe('1.5')
    expect(sanearCantidad('0.5')).toBe('0.5')
  })
  it('conserva solo el primer punto', () => {
    expect(sanearCantidad('1.2.3')).toBe('1.23')
  })
  it('deja un punto final para seguir tecleando', () => {
    expect(sanearCantidad('1.')).toBe('1.')
  })
  it('vacío si no hay nada numérico', () => {
    expect(sanearCantidad('kg')).toBe('')
    expect(sanearCantidad('')).toBe('')
  })
})
