"use client"

import { useState } from "react"
import { useRouter } from "next/navigation"
import { Loader2Icon } from "lucide-react"

import { cn } from "@/lib/utils"
import { createClient } from "@/lib/supabase/client"
import { translateAuthError } from "@/lib/supabase/auth-errors"
import { getPostLoginRedirect } from "@/lib/supabase/post-login-redirect"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import {
  Field,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
  FieldSeparator,
} from "@/components/ui/field"
import { Input } from "@/components/ui/input"

const GoogleIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" className="size-4">
    <path
      d="M12.48 10.92v3.28h7.84c-.24 1.84-.853 3.187-1.787 4.133-1.147 1.147-2.933 2.4-6.053 2.4-4.827 0-8.6-3.893-8.6-8.72s3.773-8.72 8.6-8.72c2.6 0 4.507 1.027 5.907 2.347l2.307-2.307C18.747 1.44 16.133 0 12.48 0 5.867 0 .307 5.387.307 12s5.56 12 12.173 12c3.573 0 6.267-1.173 8.373-3.36 2.16-2.16 2.84-5.213 2.84-7.667 0-.76-.053-1.467-.173-2.053H12.48z"
      fill="currentColor"
    />
  </svg>
)

type Mode = "login" | "signup"

export function AuthForm({
  className,
  initialError,
  ...props
}: React.ComponentProps<"div"> & { initialError?: string }) {
  const router = useRouter()
  const supabase = createClient()

  const [mode, setMode] = useState<Mode>("login")
  const [pending, setPending] = useState(false)
  const [pendingGoogle, setPendingGoogle] = useState(false)
  const [error, setError] = useState<string | null>(initialError ?? null)
  const [notice, setNotice] = useState<string | null>(null)

  function cambiarModo(nuevoModo: Mode) {
    setMode(nuevoModo)
    setError(null)
    setNotice(null)
  }

  async function handleGoogle() {
    setError(null)
    setNotice(null)
    setPendingGoogle(true)

    const { error } = await supabase.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${window.location.origin}/auth/callback`,
      },
    })

    if (error) {
      setError(translateAuthError(error.message))
      setPendingGoogle(false)
    }
    // Si no hay error, el browser navega a Google: no hay nada más que hacer acá.
  }

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault()
    setError(null)
    setNotice(null)

    const formData = new FormData(e.currentTarget)
    const email = String(formData.get("email") ?? "").trim()
    const password = String(formData.get("password") ?? "")

    if (mode === "signup") {
      const confirmPassword = String(formData.get("confirm-password") ?? "")
      if (password.length < 6) {
        setError("La contraseña debe tener al menos 6 caracteres.")
        return
      }
      if (password !== confirmPassword) {
        setError("Las contraseñas no coinciden.")
        return
      }
    }

    setPending(true)
    try {
      if (mode === "login") {
        const { error } = await supabase.auth.signInWithPassword({
          email,
          password,
        })
        if (error) {
          setError(translateAuthError(error.message))
          return
        }
      } else {
        const { data, error } = await supabase.auth.signUp({
          email,
          password,
          options: {
            emailRedirectTo: `${window.location.origin}/auth/callback`,
          },
        })
        if (error) {
          setError(translateAuthError(error.message))
          return
        }
        if (!data.session) {
          // Confirmación de correo activada: todavía no hay sesión.
          setNotice(
            "Te enviamos un correo para confirmar tu cuenta. Revisa tu bandeja de entrada para continuar."
          )
          return
        }
      }

      const destino = await getPostLoginRedirect(supabase)
      router.push(destino)
    } finally {
      setPending(false)
    }
  }

  const esLogin = mode === "login"

  return (
    <div className={cn("flex flex-col gap-6", className)} {...props}>
      <Card>
        <CardHeader className="text-center">
          <CardTitle className="font-heading text-xl">
            {esLogin ? "Bienvenido de vuelta" : "Crea tu cuenta"}
          </CardTitle>
          <CardDescription>
            {esLogin
              ? "Ingresa a tu cuenta de FamilyHQ"
              : "Empecemos a organizar tu hogar"}
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} key={mode}>
            <FieldGroup>
              <Field>
                <Button
                  variant="outline"
                  type="button"
                  disabled={pending || pendingGoogle}
                  onClick={handleGoogle}
                >
                  {pendingGoogle ? (
                    <Loader2Icon className="size-4 animate-spin" />
                  ) : (
                    <GoogleIcon />
                  )}
                  Continuar con Google
                </Button>
              </Field>
              <FieldSeparator className="*:data-[slot=field-separator-content]:bg-card">
                O continúa con tu correo
              </FieldSeparator>
              <Field>
                <FieldLabel htmlFor="email">Correo</FieldLabel>
                <Input
                  id="email"
                  name="email"
                  type="email"
                  placeholder="tu@correo.com"
                  autoComplete="email"
                  required
                />
              </Field>
              <Field>
                <FieldLabel htmlFor="password">Contraseña</FieldLabel>
                <Input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete={esLogin ? "current-password" : "new-password"}
                  required
                />
              </Field>
              {!esLogin && (
                <Field>
                  <FieldLabel htmlFor="confirm-password">
                    Confirma tu contraseña
                  </FieldLabel>
                  <Input
                    id="confirm-password"
                    name="confirm-password"
                    type="password"
                    autoComplete="new-password"
                    required
                  />
                  <FieldDescription>
                    Debe tener al menos 6 caracteres.
                  </FieldDescription>
                </Field>
              )}
              {error && (
                <Field>
                  <FieldError>{error}</FieldError>
                </Field>
              )}
              {notice && (
                <Field>
                  <FieldDescription role="status" className="text-primary">
                    {notice}
                  </FieldDescription>
                </Field>
              )}
              <Field>
                <Button type="submit" disabled={pending || pendingGoogle}>
                  {pending && <Loader2Icon className="size-4 animate-spin" />}
                  {esLogin
                    ? pending
                      ? "Ingresando..."
                      : "Iniciar sesión"
                    : pending
                      ? "Creando cuenta..."
                      : "Crear cuenta"}
                </Button>
                <FieldDescription className="text-center">
                  {esLogin ? (
                    <>
                      ¿No tienes cuenta?{" "}
                      <button
                        type="button"
                        className="font-medium text-primary underline underline-offset-4"
                        onClick={() => cambiarModo("signup")}
                      >
                        Regístrate
                      </button>
                    </>
                  ) : (
                    <>
                      ¿Ya tienes cuenta?{" "}
                      <button
                        type="button"
                        className="font-medium text-primary underline underline-offset-4"
                        onClick={() => cambiarModo("login")}
                      >
                        Inicia sesión
                      </button>
                    </>
                  )}
                </FieldDescription>
              </Field>
            </FieldGroup>
          </form>
        </CardContent>
      </Card>
    </div>
  )
}
