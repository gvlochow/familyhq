import Link from "next/link"
import { ChevronLeftIcon } from "lucide-react"

/** Enlace "Volver" al paso anterior del onboarding. Se ubica arriba del header. */
export function OnboardingBackLink({ href }: { href: string }) {
  return (
    <Link
      href={href}
      className="flex items-center gap-1 self-start text-sm font-medium text-muted-foreground transition-colors hover:text-foreground"
    >
      <ChevronLeftIcon className="size-4" aria-hidden />
      Volver
    </Link>
  )
}
