-- =============================================================================
-- FamilyHQ · Grupo 3 — Descubrir las invitaciones propias por correo
-- =============================================================================
-- El invitado NO puede leer household_invites (RLS: solo el hogar emisor la ve),
-- así que sin esto no hay forma de mostrarle "te invitaron" dentro de la app: la
-- aceptación dependía por completo del link del correo. Esta RPC deja que el
-- usuario autenticado descubra las invitaciones PENDIENTES dirigidas a SU correo
-- (verificado por la sesión), devolviendo el token y el nombre del hogar para un
-- banner de "Aceptar". La clave se resuelve de auth.uid() dentro de la función:
-- nadie puede pedir las invitaciones de otro.
-- =============================================================================

create or replace function public.mis_invitaciones()
returns table (token text, household_name text, link_member_id uuid)
language sql
security definer
set search_path = ''
as $$
  select i.token, h.name, i.link_member_id
  from public.household_invites i
  join public.households h on h.id = i.household_id
  join auth.users u on u.id = (select auth.uid())
  where i.status = 'pendiente'
    and i.email = lower(u.email)
    -- Si ya pertenece a un hogar, no hay invitación que aceptar.
    and not exists (
      select 1 from public.members m where m.user_id = (select auth.uid())
    )
$$;

revoke execute on function public.mis_invitaciones() from public;
grant execute on function public.mis_invitaciones() to authenticated, service_role;
