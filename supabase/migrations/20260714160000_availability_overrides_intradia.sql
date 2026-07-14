-- =============================================================================
-- FamilyHQ · availability_overrides: rediseño a intervalos intra-día
-- =============================================================================
-- La tabla original era POR DÍA (member_id, date, estado, source_event_hash_at_
-- override) con una regla de invalidación por hash del evento subyacente. Ese
-- modelo quedó inerte al migrar a tramos intra-día (availability_segments) y al
-- dropear availability_days: su clave por-día y su hash ya no encajan.
--
-- Nuevo modelo: un override es un INTERVALO [inicio_utc, fin_utc) con un estado,
-- la corrección manual que el usuario hace sobre su disponibilidad ("estoy en
-- casa hasta las 18:00" aunque el rol clasifique 'fuera").
--
-- CÓMO GANA (la regla vive en la app, no en SQL — ver lib/availability/override):
--   El override NO se escribe en availability_segments. El cron sigue siendo el
--   dueño exclusivo de esa tabla (delete-ventana + insert de lo clasificado) y NI
--   LEE los overrides. El estado efectivo que ve la UI se compone al LEER: sobre
--   los tramos clasificados/fijos se superponen los overrides, y el override
--   SIEMPRE gana dentro de su intervalo. Quitar un override hace reaparecer lo
--   clasificado al instante, sin esperar al cron.
--
-- Se ELIMINA la regla de hash: un override intra-día está acotado en el tiempo y
-- se vuelve moot al pasar su fin, así que no necesita invalidarse contra el evento.
--
-- La tabla vieja está vacía (nunca se escribió en la era de tramos): DROP + CREATE
-- en vez de una serie de ALTERs.
-- =============================================================================

drop table if exists public.availability_overrides;

-- -----------------------------------------------------------------------------
-- availability_overrides  (correcciones manuales, intra-día, escritas por el usuario)
-- -----------------------------------------------------------------------------
-- Invariante de la app: los overrides de un mismo integrante NO se solapan (la
-- Server Action recorta/borra los que solapen antes de insertar → "lo último
-- gana"). Horas en UTC como el resto de disponibilidad; conversión a
-- America/Santiago al presentar.
create table public.availability_overrides (
  id          uuid primary key default gen_random_uuid(),
  member_id   uuid not null references public.members(id) on delete cascade,
  inicio_utc  timestamptz not null,                 -- inicio del override (inclusivo)
  fin_utc     timestamptz not null,                 -- fin del override (exclusivo)
  estado      text not null,                        -- en_casa | fuera | standby_casa | por_confirmar
  created_by  uuid references public.members(id) on delete set null, -- quién lo puso (audit)
  created_at  timestamptz not null default now(),
  constraint availability_overrides_rango_check check (fin_utc > inicio_utc),
  constraint availability_overrides_estado_check
    check (estado in ('en_casa', 'fuera', 'standby_casa', 'por_confirmar'))
);

comment on table public.availability_overrides is 'Correcciones manuales de disponibilidad por INTERVALO intra-día (inicio_utc, fin_utc, estado). El usuario las escribe; el cron NO las toca. El estado efectivo se compone al leer (lib/availability/override): el override gana sobre lo clasificado dentro de su intervalo. Overrides de un mismo integrante no se solapan (invariante de la app).';
comment on column public.availability_overrides.inicio_utc is 'Inicio del override en UTC (inclusivo). Convertir a America/Santiago (IANA) al presentar, nunca offset fijo.';
comment on column public.availability_overrides.fin_utc is 'Fin del override en UTC (exclusivo).';
comment on column public.availability_overrides.estado is '''en_casa'' | ''fuera'' | ''standby_casa'' | ''por_confirmar''. Debe coincidir con el enum Estado del clasificador (lib/roster).';
comment on column public.availability_overrides.created_by is 'Integrante que creó el override (auditoría). El usuario corrige su propio estado o el de un perfil administrado del hogar.';

-- Consulta típica: "los overrides de estos integrantes que solapan esta ventana".
create index idx_availability_overrides_member_fin
  on public.availability_overrides (member_id, fin_utc);


-- =============================================================================
-- Row Level Security  (mismo modelo que availability_segments: ligada por member_id)
-- =============================================================================
alter table public.availability_overrides enable row level security;

grant select, insert, update, delete on public.availability_overrides to authenticated, service_role;

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
