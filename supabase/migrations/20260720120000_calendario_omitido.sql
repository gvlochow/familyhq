-- =============================================================================
-- FamilyHQ · "Dejar para más tarde" la conexión del calendario en el onboarding
-- =============================================================================
-- Sin esto, un integrante 'variable' sin roster_connection queda atrapado en el
-- paso del calendario: getPostLoginRedirect lo considera "no configurado" y lo
-- devuelve al mismo paso en loop. El flag registra la decisión EXPLÍCITA de
-- omitir, distinta de "todavía no llegó al paso".
--
-- Una vez que conecta (desde el onboarding o Ajustes), la fila en
-- roster_connections ya lo deja configurado por presencia, así que el flag solo
-- cubre el caso "sin conexión, entró igual".
-- =============================================================================

alter table public.members
  add column calendario_omitido boolean not null default false;

comment on column public.members.calendario_omitido is 'El integrante variable eligió "dejar para más tarde" la conexión del calendario en el onboarding. Con esto la guarda lo considera configurado aunque no tenga roster_connection; conectará después desde Ajustes.';
