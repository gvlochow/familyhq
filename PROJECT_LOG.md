# PROJECT_LOG — FamilyHQ
_Última actualización: 2026-07-08_

## Estado actual
- Clasificador de rol (lib/roster/): completo y validado. 12 tests Vitest (11 casos borde + 1 golden contra reference/salida_julio_2026.txt), confirmado día por día contra el rol real de julio de Pablo.
- Filtrado de privacidad iFlight (firma X-APPLE-CREATOR-IDENTITY): implementado; lo que no matchea se descarta en memoria, nunca se persiste ni se loguea.
- Esquema Supabase: aplicado en el proyecto remoto real (households, members, roster_connections, availability_days, availability_overrides, fixed_schedules, recurring_activities, shopping_lists, shopping_items).
- RLS: activo en todas las tablas, aislamiento por household_id verificado con test real de dos hogares. Función current_household_id() + trigger que blinda la transición de members.user_id.
- Cliente Supabase tipado (lib/supabase/): client, server, admin (service_role, server-only), proxy.ts — completo.
- Auth: pantalla única de login/registro (email+contraseña y Google) cableada a Supabase Auth, con errores traducidos a español. Callback de OAuth (app/auth/callback) funcionando. Routing post-login centralizado (lib/supabase/post-login-redirect.ts): tres escalones — sin member → crear hogar; con member y tipo_horario='ninguno' → paso de horario; con horario definido → home.
- **Onboarding paso 1 (crear hogar): completo y probado end-to-end contra el proyecto Supabase remoto real.**
  - Pantalla `app/onboarding/page.tsx` (server, guarda central) + `components/onboarding/create-household-form.tsx` (client): mobile-first, tokens de DESIGN.md, progreso "Paso 1 de 3" que arranca en ~33%, campo único (nombre del hogar), botón en el tercio inferior.
  - RPC `public.create_household(p_name text)` (migración `20260708140000_create_household_rpc.sql`, aplicada): SECURITY DEFINER, search_path='', schema-cualificado. Inserta household + member del creador (is_owner=true, rol='sostenedor', tipo_horario='ninguno') en una sola transacción. Deriva display_name desde auth.users (full_name → name → parte local del email → 'Yo'). Guardas propias: exige sesión, rechaza nombre vacío, rechaza segundo hogar con error legible. GRANT execute a authenticated y service_role.
  - Tras el RPC exitoso, el form hace `router.refresh()` (no calcula destino en el cliente) — la guarda server-side de `/onboarding` reevalúa vía getPostLoginRedirect y decide el próximo paso. Diseño idempotente: un reintento tras fallo parcial no deja al usuario varado.
  - Placeholder `app/onboarding/horario/page.tsx` con guarda que reusa la misma lógica central ("Tipo de horario — pendiente").
  - Verificado con cuenta real: registro → /onboarding → crear hogar → redirige a /onboarding/horario → refresh no retrocede → reintento con hogar ya creado no permite duplicar y redirige correctamente.
- **Onboarding paso 2 (tipo de horario): completo y probado end-to-end contra el proyecto Supabase remoto real.**
  - Pantalla `app/onboarding/horario/page.tsx` (server, guarda central que reusa getPostLoginRedirect) + `components/onboarding/choose-schedule-form.tsx` (client): mobile-first, header/progreso espejo del paso 1 ("Paso 2 de 3" ~67%, pill "Hogar creado"), dos tarjetas seleccionables (radios accesibles con fieldset/legend), botón "Continuar" en el tercio inferior deshabilitado hasta elegir.
  - Dos opciones, 'variable' primero (diferenciador de entrada): 'variable' (rol irregular → roster_connections + clasificador) y 'fijo' (mismo horario la mayoría de los días → fixed_schedules). 'ninguno' no es opción: es el estado "sin definir".
  - Tipo de dominio tipado en `lib/members/tipo-horario.ts` (TipoHorario + TIPOS_HORARIO_SELECCIONABLES + guard) — database.types tipa la columna como `string`, este módulo es la fuente de verdad del dominio (CLAUDE.md: enums tipados, no strings sueltos).
  - **Primera Server Action del repo**: `app/onboarding/horario/actions.ts` (`setTipoHorario`), honra "mutaciones vía Server Action". Corre con el cliente de servidor (sesión por cookies) → RLS de members aplica (members_update solo toca el hogar propio; el trigger de user_id no bloquea tipo_horario). Valida contra el set seleccionable, no calcula destino: devuelve {error} y el form hace router.refresh() para que la guarda reevalúe (mismo patrón que crear hogar). Idempotente.
  - Límite del alcance: al guardar 'fijo'/'variable', getPostLoginRedirect ya no devuelve el paso de horario → redirige a home. La configuración por tipo (conectar iCal si variable / bloques por día si fijo) es el paso 3, aún pendiente; hoy se aterriza en el home placeholder.
  - Limpieza colateral: removido import muerto (getPostLoginRedirect) en create-household-form.tsx, sobrante del refactor a router.refresh() del paso 1. tsc + lint limpios.
