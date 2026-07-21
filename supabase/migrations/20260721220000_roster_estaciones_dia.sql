-- =============================================================================
-- FamilyHQ · Roster — estación donde termina el día (notas de aeropuerto)
-- =============================================================================
-- Guarda, por integrante y día local, la estación (IATA) donde TERMINA el día
-- según el rol (destino del último vuelo). Se muestra en el detalle del día
-- ("Termina en SCL"), solo en días fuera.
--
-- Privacidad (Ley 19.628): la estación se deriva EXCLUSIVAMENTE de eventos
-- firmados iFlight (el propio trabajo del tripulante), igual que la disponibilidad
-- ya persistida; se comparte dentro del hogar por diseño. No proviene de eventos
-- personales (esos se descartan en memoria y nunca llegan acá).
--
-- La escribe el cron (service_role) junto a los segmentos, solo para integrantes
-- variables. Mismo patrón que availability_segments: borrar la ventana + reinsertar.
-- =============================================================================

create table public.roster_estaciones_dia (
  member_id  uuid not null references public.members(id) on delete cascade,
  fecha      date not null,
  estacion   text not null,            -- código IATA de 3 letras (destino del último vuelo)
  updated_at timestamptz not null default now(),
  primary key (member_id, fecha)
);

comment on table public.roster_estaciones_dia is
  'Estación (IATA) donde termina el día local de un integrante, derivada de los vuelos del rol iFlight. Solo visual; la escribe el cron.';

create index idx_roster_estaciones_member on public.roster_estaciones_dia (member_id);

-- RLS: se lee acotado al hogar (join a members). La escritura es solo del cron
-- (service_role, BYPASSRLS); los clientes solo hacen SELECT.
alter table public.roster_estaciones_dia enable row level security;

grant select on public.roster_estaciones_dia to authenticated;
grant select, insert, update, delete on public.roster_estaciones_dia to service_role;

create policy "roster_estaciones_dia_select" on public.roster_estaciones_dia
  for select to authenticated
  using (
    exists (
      select 1 from public.members m
      where m.id = roster_estaciones_dia.member_id
        and m.household_id = public.current_household_id()
    )
  );
