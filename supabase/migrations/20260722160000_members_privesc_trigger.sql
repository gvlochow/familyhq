-- =============================================================================
-- FamilyHQ · Blindaje de columnas de privilegio en members (escalada intra-hogar)
-- =============================================================================
-- Hallazgo (vibe-security 2026-07-22, ALTA). La política members_update solo
-- comprueba household_id = current_household_id(); RLS no restringe columnas y el
-- único trigger sobre members (enforce_members_user_id_transition) blinda solo
-- user_id. Así, rol e is_owner quedaban libres: un 'integrante' común, saltándose
-- las Server Actions y pegándole directo a PostgREST con la anon key + su JWT,
-- podía hacer
--   PATCH /rest/v1/members?id=eq.<su_member_id> { "rol":"sostenedor","is_owner":true }
-- auto-promoverse a responsable/dueño y, desde ahí, invitar, resolver solicitudes,
-- rotar el código, editar horarios ajenos y (vía la rama es_responsable_actual()
-- de members_delete) borrar a otros, incluido el dueño. Radio de impacto = hogar
-- completo. No alcanzable por la UI, pero la Data API es un endpoint público.
--
-- Cierre: un segundo trigger BEFORE UPDATE que, SOLO en contexto de cliente
-- (current_user in ('authenticated','anon') — los únicos que hacen UPDATE bajo
-- RLS), gatea las columnas sensibles cuando REALMENTE cambian (is distinct from,
-- no mera presencia en el payload, para no romper editarIntegrante cuando un
-- integrante común guarda el nombre sin tocar el rol):
--   - is_owner       -> nunca lo cambia un cliente.
--   - household_id   -> nunca lo cambia un cliente (mudarse de hogar es INSERT vía
--                       RPC SECURITY DEFINER, no UPDATE).
--   - rol            -> solo un RESPONSABLE, y solo sobre un perfil ADMINISTRADO
--                       (old.user_id is null). Bloquea la auto-promoción (un
--                       integrante con cuenta tiene old.user_id no nulo) y que un
--                       responsable cambie el rol de otra cuenta real.
--
-- Los contextos de servidor de confianza (funciones SECURITY DEFINER, cuyo owner
-- es 'postgres', y service_role) PASAN sin gatear: ya revalidan sesión + rol +
-- pertenencia antes de tocar la fila. Mismo patrón que
-- enforce_members_user_id_transition (security invoker, search_path = '').
-- =============================================================================

create or replace function public.enforce_members_privilege_columns()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- Solo gateamos los roles de CLIENTE. Servidor de confianza (definer 'postgres'
  -- / service_role) pasa: sus RPCs ya autorizaron la operación.
  if current_user not in ('authenticated', 'anon') then
    return new;
  end if;

  -- is_owner: un cliente jamás lo cambia (transferir propiedad = feature futura,
  -- por RPC).
  if new.is_owner is distinct from old.is_owner then
    raise exception 'is_owner no se puede modificar por acceso directo (member %)', old.id
      using errcode = 'check_violation';
  end if;

  -- household_id: mudarse de hogar es un INSERT vía RPC, nunca un UPDATE de cliente.
  if new.household_id is distinct from old.household_id then
    raise exception 'household_id no se puede modificar por acceso directo (member %)', old.id
      using errcode = 'check_violation';
  end if;

  -- rol: solo un responsable, y solo sobre un perfil administrado (sin cuenta).
  -- Bloquea auto-promoción (integrante con cuenta) y cambiar el rol de otra cuenta.
  if new.rol is distinct from old.rol then
    if not public.es_responsable_actual() or old.user_id is not null then
      raise exception 'Solo un responsable puede cambiar el rol de un perfil administrado (member %)', old.id
        using errcode = 'check_violation';
    end if;
  end if;

  return new;
end;
$$;

create trigger members_enforce_privilege_columns
  before update on public.members
  for each row
  execute function public.enforce_members_privilege_columns();
