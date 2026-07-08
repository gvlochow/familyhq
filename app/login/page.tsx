import Image from "next/image"

import { AuthForm } from "@/components/auth-form"

const ERRORES_CALLBACK: Record<string, string> = {
  auth_callback_failed:
    "No se pudo completar el inicio de sesión con Google. Intenta de nuevo.",
}

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>
}) {
  const { error } = await searchParams
  const initialError = error ? ERRORES_CALLBACK[error] : undefined

  return (
    <div className="flex min-h-svh flex-col items-center justify-center gap-6 bg-background p-6 md:p-10">
      <div className="flex w-full max-w-sm flex-col gap-6">
        <div className="flex items-center justify-center gap-2">
          <Image
            src="/brand/Logo_flat.png"
            alt="FamilyHQ"
            width={40}
            height={40}
            className="rounded-lg"
            priority
          />
          <span className="font-heading text-lg font-semibold text-foreground">
            FamilyHQ
          </span>
        </div>
        <AuthForm initialError={initialError} />
      </div>
    </div>
  )
}
