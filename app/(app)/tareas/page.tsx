import { ListTodoIcon } from "lucide-react"

// Placeholder: acá vivirán las actividades recurrentes y la lista de compras
// compartida (funciones de uso diario). Ver Pendientes en PROJECT_LOG.
export default function TareasPage() {
  return (
    <main className="mx-auto flex min-h-svh w-full max-w-sm flex-col gap-5 px-6 pt-8 pb-28">
      <h1 className="font-heading text-2xl font-semibold text-foreground">Tareas</h1>

      <div className="flex flex-1 flex-col items-center justify-center gap-3 text-center">
        <span
          className="flex size-12 items-center justify-center rounded-xl bg-muted text-muted-foreground"
          aria-hidden
        >
          <ListTodoIcon className="size-6" />
        </span>
        <p className="max-w-xs text-sm text-muted-foreground">
          Pronto vas a poder llevar acá las actividades recurrentes del hogar y la
          lista de compras compartida.
        </p>
      </div>
    </main>
  )
}
