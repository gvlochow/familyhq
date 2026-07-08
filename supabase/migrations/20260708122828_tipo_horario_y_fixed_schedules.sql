-- =============================================================================
-- FamilyHQ · Tipo de horario por integrante + horarios fijos
-- =============================================================================
-- Cada integrante declara qué tipo de horario tiene:
--   - 'variable' -> rol irregular (tripulación). Conecta calendario iCal y usa
--                   roster_connections + el clasificador (lib/roster).
--   - 'fijo'     -> horario de trabajo fijo por día de semana. Usa la tabla
--                   fixed_schedules de esta migración.
--   - 'ninguno'  -> no trabaja o no registra horario (ej. un hijo). Default.
--
-- 'ninguno' es el default para no obligar a decidir en el onboarding y para que
-- los integrantes existentes queden en un estado neutro y válido.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. members.tipo_horario
-- -----------------------------------------------------------------------------
alter table public.members
  add column tipo_horario text not null default 'ninguno';

alter table public.members
  add constraint members_tipo_horario_check
  check (tipo_horario in ('ninguno', 'fijo', 'variable'));

comment on column public.members.tipo_horario is
  '''ninguno'' (no trabaja / no registra) | ''fijo'' (horario fijo por día, usa fixed_schedules) | ''variable'' (rol irregular, usa roster_connections + clasificador).';


-- -----------------------------------------------------------------------------
-- 2. fixed_schedules  (una fila por día de semana por integrante)
-- -----------------------------------------------------------------------------
-- Modelo: una fila por (member_id, dia_semana). Un día sin trabajo tiene
-- hora_inicio/hora_fin en null. Un día con horario distinto (ej. viernes hasta
-- las 14:00) simplemente lleva otras horas en su fila.
create table public.fixed_schedules (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  dia_semana  int not null,   -- 1=lunes ... 7=domingo (ISO 8601)
  hora_inicio time,           -- null si ese día no trabaja
  hora_fin    time,           -- null si ese día no trabaja
  created_at  timestamptz not null default now(),
  constraint fixed_schedules_dia_semana_check check (dia_semana between 1 and 7),
  unique (member_id, dia_semana)  -- un bloque por día por integrante
);

comment on table public.fixed_schedules is 'Horario fijo de trabajo por día de semana, para integrantes con tipo_horario = ''fijo''. Una fila por día; hora_inicio/hora_fin en null = ese día no trabaja.';
comment on column public.fixed_schedules.dia_semana is '1=lunes ... 7=domingo (ISO 8601).';

create index idx_fixed_schedules_member_id on public.fixed_schedules (member_id);


-- =============================================================================
-- Row Level Security · fixed_schedules (ligada por member_id)
-- =============================================================================
-- Mismo patrón que roster_connections / availability_*: el household se resuelve
-- vía join a members -> current_household_id(). El usuario solo ve y modifica
-- filas de integrantes de SU hogar.
-- =============================================================================

alter table public.fixed_schedules enable row level security;

-- Grant a nivel de tabla: auto_expose_new_tables está off, así que sin esto el
-- rol authenticated no llega a la tabla por la Data API. RLS filtra las FILAS;
-- este grant abre el acceso al objeto. service_role igual tiene BYPASSRLS, pero
-- se concede explícito por el mismo motivo de exposición.
grant select, insert, update, delete on public.fixed_schedules to authenticated, service_role;

create policy "fixed_schedules_all" on public.fixed_schedules
  for all to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = fixed_schedules.member_id
        and m.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = fixed_schedules.member_id
        and m.household_id = public.current_household_id()
    )
  );
