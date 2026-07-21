-- =============================================================================
-- FamilyHQ · Agenda — evento que marca "fuera" a sus asignados (afecta_disponibilidad)
-- =============================================================================
-- Opt-in por evento: cuando está activo, el evento marca a sus integrantes
-- asignados como 'fuera' durante su ventana [hora, hora_fin). El efecto NO se
-- materializa en availability_segments (el cron sigue siendo su dueño único): se
-- deriva y compone AL LEER, como una capa entre el clasificado y los overrides
-- manuales (precedencia: override manual > evento > clasificado > default).
--
-- Solo tiene efecto para tipo 'evento' con hora y hora_fin y con asignados; la
-- capa de app lo valida. Aplica a eventos puntuales (agenda_items) y recurrentes
-- (recurring_activities), que comparten el mismo formulario.
-- =============================================================================

alter table public.agenda_items
  add column afecta_disponibilidad boolean not null default false;

comment on column public.agenda_items.afecta_disponibilidad is
  'Si es true, el evento marca a sus asignados como ''fuera'' durante [hora, hora_fin) (capa compuesta al leer, no materializada). Solo aplica a eventos con hora, hora_fin y asignados.';

alter table public.recurring_activities
  add column afecta_disponibilidad boolean not null default false;

comment on column public.recurring_activities.afecta_disponibilidad is
  'Igual que agenda_items.afecta_disponibilidad, para el evento recurrente (aplica a cada ocurrencia).';
