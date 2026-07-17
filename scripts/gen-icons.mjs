/**
 * Genera los íconos de la PWA desde el logo de marca (public/brand/Logo_flat.png).
 * Se corre a mano una vez (o cuando cambie el logo); los PNG resultantes se commitean.
 * `sharp` queda solo como devDependency (no se genera nada en el build).
 *
 *   node scripts/gen-icons.mjs
 *
 * Salida en public/icons/:
 *   icon-192.png, icon-512.png        — resize directo (fondo transparente, purpose "any")
 *   icon-maskable-512.png             — logo a ~80% sobre fondo navy full-bleed (purpose "maskable")
 *   apple-touch-icon-180.png          — 180×180 sobre fondo navy (iOS no maneja bien la transparencia)
 */
import { mkdir } from "node:fs/promises"
import { fileURLToPath } from "node:url"
import path from "node:path"
import sharp from "sharp"

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..")
const SRC = path.join(ROOT, "public", "brand", "Logo_flat.png")
const OUT = path.join(ROOT, "public", "icons")

const NAVY = "#284b63" // --primary (globals.css)

/** Logo centrado a `ratio` del lienzo cuadrado `size`, sobre `background`. */
async function padded(size, ratio, background) {
  const inner = Math.round(size * ratio)
  const logo = await sharp(SRC).resize(inner, inner, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } }).toBuffer()
  const margin = Math.round((size - inner) / 2)
  return sharp({ create: { width: size, height: size, channels: 4, background } })
    .composite([{ input: logo, top: margin, left: margin }])
    .png()
}

async function main() {
  await mkdir(OUT, { recursive: true })

  // "any": el logo tal cual (ya tiene forma de ícono de app), transparente.
  for (const size of [192, 512]) {
    await sharp(SRC).resize(size, size, { fit: "contain", background: { r: 0, g: 0, b: 0, alpha: 0 } })
      .png().toFile(path.join(OUT, `icon-${size}.png`))
  }

  // "maskable": navy full-bleed + logo al 80% (safe zone para la máscara del OS).
  await (await padded(512, 0.8, NAVY)).toFile(path.join(OUT, "icon-maskable-512.png"))

  // apple-touch: navy de fondo, logo al 88%.
  await (await padded(180, 0.88, NAVY)).toFile(path.join(OUT, "apple-touch-icon-180.png"))

  console.log("Íconos generados en public/icons/")
}

main().catch((e) => {
  console.error(e)
  process.exit(1)
})
