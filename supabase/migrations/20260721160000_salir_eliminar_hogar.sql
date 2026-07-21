-- =============================================================================
-- FamilyHQ · Grupo 3 — Salir / eliminar del hogar (endurece members_delete)
-- =============================================================================
-- Hueco cerrado: la política members_delete original
--   using (household_id = current_household_id())
-- dejaba a CUALQUIER integrante borrar a cualquiera de su hogar (incluido el
-- dueño) por acceso directo. La app lo tapaba a medias (eliminarIntegrante solo
-- tocaba perfiles con user_id null), pero la RLS no.
--
-- Nueva regla (declarativa, sin RPC — el borrado es una sola operación atómica):
--   - Nunca se puede borrar al DUEÑO (is_owner). Un hogar siempre tiene dueño.
--     (Transferir la propiedad / eliminar el hogar completo son features futuras.)
--   - SALIR uno mismo: puedes borrar tu propia membresía (user_id = auth.uid()).
--   - QUITAR a otro: solo un RESPONSABLE (rol 'sostenedor'), sobre cualquier otro
--     integrante de su hogar (con cuenta o perfil administrado).
--   - Un integrante común solo puede salir él mismo; no puede quitar a nadie.
--
-- Al borrar el member, sus datos ligados por member_id (disponibilidad, conexión
-- de rol con la iCal cifrada, horario fijo, asignaciones) se van en cascada; lo
-- que creó (agenda, compras) queda con autor null (on delete set null). La cuenta
-- de auth NO se toca: la persona queda libre para crear o unirse a otro hogar.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- Helper: ¿el usuario autenticado es responsable (sostenedor) de su hogar?
-- -----------------------------------------------------------------------------
-- SECURITY DEFINER + search_path = '' (mismo patrón que current_household_id):
-- lee members saltándose su RLS para no entrar en recursión con las políticas de
-- members que lo invocan.
create or replace function public.es_responsable_actual()
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1
    from public.members m
    where m.user_id = (select auth.uid())
      and m.rol = 'sostenedor'
  )
$$;

revoke execute on function public.es_responsable_actual() from public;
grant execute on function public.es_responsable_actual() to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- Reemplazo de la política de borrado de members
-- -----------------------------------------------------------------------------
drop policy "members_delete" on public.members;

create policy "members_delete" on public.members
  for delete to authenticated
  using (
    household_id = public.current_household_id()
    and is_owner = false
    and (
      user_id = (select auth.uid())        -- salir uno mismo
      or public.es_responsable_actual()     -- un responsable quita a otro
    )
  );
