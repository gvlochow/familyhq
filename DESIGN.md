# FamilyHQ — Sistema de diseño

## Concepto
El centro de operaciones del hogar. Personalidad: calma, confianza, claridad.

## Paleta
Paleta base "Puerto" (tema por defecto):
- Primario:   #284B63 (azul profundo)
- Secundario: #A7C4A0 (verde salvia) — SOLO en superficies/fondos suaves,
              nunca como texto (bajo contraste)
- Acento:     #F2B94B (ámbar) — máximo ~10% de la superficie
- Fondo:      #FAFBFC
- Texto:      #1E2933

## Temas y modo oscuro
- 3 temas (paletas): Puerto (azul, default), Bosque (verde), Ciruela (cálido).
  Cada uno con variante clara y oscura. Modo: Claro / Oscuro / Sistema.
- Los roles de color anteriores (primario/secundario/acento) valen para TODOS
  los temas: cambia el hex, no el significado. Secundario sigue siendo solo
  superficie; acento sigue siendo la identidad de "Blanco / por confirmar".
- Los tokens viven en app/globals.css (`:root`/`.dark`/`[data-theme]`). Los
  componentes SIEMPRE consumen tokens (bg-primary, text-foreground, border-
  border, bg-card, bg-muted...), NUNCA colores fijos, para heredar tema y modo.
  Excepción válida: overlays translúcidos (bg-white/x, bg-black/x) con su
  contraparte dark: cuando haga falta.
- Preferencia POR DISPOSITIVO (localStorage), no del hogar. Se elige en Ajustes
  → Apariencia. Ver components/theme/ y lib/theme/.

## Tipografía
- Títulos y números: Manrope
- Cuerpo: Inter

## Logo
Isotipo "HQ" en cuadrado redondeado. En la app va como ícono pequeño y
discreto en el header, no protagonista.

## Principios de UI (validados en mockups)
- Panel de disponibilidad: estado ACTUAL en grande ("Pablo: fuera hasta el
  sáb 15:00"), el resto de la semana en menor peso. No es una tabla de
  eventos.
- "Por confirmar" (Blank) es una categoría visual propia: color/ícono
  distinto (ámbar + reloj de arena), NO una variación de tono de en-casa
  ni de fuera. Tres estados = tres tratamientos visuales distintos.
- Ningún campo de configuración empieza vacío (buffers precargados 90/45).
- Estados vacíos proponen la acción, no anuncian ausencia.
- Onboarding no empieza en 0% si ya hubo pasos previos.
- Uso desde el celular con una mano: acciones frecuentes en el tercio
  inferior. Tab bar (4 destinos de uso diario): Inicio, Calendario, Tareas,
  Compras. Ajustes NO va en el tab bar (uso ocasional): vive en un cajón
  lateral que abre un engranaje en el header de cada página
  (components/nav/ajustes-launcher.tsx). El cajón es un menú liviano (identidad
  del hogar, enlace a la página completa de Ajustes, compartir, cerrar sesión).
- Lista de compras y recurrentes a un toque desde el home/tab bar (son las
  funciones de uso diario que sostienen el hábito).

  ## Logo
Isotipo "HQ" en cuadrado redondeado. Archivo: public/brand/Logo_flat.png
(referenciar como /brand/Logo_flat.png). En la app va como ícono pequeño y
discreto en el header, no protagonista.