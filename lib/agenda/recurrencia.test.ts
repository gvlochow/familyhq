import { describe, expect, it } from 'vitest'
import {
  esRecurrencia,
  ocurrencias,
  resumenRecurrencia,
  type Recurrencia,
} from './recurrencia'

describe('esRecurrencia', () => {
  it('acepta dia_mes válido', () => {
    expect(esRecurrencia({ tipo: 'dia_mes', dia: 5 })).toBe(true)
    expect(esRecurrencia({ tipo: 'dia_mes', dia: 31 })).toBe(true)
  })
  it('acepta dias_semana válido', () => {
    expect(esRecurrencia({ tipo: 'dias_semana', dias: [2, 5] })).toBe(true)
  })
  it('rechaza formas inválidas', () => {
    expect(esRecurrencia(null)).toBe(false)
    expect(esRecurrencia({ tipo: 'dia_mes', dia: 0 })).toBe(false)
    expect(esRecurrencia({ tipo: 'dia_mes', dia: 32 })).toBe(false)
    expect(esRecurrencia({ tipo: 'dia_mes', dia: 5.5 })).toBe(false)
    expect(esRecurrencia({ tipo: 'dias_semana', dias: [] })).toBe(false)
    expect(esRecurrencia({ tipo: 'dias_semana', dias: [8] })).toBe(false)
    expect(esRecurrencia({ tipo: 'otro' })).toBe(false)
  })
})

describe('ocurrencias — dia_mes', () => {
  const r: Recurrencia = { tipo: 'dia_mes', dia: 5 }

  it('genera el día 5 de cada mes en la ventana', () => {
    expect(ocurrencias(r, '2026-07-01', '2026-09-30', '2026-01-01', null)).toEqual([
      '2026-07-05',
      '2026-08-05',
      '2026-09-05',
    ])
  })

  it('respeta fecha_inicio (no genera antes de la vigencia)', () => {
    expect(ocurrencias(r, '2026-07-01', '2026-09-30', '2026-08-10', null)).toEqual([
      '2026-09-05',
    ])
  })

  it('respeta fecha_fin', () => {
    expect(ocurrencias(r, '2026-07-01', '2026-12-31', '2026-01-01', '2026-08-31')).toEqual([
      '2026-07-05',
      '2026-08-05',
    ])
  })

  it('ancla al último día cuando el mes es más corto (dia 31 en febrero)', () => {
    const r31: Recurrencia = { tipo: 'dia_mes', dia: 31 }
    // 2026 no es bisiesto -> febrero tiene 28 días.
    expect(ocurrencias(r31, '2026-02-01', '2026-02-28', '2026-01-01', null)).toEqual([
      '2026-02-28',
    ])
  })
})

describe('ocurrencias — dias_semana', () => {
  const r: Recurrencia = { tipo: 'dias_semana', dias: [2, 5] } // martes y viernes

  it('genera cada martes y viernes de la ventana', () => {
    // 2026-07-14 es martes.
    expect(ocurrencias(r, '2026-07-13', '2026-07-19', '2026-01-01', null)).toEqual([
      '2026-07-14', // martes
      '2026-07-17', // viernes
    ])
  })

  it('ventana vacía si fecha_inicio es posterior', () => {
    expect(ocurrencias(r, '2026-07-13', '2026-07-19', '2026-08-01', null)).toEqual([])
  })
})

describe('resumenRecurrencia', () => {
  it('dia_mes', () => {
    expect(resumenRecurrencia({ tipo: 'dia_mes', dia: 5 })).toBe('cada 5 del mes')
  })
  it('un día de la semana', () => {
    expect(resumenRecurrencia({ tipo: 'dias_semana', dias: [4] })).toBe('cada jueves')
  })
  it('varios días de la semana, ordenados', () => {
    expect(resumenRecurrencia({ tipo: 'dias_semana', dias: [5, 2] })).toBe('martes y viernes')
  })
  it('tres o más días', () => {
    expect(resumenRecurrencia({ tipo: 'dias_semana', dias: [1, 3, 5] })).toBe(
      'lunes, miércoles y viernes',
    )
  })
})
