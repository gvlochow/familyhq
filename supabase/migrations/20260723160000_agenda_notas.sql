-- =============================================================================
-- FamilyHQ · Notas en actividades/eventos de la agenda
-- =============================================================================
-- Un campo de texto libre opcional para anotar cosas del ítem (qué llevar, un
-- detalle, un recordatorio). Aplica a los ítems puntuales (agenda_items) y a las
-- reglas recurrentes (recurring_activities). Solo texto; sin efecto en lógica.
-- =============================================================================

alter table public.agenda_items add column notas text;
alter table public.recurring_activities add column notas text;

comment on column public.agenda_items.notas is
  'Nota libre opcional del ítem (qué llevar, un detalle). Solo visual.';
comment on column public.recurring_activities.notas is
  'Nota libre opcional de la actividad recurrente. Solo visual.';
