-- =============================================================================
-- FamilyHQ · Tipo de horario "sin_horario" (siempre en casa)
-- =============================================================================
-- Agrega un cuarto valor a members.tipo_horario: 'sin_horario', una ELECCIÓN
-- explícita = "no trabajo con horario, quedo en casa por defecto". Es distinto de
-- 'ninguno', que sigue siendo el estado inicial "aún no elegido" (default del RPC
-- de creación de hogar) y que el routing del onboarding usa para mandar a elegir.
--
-- No genera segmentos de disponibilidad (como 'ninguno'): sin filas en
-- availability_segments, la composición cae en el default "en casa". El cron y la
-- materialización solo procesan 'variable'/'fijo', así que lo ignoran.
-- =============================================================================

alter table public.members
  drop constraint members_tipo_horario_check;

alter table public.members
  add constraint members_tipo_horario_check
  check (tipo_horario in ('ninguno', 'fijo', 'variable', 'sin_horario'));
