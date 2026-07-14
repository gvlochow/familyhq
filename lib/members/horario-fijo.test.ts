import { describe, expect, it } from 'vitest'
import { bloquesDesdeFilas, type FilaFixedSchedule } from './horario-fijo'

describe('bloquesDesdeFilas', () => {
  it('reconstruye 7 bloques; días sin fila quedan libres con defaults', () => {
    const filas: FilaFixedSchedule[] = [
      { dia_semana: 1, hora_inicio: '09:00:00', hora_fin: '18:00:00', almuerza_en_casa: false, hora_almuerzo_inicio: null, hora_almuerzo_fin: null },
    ]
    const bloques = bloquesDesdeFilas(filas)
    expect(bloques).toHaveLength(7)
    const lunes = bloques.find((b) => b.dia === 1)!
    expect(lunes.trabaja).toBe(true)
    expect([lunes.horaInicio, lunes.horaFin]).toEqual(['09:00', '18:00'])
    // Martes no tiene fila -> libre con defaults.
    const martes = bloques.find((b) => b.dia === 2)!
    expect(martes.trabaja).toBe(false)
    expect([martes.horaInicio, martes.horaFin]).toEqual(['09:00', '18:00'])
  })

  it('recorta HH:MM:SS y lee el almuerzo', () => {
    const filas: FilaFixedSchedule[] = [
      { dia_semana: 3, hora_inicio: '08:30:00', hora_fin: '17:15:00', almuerza_en_casa: true, hora_almuerzo_inicio: '13:00:00', hora_almuerzo_fin: '14:00:00' },
    ]
    const b = bloquesDesdeFilas(filas).find((x) => x.dia === 3)!
    expect(b).toMatchObject({
      trabaja: true,
      horaInicio: '08:30',
      horaFin: '17:15',
      almuerzaEnCasa: true,
      horaAlmuerzoInicio: '13:00',
      horaAlmuerzoFin: '14:00',
    })
  })

  it('una fila con horas null se lee como día libre', () => {
    const filas: FilaFixedSchedule[] = [
      { dia_semana: 6, hora_inicio: null, hora_fin: null, almuerza_en_casa: false, hora_almuerzo_inicio: null, hora_almuerzo_fin: null },
    ]
    expect(bloquesDesdeFilas(filas).find((b) => b.dia === 6)!.trabaja).toBe(false)
  })
})
