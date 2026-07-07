# CLAUDE.md

## Contexto del proyecto
[Completar al iniciar el proyecto real: qué hace la app, quién la usa]

## Stack
Next.js (App Router) + TypeScript, Tailwind + shadcn/ui, Supabase (Postgres + Auth + RLS), Vercel, GitHub.

## Convenciones
- Migraciones de Supabase como código (`supabase migration new`), nunca desde el dashboard.
- Componentes de shadcn se agregan con `npx shadcn@latest add <componente>`, no se escriben a mano si ya existen.
- Testing: Vitest, tests junto al archivo que testean (`archivo.ts` → `archivo.test.ts` al lado).

## Bitácora de sesión
Al cerrar cada sesión de trabajo, usar el skill project-log
(C:\Users\gvloc\claude-skills\project-log\SKILL.md) para generar o
actualizar PROJECT_LOG.md con el estado del proyecto.

## Diseño
Ver DESIGN.md para paleta, tipografía y pantallas clave.