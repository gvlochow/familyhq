# PROJECT_LOG — FamilyHQ
_Última actualización: 2026-07-08_

## Estado actual
- Clasificador de rol (lib/roster/): completo y validado. 12 tests Vitest (11 casos borde + 1 golden contra reference/salida_julio_2026.txt), confirmado día por día contra el rol real de julio de Pablo.
- Filtrado de privacidad iFlight (firma X-APPLE-CREATOR-IDENTITY): implementado; lo que no matchea se descarta en memoria, nunca se persiste ni se loguea.
- Esquema Supabase: aplicado en el proyecto remoto real (households, members, roster_connections, availability_days, availability_overrides, fixed_schedules, recurring_activities, shopping_lists, shopping_items).
- RLS: activo en todas las tablas, aislamiento por household_id verificado con test real de dos hogares. Función current_household_id() + trigger que blinda la transición de members.user_id.
- Cliente Supabase tipado (lib/supabase/): client, server, admin (service_role, server-only), proxy.ts — completo.
- Auth: Google OAuth configurado (Google Cloud + Supabase, modo Testing) y email/contraseña disponible. Falta la UI/flujo de login.
- Onboarding: no iniciado.

## Sesión anterior
- Se cerró el esquema: tipo_horario en members ('ninguno'|'fijo'|'variable') + tabla fixed_schedules con su RLS.
- Se habilitaron perfiles sin cuenta propia: members.user_id nullable, más trigger que solo permite la transición null -> auth.uid() propio (nunca reasignación ni desvinculación).
- Se armó la capa de cliente Supabase tipada completa (@supabase/ssr, no el auth-helpers deprecado).
- Se verificó conexión real y aislamiento RLS con una página de prueba temporal (creada y luego borrada).
- Se configuró Google OAuth en modo Testing.

## Decisiones técnicas
- Ingesta del rol por feed iCal secreto de Google Calendar, no por OAuth de Calendar API, para evitar el proceso de verificación de Google. El export estático de la app iFlight se descartó porque no se actualiza ante cambios de rol. Cron de sync 2-4x/día.
- El override manual gana sobre el estado clasificado hasta que el usuario lo quite o cambie el evento subyacente; esa regla vive en la lógica de app/cron, no en la base de datos.
- Un usuario, un hogar en el MVP (members.unique(user_id) sobre los valores no nulos).
- Next.js 16 tiene breaking changes relevantes: el middleware se llama proxy.ts (no middleware.ts) y cookies() es async — no asumir la API de versiones anteriores.
- No hay Docker en este entorno: el proyecto Supabase es remoto, no local. Los cambios de esquema se aplican con `supabase db push` directo contra la base real, nunca con `supabase start`.
- Alcance del MVP: disponibilidad familiar (segmento de entrada, rol irregular) + actividades recurrentes y lista de compras (segmento de retención, horario normal). Reuniones vía OAuth de Calendar personal y georreferenciación quedan fuera del MVP. Asesora del hogar y minuta semanal son ideas a futuro.

## Pendientes priorizados
- [ ] Auth + onboarding: registro (email + Google) → crear hogar → definir tipo de horario propio → configurar según tipo (iCal si variable / bloques por día si fijo) → invitar integrantes (con o sin cuenta), con retoma si se abandona a mitad.
- [ ] Cron de ingesta y clasificación del rol sobre roster_connections.
- [ ] Flujo de vinculación de cuenta para un perfil sin login que luego se registra (dispara el update de user_id que ya está blindado a nivel de trigger).
- [ ] Pantallas del producto: calendario familiar, actividades recurrentes, lista de compras.

## Problemas conocidos
(ninguno registrado)
