-- =============================================================================
-- FamilyHQ · Grupo 3 — Entrada al hogar
-- =============================================================================
-- Hasta ahora un usuario solo podía CREAR su hogar (onboarding). Esta migración
-- habilita la ENTRADA a un hogar existente por tres caminos, todos con la misma
-- invariante intacta ("un usuario, un hogar" = members.unique(user_id)):
--
--   1. Código de hogar + solicitud: quien tiene el código pide ingresar; un
--      responsable (rol 'sostenedor') aprueba / rechaza / bloquea.
--   2. Invitación por email: un responsable invita a un correo; esa persona
--      acepta con un token (pre-aprobada, no pasa por la cola de solicitudes).
--   3. Vinculación a perfil administrado: al aprobar/aceptar, el responsable
--      puede enlazar la cuenta entrante a un perfil administrado ya existente
--      (user_id null) en vez de crear un member nuevo — evita duplicados.
--
-- Toda escritura sensible pasa por funciones SECURITY DEFINER (mismo patrón que
-- create_household / current_household_id): los clientes NO tienen INSERT/UPDATE
-- directo sobre estas tablas; solo SELECT acotado por RLS. La autorización vive
-- dentro de cada RPC (sesión + pertenencia + rol), no en el cliente.
-- =============================================================================


-- -----------------------------------------------------------------------------
-- 1. Generador de código de hogar
-- -----------------------------------------------------------------------------
-- Alfabeto sin caracteres ambiguos (sin 0/O, 1/I/L): fácil de dictar/tipear.
-- 8 caracteres sobre 31 símbolos ≈ 40 bits; combinado con el rate limit de
-- solicitar_ingreso, el espacio es infactible de barrer para cosechar hogares.
--
-- SECURITY DEFINER a propósito: la comprobación de unicidad debe ver TODAS las
-- filas de households, no solo el hogar propio (que es lo que dejaría ver la RLS
-- al rol authenticated). Reintenta ante la colisión — improbable, pero robusto.
create or replace function public.generar_codigo_hogar()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_alfabeto constant text := 'ABCDEFGHJKMNPQRSTUVWXYZ23456789'; -- 31 símbolos
  v_codigo   text;
  v_i        int;
begin
  loop
    v_codigo := '';
    for v_i in 1..8 loop
      v_codigo := v_codigo
        || substr(v_alfabeto, 1 + floor(random() * length(v_alfabeto))::int, 1);
    end loop;

    exit when not exists (
      select 1 from public.households h where h.join_code = v_codigo
    );
  end loop;

  return v_codigo;
end;
$$;

revoke execute on function public.generar_codigo_hogar() from public;
grant execute on function public.generar_codigo_hogar() to authenticated, service_role;


-- -----------------------------------------------------------------------------
-- 2. households.join_code
-- -----------------------------------------------------------------------------
alter table public.households
  add column join_code text;

comment on column public.households.join_code is
  'Código para compartir e invitar a unirse al hogar. Único, no enumerable. Lo genera generar_codigo_hogar(); se puede rotar con rotar_codigo_hogar().';

-- Backfill fila por fila: generar_codigo_hogar() garantiza unicidad contra las
-- filas ya persistidas. Un UPDATE masivo no sirve — cada llamada debe "ver" los
-- códigos recién asignados, y eso exige commitear cada asignación en orden.
do $$
declare
  r record;
begin
  for r in select id from public.households where join_code is null loop
    update public.households
      set join_code = public.generar_codigo_hogar()
    where id = r.id;
  end loop;
end;
$$;

alter table public.households
  alter column join_code set not null,
  alter column join_code set default public.generar_codigo_hogar();

create unique index households_join_code_key on public.households (join_code);


