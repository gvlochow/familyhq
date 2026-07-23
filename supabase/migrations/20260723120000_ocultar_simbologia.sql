-- =============================================================================
-- FamilyHQ · Preferencia del hogar: ocultar la simbología del calendario
-- =============================================================================
-- Esconde por defecto la leyenda de colores del calendario (útil al principio,
-- redundante con el tiempo). El "?" del calendario la muestra igual bajo demanda.
-- Preferencia por HOGAR (como mostrar_categoria); default false (se muestra).
-- =============================================================================

alter table public.households
  add column ocultar_simbologia boolean not null default false;

comment on column public.households.ocultar_simbologia is
  'Si true, la leyenda de colores del calendario arranca oculta (el "?" la muestra bajo demanda). Preferencia del hogar; solo visual.';
