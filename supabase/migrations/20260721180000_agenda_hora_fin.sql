-- =============================================================================
-- FamilyHQ · Agenda — hora de término de los eventos (hora_fin)
-- =============================================================================
-- Los eventos hasta ahora solo tenían hora de inicio (`hora`). Se agrega una hora
-- de término OPCIONAL para poder mostrar el rango ("09:00–10:30"). Aplica a los
-- eventos puntuales (agenda_items) y a los recurrentes (recurring_activities),
-- que comparten el mismo formulario.
--
-- Semántica (se valida en la capa de app, no en SQL): solo para tipo 'evento',
-- solo si hay hora de inicio, y hora_fin > hora. Las tareas la dejan en null.
-- =============================================================================

alter table public.agenda_items
  add column hora_fin time;

comment on column public.agenda_items.hora_fin is
  'Hora local de término del evento (opcional). null = sin término / no aplica (tareas y eventos sin hora). Debe ser > hora cuando está presente.';

alter table public.recurring_activities
  add column hora_fin time;

comment on column public.recurring_activities.hora_fin is
  'Hora local de término del evento recurrente (opcional). Mismas reglas que agenda_items.hora_fin.';
