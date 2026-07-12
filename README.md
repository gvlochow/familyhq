# FamilyHQ

App PWA de organización familiar. El diferenciador de entrada: traduce el rol de
trabajo irregular de tripulación aérea (LATAM, vía **iFlight NEO**) en un
calendario familiar legible — **en casa / fuera / standby / por confirmar** —, y
suma las funciones de uso diario que sostienen el hábito: actividades recurrentes
y lista de compras compartida.

Dos segmentos: hogares con rol irregular (entrada) y hogares de horario normal
(retención).

---

## Stack

- **Next.js 16** (App Router) + **TypeScript** estricto
- **Tailwind CSS** + **shadcn/ui**
- **Supabase** — Postgres + Auth + RLS (multi-tenant real por `household_id`)
- **Vercel** (deploy + Cron)
- **Vitest** (tests)
- **pnpm** (gestor de paquetes — no usar npm ni yarn)

> ⚠️ Next.js 16 tiene breaking changes: el middleware se llama `proxy.ts` (no
> `middleware.ts`) y `cookies()` es async. Ver `AGENTS.md`.

---

## Puesta en marcha

Requiere Node 20+ y pnpm.

```bash
# 1. Instalar dependencias
pnpm install

# 2. Configurar variables de entorno
cp .env.example .env.local
#    y completar los valores (ver "Variables de entorno")

# 3. Levantar el entorno de desarrollo
pnpm dev            # http://localhost:3000
```

### Scripts

| Comando | Qué hace |
|---|---|
| `pnpm dev` | Servidor de desarrollo (Turbopack) |
| `pnpm build` | Build de producción |
| `pnpm start` | Sirve el build de producción |
| `pnpm test` | Tests con Vitest |
| `pnpm lint` | ESLint |

---

## Variables de entorno

Todas se declaran en `.env.example`. `.env.local` está gitignored — nunca se
commitea.

| Variable | Uso |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL del proyecto Supabase |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Clave anónima (cliente, sujeta a RLS) |
| `SUPABASE_SERVICE_ROLE_KEY` | Clave service_role — solo servidor, salta RLS. Usada por el cron de ingesta |
| `ICAL_ENCRYPTION_KEY` | Clave AES-256 (32 bytes en base64) para cifrar la URL secreta del feed iCal |
| `CRON_SECRET` | Protege el endpoint del cron de ingesta |

Generar las claves:

```bash
# ICAL_ENCRYPTION_KEY (32 bytes base64)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# CRON_SECRET (hex)
node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"
```

> `ICAL_ENCRYPTION_KEY` debe ser **la misma en todos los entornos** y estable en
> el tiempo: si se pierde o cambia, las URLs ya cifradas quedan irrecuperables.

---

## Estructura

```
app/                  Rutas (App Router)
  (app)/              Área autenticada (home = panel de disponibilidad)
  onboarding/         Flujo de alta (crear hogar → tipo de horario → configuración)
  auth/callback/      Callback de OAuth
  api/cron/roster/    Cron de ingesta y clasificación del rol
components/           Componentes de UI (ui/ = shadcn; home/, onboarding/)
lib/
  roster/             Clasificador de rol iFlight → estado familiar (dominio puro)
  availability/       Modelo de vista del panel de disponibilidad (dominio puro)
  crypto/             Cifrado de secretos (AES-256-GCM, server-only)
  members/            Tipos de dominio de integrantes/horario
  supabase/           Clientes (browser, server, admin) + routing post-login
supabase/migrations/  Esquema como código (versionado)
reference/            Fuente de verdad del clasificador (gitignored parcial)
```

La **lógica de dominio** (`lib/roster`, `lib/availability`) es pura: sin
dependencias de Next.js ni Supabase, y cubierta por tests.

---

## Base de datos y migraciones

Las migraciones viven en `supabase/migrations/` **como código** (versionadas en
el repo), nunca editadas desde el dashboard. El CLI de Supabase es una
devDependency (se invoca con `pnpm supabase`).

```bash
# Aplicar migraciones al proyecto remoto vinculado
pnpm supabase db push --linked

# Regenerar los tipos TypeScript desde el esquema
pnpm supabase gen types typescript --linked > lib/database.types.ts
```

**Multi-tenant desde el día uno:** todo dato lleva `household_id` y hay RLS que
aísla cada hogar; ningún hogar ve datos de otro.

---

## Privacidad (Ley 19.628 — no negociable)

El feed de calendario del usuario incluye su calendario personal completo. La app
**solo procesa** eventos con la firma de iFlight
(`X-APPLE-CREATOR-IDENTITY` con `com.ibsplc.iflight.crew.mobility`).

- Todo evento sin esa firma se descarta **en memoria**. Nunca se persiste en la
  base, nunca se loguea, ni siquiera transitoriamente.
- La URL secreta del calendario se guarda **cifrada** (AES-256-GCM en la app),
  asociada al `user_id`.

---

## Manejo de fechas

- Timezone **siempre IANA `America/Santiago`**, nunca offset fijo (el rol cruza
  el cambio de hora de Chile).
- Las horas del feed vienen en UTC (con `Z`).
- El clasificador de rol está validado contra datos reales
  (`reference/salida_julio_2026.txt`). Cualquier cambio que altere esos
  resultados es un bug, no una mejora.

---

## Cron de ingesta del rol

`app/api/cron/roster/route.ts` corre en el runtime de la app (el descifrado y el
clasificador viven ahí). Lo dispara **Vercel Cron** (`vercel.json`) con
`Authorization: Bearer $CRON_SECRET`, aunque el endpoint es agnóstico al
disparador. Por cada conexión: descifra la URL, hace un fetch del feed, clasifica
la ventana de días y materializa `availability_days` respetando las correcciones
manuales (overrides).

> Vercel Cron en plan Hobby corre 1×/día como máximo; para mayor frecuencia se
> necesita plan Pro o un scheduler externo.

---

## Documentación del proyecto

- **`CLAUDE.md`** — contexto y reglas no negociables (privacidad, fechas, alcance).
- **`DESIGN.md`** — sistema de diseño (paleta, tipografía, principios de UI).
- **`PROJECT_LOG.md`** — bitácora de estado, decisiones técnicas y pendientes.
