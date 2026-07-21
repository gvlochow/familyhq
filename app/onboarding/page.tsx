import Link from "next/link"
import Image from "next/image"
import { redirect } from "next/navigation"
import { HomeIcon, UsersIcon } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import {
  ONBOARDING_ROUTE,
  ONBOARDING_CREAR_ROUTE,
  ONBOARDING_UNIRSE_ROUTE,
  getPostLoginRedirect,
} from "@/lib/supabase/post-login-redirect"

// Primer paso del onboarding: elegir entre CREAR un hogar o UNIRSE a uno
// existente. La guarda usa el routing central: sin sesión -> login; si ya avanzó
// (tiene hogar o solicitud pendiente) -> su destino real.
export default async function OnboardingPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  if (!user) {
    redirect("/login")
  }

  const destino = await getPostLoginRedirect(supabase)
  if (destino !== ONBOARDING_ROUTE) {
    redirect(destino)
  }

  return (
    <main className="bg-background">
      <div className="mx-auto flex min-h-svh w-full max-w-sm flex-col px-6 pt-8 pb-10">
        <header className="flex items-center justify-center gap-2">
          <Image
            src="/brand/Logo_flat.png"
            alt="FamilyHQ"
            width={32}
            height={32}
            className="rounded-lg"
            priority
          />
          <span className="font-heading text-base font-semibold text-foreground">
            FamilyHQ
          </span>
        </header>

        <div className="flex flex-1 flex-col justify-center gap-6 py-10">
          <div className="flex flex-col gap-2 text-center">
            <h1 className="font-heading text-2xl font-semibold text-foreground">
              ¿Empezamos tu hogar o te unes a uno?
            </h1>
            <p className="text-muted-foreground">
              Si alguien de tu familia ya creó el hogar, únete con su código. Si
              no, crea el tuyo.
            </p>
          </div>

          <div className="flex flex-col gap-3">
            <Link
              href={ONBOARDING_CREAR_ROUTE}
              className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary"
                aria-hidden
              >
                <HomeIcon className="size-5" />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-heading text-sm font-semibold text-foreground">
                  Crear un hogar
                </span>
                <span className="text-sm text-muted-foreground">
                  Empieza de cero e invita a tu familia después.
                </span>
              </span>
            </Link>

            <Link
              href={ONBOARDING_UNIRSE_ROUTE}
              className="flex items-start gap-3 rounded-xl border border-border bg-background p-4 text-left transition-colors hover:bg-muted focus-visible:border-ring focus-visible:ring-3 focus-visible:ring-ring/50 focus-visible:outline-none"
            >
              <span
                className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-lg bg-muted text-muted-foreground"
                aria-hidden
              >
                <UsersIcon className="size-5" />
              </span>
              <span className="flex flex-1 flex-col gap-0.5">
                <span className="font-heading text-sm font-semibold text-foreground">
                  Unirme a un hogar
                </span>
                <span className="text-sm text-muted-foreground">
                  Ingresa el código que te compartieron para pedir el ingreso.
                </span>
              </span>
            </Link>
          </div>
        </div>
      </div>
    </main>
  )
}
