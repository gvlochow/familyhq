-- =============================================================================
-- FamilyHQ · Excepciones de recurrencia (omitir una ocurrencia)
-- =============================================================================
-- "Esta vez no": permite saltar UNA ocurrencia de una actividad recurrente sin
-- borrar la regla ni tocar las demás. Igual que recurring_completions, la
-- ocurrencia no está materializada: la presencia de una fila (regla, fecha) marca
-- ese día como OMITIDO, y la expansión al leer (lib/agenda/recurrencia +
-- app/(app)/_lib) lo descarta en todos los consumidores (Inicio, Tareas,
-- Calendario y la capa de disponibilidad de eventos afecta_disponibilidad).
--
-- Mover/editar una sola instancia (no solo omitirla) es una feature futura: sería
-- otra tabla de override con los campos de la regla por (regla, fecha).
-- =============================================================================

create table public.recurring_exceptions (
  id                    uuid primary key default gen_random_uuid(),
  recurring_activity_id uuid not null references public.recurring_activities(id) on delete cascade,
  fecha                 date not null,                          -- día omitido (local)
  created_by            uuid references public.members(id) on delete set null,
  created_at            timestamptz not null default now(),
  unique (recurring_activity_id, fecha)
);

comment on table public.recurring_exceptions is
  'Ocurrencias OMITIDAS de una actividad recurrente ("esta vez no"). Fila presente (recurring_activity_id, fecha) = esa ocurrencia se descarta al expandir. No materializa nada; el resto de las ocurrencias siguen igual.';

create index idx_recurring_exceptions_activity
  on public.recurring_exceptions (recurring_activity_id, fecha);

-- =============================================================================
-- RLS: ligada por recurring_activity_id -> household de la regla (mismo patrón
-- que recurring_completions).
-- =============================================================================
alter table public.recurring_exceptions enable row level security;

grant select, insert, update, delete on public.recurring_exceptions to authenticated, service_role;

create policy "recurring_exceptions_all" on public.recurring_exceptions
  for all to authenticated
  using (
    exists (
      select 1 from public.recurring_activities r
      where r.id = recurring_exceptions.recurring_activity_id
        and r.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.recurring_activities r
      where r.id = recurring_exceptions.recurring_activity_id
        and r.household_id = public.current_household_id()
    )
  );
