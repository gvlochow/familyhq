"use client"

import { useEffect } from "react"

/**
 * Registra el service worker (public/sw.js) una vez, del lado del cliente. Solo en
 * PRODUCCIÓN: en dev el HMR de Next y un SW cacheando pelean. No renderiza nada.
 *
 * El SW da la instalabilidad (junto con el manifest) + un offline básico; NUNCA
 * cachea datos personales (ver public/sw.js).
 */
export function RegisterSW() {
  useEffect(() => {
    if (process.env.NODE_ENV !== "production") return
    if (!("serviceWorker" in navigator)) return
    navigator.serviceWorker.register("/sw.js").catch(() => {
      // Silencioso: sin SW la app sigue funcionando, solo no es instalable/offline.
    })
  }, [])

  return null
}
