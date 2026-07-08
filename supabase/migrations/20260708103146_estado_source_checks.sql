-- =============================================================================
-- FamilyHQ · CHECK constraints de los enums críticos del clasificador
-- =============================================================================
-- Solo se restringen los dos dominios que DEBEN coincidir con el código del
-- clasificador (lib/roster), porque un valor fuera de rango ahí haría que la app
-- mienta sobre la disponibilidad de una persona:
--   - estado: los 4 estados del enum Estado.
--   - source: 'clasificado' (salida del clasificador) | 'override' (corrección manual).
--
-- plan y rol se dejan como text libre a propósito (freemium/roles pueden crecer);
-- no se tocan acá.
-- =============================================================================

alter table public.availability_days
  add constraint availability_days_estado_check
  check (estado in ('en_casa', 'fuera', 'standby_casa', 'por_confirmar'));

alter table public.availability_days
  add constraint availability_days_source_check
  check (source in ('clasificado', 'override'));

alter table public.availability_overrides
  add constraint availability_overrides_estado_check
  check (estado in ('en_casa', 'fuera', 'standby_casa', 'por_confirmar'));
