import { redirect } from "next/navigation"

import { createClient } from "@/lib/supabase/server"
import { resolverMemberObjetivo } from "@/app/_lib/permisos-integrante"
import { BuffersForm } from "@/components/ajustes/buffers-form"

/**
 * Buffers de traslado de un integrante. resolverMemberObjetivo aplica el permiso:
 * uno mismo, o un administrado del hogar si soy Responsable. Si no corresponde,
 * de vuelta a Ajustes.
 */
export default async function BuffersPage({
  params,
}: {
  params: Promise<{ memberId: string }>
}) {
  const { memberId } = await params
  const supabase = await createClient()

  const objetivo = await resolverMemberObjetivo(supabase, memberId)
  if ("error" in objetivo) redirect("/ajustes")

  const { data: m } = await supabase
    .from("members")
    .select("display_name, buffer_salida_min, buffer_llegada_min")
    .eq("id", objetivo.memberId)
    .maybeSingle()
  if (!m) redirect("/ajustes")

  return (
    <BuffersForm
      memberId={objetivo.memberId}
      nombre={m.display_name.split(" ")[0]}
      inicial={m.display_name.trim().charAt(0).toUpperCase() || "?"}
      salidaInicial={m.buffer_salida_min}
      llegadaInicial={m.buffer_llegada_min}
    />
  )
}
