-- =============================================================================
-- FamilyHQ · Re-arquitectura de disponibilidad: tramos intra-día
-- =============================================================================
-- Reemplaza el modelo de UN estado por día (availability_days) por TRAMOS
-- `(inicio_utc, fin_utc, estado)` por integrante. El modelo por-día es lossy:
-- un crew que aterriza a la 1am quedaba "fuera" el día entero pese a estar 22h
-- en casa; un horario fijo 9-18 quedaba "fuera" todo el día sin distinguir la
-- mañana/tarde en casa ni la ventana de almuerzo.
--
-- Migración ADITIVA a propósito: la UI (home, calendario) todavía lee
-- availability_days y migra a tramos en una fase posterior. Por eso NO se elimina
-- todavía; queda marcada como DEPRECADA y se dropeará cuando la UI lea segmentos.
-- El cron pasa a escribir esta tabla en la Fase 2.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- availability_segments  (materializada por el clasificador vía cron, Fase 2)
-- -----------------------------------------------------------------------------
-- Los tramos de un integrante son contiguos y no se solapan (invariante que
-- garantiza el clasificador, lib/roster/segments). Se guardan en UTC (como el
-- feed y el resto de lib/roster); la conversión a America/Santiago se hace al
-- presentar. La clave de upsert es (member_id, inicio_utc): el cron reescribe la
-- ventana recalculada por instante de inicio.
create table public.availability_segments (
  id                uuid primary key default gen_random_uuid(),
  member_id         uuid not null references public.members(id) on delete cascade,
  inicio_utc        timestamptz not null,                 -- inicio del tramo (inclusivo)
  fin_utc           timestamptz not null,                 -- fin del tramo (exclusivo)
  estado            text not null,                        -- en_casa | fuera | standby_casa | por_confirmar
  source            text not null default 'clasificado',  -- 'clasificado' | 'override'
  source_event_hash text,                                 -- hash del evento subyacente (regla de override)
  updated_at        timestamptz not null default now(),
  unique (member_id, inicio_utc),
  constraint availability_segments_rango_check check (fin_utc > inicio_utc),
  constraint availability_segments_estado_check
    check (estado in ('en_casa', 'fuera', 'standby_casa', 'por_confirmar')),
  constraint availability_segments_source_check
    check (source in ('clasificado', 'override'))
);

comment on table public.availability_segments is 'Estado familiar materializado por TRAMOS intra-día (inicio_utc, fin_utc, estado). Reemplaza el modelo por-día de availability_days. Lo escribe el cron con la salida del clasificador (lib/roster/segments); tramos contiguos y sin solape por integrante.';
comment on column public.availability_segments.inicio_utc is 'Inicio del tramo en UTC (inclusivo). Convertir a America/Santiago (IANA) al presentar, nunca offset fijo.';
comment on column public.availability_segments.fin_utc is 'Fin del tramo en UTC (exclusivo).';
comment on column public.availability_segments.estado is '''en_casa'' | ''fuera'' | ''standby_casa'' | ''por_confirmar''. Debe coincidir con el enum Estado del clasificador (lib/roster).';
comment on column public.availability_segments.source is '''clasificado'' (salida directa del clasificador) | ''override'' (ganó una corrección manual).';
comment on column public.availability_segments.source_event_hash is 'Hash del evento iCal subyacente. Base de la regla de override (misma semántica que availability_days.source_event_hash).';

-- Consulta típica: "los tramos de estos integrantes en esta ventana temporal".
-- El unique (member_id, inicio_utc) ya cubre el orden; este índice ayuda a acotar
-- por el fin del tramo cuando la ventana empieza a mitad de un tramo largo.
create index idx_availability_segments_member_fin
  on public.availability_segments (member_id, fin_utc);


-- -----------------------------------------------------------------------------
-- Deprecación de availability_days (NO se elimina todavía)
-- -----------------------------------------------------------------------------
comment on table public.availability_days is 'DEPRECADA por availability_segments (modelo de tramos intra-día). Se mantiene mientras la UI (home, calendario) todavía la lee; se dropeará cuando la UI migre a segmentos. No escribir nuevas features contra esta tabla.';


-- =============================================================================
-- Row Level Security  (mismo modelo que availability_days: ligada por member_id)
-- =============================================================================
alter table public.availability_segments enable row level security;

grant select, insert, update, delete on public.availability_segments to authenticated, service_role;

create policy "availability_segments_all" on public.availability_segments
  for all to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = availability_segments.member_id
        and m.household_id = public.current_household_id()
    )
  )
  with check (
    exists (
      select 1 from public.members m
      where m.id = availability_segments.member_id
        and m.household_id = public.current_household_id()
    )
  );
