-- =============================================================================
-- FamilyHQ · Esquema inicial
-- =============================================================================
-- Multi-tenant: todo dato pertenece a un household. RLS aísla cada hogar.
-- Un usuario pertenece a UN solo hogar en el MVP (members.unique(user_id)).
-- La pertenencia se resuelve siempre vía members.user_id = auth.uid().
--
-- Freemium: los campos de plan/suscripción existen pero quedan nulos; NO hay
-- billing todavía (se conectará Stripe más adelante).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. households
-- -----------------------------------------------------------------------------
create table public.households (
  id                  uuid primary key default gen_random_uuid(),
  name                text not null,
  plan                text not null default 'free', -- 'free' | 'premium'
  subscription_status text,                          -- Stripe futuro; nulo por ahora
  subscription_ref    text,                          -- id externo de pago; nulo por ahora
  created_at          timestamptz not null default now()
);

comment on column public.households.plan is '''free'' | ''premium''. Freemium preparado; sin billing todavía.';
comment on column public.households.subscription_status is 'Reservado para Stripe. Nulo hasta que exista billing.';
comment on column public.households.subscription_ref is 'Id externo de pago (Stripe). Nulo hasta que exista billing.';


-- -----------------------------------------------------------------------------
-- 2. members
-- -----------------------------------------------------------------------------
create table public.members (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  display_name       text not null,
  rol                text not null default 'integrante', -- 'sostenedor' | 'integrante'
  is_owner           boolean not null default false,     -- creó / administra / paga
  buffer_salida_min  int not null default 90,
  buffer_llegada_min int not null default 45,
  created_at         timestamptz not null default now(),
  unique (user_id)   -- refuerza "un usuario, un hogar" en el MVP
);

comment on column public.members.rol is '''sostenedor'' | ''integrante''.';
comment on column public.members.is_owner is 'El integrante que creó/administra el hogar (y en el futuro paga).';

create index idx_members_household_id on public.members (household_id);


-- -----------------------------------------------------------------------------
-- 3. roster_connections
-- -----------------------------------------------------------------------------
create table public.roster_connections (
  id                 uuid primary key default gen_random_uuid(),
  member_id          uuid not null references public.members(id) on delete cascade,
  ical_url_encrypted text not null,        -- URL secreta del feed iCal, CIFRADA (nunca en claro)
  last_fetch_hash    text,                 -- ETag/hash del último fetch, para saltarse sync sin cambios
  last_synced_at     timestamptz,
  created_at         timestamptz not null default now(),
  unique (member_id)
);

comment on column public.roster_connections.ical_url_encrypted is 'URL secreta del feed iCal cifrada en la app. NUNCA se guarda en claro.';


-- -----------------------------------------------------------------------------
-- 4. availability_days  (materializada por el clasificador vía cron)
-- -----------------------------------------------------------------------------
create table public.availability_days (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references public.members(id) on delete cascade,
  date              date not null,
  estado            text not null,                        -- en_casa | fuera | standby_casa | por_confirmar
  source            text not null default 'clasificado',  -- 'clasificado' | 'override'
  source_event_hash text,                                 -- hash del evento subyacente (regla de override)
  updated_at        timestamptz not null default now(),
  unique (member_id, date)
);

comment on table public.availability_days is 'Estado familiar materializado por día. Lo escribe el cron con la salida del clasificador; el usuario no la edita a mano (edita availability_overrides).';
comment on column public.availability_days.estado is '''en_casa'' | ''fuera'' | ''standby_casa'' | ''por_confirmar''. Debe coincidir con el enum Estado del clasificador (lib/roster).';
comment on column public.availability_days.source is '''clasificado'' (salida directa del clasificador) | ''override'' (ganó una corrección manual).';
comment on column public.availability_days.source_event_hash is 'Hash del evento iCal subyacente. Se compara con availability_overrides.source_event_hash_at_override para decidir si el override sigue vigente.';


-- -----------------------------------------------------------------------------
-- 5. availability_overrides  (correcciones manuales, separadas del clasificado)
-- -----------------------------------------------------------------------------
create table public.availability_overrides (
  id                            uuid primary key default gen_random_uuid(),
  member_id                     uuid not null references public.members(id) on delete cascade,
  date                          date not null,
  estado                        text not null,   -- mismo dominio que availability_days.estado
  source_event_hash_at_override text,             -- hash del evento cuando se hizo el override
  created_at                    timestamptz not null default now(),
  unique (member_id, date)
);

