-- =============================================================================
-- FamilyHQ · Recurrencia en la agenda
-- =============================================================================
-- recurring_activities existía desde el esquema inicial pero estaba INERTE (sin
-- tipo/hora/asignados, sin expansión ni UI). Ahora es la REGLA de una actividad
-- recurrente (cuenta mensual, actividad semanal). Las OCURRENCIAS no se materializan
-- como filas: se expanden al leer (lib/agenda/recurrencia) sobre la ventana pedida,
-- igual que los overrides de disponibilidad. Solo el completado por-ocurrencia se
-- persiste (recurring_completions), para no perder "quién/cuándo" por instancia.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- recurring_activities: se completa como REGLA de la agenda recurrente
-- -----------------------------------------------------------------------------
-- Consistencia con agenda_items: la columna del texto pasa de 'title' a 'titulo'
-- (el resto del dominio es español). La tabla está vacía, el rename es seguro.
alter table public.recurring_activities rename column title to titulo;

alter table public.recurring_activities
  add column tipo         text not null default 'tarea',       -- 'tarea' | 'evento'
  add column hora         time,                                -- null = todo el día / sin hora
  add column asignado_a   uuid[] not null default '{}',        -- integrantes asignados (ids del hogar)
  add column fecha_inicio date not null default current_date,  -- la regla no genera ocurrencias antes de esto
  add column fecha_fin    date;                                -- null = indefinida

alter table public.recurring_activities
  add constraint recurring_activities_tipo_check check (tipo in ('tarea', 'evento'));

comment on table public.recurring_activities is 'REGLA de una actividad recurrente (cuenta mensual, actividad semanal). Las ocurrencias se expanden al leer (lib/agenda/recurrencia) desde recurrence + fecha_inicio/fin; NO se materializan. El completado por-ocurrencia vive en recurring_completions.';
comment on column public.recurring_activities.recurrence is 'Regla en JSON. v1: {"tipo":"dia_mes","dia":5} (día N del mes; si N>días del mes, se ancla al último) o {"tipo":"dias_semana","dias":[2,5]} (ISO 1=lun..7=dom).';
comment on column public.recurring_activities.tipo is '''tarea'' (se completa por ocurrencia) | ''evento'' (ocurre a una hora).';
comment on column public.recurring_activities.hora is 'Hora local de la ocurrencia. null = todo el día / sin hora.';
comment on column public.recurring_activities.asignado_a is 'Integrantes asignados (ids de members del hogar). Array, sin FK; la app valida pertenencia al hogar al escribir.';
comment on column public.recurring_activities.fecha_inicio is 'Primer día desde el que la regla genera ocurrencias (default: el día en que se crea).';
comment on column public.recurring_activities.fecha_fin is 'Último día en que la regla genera ocurrencias. null = indefinida.';


-- -----------------------------------------------------------------------------
-- recurring_completions: una fila por ocurrencia COMPLETADA
-- -----------------------------------------------------------------------------
-- La presencia de la fila (recurring_activity_id, fecha) = esa ocurrencia está
-- hecha. Destildar = borrar la fila. Solo aplica a reglas 'tarea'.
create table public.recurring_completions (
  id                    uuid primary key default gen_random_uuid(),
  recurring_activity_id uuid not null references public.recurring_activities(id) on delete cascade,
  fecha                 date not null,                          -- día de la ocurrencia (local)
  completado_por        uuid references public.members(id) on delete set null,
  completado_at         timestamptz not null default now(),
  unique (recurring_activity_id, fecha)
);

comment on table public.recurring_completions is 'Ocurrencias COMPLETADAS de una actividad recurrente. Fila presente (recurring_activity_id, fecha) = hecha; destildar = borrar. completado_por/at para el historial/puntaje futuro (igual que agenda_items).';

create index idx_recurring_completions_activity on public.recurring_completions (recurring_activity_id, fecha);


-- =============================================================================
-- Row Level Security (ligada por recurring_activity_id -> household de la regla)
-- =============================================================================
alter table public.recurring_completions enable row level security;

grant select, insert, update, delete on public.recurring_completions to authenticated, service_role;

create policy "recurring_completions_all" on public.recurring_completions
  for all to authenticated
  using (
    exists (
      select 1 from public.recurring_activities r
      where r.id = recurring_completions.recurring_activity_id
        and r.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.recurring_activities r
      where r.id = recurring_completions.recurring_activity_id
        and r.household_id = public.current_household_id()
    )
  );
