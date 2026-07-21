-- =============================================================================
-- FamilyHQ · Grupo 3 — Cancelar la propia solicitud de ingreso
-- =============================================================================
-- Sin esto, quien tecleó el código equivocado queda "pendiente" para siempre
-- salvo que el hogar destino la resuelva. Se permite RETIRAR la propia solicitud
-- pendiente (y solo esa): su user_id y status = 'pendiente'. No toca solicitudes
-- de otros ni resueltas/bloqueadas.
-- =============================================================================

grant delete on public.household_join_requests to authenticated;

create policy "household_join_requests_delete_propia" on public.household_join_requests
  for delete to authenticated
  using (
    user_id = (select auth.uid())
    and status = 'pendiente'
  );