-- -----------------------------------------------------------------------------
-- 3. Ajuste del trigger de transición de members.user_id
-- -----------------------------------------------------------------------------
-- El trigger original (migración 20260708130324) solo permitía la transición
-- null -> X cuando X = auth.uid() (auto-vinculación: "vincula TU propia cuenta").
-- La aprobación con vinculación introduce un segundo camino legítimo: un
-- RESPONSABLE enlaza la cuenta entrante a un perfil administrado. En ese caso
-- quien ejecuta el UPDATE (dentro de resolver_ingreso/aceptar_invitacion) NO es
-- la persona que se vincula, así que el chequeo estricto lo rechazaría.
--
-- Solución minimalista y segura por rol de ejecución: el chequeo estricto
-- "solo tu propia cuenta" se mantiene EXACTAMENTE igual para los roles de cliente
-- (authenticated / anon), que son los únicos que hacen UPDATE bajo RLS. Los
-- contextos de servidor de confianza (funciones SECURITY DEFINER, cuyo owner es
-- 'postgres', y service_role) SÍ pueden vincular a una cuenta aprobada — pero esas
-- funciones ya gatean por sesión + rol + pertenencia antes de tocar la fila.
--   - Un cliente 'authenticated' JAMÁS puede convertirse en 'postgres', así que
--     sigue sin poder vincular la cuenta de un tercero por UPDATE directo.
--   - La prohibición de REASIGNAR o ANULAR una cuenta ya vinculada (old no nulo)
--     se mantiene universal, para todos los contextos.
create or replace function public.enforce_members_user_id_transition()
returns trigger
language plpgsql
security invoker
set search_path = ''
as $$
begin
  -- user_id no cambia: edición normal de otros campos.
  if new.user_id is not distinct from old.user_id then
    return new;
  end if;

  -- A partir de acá, user_id SÍ cambió.

  -- Una cuenta ya vinculada no se reasigna ni se vuelve a null (universal).
  if old.user_id is not null then
    raise exception 'user_id no se puede reasignar ni anular una vez vinculado (member %)', old.id
      using errcode = 'check_violation';
  end if;

  -- old.user_id es null y cambió -> new.user_id es no-nulo.
  -- Contexto de CLIENTE (RLS): solo auto-vinculación de la propia cuenta.
  if current_user in ('authenticated', 'anon') then
    if new.user_id <> (select auth.uid()) then
      raise exception 'Solo puedes vincular tu propia cuenta a un perfil (user_id debe ser auth.uid())'
        using errcode = 'check_violation';
    end if;
  end if;

  -- Contexto de servidor de confianza (definer 'postgres' / service_role):
  -- la vinculación ya viene autorizada por la RPC que la ejecuta.
  return new;
end;
$$;


-- -----------------------------------------------------------------------------
-- 4. household_join_requests  (solicitudes de ingreso por código)
-- -----------------------------------------------------------------------------
create table public.household_join_requests (
  id                 uuid primary key default gen_random_uuid(),
  household_id       uuid not null references public.households(id) on delete cascade,
  user_id            uuid not null references auth.users(id) on delete cascade,
  status             text not null default 'pendiente'
                       check (status in ('pendiente', 'aprobada', 'rechazada', 'bloqueada')),
  -- Datos del solicitante capturados al pedir (el responsable no puede leer
  -- auth.users vía RLS): sirven para decidir a quién se aprueba.
  solicitante_nombre text,
  solicitante_email  text,
  -- Perfil administrado al que se vinculó la cuenta al aprobar (si aplica).
  link_member_id     uuid references public.members(id) on delete set null,
  resolved_by        uuid references public.members(id) on delete set null,
  resolved_at        timestamptz,
  created_at         timestamptz not null default now(),
  unique (household_id, user_id)  -- una solicitud por persona/hogar (se reusa la fila)
);

comment on table public.household_join_requests is
  'Solicitudes de ingreso a un hogar vía código. La escritura es solo por RPC (solicitar_ingreso / resolver_ingreso); el cliente solo hace SELECT acotado por RLS.';

create index idx_join_requests_household_id on public.household_join_requests (household_id);
create index idx_join_requests_user_id on public.household_join_requests (user_id);


