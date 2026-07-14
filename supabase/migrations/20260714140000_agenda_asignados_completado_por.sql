-- =============================================================================
-- FamilyHQ · agenda_items: asignados + quién completó
-- =============================================================================
-- asignado_a: integrantes a los que se asigna la tarea/evento (multi-select).
--   Se guarda como uuid[] (no tabla puente): la lista es chica y del mismo hogar,
--   y ambas vistas (Inicio, Tareas) ya tienen los members en memoria para resolver
--   iniciales. Sin FK sobre el array: la app valida que sean del hogar al escribir,
--   y al leer ignora ids que ya no resuelvan a un integrante.
--
-- completado_por: quién marcó la tarea como hecha. Junto con completado_at (ya
--   existente) captura el "quién/cuándo" para el futuro historial/puntaje de tareas
--   (estilo Todoist), sin construir todavía ese subsistema.
-- =============================================================================

alter table public.agenda_items
  add column asignado_a     uuid[] not null default '{}',
  add column completado_por uuid references public.members(id) on delete set null;

comment on column public.agenda_items.asignado_a is 'Integrantes asignados (ids de members del mismo hogar). Array, sin FK; la app valida pertenencia al hogar al escribir.';
comment on column public.agenda_items.completado_por is 'Integrante que marcó la tarea como completada. Con completado_at, base del historial/puntaje futuro.';
