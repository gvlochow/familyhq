import { describe, expect, it } from 'vitest'
import { construirPanelSemana } from './panel'
import type { TramoVista } from './dia-resumen'

// Chile en julio está en UTC-4. now = 2026-07-13 14:00 local = 18:00Z.
const NOW = '2026-07-13T18:00:00Z'
function t(inicioUtc: string, finUtc: string, estado: string): TramoVista {
  return { inicioUtc, finUtc, estado }
}

describe('construirPanelSemana', () => {
  it('estadoAhora es el tramo que cubre el instante actual', () => {
    const tramos = [
      t('2026-07-13T13:00:00Z', '2026-07-13T22:00:00Z', 'fuera'), // 09:00-18:00 local
      t('2026-07-13T22:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'),
    ]
    const p = construirPanelSemana(tramos, NOW, 7)
    expect(p.estadoAhora).toBe('fuera')
    // El tramo actual termina hoy a las 18:00 local (22:00Z), dentro de la ventana.
    expect(p.finActualISO).toBe('2026-07-13T22:00:00Z')
    expect(p.dias).toHaveLength(7)
    expect(p.dias[0]).toMatchObject({ fecha: '2026-07-13', esHoy: true })
  })

  it('la tira resume cada día (fuera marginal de madrugada -> en_casa)', () => {
    // El 13: fuera ~2h de madrugada (bajo el piso) pero en casa el resto -> en_casa.
    const tramos = [
      t('2026-07-13T04:00:00Z', '2026-07-13T06:00:00Z', 'fuera'),
      t('2026-07-13T06:00:00Z', '2026-07-14T04:00:00Z', 'en_casa'),
    ]
    const p = construirPanelSemana(tramos, NOW, 7)
    expect(p.dias[0].estado).toBe('en_casa')
  })

  it('tramo actual que se extiende más allá de la ventana -> finActualISO null (constante)', () => {
    const tramos = [t('2026-07-01T04:00:00Z', '2026-08-01T04:00:00Z', 'en_casa')]
    const p = construirPanelSemana(tramos, NOW, 7)
    expect(p.estadoAhora).toBe('en_casa')
    expect(p.finActualISO).toBeNull()
  })

  it('sin tramo que cubra ahora -> estadoAhora null y finActualISO null', () => {
    const tramos = [t('2026-07-20T04:00:00Z', '2026-07-21T04:00:00Z', 'fuera')]
    const p = construirPanelSemana(tramos, NOW, 7)
    expect(p.estadoAhora).toBeNull()
    expect(p.finActualISO).toBeNull()
  })

  it('un estado desconocido ahora se degrada a null (no crashea)', () => {
    const tramos = [t('2026-07-13T04:00:00Z', '2026-07-14T04:00:00Z', 'estado_raro')]
    const p = construirPanelSemana(tramos, NOW, 2)
    expect(p.estadoAhora).toBeNull()
    expect(p.dias[0].estado).toBeNull()
  })

  it('días sin tramo quedan con estado null', () => {
    const tramos = [t('2026-07-13T04:00:00Z', '2026-07-14T04:00:00Z', 'fuera')]
    const p = construirPanelSemana(tramos, NOW, 7)
    expect(p.dias.find((d) => d.fecha === '2026-07-18')!.estado).toBeNull()
  })
})
