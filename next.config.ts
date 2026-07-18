import type { NextConfig } from "next";

const esDesarrollo = process.env.NODE_ENV === "development";

/**
 * Content-Security-Policy.
 *
 * Se despliega primero en modo Report-Only (ver `cabecerasSeguridad`) para
 * detectar rupturas reales antes de forzarla. Notas por directiva:
 *
 * - script-src: Next.js inyecta scripts inline (hidratación, flight data) sin
 *   nonce, por eso 'unsafe-inline'. En desarrollo, React Refresh además evalúa
 *   código, de ahí 'unsafe-eval' solo ahí.
 * - style-src: 'unsafe-inline' es necesario para los estilos inline de Next y
 *   las variables CSS que inyecta next/font.
 * - font-src / img-src: next/font autoaloja las fuentes en build y las
 *   imágenes son locales, así que basta 'self' (+ data:/blob: para next/image).
 * - connect-src: Supabase (REST, Auth y Realtime vía wss).
 * - frame-ancestors 'none': antiframing, refuerza X-Frame-Options y cubre a
 *   los navegadores que ya no honran esa cabecera.
 */
const csp = [
  "default-src 'self'",
  `script-src 'self' 'unsafe-inline'${esDesarrollo ? " 'unsafe-eval'" : ""}`,
  "style-src 'self' 'unsafe-inline'",
  "img-src 'self' data: blob:",
  "font-src 'self' data:",
  "connect-src 'self' https://*.supabase.co wss://*.supabase.co",
  "manifest-src 'self'",
  "worker-src 'self'",
  "object-src 'none'",
  "base-uri 'self'",
  "form-action 'self'",
  "frame-ancestors 'none'",
  "upgrade-insecure-requests",
].join("; ");

const cabecerasSeguridad = [
  // La app nunca debe ser enmarcada: evita clickjacking sobre las Server Actions.
  { key: "X-Frame-Options", value: "DENY" },
  { key: "X-Content-Type-Options", value: "nosniff" },
  { key: "Referrer-Policy", value: "strict-origin-when-cross-origin" },
  // Geolocalización descartada por diseño (privacidad); cámara y micrófono no se usan.
  {
    key: "Permissions-Policy",
    value: "geolocation=(), camera=(), microphone=(), interest-cohort=()",
  },
  {
    key: "Strict-Transport-Security",
    value: "max-age=63072000; includeSubDomains; preload",
  },
  // TODO(cabeceras): tras validar los reportes en producción, cambiar la clave
  // a "Content-Security-Policy" para forzarla.
  { key: "Content-Security-Policy-Report-Only", value: csp },
];

const nextConfig: NextConfig = {
  async headers() {
    return [
      {
        source: "/:path*",
        headers: cabecerasSeguridad,
      },
    ];
  },
};

export default nextConfig;
