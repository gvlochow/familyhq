import { describe, expect, it } from 'vitest'
import {
  expandirRecurrentes,
  idOcurrencia,
  parseIdOcurrencia,
  type ReglaRecurrenteDB,
} from './recurrente'
import type { MiembroRef } from './tipos'

const miembros = new Map<string, MiembroRef>([
  ['m1', { id: 'm1', inicial: 'A', nombre: 'Ana' }],
  ['m2', { id: 'm2', inicial: 'B', nombre: 'Beto' }],
])

function regla(over: Partial<ReglaRecurrenteDB> = {}): ReglaRecurrenteDB {
  return {
    id: 'r1',
    tipo: 'tarea',
    titulo: 'Cuenta de luz',
    hora: null,
    recurrence: { tipo: 'dia_mes', dia: 5 },
    asignado_a: ['m1'],
    fecha_inicio: '2026-01-01',
    fecha_fin: null,
    created_by: 'm2',
    ...over,
  }
}

describe('idOcurrencia / parseIdOcurrencia', () => {
  it('ida y vuelta', () => {
    const id = idOcurrencia('abc-123', '2026-08-05')
    expect(id).toBe('rec:abc-123:2026-08-05')
    expect(parseIdOcurrencia(id)).toEqual({ ruleId: 'abc-123', fecha: '2026-08-05' })
  })
  it('un id puntual (no recurrente) da null', () => {
    expect(parseIdOcurrencia('550e8400-e29b-41d4-a716-446655440000')).toBeNull()
  })
})

describe('expandirRecurrentes', () => {
  it('expande una regla mensual a ocurrencias AgendaItem con asignados y creador', () => {
    const items = expandirRecurrentes([regla()], new Set(), '2026-07-01', '2026-09-30', miembros)
    expect(items.map((i) => i.fecha)).toEqual(['2026-07-05', '2026-08-05', '2026-09-05'])
    const primero = items[0]
    expect(primero.id).toBe('rec:r1:2026-07-05')
    expect(primero.titulo).toBe('Cuenta de luz')
    expect(primero.tipo).toBe('tarea')
    expect(primero.recurrente).toBe(true)
    expect(primero.recurrenteId).toBe('r1')
    expect(primero.recurrenciaResumen).toBe('cada 5 del mes')
    expect(primero.asignados).toEqual([{ id: 'm1', inicial: 'A', nombre: 'Ana' }])
    expect(primero.agregadoPor).toBe('Beto')
    expect(primero.completado).toBe(false)
  })

  it('marca completado según el set de completadas', () => {
    const completadas = new Set(['r1:2026-08-05'])
    const items = expandirRecurrentes([regla()], completadas, '2026-07-01', '2026-09-30', miembros)
    expect(items.find((i) => i.fecha === '2026-08-05')?.completado).toBe(true)
    expect(items.find((i) => i.fecha === '2026-07-05')?.completado).toBe(false)
  })

  it('recorta la hora HH:MM:SS -> HH:MM', () => {
    const items = expandirRecurrentes([regla({ hora: '19:30:00' })], new Set(), '2026-07-01', '2026-07-31', miembros)
    expect(items[0].hora).toBe('19:30')
  })

  it('descarta reglas con tipo o recurrence inválidos', () => {
    const malas = [
      regla({ id: 'x', tipo: 'inventado' }),
      regla({ id: 'y', recurrence: { tipo: 'otro' } }),
    ]
    expect(expandirRecurrentes(malas, new Set(), '2026-07-01', '2026-12-31', miembros)).toEqual([])
  })

  it('ordena por fecha al mezclar varias reglas', () => {
    const semanal = regla({ id: 'r2', recurrence: { tipo: 'dias_semana', dias: [2] }, asignado_a: [] })
    const items = expandirRecurrentes([regla(), semanal], new Set(), '2026-07-01', '2026-07-08', miembros)
    // dia_mes 5 -> 07-05 (domingo); dias_semana martes -> 07-07. Ordenadas.
    expect(items.map((i) => i.fecha)).toEqual(['2026-07-05', '2026-07-07'])
  })
})
