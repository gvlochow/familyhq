-- =============================================================================
-- FamilyHQ · agenda_items (tareas y eventos puntuales del hogar)
-- =============================================================================
-- Items de una sola vez que alimentan el feed "Próximo en la casa" del Inicio, la
-- tab Tareas y el botón "+". Alcance deliberadamente puntual: la recurrencia
-- (cuentas mensuales, etc.) vive en recurring_activities y se integrará después
-- como otra fuente del feed. Por eso acá NO hay regla de recurrencia ni estado de
-- completado por-ocurrencia.
--
-- tarea  -> tiene estado de completado (algo que hacer).
-- evento -> algo que ocurre a una hora (no se "completa").
-- =============================================================================

create table public.agenda_items (
  id            uuid primary key default gen_random_uuid(),
  household_id  uuid not null references public.households(id) on delete cascade,
  tipo          text not null,                       -- 'tarea' | 'evento'
  titulo        text not null,
  fecha         date not null,                       -- día en que vence (tarea) u ocurre (evento)
  hora          time,                                -- null = todo el día / sin hora
  completado    boolean not null default false,      -- aplica a 'tarea'
  completado_at timestamptz,
  created_by    uuid references public.members(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint agenda_items_tipo_check check (tipo in ('tarea', 'evento'))
);

comment on table public.agenda_items is 'Tareas y eventos PUNTUALES (una sola vez) del hogar. Alimentan el feed del Inicio, la tab Tareas y el "+". La recurrencia vive en recurring_activities.';
comment on column public.agenda_items.tipo is '''tarea'' (se completa) | ''evento'' (ocurre a una hora).';
comment on column public.agenda_items.hora is 'Hora local del item. null = todo el día / sin hora definida.';
comment on column public.agenda_items.completado is 'Solo aplica a las tareas. Los eventos quedan siempre en false.';

create index idx_agenda_items_household_fecha on public.agenda_items (household_id, fecha);
create index idx_agenda_items_created_by on public.agenda_items (created_by);


-- =============================================================================
-- Row Level Security (household_id directo, mismo patrón que recurring_activities)
-- =============================================================================
alter table public.agenda_items enable row level security;

grant select, insert, update, delete on public.agenda_items to authenticated, service_role;

create policy "agenda_items_all" on public.agenda_items
  for all to authenticated
  using (household_id = public.current_household_id())
  with check (household_id = public.current_household_id());
