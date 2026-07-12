import { LogOutIcon } from "lucide-react"

import { createClient } from "@/lib/supabase/server"
import { Button } from "@/components/ui/button"
import { signOut } from "./actions"

// El resto de Ajustes (buffers, integrantes, conexión del rol) llega después;
// por ahora la pantalla resuelve la sesión, que es lo que falta hoy.
export default async function AjustesPage() {
  const supabase = await createClient()
  const {
    data: { user },
  } = await supabase.auth.getUser()

  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-6 px-6 pt-8 pb-28">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Ajustes</h1>

      <section className="flex flex-col gap-3">
        <h2 className="text-sm font-medium text-muted-foreground">Sesión</h2>
        {user?.email && (
          <p className="text-sm text-foreground">
            Conectado como <span className="font-medium">{user.email}</span>
          </p>
        )}
        <form action={signOut}>
          <Button type="submit" variant="outline" size="lg" className="w-full">
            <LogOutIcon className="size-4" />
            Cerrar sesión
          </Button>
        </form>
      </section>

      <p className="text-sm text-muted-foreground">
        Pronto vas a poder ajustar acá tu hogar y tu perfil: buffers de tiempo,
        integrantes y la conexión de tu rol.
      </p>
    </main>
  )
}
