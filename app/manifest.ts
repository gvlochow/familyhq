import type { MetadataRoute } from "next"

/**
 * Manifest de la PWA. Next lo sirve en /manifest.webmanifest e inyecta el
 * <link rel="manifest"> automáticamente (no hay que enlazarlo a mano). Junto con
 * el service worker (public/sw.js) y HTTPS, hace la app instalable.
 */
export default function manifest(): MetadataRoute.Manifest {
  return {
    name: "FamilyHQ",
    short_name: "FamilyHQ",
    description: "El centro de operaciones del hogar.",
    start_url: "/",
    scope: "/",
    display: "standalone",
    lang: "es",
    dir: "ltr",
    background_color: "#ffffff",
    theme_color: "#284b63",
    icons: [
      { src: "/icons/icon-192.png", sizes: "192x192", type: "image/png", purpose: "any" },
      { src: "/icons/icon-512.png", sizes: "512x512", type: "image/png", purpose: "any" },
      { src: "/icons/icon-maskable-512.png", sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  }
}
