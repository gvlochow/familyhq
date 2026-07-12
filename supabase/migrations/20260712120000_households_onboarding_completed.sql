-- =============================================================================
-- FamilyHQ · households.onboarding_completed
-- =============================================================================
-- Marca si el hogar terminó el flujo de onboarding, incluido el paso opcional de
-- agregar integrantes (paso 4). Sin este flag, la pantalla opcional de
-- integrantes se mostraría en cada login (getPostLoginRedirect no tendría cómo
-- saber que ya se pasó por ahí).
--
--   - Hogares nuevos: arrancan en false (default). create_household no la setea,
--     así que toma el default; el flujo la pone en true al terminar/omitir el paso 4.
--   - Hogares existentes: se backfillean a true — ya completaron el onboarding
--     anterior (previo a este paso), así que no deben caer de nuevo en él.
-- =============================================================================

alter table public.households
  add column onboarding_completed boolean not null default false;

comment on column public.households.onboarding_completed is
  'true = el hogar completó el onboarding (incluido el paso opcional de integrantes). Lo setea el flujo al terminar/omitir el paso 4. Hogares previos a esta columna se backfillearon a true.';

-- Backfill: todo hogar existente ya pasó el onboarding anterior.
update public.households set onboarding_completed = true;
