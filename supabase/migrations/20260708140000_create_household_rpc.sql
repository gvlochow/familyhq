-- =============================================================================
-- FamilyHQ · RPC de bootstrap de hogar (create_household)
-- =============================================================================
-- Primer paso real del onboarding: crear el household y el member del usuario
-- que lo crea. Ambas inserciones DEBEN ocurrir en la misma transacción — dos
-- llamadas separadas podrían fallar a la mitad y dejar un hogar sin dueño (o un
-- usuario con hogar fantasma). Una función encapsula las dos inserciones en una
-- sola transacción atómica.
--
-- SECURITY DEFINER a propósito, igual que current_household_id(): en el momento
-- del onboarding el usuario todavía no tiene member, así que current_household_id()
-- es null y las políticas acotadas al hogar propio no aplican. La función corre
-- con los privilegios del owner (bypassa RLS) para poder sembrar el par
-- household+member de forma controlada. La seguridad la da la propia función:
-- solo actúa sobre auth.uid() y se niega a crear un segundo hogar.
--
-- search_path = '' y todo schema-cualificado (mismo patrón que
-- current_household_id) para que la resolución de nombres no dependa del
-- search_path del llamante.
-- =============================================================================

create or replace function public.create_household(p_name text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid          uuid := (select auth.uid());
  v_name         text := nullif(trim(p_name), '');
  v_display_name text;
  v_household_id uuid;
begin
  -- Debe haber sesión: la función siembra el member de auth.uid().
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada para crear un hogar'
      using errcode = 'insufficient_privilege';
  end if;

  -- El nombre del hogar es obligatorio (y no puede ser solo espacios).
  if v_name is null then
    raise exception 'El nombre del hogar no puede estar vacío'
      using errcode = 'check_violation';
  end if;

  -- Un usuario, un hogar en el MVP. Si ya tiene member, no creamos un segundo
  -- hogar: fallaríamos igual contra members.unique(user_id), pero preferimos un
  -- error propio y legible en vez del choque de constraint.
  if exists (
    select 1 from public.members m where m.user_id = v_uid
  ) then
    raise exception 'Este usuario ya pertenece a un hogar'
      using errcode = 'unique_violation';
  end if;

  -- Nombre a mostrar del sostenedor: se toma de los metadatos de la cuenta
  -- (full_name/name de Google, si vino por OAuth) o del correo. No lo pedimos en
  -- esta pantalla; se puede editar después en Ajustes.
  select coalesce(
    nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
    nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
    nullif(split_part(u.email, '@', 1), ''),
    'Yo'
  )
  into v_display_name
  from auth.users u
  where u.id = v_uid;

  -- 1. El hogar.
  insert into public.households (name, plan)
  values (v_name, 'free')
  returning id into v_household_id;

  -- 2. El member del creador: dueño y sostenedor. tipo_horario queda en
  --    'ninguno' a propósito — se define en el paso siguiente del onboarding.
  insert into public.members (
    user_id, household_id, is_owner, rol, tipo_horario, display_name
  )
  values (
    v_uid, v_household_id, true, 'sostenedor', 'ninguno', v_display_name
  );

  return v_household_id;
end;
$$;

-- No exponer a anon: solo usuarios autenticados hacen onboarding.
revoke execute on function public.create_household(text) from public;
grant execute on function public.create_household(text) to authenticated, service_role;