-- -----------------------------------------------------------------------------
-- 5. household_invites  (invitaciones por email)
-- -----------------------------------------------------------------------------
create table public.household_invites (
  id             uuid primary key default gen_random_uuid(),
  household_id   uuid not null references public.households(id) on delete cascade,
  email          text not null,                 -- siempre en minúsculas (lower)
  token          text not null unique,          -- secreto del enlace de aceptación
  status         text not null default 'pendiente'
                   check (status in ('pendiente', 'aceptada', 'revocada')),
  link_member_id uuid references public.members(id) on delete set null,
  invited_by     uuid references public.members(id) on delete set null,
  accepted_at    timestamptz,
  created_at     timestamptz not null default now()
);

comment on table public.household_invites is
  'Invitaciones por email a un hogar. La acepta el invitado con su token (aceptar_invitacion), verificando que el correo de su sesión coincide con el invitado.';

-- Una sola invitación VIVA por (hogar, email). Índice parcial: tras revocar o
-- aceptar se puede volver a invitar el mismo correo sin chocar.
create unique index household_invites_pendiente_key
  on public.household_invites (household_id, email)
  where status = 'pendiente';

create index idx_household_invites_household_id on public.household_invites (household_id);


-- =============================================================================
-- 6. Row Level Security
-- =============================================================================
-- Ambas tablas: RLS activo, solo SELECT para el cliente. Toda mutación pasa por
-- las RPCs SECURITY DEFINER de abajo (que bypassa RLS de forma controlada).
alter table public.household_join_requests enable row level security;
alter table public.household_invites       enable row level security;

grant select on public.household_join_requests to authenticated;
grant select on public.household_invites       to authenticated;
grant select, insert, update, delete on public.household_join_requests to service_role;
grant select, insert, update, delete on public.household_invites       to service_role;

-- join_requests: la ve el hogar destino (bandeja del responsable) y el propio
-- solicitante (su estado). El solicitante aún no tiene member, así que
-- current_household_id() es null para él: su rama es user_id = auth.uid().
create policy "household_join_requests_select" on public.household_join_requests
  for select to authenticated
  using (
    household_id = public.current_household_id()
    or user_id = (select auth.uid())
  );

-- invites: solo las ve el hogar que las emitió (para gestionarlas/revocarlas).
-- El invitado no necesita SELECT: acepta vía RPC con el token.
create policy "household_invites_select" on public.household_invites
  for select to authenticated
  using (household_id = public.current_household_id());


-- =============================================================================
-- 7. RPCs
-- =============================================================================

