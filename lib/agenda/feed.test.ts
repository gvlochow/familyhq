import { describe, expect, it } from 'vitest'
import { construirFeed } from './feed'
import type { AgendaItem } from './tipos'
import type { CambioDisponibilidad } from '../availability/proximo'

const NOW = '2026-07-13T11:00:00Z' // lunes 07:00 local

const sale: CambioDisponibilidad = {
  cuando: '2026-07-13T14:00:00Z', // 10:00 local
  miembroId: 'p',
  miembro: 'Pablo',
  tipo: 'sale',
  estado: 'fuera',
}

function item(p: Partial<AgendaItem> & { id: string; fecha: string }): AgendaItem {
  return {
    tipo: 'tarea',
    titulo: 't',
    hora: null,
    completado: false,
    ...p,
  }
}

describe('construirFeed', () => {
  it('mezcla disponibilidad y agenda ordenados por cuándo', () => {
    const luz = item({ id: 'luz', titulo: 'Luz', fecha: '2026-07-13' }) // 00:00 local
    const reunion = item({ id: 'r', tipo: 'evento', titulo: 'Reunión', fecha: '2026-07-13', hora: '18:00' })
    const feed = construirFeed([sale], [luz, reunion], NOW, 7)
    expect(feed.map((f) => f.clave)).toEqual([
      'agenda-luz', // 00:00
      'disp-p-2026-07-13T14:00:00Z', // 10:00
      'agenda-r', // 18:00
    ])
  })

  it('excluye tareas completadas', () => {
    const hecha = item({ id: 'h', fecha: '2026-07-13', completado: true })
    expect(construirFeed([], [hecha], NOW, 7)).toHaveLength(0)
  })

  it('excluye lo anterior a hoy y lo posterior a la ventana', () => {
    const ayer = item({ id: 'a', fecha: '2026-07-10' })
    const lejos = item({ id: 'l', fecha: '2026-07-25' })
    expect(construirFeed([], [ayer, lejos], NOW, 7)).toHaveLength(0)
  })

  it('un evento completado igual aparece (completado solo aplica a tareas)', () => {
    const evento = item({ id: 'e', tipo: 'evento', fecha: '2026-07-14', hora: '09:00', completado: true })
    expect(construirFeed([], [evento], NOW, 7)).toHaveLength(1)
  })
})
