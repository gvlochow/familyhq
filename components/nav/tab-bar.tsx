"use client"

import Link from "next/link"
import { usePathname } from "next/navigation"
import {
  CalendarDaysIcon,
  HouseIcon,
  ListTodoIcon,
  SettingsIcon,
  ShoppingCartIcon,
} from "lucide-react"

import { cn } from "@/lib/utils"

/**
 * Barra de navegación inferior de la app autenticada (DESIGN.md: Inicio,
 * Calendario, Tareas, Compras, Ajustes; acciones al alcance del pulgar). Fija
 * abajo, ancho de la app (max-w-sm) centrado. El item activo se resuelve por la ruta.
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
                className={cn(
                  "flex flex-col items-center gap-1 rounded-lg py-1.5 text-[11px] font-medium transition-colors",
                  activo
                    ? "text-primary"
                    : "text-muted-foreground hover:text-foreground",
                )}
              >
                <Icono className="size-5" aria-hidden />
                {label}
              </Link>
            </li>
          )
        })}
      </ul>
    </nav>
  )
}
