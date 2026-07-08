# FamilyHQ — Contexto para Claude Code

## Qué es
App PWA de organización familiar. Diferenciador de entrada: traduce el rol
de trabajo irregular de tripulación aérea (LATAM, vía iFlight NEO) en un
calendario familiar legible (en casa / fuera / standby / por confirmar).
Funciones de uso diario: actividades recurrentes y lista de compras
compartida. Dos segmentos: hogares con rol irregular (entrada) y hogares
de horario normal (retención).

## Stack
- Next.js 16 (App Router) + TypeScript
- Tailwind + shadcn/ui
- Supabase (Postgres + Auth + RLS)
- Vercel (deploy)
- Vitest (tests)
- pnpm (gestor de paquetes — NO usar npm ni yarn)

## Convenciones de código
- TypeScript estricto. Estados y enums tipados, no strings sueltos.
- Lógica de dominio en src/lib/, sin dependencias de Next.js ni Supabase.
- Server Actions para mutaciones; nunca exponer lógica sensible al cliente.
- Migraciones de Supabase como código (CLI), versionadas en el repo, NO en
  el dashboard.
- Cada feature en su rama.

## Reglas no negociables (privacidad — Ley 19.628)
- El feed de calendario del usuario incluye su calendario personal completo.
  SOLO se procesan eventos con la firma iFlight
  (X-APPLE-CREATOR-IDENTITY con "com.ibsplc.iflight.crew.mobility").
- Todo evento sin esa firma se descarta EN MEMORIA. NUNCA se persiste en la
  base de datos, NUNCA se loguea, ni siquiera transitoriamente.
- La URL secreta del calendario se guarda cifrada, asociada al user_id.
- Multi-tenant real desde el día uno: todo dato va con household_id y RLS
  que aísla cada hogar. Ningún hogar ve datos de otro.

## Manejo de fechas (crítico)
- Timezone siempre IANA "America/Santiago", NUNCA offset fijo (-3/-4). El
  rol cruza el cambio de hora de Chile.
- Las horas del feed vienen en UTC (con Z).
- El clasificador de rol ya está validado contra datos reales. Su verdad de
  referencia es reference/salida_julio_2026.txt. Cualquier cambio que altere
  esos resultados es un bug, no una mejora.

## Qué NO hacer
- No usar geolocalización (descartada por privacidad y fragilidad en PWA).
- No implementar sync de Google Calendar personal vía OAuth (fuera del MVP).
- No trabajar sobre lectora ni PollaGol desde este repo (son otros proyectos).