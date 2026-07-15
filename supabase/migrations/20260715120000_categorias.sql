-- =============================================================================
-- FamilyHQ · Categorías de la agenda (tareas/eventos)
-- =============================================================================
-- Categorías por hogar, editables, cada una con un color de una paleta curada
-- (el color se guarda como CLAVE de la paleta; la UI la mapea a un hex, ver
-- lib/agenda/categorias). agenda_items y recurring_activities referencian una
-- categoría opcional; borrar una categoría deja el ítem SIN categoría (no lo borra).
--
-- Se siembran 4 por defecto (Pagos, Quehaceres, Cumpleaños, Colegio) en cada hogar:
-- para los existentes con un backfill, y para los nuevos con un trigger AFTER INSERT
-- sobre households (así funciona sin importar cómo se cree el hogar).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- categorias
-- -----------------------------------------------------------------------------
create table public.categorias (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  nombre       text not null,
  color        text not null default 'gris',  -- clave de la paleta (lib/agenda/categorias)
  created_at   timestamptz not null default now()
);

comment on table public.categorias is 'Categorías de la agenda por hogar (editables). color = clave de la paleta curada (lib/agenda/categorias). Se siembran 4 por defecto por hogar.';
comment on column public.categorias.color is 'Clave de la paleta (navy|salvia|ambar|rojo|rosa|morado|celeste|gris). La UI la mapea a un hex.';

create index idx_categorias_household on public.categorias (household_id);

-- Referencia opcional desde la agenda puntual y las reglas recurrentes.
alter table public.agenda_items
  add column categoria_id uuid references public.categorias(id) on delete set null;
alter table public.recurring_activities
  add column categoria_id uuid references public.categorias(id) on delete set null;


-- =============================================================================
-- Siembra de las 4 categorías por defecto
-- =============================================================================
-- Función + trigger para hogares NUEVOS. SECURITY DEFINER (search_path='') para que
-- inserte sin verse frenada por RLS, igual que create_household.
create or replace function public.seed_categorias_default()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.categorias (household_id, nombre, color) values
    (new.id, 'Pagos', 'ambar'),
    (new.id, 'Quehaceres', 'salvia'),
    (new.id, 'Cumpleaños', 'rosa'),
    (new.id, 'Colegio', 'celeste');
  return new;
end;
$$;

create trigger trg_seed_categorias
  after insert on public.households
  for each row execute function public.seed_categorias_default();

-- Backfill para los hogares que YA existen.
insert into public.categorias (household_id, nombre, color)
select h.id, d.nombre, d.color
from public.households h
cross join (values
  ('Pagos', 'ambar'),
  ('Quehaceres', 'salvia'),
  ('Cumpleaños', 'rosa'),
  ('Colegio', 'celeste')
) as d(nombre, color);


-- =============================================================================
-- Row Level Security (household_id directo)
-- =============================================================================
alter table public.categorias enable row level security;

grant select, insert, update, delete on public.categorias to authenticated, service_role;

create policy "categorias_all" on public.categorias
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
