import "server-only"

import {
  createCipheriv,
  createDecipheriv,
  randomBytes,
} from "node:crypto"

/**
 * Cifrado simétrico para secretos guardados en la base (hoy: la URL del feed
 * iCal del rol, roster_connections.ical_url_encrypted).
 *
 * Regla no negociable (CLAUDE.md / Ley 19.628): la URL secreta del calendario
 * se guarda cifrada, NUNCA en claro. El cifrado ocurre en la app, no en la base.
 *
 * AES-256-GCM: confidencialidad + integridad (el tag detecta manipulación). El
 * payload persistido es base64( iv[12] | authTag[16] | ciphertext ), autocontenido.
 *
 * 'server-only' hace fallar el build si esto termina en un bundle de browser: la
 * clave jamás debe salir del servidor.
 */

const ALGO = "aes-256-gcm"
const IV_BYTES = 12 // nonce recomendado para GCM
const TAG_BYTES = 16
const KEY_BYTES = 32 // AES-256

function getKey(): Buffer {
  const raw = process.env.ICAL_ENCRYPTION_KEY
  if (!raw) {
    throw new Error(
      "ICAL_ENCRYPTION_KEY no está definida. Es obligatoria para cifrar la URL del feed iCal."
    )
  }
  const key = Buffer.from(raw, "base64")
  if (key.length !== KEY_BYTES) {
    throw new Error(
      `ICAL_ENCRYPTION_KEY debe ser 32 bytes en base64 (AES-256); tiene ${key.length}.`
    )
  }
  return key
}

/** Cifra texto plano y devuelve el payload base64 autocontenido. */
export function encryptSecret(plaintext: string): string {
  const iv = randomBytes(IV_BYTES)
  const cipher = createCipheriv(ALGO, getKey(), iv)
  const ciphertext = Buffer.concat([
    cipher.update(plaintext, "utf8"),
    cipher.final(),
  ])
  const tag = cipher.getAuthTag()
  return Buffer.concat([iv, tag, ciphertext]).toString("base64")
}

/** Descifra un payload producido por encryptSecret. Lanza si fue manipulado. */
export function decryptSecret(payload: string): string {
  const buf = Buffer.from(payload, "base64")
  if (buf.length < IV_BYTES + TAG_BYTES) {
    throw new Error("Payload cifrado inválido: demasiado corto.")
  }
  const iv = buf.subarray(0, IV_BYTES)
  const tag = buf.subarray(IV_BYTES, IV_BYTES + TAG_BYTES)
  const ciphertext = buf.subarray(IV_BYTES + TAG_BYTES)
  const decipher = createDecipheriv(ALGO, getKey(), iv)
  decipher.setAuthTag(tag)
  return Buffer.concat([
    decipher.update(ciphertext),
    decipher.final(),
  ]).toString("utf8")
}
