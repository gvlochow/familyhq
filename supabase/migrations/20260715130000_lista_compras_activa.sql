-- =============================================================================
-- FamilyHQ · Lista de compras — una lista activa por hogar
-- =============================================================================
-- MVP: cada hogar tiene UNA lista activa perpetua (se agrega, se marca comprado,
-- se borra). El esquema inicial (20260708004206) ya trae shopping_lists /
-- shopping_items con RLS; status/closed_at/carried_from_list_id quedan latentes
-- para un flujo de "cerrar compra + arrastrar no-comprados" futuro.
--
-- Aquí se garantiza el invariante "una sola lista activa por hogar":
--   1) índice único parcial (guardarraíl real ante carreras del get-or-create),
--   2) siembra de una lista activa por hogar (trigger para los nuevos + backfill
--      para los existentes), igual patrón que seed_categorias_default.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Invariante: como mucho UNA lista activa por hogar.
-- -----------------------------------------------------------------------------
create unique index shopping_lists_una_activa_por_hogar
  on public.shopping_lists (household_id)
  where status = 'activa';


-- =============================================================================
-- Siembra de la lista activa por hogar
-- =============================================================================
-- Función + trigger para hogares NUEVOS. SECURITY DEFINER (search_path='') para
-- que inserte sin verse frenada por RLS, igual que seed_categorias_default.
create or replace function public.seed_shopping_list_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.shopping_lists (household_id, status) values (new.id, 'activa');
  return new;
end;
$$;

create trigger trg_seed_shopping_list
  after insert on public.households
  for each row execute function public.seed_shopping_list_default();

-- Backfill: una lista activa para los hogares que YA existen y no la tienen.
insert into public.shopping_lists (household_id, status)
select h.id, 'activa'
from public.households h
where not exists (
  select 1 from public.shopping_lists l
  where l.household_id = h.id and l.status = 'activa'
);
