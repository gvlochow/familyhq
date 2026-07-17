-- =============================================================================
-- FamilyHQ · Cierra el auto-join a hogares ajenos en members_insert
-- =============================================================================
-- Hallazgo de auditoría (High): la política members_insert permitía la rama
-- `user_id = auth.uid()`, que dejaba a un usuario autenticado insertarse a sí
-- mismo como member de CUALQUIER household (con check sobre user_id, sin acotar
-- el household_id de destino). Un usuario nuevo podía así unirse a un hogar
-- ajeno conociendo su household_id.
--
-- Esa rama era además código muerto para el flujo real: el alta del member del
-- creador ocurre dentro de create_household() (SECURITY DEFINER, bypassa RLS),
-- no vía esta política. El único INSERT que la app hace contra members bajo RLS
-- es el de perfiles administrados (user_id null) en el hogar propio
-- (agregarIntegrante). Por eso se elimina la rama de auto-join y queda solo ese
-- caso, acotado a household_id = current_household_id().
--
-- Las demás políticas de members (select/update/delete) ya filtran por
-- household_id y no cambian.
-- =============================================================================

drop policy "members_insert" on public.members;

create policy "members_insert" on public.members
  for insert to authenticated
  with check (
    user_id is null
    and household_id = public.current_household_id()
  );
