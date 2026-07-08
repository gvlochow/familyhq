-- =============================================================================
-- FamilyHQ · Integrantes sin cuenta propia (perfiles administrados)
-- =============================================================================
-- Hasta ahora todo member tenía un user_id (una cuenta de auth). Esta migración
-- habilita perfiles que el owner/sostenedor administra SIN login propio: pensado
-- para hijos u otros integrantes que no necesitan acceso directo a la app.
--
-- Flujo de un perfil administrado:
--   1. El owner lo crea con user_id = null (no tiene cuenta de auth).
--   2. Ese perfil no puede autenticarse por sí mismo: no necesita política de
--      acceso propia. Es visible y editable por los miembros CON sesión de su
--      mismo household, igual que cualquier otra fila del hogar.
--   3. Vinculación: si esa persona más adelante quiere login propio (ej. un
--      hijo que crece), se registra en auth y se actualiza SU fila poniendo
--      user_id = <su nuevo auth uid>. A partir de ahí queda como integrante con
--      cuenta normal. El "cuándo/cómo se dispara" ese update es lógica de app
--      futura, pero la TRANSICIÓN segura de user_id sí se blinda acá a nivel de
--      base de datos (trigger del punto 4).
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. members.user_id pasa a ser opcional
-- -----------------------------------------------------------------------------
alter table public.members
  alter column user_id drop not null;

comment on column public.members.user_id is
  'Cuenta de auth del integrante. NULL = perfil administrado sin login propio (lo maneja el owner). Se puede completar después al vincular una cuenta (lógica de app futura).';

-- La unicidad unique(user_id) NO se toca: en Postgres UNIQUE trata los NULL como
-- distintos entre sí (NULLS DISTINCT, el default), por lo que se permiten varios
-- perfiles con user_id = null sin chocar, y se mantiene "un usuario, un member"
-- para las cuentas reales (no-nulas). Verificado: no requiere cambios.


-- -----------------------------------------------------------------------------
-- 2. members.created_by_member_id  (quién creó el perfil administrado)
-- -----------------------------------------------------------------------------
-- Registra qué integrante (owner/sostenedor) creó el perfil. on delete set null:
-- si ese creador se elimina, el perfil administrado sobrevive sin quedar colgado.
alter table public.members
  add column created_by_member_id uuid references public.members(id) on delete set null;

comment on column public.members.created_by_member_id is
  'Integrante que creó este perfil (útil para perfiles administrados sin login). NULL si se autocreó en onboarding o si el creador ya no existe.';

create index idx_members_created_by_member_id on public.members (created_by_member_id);


-- -----------------------------------------------------------------------------
-- 3. Ajuste de RLS: members_insert
-- -----------------------------------------------------------------------------
-- La política original exigía user_id = auth.uid() en el INSERT, lo que impide
-- crear perfiles administrados (user_id = null). Se reemplaza para permitir dos
-- casos, ambos seguros:
--   a) Autocreación en onboarding: user_id = auth.uid() (el usuario se crea a sí
--      mismo; en ese momento current_household_id() aún es null).
--   b) Perfil administrado: user_id IS NULL dentro del PROPIO household del
--      llamante (household_id = current_household_id()). Solo se pueden agregar
--      perfiles al hogar propio.
--
-- El resto de políticas de members (select/update/delete) ya filtran por
-- household_id y no asumen user_id no nulo, así que siguen válidas sin cambios.
-- current_household_id() tampoco cambia: un member con user_id null nunca calza
-- con auth.uid(), que siempre es no-nulo para un usuario con sesión.
drop policy "members_insert" on public.members;

create policy "members_insert" on public.members
  for insert to authenticated
  with check (
    user_id = (select auth.uid())
    or (
      user_id is null
      and household_id = public.current_household_id()
    )
  );


-- -----------------------------------------------------------------------------
-- 4. Blindaje de la transición de members.user_id (trigger BEFORE UPDATE)
-- -----------------------------------------------------------------------------
-- La política members_update deja editar los campos del hogar (rol,
-- tipo_horario, display_name, etc.), pero NO puede por sí sola restringir cómo
-- cambia user_id: una política RLS solo ve la fila vieja (USING) o la nueva
-- (WITH CHECK), nunca ambas a la vez, así que no puede comparar el valor viejo
-- contra el nuevo. Esa comparación requiere un trigger.
--
-- Regla segura de transición de user_id (seguridad por defecto):
--   - Sin cambios              -> permitido (se está editando otro campo).
--   - null  -> auth.uid()      -> permitido: una persona vincula SU PROPIA
--                                 cuenta a un perfil administrado.
--   - null  -> otro uuid       -> RECHAZADO: no puedes vincular la cuenta de un
--                                 tercero.
--   - valor -> otro valor      -> RECHAZADO: no se reasigna una cuenta ya
--                                 vinculada a otra.
--   - valor -> null            -> RECHAZADO: no se "desvincula" volviendo a null.
--
-- SECURITY INVOKER: corre con el rol de quien hace el UPDATE; auth.uid() refleja
-- a esa persona. No accede a tablas, solo compara OLD/NEW y auth.uid().
create or replace function public.enforce_members_user_id_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- user_id no cambia: se permite (edición normal de otros campos).
  if new.user_id is not distinct from old.user_id then
    return new;
  end if;

  -- A partir de acá, user_id SÍ cambió.

  -- Solo se permite partir desde null: una cuenta ya vinculada no se reasigna
  -- ni se vuelve a null.
  if old.user_id is not null then
    raise exception 'user_id no se puede reasignar ni anular una vez vinculado (member %)', old.id
      using errcode = 'check_violation';
  end if;

  -- old.user_id es null y cambió, por lo que new.user_id es no-nulo. Debe ser la
  -- cuenta de quien ejecuta la operación: vinculas TU propia cuenta, no la de un
  -- tercero.
  if new.user_id <> (select auth.uid()) then
    raise exception 'Solo puedes vincular tu propia cuenta a un perfil (user_id debe ser auth.uid())'
      using errcode = 'check_violation';
  end if;

  return new;
end;
$$;

create trigger members_enforce_user_id_transition
  before update on public.members
  for each row
  execute function public.enforce_members_user_id_transition();