-- === REGLA DE OVERRIDE (la lógica vive en el cron / código de app, no en SQL) ===
-- Cuando el cron re-sincroniza y recalcula availability_days:
--   1. Si existe un availability_overrides para ese (member_id, date), el
--      OVERRIDE GANA: availability_days se escribe con estado del override y
--      source = 'override'.
--   2. EXCEPCIÓN: si el evento subyacente cambió
--      (availability_days.source_event_hash actual  !=
--       availability_overrides.source_event_hash_at_override),
--      el override se DESCARTA y vuelve a mandar el estado clasificado.
-- En una frase: "el override gana hasta que el usuario lo quite o hasta que
-- cambie el evento subyacente". Se guardan separados para no perder nunca el
-- valor clasificado original.
comment on table public.availability_overrides is 'Correcciones manuales del estado. Precedencia (implementada en el cron, no aquí): el override gana sobre el clasificado, SALVO que el evento subyacente haya cambiado (hash actual != source_event_hash_at_override), en cuyo caso se descarta.';
comment on column public.availability_overrides.source_event_hash_at_override is 'Hash del evento subyacente al momento de crear el override. Si el hash actual difiere, el evento cambió y el override deja de aplicarse.';


-- -----------------------------------------------------------------------------
-- 6. recurring_activities
-- -----------------------------------------------------------------------------
create table public.recurring_activities (
  id                    uuid primary key default gen_random_uuid(),
  household_id          uuid not null references public.households(id) on delete cascade,
  title                 text not null,
  recurrence            jsonb not null,          -- p.ej. {tipo:'dia_mes',valor:5} | {tipo:'dias_semana',valores:['ma','vi']}
  payment_link          text,
  reminder_offset_hours int default 24,
  created_by            uuid references public.members(id) on delete set null,
  created_at            timestamptz not null default now()
);

comment on column public.recurring_activities.recurrence is 'Regla flexible en JSON. Ej: {"tipo":"dia_mes","valor":5} o {"tipo":"dias_semana","valores":["ma","vi"]}.';

create index idx_recurring_activities_household_id on public.recurring_activities (household_id);
create index idx_recurring_activities_created_by on public.recurring_activities (created_by);


-- -----------------------------------------------------------------------------
-- 7. shopping_lists
-- -----------------------------------------------------------------------------
create table public.shopping_lists (
  id           uuid primary key default gen_random_uuid(),
  household_id uuid not null references public.households(id) on delete cascade,
  status       text not null default 'activa', -- 'activa' | 'cerrada'
  closed_at    timestamptz,
  created_at   timestamptz not null default now()
);