-- --- solicitar_ingreso(p_code) -----------------------------------------------
-- La ejecuta un usuario autenticado SIN hogar. Valida el código, verifica que no
-- tenga member ni esté bloqueado, y crea/reusa una solicitud pendiente. Devuelve
-- el nombre del hogar (para el mensaje "Solicitud enviada a ..."). No existe un
-- endpoint de "preview" del código a propósito: el nombre solo se revela al crear
-- la solicitud, y con rate limit, para no ofrecer una superficie de cosecha.
create or replace function public.solicitar_ingreso(p_code text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_code   text := upper(regexp_replace(coalesce(p_code, ''), '\s', '', 'g'));
  v_hh     record;
  v_nombre text;
  v_email  text;
  v_status text;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada'
      using errcode = 'insufficient_privilege';
  end if;

  -- Rate limit: acota los intentos por usuario (anti fuerza bruta de códigos).
  if not public.consumir_rate_limit('solicitar_ingreso', 10, 3600) then
    raise exception 'Demasiados intentos. Espera un momento e intenta de nuevo.'
      using errcode = 'check_violation';
  end if;

  if v_code = '' then
    raise exception 'Ingresa el código del hogar'
      using errcode = 'check_violation';
  end if;

  -- Un usuario, un hogar: si ya es member, no puede solicitar ingreso.
  if exists (select 1 from public.members m where m.user_id = v_uid) then
    raise exception 'Ya perteneces a un hogar'
      using errcode = 'unique_violation';
  end if;

  select h.id, h.name into v_hh
  from public.households h
  where h.join_code = v_code;

  if v_hh.id is null then
    raise exception 'No encontramos un hogar con ese código'
      using errcode = 'no_data_found';
  end if;

  -- Nombre/email del solicitante para la bandeja del responsable.
  select
    coalesce(
      nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
      nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
      nullif(split_part(u.email, '@', 1), ''),
      'Alguien'
    ),
    u.email
  into v_nombre, v_email
  from auth.users u
  where u.id = v_uid;

  insert into public.household_join_requests (
    household_id, user_id, status, solicitante_nombre, solicitante_email
  )
  values (v_hh.id, v_uid, 'pendiente', v_nombre, v_email)
  on conflict (household_id, user_id) do update
    set status = case
          when public.household_join_requests.status = 'bloqueada' then 'bloqueada'
          else 'pendiente'
        end,
        solicitante_nombre = excluded.solicitante_nombre,
        solicitante_email  = excluded.solicitante_email,
        resolved_by = null,
        resolved_at = null
  returning status into v_status;

  if v_status = 'bloqueada' then
    raise exception 'No puedes solicitar ingreso a este hogar'
      using errcode = 'insufficient_privilege';
  end if;

  return jsonb_build_object('household_name', v_hh.name);
end;
$$;

revoke execute on function public.solicitar_ingreso(text) from public;
grant execute on function public.solicitar_ingreso(text) to authenticated, service_role;


-- --- resolver_ingreso(p_request_id, p_accion, p_link_member_id) ---------------
-- La ejecuta un RESPONSABLE del hogar destino. 'aprobar' crea el member (nuevo o
-- vinculado a un perfil administrado) atómicamente; 'rechazar'/'bloquear' solo
-- marcan la solicitud. La creación del member y el cierre de la solicitud van en
-- la misma transacción para no dejar estados a medias.
create or replace function public.resolver_ingreso(
  p_request_id     uuid,
  p_accion         text,
  p_link_member_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_req record;
  v_yo  record;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada'
      using errcode = 'insufficient_privilege';
  end if;

  select * into v_req
  from public.household_join_requests
  where id = p_request_id
  for update;

  if v_req.id is null then
    raise exception 'La solicitud no existe'
      using errcode = 'no_data_found';
  end if;

  -- Quien resuelve debe ser RESPONSABLE del hogar de la solicitud.
  select m.id, m.rol, m.household_id into v_yo
  from public.members m
  where m.user_id = v_uid;

  if v_yo.id is null
     or v_yo.household_id <> v_req.household_id
     or v_yo.rol <> 'sostenedor' then
    raise exception 'No autorizado para resolver esta solicitud'
      using errcode = 'insufficient_privilege';
  end if;

  if v_req.status <> 'pendiente' then
    raise exception 'Esta solicitud ya fue resuelta'
      using errcode = 'check_violation';
  end if;

  if p_accion = 'aprobar' then
    -- La persona no debe haber entrado a otro hogar entretanto.
    if exists (select 1 from public.members m where m.user_id = v_req.user_id) then
      raise exception 'Esa persona ya pertenece a un hogar'
        using errcode = 'unique_violation';
    end if;

    if p_link_member_id is not null then
      -- Vincular a un perfil ADMINISTRADO (user_id null) del MISMO hogar.
      update public.members
        set user_id = v_req.user_id
      where id = p_link_member_id
        and household_id = v_req.household_id
        and user_id is null;

      if not found then
        raise exception 'El perfil a vincular no es válido'
          using errcode = 'check_violation';
      end if;
    else
      -- Member nuevo: integrante sin horario definido (hará su mini-onboarding).
      insert into public.members (
        user_id, household_id, is_owner, rol, tipo_horario, display_name, created_by_member_id
      )
      values (
        v_req.user_id, v_req.household_id, false, 'integrante', 'ninguno',
        coalesce(nullif(trim(v_req.solicitante_nombre), ''), 'Integrante'), v_yo.id
      );
    end if;

    update public.household_join_requests
      set status = 'aprobada', resolved_by = v_yo.id, resolved_at = now(),
          link_member_id = p_link_member_id
    where id = p_request_id;

  elsif p_accion = 'rechazar' then
    update public.household_join_requests
      set status = 'rechazada', resolved_by = v_yo.id, resolved_at = now()
    where id = p_request_id;

  elsif p_accion = 'bloquear' then
    update public.household_join_requests
      set status = 'bloqueada', resolved_by = v_yo.id, resolved_at = now()
    where id = p_request_id;

  else
    raise exception 'Acción inválida'
      using errcode = 'check_violation';
  end if;
end;
$$;

revoke execute on function public.resolver_ingreso(uuid, text, uuid) from public;
grant execute on function public.resolver_ingreso(uuid, text, uuid) to authenticated, service_role;


-- --- crear_invitacion(p_email, p_link_member_id) -----------------------------
-- La ejecuta un RESPONSABLE. Persiste la invitación y DEVUELVE el token; el envío
-- del correo (Supabase inviteUserByEmail) lo hace la Server Action con ese token.
-- El token se genera en la base (dos uuid) para no depender del cliente.
create or replace function public.crear_invitacion(
  p_email          text,
  p_link_member_id uuid default null
)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_yo    record;
  v_email text := lower(trim(coalesce(p_email, '')));
  v_token text;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada'
      using errcode = 'insufficient_privilege';
  end if;

  select m.id, m.rol, m.household_id into v_yo
  from public.members m
  where m.user_id = v_uid;

  if v_yo.id is null or v_yo.rol <> 'sostenedor' then
    raise exception 'Solo un responsable puede invitar'
      using errcode = 'insufficient_privilege';
  end if;

  -- Validación mínima de formato (algo@algo.algo).
  if v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception 'Correo inválido'
      using errcode = 'check_violation';
  end if;

  if not public.consumir_rate_limit('crear_invitacion', 20, 3600) then
    raise exception 'Demasiadas invitaciones. Espera un momento.'
      using errcode = 'check_violation';
  end if;

  -- Perfil a vincular: debe ser administrado (user_id null) del hogar propio.
  if p_link_member_id is not null then
    if not exists (
      select 1 from public.members m
      where m.id = p_link_member_id
        and m.household_id = v_yo.household_id
        and m.user_id is null
    ) then
      raise exception 'El perfil a vincular no es válido'
        using errcode = 'check_violation';
    end if;
  end if;

  v_token := replace(gen_random_uuid()::text, '-', '')
          || replace(gen_random_uuid()::text, '-', '');

  -- Deja viva una sola invitación por (hogar, email): revoca la pendiente previa.
  update public.household_invites
    set status = 'revocada'
  where household_id = v_yo.household_id
    and email = v_email
    and status = 'pendiente';

  insert into public.household_invites (
    household_id, email, token, status, link_member_id, invited_by
  )
  values (v_yo.household_id, v_email, v_token, 'pendiente', p_link_member_id, v_yo.id);

  return jsonb_build_object('token', v_token, 'email', v_email);
end;
$$;

revoke execute on function public.crear_invitacion(text, uuid) from public;
grant execute on function public.crear_invitacion(text, uuid) to authenticated, service_role;


-- --- revocar_invitacion(p_id) ------------------------------------------------
create or replace function public.revocar_invitacion(p_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := (select auth.uid());
  v_yo  record;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada'
      using errcode = 'insufficient_privilege';
  end if;

  select m.id, m.rol, m.household_id into v_yo
  from public.members m
  where m.user_id = v_uid;

  if v_yo.id is null or v_yo.rol <> 'sostenedor' then
    raise exception 'Solo un responsable puede revocar invitaciones'
      using errcode = 'insufficient_privilege';
  end if;

  update public.household_invites
    set status = 'revocada'
  where id = p_id
    and household_id = v_yo.household_id
    and status = 'pendiente';
end;
$$;

revoke execute on function public.revocar_invitacion(uuid) from public;
grant execute on function public.revocar_invitacion(uuid) to authenticated, service_role;


-- --- aceptar_invitacion(p_token) ---------------------------------------------
-- La ejecuta el INVITADO tras autenticarse. Verifica que el correo de su sesión
-- coincide con el correo invitado (un token filtrado no sirve para otra cuenta),
-- que no tenga hogar, y crea/vincula su member. Devuelve el nombre del hogar.
create or replace function public.aceptar_invitacion(p_token text)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid     uuid := (select auth.uid());
  v_email   text;
  v_nombre  text;
  v_inv     record;
  v_hh_name text;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada'
      using errcode = 'insufficient_privilege';
  end if;

  select lower(u.email),
         coalesce(
           nullif(trim(u.raw_user_meta_data ->> 'full_name'), ''),
           nullif(trim(u.raw_user_meta_data ->> 'name'), ''),
           nullif(split_part(u.email, '@', 1), ''),
           'Integrante'
         )
  into v_email, v_nombre
  from auth.users u
  where u.id = v_uid;

  select * into v_inv
  from public.household_invites
  where token = p_token
    and status = 'pendiente'
  for update;

  if v_inv.id is null then
    raise exception 'La invitación no es válida o ya fue usada'
      using errcode = 'no_data_found';
  end if;

  -- El correo de la sesión debe ser el invitado.
  if v_inv.email <> v_email then
    raise exception 'Esta invitación es para otro correo'
      using errcode = 'insufficient_privilege';
  end if;

  if exists (select 1 from public.members m where m.user_id = v_uid) then
    raise exception 'Ya perteneces a un hogar'
      using errcode = 'unique_violation';
  end if;

  if v_inv.link_member_id is not null then
    update public.members
      set user_id = v_uid
    where id = v_inv.link_member_id
      and household_id = v_inv.household_id
      and user_id is null;

    if not found then
      raise exception 'El perfil a vincular ya no está disponible'
        using errcode = 'check_violation';
    end if;
  else
    insert into public.members (
      user_id, household_id, is_owner, rol, tipo_horario, display_name
    )
    values (
      v_uid, v_inv.household_id, false, 'integrante', 'ninguno', v_nombre
    );
  end if;

  update public.household_invites
    set status = 'aceptada', accepted_at = now()
  where id = v_inv.id;

  select h.name into v_hh_name
  from public.households h
  where h.id = v_inv.household_id;

  return jsonb_build_object('household_name', v_hh_name);
end;
$$;

revoke execute on function public.aceptar_invitacion(text) from public;
grant execute on function public.aceptar_invitacion(text) to authenticated, service_role;


-- --- rotar_codigo_hogar() ----------------------------------------------------
create or replace function public.rotar_codigo_hogar()
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid    uuid := (select auth.uid());
  v_yo     record;
  v_codigo text;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada'
      using errcode = 'insufficient_privilege';
  end if;

  select m.id, m.rol, m.household_id into v_yo
  from public.members m
  where m.user_id = v_uid;

  if v_yo.id is null or v_yo.rol <> 'sostenedor' then
    raise exception 'Solo un responsable puede rotar el código'
      using errcode = 'insufficient_privilege';
  end if;

  v_codigo := public.generar_codigo_hogar();

  update public.households
    set join_code = v_codigo
  where id = v_yo.household_id;

  return v_codigo;
end;
$$;

revoke execute on function public.rotar_codigo_hogar() from public;
grant execute on function public.rotar_codigo_hogar() to authenticated, service_role;