- Sistema de diseño: tokens de DESIGN.md (paleta #284B63/#A7C4A0/#F2B94B, Manrope/Inter) aplicados globalmente en globals.css/layout.tsx.

## Sesión anterior
- Construido el flujo completo de onboarding paso 1 (crear hogar): RPC atómica, pantalla, expansión del routing centralizado a tres escalones.
- Corregido en revisión (antes de aplicar): el form inicialmente calculaba el destino en el cliente con getPostLoginRedirect + router.push tras el RPC — se cambió a router.refresh() para evitar dejar al usuario varado en caso de fallo parcial (hogar creado pero resolución de destino fallida).
- Verificado esquema real de members y households antes del push: buffers con default (90/45), tipo_horario con CHECK que permite 'ninguno'/'fijo'/'variable', rol sin CHECK restrictivo — sin bloqueantes.
- CLI de Supabase no estaba disponible en el PC usado esta sesión; se instaló como devDependency local (`pnpm add -D supabase`, se invoca con `pnpm supabase ...`) en vez de global, ya que Supabase discontinuó la instalación global vía npm.
- Migración pusheada contra el proyecto remoto real y probada con cuenta real.

## Decisiones técnicas
- Ingesta del rol por feed iCal secreto de Google Calendar, no por OAuth de Calendar API, para evitar el proceso de verificación de Google. El export estático de la app iFlight se descartó porque no se actualiza ante cambios de rol. Cron de sync 2-4x/día.
- El override manual gana sobre el estado clasificado hasta que el usuario lo quite o cambie el evento subyacente; esa regla vive en la lógica de app/cron, no en la base de datos.
- Un usuario, un hogar en el MVP (members.unique(user_id) sobre los valores no nulos). El RPC de creación de hogar refuerza esto con un chequeo propio antes de insertar, para dar un error legible en vez de chocar contra el constraint.
- Next.js 16 tiene breaking changes relevantes: el middleware se llama proxy.ts (no middleware.ts) y cookies() es async — no asumir la API de versiones anteriores.
- No hay Docker en este entorno: el proyecto Supabase es remoto, no local. Los cambios de esquema se aplican con `pnpm supabase db push` directo contra la base real, nunca con `supabase start`.
- El routing "¿qué paso sigue?" vive en UNA sola función (lib/supabase/post-login-redirect.ts), isomórfica (recibe el cliente Supabase como parámetro, no depende de next/headers). La usan el form de auth, el callback OAuth, y las guardas server de /onboarding y /onboarding/horario. Cualquier pantalla nueva que necesite decidir "¿a dónde sigo?" reusa esta función, nunca duplica la consulta a members.
- Tras una acción que cambia el estado de onboarding (crear hogar, y a futuro definir tipo de horario), la pantalla NO calcula el siguiente destino en el cliente: hace router.refresh() y deja que la guarda server-side del segmento actual decida vía getPostLoginRedirect. Patrón a repetir en el paso de tipo de horario.
- Las acciones interactivas de auth (signUp/signInWithPassword/signInWithOAuth) se llaman desde el cliente de browser (lib/supabase/client.ts), no vía Server Actions — patrón oficial de Supabase SSR, decisión explícita.
- Convención de mutaciones (aclarada al construir el paso 2): las mutaciones de dominio van por Server Action con el cliente de servidor (RLS aplica por sesión) — así se hizo setTipoHorario. Dos excepciones ya presentes: (1) auth, desde el cliente por el patrón SSR de Supabase; (2) create_household, RPC SECURITY DEFINER llamada desde el cliente porque necesita atomicidad de dos inserts. Regla práctica: mutación simple sobre datos propios → Server Action; lógica que debe ser atómica o saltar/afinar RLS → RPC en la base.
- Alcance del MVP: disponibilidad familiar (segmento de entrada, rol irregular) + actividades recurrentes y lista de compras (segmento de retención, horario normal). Reuniones vía OAuth de Calendar personal y georreferenciación quedan fuera del MVP. Asesora del hogar y minuta semanal son ideas a futuro.
- CLI de Supabase: instalar como devDependency local del proyecto (`pnpm add -D supabase`, invocar con `pnpm supabase`), no global — Supabase discontinuó la instalación global vía npm.

## Pendientes priorizados
- [ ] Paso 3 del onboarding: configuración según el tipo de horario elegido en el paso 2. Si 'variable' → conectar el feed iCal secreto (roster_connections). Si 'fijo' → bloques por día (fixed_schedules, precargados). Requiere agregar un cuarto escalón a getPostLoginRedirect (con hogar + tipo definido pero SIN configuración → paso 3; hoy ese estado cae directo a home). Reusar el patrón router.refresh() + guarda server.
- [ ] Cron de ingesta y clasificación del rol sobre roster_connections.
- [ ] Flujo de vinculación de cuenta para un perfil sin login que luego se registra (dispara el update de user_id, ya blindado por trigger).
- [ ] Pantallas del producto: calendario familiar, actividades recurrentes, lista de compras (home real, hoy placeholder).
- [ ] Flujo de invitar integrantes al hogar (mencionado en la copy de la pantalla de crear hogar: "más adelante podrás invitar a tu familia" — aún no construido).

## Problemas conocidos
- Este entorno no tiene chromium-cli ni Playwright instalados: la UI se verifica con build/tsc/eslint y curl contra el HTML server-rendered, no con screenshots reales de browser.
- CLI de Supabase debe reinstalarse como devDependency (`pnpm add -D supabase`) en cualquier PC nuevo donde se clone el repo; no está disponible global y no se hereda solo con `pnpm install` si no quedó en package.json de una sesión anterior — confirmar que sí quedó registrado como devDependency tras el commit de esta sesión.
