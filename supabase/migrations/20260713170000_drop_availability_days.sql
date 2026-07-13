-- =============================================================================
-- FamilyHQ · Drop de availability_days (migración a tramos intra-día completa)
-- =============================================================================
-- El modelo por-día quedó reemplazado por availability_segments (tramos
-- intra-día): el cron ya no escribe availability_days y la UI (home, calendario)
-- ya lee tramos. Se elimina la tabla y su índice/constraints asociados.
--
-- availability_overrides NO se toca: sigue siendo el lugar de las correcciones
-- manuales. Su mecanismo por-día (hash de evidencia) quedó inerte con este cambio;
-- se rediseñará para operar sobre tramos cuando exista la UI de corrección. Por eso
-- se conserva la tabla (hoy vacía) en vez de dropearla y recrearla.
-- =============================================================================

drop table if exists public.availability_days;
