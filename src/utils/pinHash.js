// Tiny helper for hashing a PIN with the browser's built-in Web Crypto API.
// No new dependency needed — SubtleCrypto is available in every modern
// browser. We salt with the user's uid so two people who happen to pick
// the same PIN don't end up with the same stored hash.

async function sha256Hex(text) {
  const bytes = new TextEncoder().encode(text)
  const digest = await crypto.subtle.digest('SHA-256', bytes)
  return Array.from(new Uint8Array(digest))
    .map((b) => b.toString(16).padStart(2, '0'))
    .join('')
}

export async function hashPin(uid, pin) {
  return sha256Hex(`ilovee-pin:${uid}:${pin}`)
}