comment on column public.shopping_lists.status is '''activa'' | ''cerrada''.';

create index idx_shopping_lists_household_id on public.shopping_lists (household_id);


-- -----------------------------------------------------------------------------
-- 8. shopping_items
-- -----------------------------------------------------------------------------
create table public.shopping_items (
  id                   uuid primary key default gen_random_uuid(),
  list_id              uuid not null references public.shopping_lists(id) on delete cascade,
  name                 text not null,
  quantity             text,   -- texto libre: "2 kg", "1 paquete"
  added_by             uuid references public.members(id) on delete set null,
  is_purchased         boolean not null default false,
  carried_from_list_id uuid references public.shopping_lists(id) on delete set null, -- arrastrado de una lista anterior
  created_at           timestamptz not null default now()
);

comment on column public.shopping_items.carried_from_list_id is 'Lista anterior de la que se arrastró el ítem (si aplica).';

create index idx_shopping_items_list_id on public.shopping_items (list_id);
create index idx_shopping_items_added_by on public.shopping_items (added_by);
create index idx_shopping_items_carried_from on public.shopping_items (carried_from_list_id);


-- -----------------------------------------------------------------------------
-- Helper: household del usuario autenticado
-- -----------------------------------------------------------------------------
-- Se define DESPUÉS de members porque el cuerpo referencia esa tabla (Postgres
-- valida el body al crear la función). SECURITY DEFINER a propósito: lee
-- public.members SALTÁNDOSE su RLS, para que las políticas que consultan members
-- no entren en recursión infinita. Como un usuario tiene un solo hogar
-- (unique(user_id)), devuelve un único household_id.
create or replace function public.current_household_id()
returns uuid
language sql
stable
security definer
set search_path = ''
as $$
  select household_id
  from public.members
  where user_id = (select auth.uid())
  limit 1
$$;

revoke execute on function public.current_household_id() from public;
grant execute on function public.current_household_id() to authenticated, service_role;


-- =============================================================================
-- Row Level Security
-- =============================================================================
-- Modelo: un usuario solo ve y modifica filas de SU household.
--  - Tablas con household_id directo     -> household_id = current_household_id()
--  - Tablas ligadas por member_id        -> se resuelve el household vía join a members
--  - shopping_items (ligada por list_id) -> join a shopping_lists
-- El cron corre con service_role, que tiene BYPASSRLS: escribe availability_days
-- sin verse afectado por estas políticas.
-- =============================================================================

alter table public.households             enable row level security;
alter table public.members                enable row level security;
alter table public.roster_connections     enable row level security;
alter table public.availability_days      enable row level security;
alter table public.availability_overrides enable row level security;
alter table public.recurring_activities   enable row level security;
alter table public.shopping_lists         enable row level security;
alter table public.shopping_items         enable row level security;

-- Grants a nivel de tabla: sin esto el rol authenticated no llega a las tablas
-- por la Data API (el default de Supabase ya no auto-expone tablas nuevas). RLS
-- filtra las FILAS; estos grants abren el acceso al objeto. service_role igual
-- tiene BYPASSRLS, pero se le concede explícito por el mismo motivo de exposición.
grant select, insert, update, delete on public.households             to authenticated, service_role;
grant select, insert, update, delete on public.members                to authenticated, service_role;
grant select, insert, update, delete on public.roster_connections     to authenticated, service_role;
grant select, insert, update, delete on public.availability_days      to authenticated, service_role;
grant select, insert, update, delete on public.availability_overrides to authenticated, service_role;
grant select, insert, update, delete on public.recurring_activities   to authenticated, service_role;
grant select, insert, update, delete on public.shopping_lists         to authenticated, service_role;
grant select, insert, update, delete on public.shopping_items         to authenticated, service_role;


-- --- households --------------------------------------------------------------
-- Bootstrap: al hacer onboarding el usuario todavía no tiene household, así que
-- current_household_id() es null. Por eso el INSERT se permite abierto (a un
-- usuario autenticado) y la creación del household + su member se hace en la
-- misma transacción de onboarding. El resto de operaciones ya quedan acotadas
-- al hogar propio.
create policy "households_select" on public.households
  for select to authenticated
  using (id = public.current_household_id());

create policy "households_insert" on public.households
  for insert to authenticated
  with check (true);

create policy "households_update" on public.households
  for update to authenticated
  using (id = public.current_household_id())
  with check (id = public.current_household_id());

create policy "households_delete" on public.households
  for delete to authenticated
  using (id = public.current_household_id());


-- --- members -----------------------------------------------------------------
-- INSERT acotado a la propia membresía (user_id = auth.uid()): en el MVP un
-- usuario solo se crea a sí mismo (onboarding). El endurecimiento del flujo de
-- invitaciones llegará con esa feature.
create policy "members_select" on public.members
  for select to authenticated
  using (household_id = public.current_household_id());

create policy "members_insert" on public.members
  for insert to authenticated
  with check (user_id = (select auth.uid()));

create policy "members_update" on public.members
  for update to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());

create policy "members_delete" on public.members
  for delete to authenticated
  using (household_id = public.current_household_id());


-- --- roster_connections (ligada por member_id) -------------------------------
create policy "roster_connections_all" on public.roster_connections
  for all to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = roster_connections.member_id
        and m.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = roster_connections.member_id
        and m.household_id = public.current_household_id()
    )
  );


-- --- availability_days (ligada por member_id) --------------------------------
create policy "availability_days_all" on public.availability_days
  for all to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = availability_days.member_id
        and m.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = availability_days.member_id
        and m.household_id = public.current_household_id()
    )
  );


-- --- availability_overrides (ligada por member_id) ---------------------------
create policy "availability_overrides_all" on public.availability_overrides
  for all to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = availability_overrides.member_id
        and m.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = availability_overrides.member_id
        and m.household_id = public.current_household_id()
    )
  );


-- --- recurring_activities (household_id directo) -----------------------------
create policy "recurring_activities_all" on public.recurring_activities
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- --- shopping_lists (household_id directo) -----------------------------------
create policy "shopping_lists_all" on public.shopping_lists
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());


-- --- shopping_items (ligada por list_id) -------------------------------------
create policy "shopping_items_all" on public.shopping_items
  for all to authenticated
  using (
    exists (
      select 1 from public.shopping_lists l
      where l.id = shopping_items.list_id
        and l.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.shopping_lists l
      where l.id = shopping_items.list_id
        and l.household_id = public.current_household_id()
    )
  );
