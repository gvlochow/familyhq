/**
 * FamilyHQ · Service worker mínimo (manual, sin dependencias).
 *
 * Da la instalabilidad (junto con el manifest) + un offline básico. Estrategia
 * conservadora por PRIVACIDAD (Ley 19.628):
 *   - NUNCA se cachean respuestas de Supabase (otro host, cross-origin), de /api,
 *     ni el HTML de páginas autenticadas. Solo assets estáticos públicos + la
 *     página de respaldo offline.
 *
 * Al cambiar la estrategia o los assets precacheados, subir la versión de CACHE.
 */
const CACHE = "familyhq-v1"

// Assets públicos sin datos personales que precargamos para el arranque offline.
const PRECACHE = [
  "/offline.html",
  "/icons/icon-192.png",
  "/icons/icon-512.png",
  "/manifest.webmanifest",
]

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE).then((cache) => cache.addAll(PRECACHE)))
  self.skipWaiting()
})

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  )
})

/** ¿Es un asset estático público, cacheable sin exponer datos personales? */
function esAssetEstatico(url) {
  return (
    url.pathname.startsWith("/_next/static/") ||
    url.pathname.startsWith("/icons/") ||
    url.pathname.startsWith("/brand/")
  )
}

self.addEventListener("fetch", (event) => {
  const req = event.request
  if (req.method !== "GET") return

  const url = new URL(req.url)
  // Solo same-origin. Supabase y cualquier tercero quedan intactos (no los tocamos).
  if (url.origin !== self.location.origin) return
  // La API del propio dominio nunca se cachea.
  if (url.pathname.startsWith("/api/")) return

  // Assets estáticos: cache-first (son inmutables/hasheados, sin datos personales).
  if (esAssetEstatico(url)) {
    event.respondWith(
      caches.match(req).then((hit) => {
        if (hit) return hit
        return fetch(req).then((res) => {
          if (res.ok) {
            const copia = res.clone()
            caches.open(CACHE).then((cache) => cache.put(req, copia))
          }
          return res
        })
      }),
    )
    return
  }

  // Navegaciones (páginas): network-first, SIN cachear el HTML (puede ser una vista
  // autenticada). Si no hay red, servir la página de respaldo offline.
  if (req.mode === "navigate") {
    event.respondWith(fetch(req).catch(() => caches.match("/offline.html")))
    return
  }

  // El resto (mismo origen, GET, no estático) se deja pasar a la red sin cachear.
})
