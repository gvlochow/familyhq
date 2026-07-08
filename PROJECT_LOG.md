# PROJECT_LOG — FamilyHQ
_Última actualización: 2026-07-08_

## Estado actual
- Clasificador de rol (lib/roster/): completo y validado. 12 tests Vitest (11 casos borde + 1 golden contra reference/salida_julio_2026.txt), confirmado día por día contra el rol real de julio de Pablo.
- Filtrado de privacidad iFlight (firma X-APPLE-CREATOR-IDENTITY): implementado; lo que no matchea se descarta en memoria, nunca se persiste ni se loguea.
- Esquema Supabase: aplicado en el proyecto remoto real (households, members, roster_connections, availability_days, availability_overrides, fixed_schedules, recurring_activities, shopping_lists, shopping_items).
- RLS: activo en todas las tablas, aislamiento por household_id verificado con test real de dos hogares. Función current_household_id() + trigger que blinda la transición de members.user_id.
- Cliente Supabase tipado (lib/supabase/): client, server, admin (service_role, server-only), proxy.ts — completo.
- Auth: pantalla única de login/registro (email+contraseña y Google) cableada a Supabase Auth, con errores traducidos a español. Callback de OAuth (app/auth/callback) funcionando. Routing post-login centralizado (lib/supabase/post-login-redirect.ts): hogar existente → home, si no → onboarding.
- Onboarding y home: solo placeholders con guarda de acceso (sin sesión → /login, sin hogar → /onboarding). Falta el flujo real de creación de hogar y las pantallas del producto.
- Sistema de diseño: tokens de DESIGN.md (paleta #284B63/#A7C4A0/#F2B94B, Manrope/Inter) aplicados globalmente en globals.css/layout.tsx.

## Sesión anterior
- Se construyó la pantalla de auth sobre los bloques shadcn existentes (Card+Field, centrado, mobile-first), fusionando login y registro en un solo componente con toggle interno.
- Se cableó a Supabase Auth: signUp, signInWithPassword, signInWithOAuth('google'), con manejo de correo-sin-confirmar y errores legibles.
- Se creó el routing post-login centralizado (getPostLoginRedirect), reusado por el login con email, el callback de OAuth y las guardas de app/(app) y app/onboarding.
- Se aplicaron los tokens de DESIGN.md al sistema de diseño global y se reemplazó el app/page.tsx boilerplate de Next.js por app/(app)/page.tsx.
- Se verificó con build + tsc + eslint + curl contra el dev server (contenido de /login, redirects de las guardas); no se probó signUp/Google OAuth real contra el proyecto Supabase remoto para no crear usuarios de prueba ahí.

## Decisiones técnicas
- Ingesta del rol por feed iCal secreto de Google Calendar, no por OAuth de Calendar API, para evitar el proceso de verificación de Google. El export estático de la app iFlight se descartó porque no se actualiza ante cambios de rol. Cron de sync 2-4x/día.
- El override manual gana sobre el estado clasificado hasta que el usuario lo quite o cambie el evento subyacente; esa regla vive en la lógica de app/cron, no en la base de datos.
- Un usuario, un hogar en el MVP (members.unique(user_id) sobre los valores no nulos).
- Next.js 16 tiene breaking changes relevantes: el middleware se llama proxy.ts (no middleware.ts) y cookies() es async — no asumir la API de versiones anteriores.
- No hay Docker en este entorno: el proyecto Supabase es remoto, no local. Los cambios de esquema se aplican con `supabase db push` directo contra la base real, nunca con `supabase start`.
- El routing "¿tiene hogar?" vive en UNA sola función (lib/supabase/post-login-redirect.ts). Cualquier nuevo punto de entrada de auth debe reusarla, no duplicar la consulta a members.
- Las acciones interactivas de auth (signUp/signInWithPassword/signInWithOAuth) se llaman desde el cliente de browser (lib/supabase/client.ts), no vía Server Actions — patrón oficial de Supabase SSR, decisión explícita.
- Alcance del MVP: disponibilidad familiar (segmento de entrada, rol irregular) + actividades recurrentes y lista de compras (segmento de retención, horario normal). Reuniones vía OAuth de Calendar personal y georreferenciación quedan fuera del MVP. Asesora del hogar y minuta semanal son ideas a futuro.

## Pendientes priorizados
- [ ] Onboarding real: crear hogar → tipo de horario propio → configurar según tipo (iCal si variable / bloques por día si fijo) → invitar integrantes (con o sin cuenta). Auth y routing base ya están listos.
- [ ] Probar el flujo de auth (signUp, login, Google OAuth) con una cuenta real contra el proyecto Supabase remoto — no se hizo de forma automática por ser el proyecto real.
- [ ] Cron de ingesta y clasificación del rol sobre roster_connections.
- [ ] Flujo de vinculación de cuenta para un perfil sin login que luego se registra (dispara el update de user_id, ya blindado por trigger).
- [ ] Pantallas del producto: calendario familiar, actividades recurrentes, lista de compras (home real, hoy placeholder).

## Problemas conocidos
- Este entorno no tiene chromium-cli ni Playwright instalados: la UI se verifica con build/tsc/eslint y curl contra el HTML server-rendered, no con screenshots reales de browser.
