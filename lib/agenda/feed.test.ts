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
    horaFin: null,
    afectaDisponibilidad: false,
    completado: false,
    asignados: [],
    agregadoPor: null,
    notas: null,
    categoria: null,
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

  // NOW = 07:00 local.
  it('descarta un evento del día cuyo término (hora_fin) ya pasó', () => {
    const terminado = item({ id: 't', tipo: 'evento', fecha: '2026-07-13', hora: '05:00', horaFin: '06:00' })
    expect(construirFeed([], [terminado], NOW, 7)).toHaveLength(0)
  })

  it('descarta un evento puntual (sin hora_fin) cuya hora ya pasó', () => {
    const pasado = item({ id: 'p', tipo: 'evento', fecha: '2026-07-13', hora: '05:00' })
    expect(construirFeed([], [pasado], NOW, 7)).toHaveLength(0)
  })

  it('mantiene un evento en curso (empezó pero su hora_fin no llegó)', () => {
    const enCurso = item({ id: 'c', tipo: 'evento', fecha: '2026-07-13', hora: '06:00', horaFin: '08:00' })
    expect(construirFeed([], [enCurso], NOW, 7)).toHaveLength(1)
  })

  it('una TAREA vencida hoy sigue en el feed (no se olvida)', () => {
    const vencida = item({ id: 'v', tipo: 'tarea', fecha: '2026-07-13', hora: '05:00' })
    expect(construirFeed([], [vencida], NOW, 7)).toHaveLength(1)
  })
})
