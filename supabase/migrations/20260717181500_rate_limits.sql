-- =============================================================================
-- FamilyHQ · Rate limiting persistente (rate_limits + consumir_rate_limit)
-- =============================================================================
-- La app corre en serverless (Vercel): cada invocación de una Server Action puede
-- caer en un worker distinto y sin estado compartido, así que un contador en
-- memoria del proceso no sirve como rate limit. El estado del límite vive en
-- Postgres, que es la única fuente compartida entre invocaciones.
--
-- Caso de uso inicial: connectCalendar hace un fetch a una URL externa provista
-- por el usuario. Con el filtro SSRF ya en su lugar el riesgo es bajo, pero sigue
-- siendo una primitiva de fetch repetible; el límite acota los intentos por
-- usuario y acción.
--
-- Ventana fija por clave: la primera llamada siembra la fila con count=1 y
-- window_start=now(); las siguientes incrementan mientras la ventana siga vigente
-- y la reinician (count=1, nueva window_start) en cuanto expira. Todo ocurre en un
-- solo INSERT ... ON CONFLICT, atómico bajo el lock de fila, sin condiciones de
-- carrera entre invocaciones concurrentes.
-- =============================================================================

create table public.rate_limits (
  key          text        primary key,
  window_start timestamptz not null default now(),
  count        integer     not null default 0
);

-- RLS activo y SIN políticas: ningún rol de cliente (anon/authenticated) puede
-- leer ni escribir la tabla directamente. El único acceso es vía la función
-- consumir_rate_limit (SECURITY DEFINER), que corre con los privilegios del owner
-- y bypassa RLS de forma controlada.
alter table public.rate_limits enable row level security;

-- =============================================================================
-- consumir_rate_limit(p_accion, p_limite, p_ventana_seg) -> boolean
-- =============================================================================
-- Registra un intento del usuario autenticado para la acción dada y devuelve
-- true si está dentro del límite, false si lo excede.
--
-- La clave se construye SIEMPRE a partir de auth.uid() dentro de la función: el
-- llamante no puede falsificarla ni gastar el presupuesto de otro usuario ni
-- evadir el límite cambiando un parámetro. p_accion solo namespacéa el contador
-- (distintas acciones no comparten cupo).
--
-- SECURITY DEFINER + search_path = '' y todo schema-cualificado, mismo patrón que
-- create_household / current_household_id.
-- =============================================================================

create or replace function public.consumir_rate_limit(
  p_accion      text,
  p_limite      integer,
  p_ventana_seg integer
)
returns boolean
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid   uuid := (select auth.uid());
  v_key   text;
  v_count integer;
begin
  if v_uid is null then
    raise exception 'Se requiere una sesión autenticada'
      using errcode = 'insufficient_privilege';
  end if;

  v_key := v_uid::text || ':' || coalesce(p_accion, '');

  insert into public.rate_limits (key, window_start, count)
  values (v_key, now(), 1)
  on conflict (key) do update
    set
      count = case
        when public.rate_limits.window_start
             < now() - make_interval(secs => p_ventana_seg)
          then 1
          else public.rate_limits.count + 1
      end,
      window_start = case
        when public.rate_limits.window_start
             < now() - make_interval(secs => p_ventana_seg)
          then now()
          else public.rate_limits.window_start
      end
  returning public.rate_limits.count into v_count;

  return v_count <= p_limite;
end;
$$;

-- Solo usuarios autenticados consumen el límite. service_role lo mantiene por si
-- se necesita desde tareas server-side.
revoke execute on function public.consumir_rate_limit(text, integer, integer) from public;
grant execute on function public.consumir_rate_limit(text, integer, integer)
  to authenticated, service_role;
