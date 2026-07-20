"use client"

import { useEffect, useState } from "react"
import Link, { useLinkStatus } from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDaysIcon,
  HouseIcon,
  ListTodoIcon,
  SettingsIcon,
  ShoppingCartIcon,
  type LucideIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Barra de navegación inferior de la app autenticada (DESIGN.md: Inicio,
 * Calendario, Tareas, Compras, Ajustes; acciones al alcance del pulgar). Fija
 * abajo, ancho de la app (max-w-sm) centrado. El item activo se resuelve por la ruta.
 *
 * Feedback de navegación (para que tocar una tab se sienta instantáneo aunque el
 * Server Component tarde en llegar): cada tab usa useLinkStatus para resaltarse en
 * el mismo frame del toque y, si la espera se nota, dispara una barra de progreso
 * superior. Ver TabItem / NavProgress.
 */
const TABS = [
  { href: "/", label: "Inicio", Icono: HouseIcon },
  { href: "/calendario", label: "Calendario", Icono: CalendarDaysIcon },
  { href: "/tareas", label: "Tareas", Icono: ListTodoIcon },
  { href: "/compras", label: "Compras", Icono: ShoppingCartIcon },
  { href: "/ajustes", label: "Ajustes", Icono: SettingsIcon },
] as const

export function TabBar() {
  const pathname = usePathname()

  return (
    <nav
      aria-label="Navegación principal"
      className="fixed inset-x-0 bottom-0 z-40 border-t border-border bg-card/95 backdrop-blur"
    >
      <ul className="mx-auto flex w-full max-w-sm items-stretch justify-around px-2 pt-1.5 pb-[max(0.375rem,env(safe-area-inset-bottom))]">
        {TABS.map(({ href, label, Icono }) => {
          const activo =
            href === "/" ? pathname === "/" : pathname.startsWith(href)
          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={activo ? "page" : undefined}
                className="block rounded-lg"
              >
                <TabItem activo={activo} label={label} Icono={Icono} />
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}

/**
 * Contenido de una tab. useLinkStatus expone `pending` = la navegación de ESTE
 * Link está en curso. Con eso la tab tocada se resalta al instante (sin esperar a
 * que cargue la página; el estado `activo` derivado de la ruta recién cambia al
 * final) y, mientras carga, queda levemente atenuada.
 */
function TabItem({
  activo,
  label,
  Icono,
}: {
  activo: boolean
  label: string
  Icono: LucideIcon
}) {
  const { pending } = useLinkStatus()
  const resaltado = activo || pending

  return (
    <>
      {pending && <NavProgress />}
      <span
        className={cn(
          "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
          resaltado
            ? "text-primary"
            : "text-muted-foreground hover:text-foreground",
          pending && !activo && "opacity-70",
        )}
      >
        <Icono className="size-5" aria-hidden />
        {label}
      </span>
    </>
  )
}

/**
 * Barra de progreso superior indeterminada. La monta la tab que entró en pending y
 * se desmonta al terminar la navegación. El retardo de 120ms evita el parpadeo en
 * navegaciones instantáneas (rutas ya cacheadas por el prefetch): la barra solo
 * aparece cuando la espera es real, que es justo el caso que se sentía lento.
 */
function NavProgress() {
  const [visible, setVisible] = useState(false)
  useEffect(() => {
    const t = setTimeout(() => setVisible(true), 120)
    return () => clearTimeout(t)
  }, [])

  if (!visible) return null
  return (
    <div className="fixed inset-x-0 top-0 z-50 h-0.5 overflow-hidden" aria-hidden>
      <div className="h-full w-1/3 rounded-full bg-primary animate-[nav-progress_0.9s_ease-in-out_infinite]" />
    </div>
  )
}
