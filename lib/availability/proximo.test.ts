import { describe, expect, it } from 'vitest'
import { construirProximos, type MiembroTramos } from './proximo'
import { etiquetaCuando } from './formato'
import type { TramoVista } from './dia-resumen'

function t(inicioUtc: string, finUtc: string, estado: string): TramoVista {
  return { inicioUtc, finUtc, estado }
}

// Chile en julio = UTC-4. now = 07:00 local del 13 = 11:00Z.
const NOW = '2026-07-13T11:00:00Z'

function miembro(id: string, nombre: string, tramos: TramoVista[]): MiembroTramos {
  return { id, nombre, tramos }
}

describe('construirProximos', () => {
  it('emite sale (en_casa->fuera) y llega (fuera->en_casa) futuros', () => {
    const pablo = miembro('p', 'Pablo', [
      t('2026-07-13T04:00:00Z', '2026-07-13T13:00:00Z', 'en_casa'),
      t('2026-07-13T13:00:00Z', '2026-07-13T22:00:00Z', 'fuera'),
      t('2026-07-13T22:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'),
    ])
    const out = construirProximos([pablo], NOW, 7)
    expect(out).toHaveLength(2)
    expect(out[0]).toMatchObject({ tipo: 'sale', cuando: '2026-07-13T13:00:00Z' })
    expect(out[1]).toMatchObject({ tipo: 'llega', cuando: '2026-07-13T22:00:00Z' })
  })

  it('ignora cambios pasados y los que caen fuera de la ventana', () => {
    const pablo = miembro('p', 'Pablo', [
      t('2026-07-13T04:00:00Z', '2026-07-13T09:00:00Z', 'fuera'), // termina antes de now
      t('2026-07-13T09:00:00Z', '2026-07-25T04:00:00Z', 'en_casa'),
      t('2026-07-25T04:00:00Z', '2026-07-26T04:00:00Z', 'fuera'), // > +7 días
    ])
    // El llega de las 09:00Z es pasado (now 11:00Z); el sale del 25 está fuera de ventana.
    expect(construirProximos([pablo], NOW, 7)).toHaveLength(0)
  })

  it('ordena los cambios de todos los integrantes por instante', () => {
    const pablo = miembro('p', 'Pablo', [
      t('2026-07-13T04:00:00Z', '2026-07-13T20:00:00Z', 'fuera'),
      t('2026-07-13T20:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'), // llega 20:00Z
    ])
    const ana = miembro('a', 'Ana', [
      t('2026-07-13T04:00:00Z', '2026-07-13T14:00:00Z', 'en_casa'),
      t('2026-07-13T14:00:00Z', '2026-07-14T04:00:00Z', 'fuera'), // sale 14:00Z
    ])
    const out = construirProximos([pablo, ana], NOW, 7)
    expect(out.map((c) => `${c.miembro}:${c.tipo}`)).toEqual(['Ana:sale', 'Pablo:llega'])
  })

  it('omite transiciones a/desde por_confirmar', () => {
    const v = miembro('v', 'Valentina', [
      t('2026-07-13T04:00:00Z', '2026-07-13T15:00:00Z', 'en_casa'),
      t('2026-07-13T15:00:00Z', '2026-07-14T04:00:00Z', 'por_confirmar'),
    ])
    expect(construirProximos([v], NOW, 7)).toHaveLength(0)
  })
})

describe('etiquetaCuando', () => {
  it('hoy / mañana / esta semana / más lejos', () => {
    const now = '2026-07-13T12:00:00Z' // lunes 08:00 local
    expect(etiquetaCuando('2026-07-13T22:00:00Z', now)).toBe('Hoy 18:00')
    expect(etiquetaCuando('2026-07-14T13:00:00Z', now)).toBe('Mañana 09:00')
    expect(etiquetaCuando('2026-07-18T19:00:00Z', now)).toBe('Sáb 15:00') // sábado
    expect(etiquetaCuando('2026-07-25T13:00:00Z', now)).toBe('25 jul')
  })

  it('sin hora cuando se pide solo fecha', () => {
    const now = '2026-07-13T12:00:00Z'
    expect(etiquetaCuando('2026-07-25T13:00:00Z', now, false)).toBe('25 jul')
    expect(etiquetaCuando('2026-07-13T22:00:00Z', now, false)).toBe('Hoy')
  })
})
