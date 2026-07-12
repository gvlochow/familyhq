import { SettingsIcon } from "lucide-react"

// Placeholder: acá irán los ajustes del hogar y del integrante (buffers de
// salida/llegada, gestión de integrantes, conexión del rol). Ver PROJECT_LOG.
export default function AjustesPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-5 px-6 pt-8 pb-28">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Ajustes</h1>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span
          className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"
          aria-hidden
        >
          <SettingsIcon className="size-6" />
        </span>
        <p className="max-w-xs text-sm text-muted-foreground">
          Pronto vas a poder ajustar acá tu hogar y tu perfil: buffers de tiempo,
          integrantes y la conexión de tu rol.
        </p>
      </div>
    </main>
  )
}
