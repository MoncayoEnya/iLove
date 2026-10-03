// Talks to our own /api/ai endpoint (api/ai.js, a Vercel function that holds
// the Groq key). Never calls Groq directly from the browser.
//
// Local development: `npm run dev` doesn't run Vercel functions, so set
//   VITE_AI_API_URL=https://your-site.vercel.app/api/ai
// in your .env to use the deployed endpoint while developing. Without it
// (and with no deployment) every caller just falls back to the built-in
// lists, so the app keeps working.

const AI_URL = import.meta.env.VITE_AI_API_URL || '/api/ai'

export async function askAI(type, payload = {}, timeoutMs = 12000) {
  const ctrl = new AbortController()
  const t = setTimeout(() => ctrl.abort(), timeoutMs)
  try {
    const res = await fetch(AI_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ type, ...payload }),
      signal: ctrl.signal,
    })
    const data = await res.json().catch(() => ({}))
    if (!res.ok) throw new Error(data.error || `AI request failed (${res.status})`)
    return data
  } finally {
    clearTimeout(t)
  }
}
