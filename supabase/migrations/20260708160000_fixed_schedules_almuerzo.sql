-- =============================================================================
-- FamilyHQ · Almuerzo en el horario fijo (fixed_schedules)
-- =============================================================================
-- El horario fijo del paso 3 del onboarding permite declarar el almuerzo por día:
-- si la persona va a casa a almorzar y en qué rango. Alimenta la disponibilidad
-- de mediodía (estar en casa a la hora de almuerzo cuenta como en_casa aunque el
-- día sea de trabajo).
--
-- Solo aplica a días de trabajo (hora_inicio/hora_fin no nulos). Un día libre o
-- un día de trabajo sin ida a casa dejan almuerza_en_casa=false y las horas null.
-- =============================================================================

alter table public.fixed_schedules
  add column almuerza_en_casa     boolean not null default false,
  add column hora_almuerzo_inicio time,
  add column hora_almuerzo_fin    time;

comment on column public.fixed_schedules.almuerza_en_casa is
  'true si ese día la persona va a casa a almorzar (cuenta como en_casa en ese rango).';
comment on column public.fixed_schedules.hora_almuerzo_inicio is
  'Inicio del almuerzo en casa. null si almuerza_en_casa=false.';
comment on column public.fixed_schedules.hora_almuerzo_fin is
  'Fin del almuerzo en casa. null si almuerza_en_casa=false.';
