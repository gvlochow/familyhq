-- =============================================================================
-- FamilyHQ · Buffers de traslado: default 30/30 (viaje a/desde trabajo)
-- =============================================================================
-- Los buffers pasan a aplicarse en AMBOS tipos de horario (variable y fijo) y en
-- ambos sentidos (salida = viaje a trabajo, llegada = viaje desde trabajo). El
-- default viejo (llegada 45 / salida 90) estaba pensado para tripulación y resulta
-- grande para un horario fijo de oficina. Se baja a un commute modesto y simétrico
-- de 30/30; cada integrante lo ajusta después en Ajustes.
--
-- Ningún integrante configuró sus buffers todavía (la UI de edición aún no existe),
-- así que todas las filas están en el default viejo: se bajan al nuevo. El WHERE
-- protege cualquier valor no-default (no debería haber ninguno).
-- =============================================================================

alter table public.members
  alter column buffer_llegada_min set default 30,
  alter column buffer_salida_min set default 30;

update public.members
  set buffer_llegada_min = 30, buffer_salida_min = 30
  where buffer_llegada_min = 45 and buffer_salida_min = 90;
