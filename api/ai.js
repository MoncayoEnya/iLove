// Vercel serverless function: /api/ai
//
// Generates the daily "question of the day" and fresh date ideas with Groq
// (https://console.groq.com). It runs on Vercel's servers, so the Groq API
// key never ships to the browser — anyone could copy it from there.
//
// Setup (one time):
//   1. Get a key at https://console.groq.com/keys
//   2. Vercel → your project → Settings → Environment Variables:
//        GROQ_API_KEY = gsk_...            (required)
//        GROQ_MODEL   = llama-3.3-70b-versatile   (optional, this is the default)
//        ALLOWED_ORIGINS = https://your-site.vercel.app   (optional, extra lock)
//   3. Redeploy.
//
// The browser can only ask for the two fixed things below ("question" or
// "dateIdeas"); it can't send its own prompt, so this endpoint can't be
// used as a free general-purpose AI proxy by someone else.

const GROQ_URL = 'https://api.groq.com/openai/v1/chat/completions'
const DEFAULT_MODEL = 'llama-3.3-70b-versatile'
const FALLBACK_MODELS = ['llama-3.1-8b-instant', 'openai/gpt-oss-20b']

// Best-effort per-instance rate limit (serverless instances are short-lived,
// so this just stops accidental loops / casual abuse).
const hits = new Map()
function rateLimited(ip) {
  const now = Date.now()
  const windowMs = 60 * 1000
  const list = (hits.get(ip) || []).filter((t) => now - t < windowMs)
  list.push(now)
  hits.set(ip, list)
  return list.length > 20
}

function setCors(req, res) {
  const origin = req.headers.origin || ''
  const allowed = (process.env.ALLOWED_ORIGINS || '')
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
  const isLocal = /^http:\/\/(localhost|127\.0\.0\.1)(:\d+)?$/.test(origin)
  if (origin && (isLocal || allowed.includes(origin) || allowed.length === 0)) {
    res.setHeader('Access-Control-Allow-Origin', origin)
    res.setHeader('Vary', 'Origin')
  }
  res.setHeader('Access-Control-Allow-Methods', 'POST, OPTIONS')
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type')
}

const clean = (s, max = 200) => String(s || '').replace(/\s+/g, ' ').trim().slice(0, max)

function buildPrompt(type, body) {
  if (type === 'question') {
    const recent = (Array.isArray(body.recent) ? body.recent : []).slice(0, 30).map((q) => clean(q))
    return {
      system:
        'You write one "question of the day" for a couple app. Both partners answer it, then see each other\'s answer. ' +
        'Questions are warm, playful or reflective, easy to answer in a sentence or two, never sexual, never about money troubles, ' +
        'breakups, exes, or anything that could start a fight. Vary the style: memories, dreams, fun hypotheticals, appreciation, little preferences. ' +
        'Reply with JSON only: {"question": "..."}',
      user:
        `Write today's question (max 120 characters, one question mark).` +
        (recent.length ? `\nDo not repeat or closely resemble these recent ones:\n- ${recent.join('\n- ')}` : ''),
      temperature: 1.0,
    }
  }
  if (type === 'dateIdeas') {
    const p = body.prefs || {}
    const pick = (v, ok, d) => (ok.includes(v) ? v : d)
    const time = pick(p.time, ['tonight', 'weekend'], 'tonight')
    const energy = pick(p.energy, ['easy', 'active'], 'easy')
    const cost = pick(p.cost, ['low', 'any'], 'low')
    const setting = pick(p.setting, ['inside', 'outside'], 'inside')
    const existing = (Array.isArray(body.existing) ? body.existing : []).slice(-25).map((t) => clean(t, 70))
    return {
      system:
        'You suggest date ideas for a couple app. Ideas are specific and fun, one short line each (max 70 characters), ' +
        'start with a verb, no emojis. Tags must come only from: indoor, outdoor, low-budget, food, movies, adventure, study, surprise. ' +
        'Reply with JSON only: {"ideas": [{"title": "...", "tags": ["..."]}]}',
      user:
        `Give 3 date ideas for: time=${time}, energy=${energy}, cost=${cost === 'low' ? 'cheap or free' : 'any budget'}, setting=${setting}.` +
        (existing.length ? `\nThey already have these, so suggest different ones:\n- ${existing.join('\n- ')}` : ''),
      temperature: 0.95,
    }
  }
  return null
}

const ALLOWED_TAGS = new Set(['indoor', 'outdoor', 'low-budget', 'food', 'movies', 'adventure', 'study', 'surprise'])

function shapeResult(type, data) {
  if (type === 'question') {
    const q = clean(data?.question, 160)
    if (!q || q.length < 8) throw new Error('empty question')
    return { question: q.endsWith('?') ? q : `${q.replace(/[.!]+$/, '')}?` }
  }
  const ideas = (Array.isArray(data?.ideas) ? data.ideas : [])
    .map((i) => ({
      title: clean(i?.title, 90).replace(/[.]+$/, ''),
      tags: (Array.isArray(i?.tags) ? i.tags : []).map((t) => String(t).toLowerCase()).filter((t) => ALLOWED_TAGS.has(t)).slice(0, 3),
    }))
    .filter((i) => i.title.length > 3)
    .slice(0, 3)
  if (!ideas.length) throw new Error('no ideas')
  return { ideas }
}

export default async function handler(req, res) {
  setCors(req, res)
  if (req.method === 'OPTIONS') return res.status(204).end()

  // Self-check: open https://<your-site>/api/ai?check=1 in a browser to see
  // whether the key is set up and Groq accepts it. Never reveals the key.
  if (req.method === 'GET' && 'check' in (req.query || {})) {
    const raw = process.env.GROQ_API_KEY || ''
    const k = raw.trim()
    const report = {
      keyPresent: !!k,
      keyStartsWithGsk: k.startsWith('gsk_'),
      keyLength: k.length,
      keyHadExtraSpaces: raw !== k,
      model: process.env.GROQ_MODEL || DEFAULT_MODEL,
      node: process.version,
    }
    if (k && typeof fetch === 'function') {
      try {
        const r = await fetch('https://api.groq.com/openai/v1/models', { headers: { Authorization: `Bearer ${k}` } })
        report.groqStatus = r.status
        const body = await r.json().catch(() => ({}))
        if (r.ok) {
          const ids = (body.data || []).map((m) => m.id)
          report.groqKeyWorks = true
          report.modelAvailable = ids.includes(report.model)
          report.someModels = ids.filter((id) => /llama|gpt-oss|qwen|gemma/i.test(id)).slice(0, 12)
        } else {
          report.groqKeyWorks = false
          report.groqMessage = body?.error?.message || 'unknown'
        }
      } catch (e) {
        report.groqError = String(e?.message || e)
      }
    }
    res.setHeader('Cache-Control', 'no-store')
    return res.status(200).json(report)
  }

  if (req.method !== 'POST') return res.status(405).json({ error: 'POST only' })

  const key = process.env.GROQ_API_KEY
  if (!key) return res.status(503).json({ error: 'AI is not set up yet (GROQ_API_KEY missing).' })

  const ip = String(req.headers['x-forwarded-for'] || '').split(',')[0] || 'unknown'
  if (rateLimited(ip)) return res.status(429).json({ error: 'Slow down a little.' })

  let body = req.body
  if (typeof body === 'string') {
    try {
      body = JSON.parse(body)
    } catch {
      body = {}
    }
  }
  const type = body?.type
  const prompt = buildPrompt(type, body || {})
  if (!prompt) return res.status(400).json({ error: 'Unknown request type.' })

  if (typeof fetch !== 'function') {
    return res.status(500).json({ error: 'Server Node.js is too old (needs 18+). Set Node 20 in Vercel → Settings → General.' })
  }

  // Try the chosen model first, then two other free Groq models, so one
  // model being renamed/retired on Groq's side doesn't break the feature.
  const models = [...new Set([process.env.GROQ_MODEL || DEFAULT_MODEL, ...FALLBACK_MODELS])]
  let lastProblem = ''
  const problems = []
  for (const model of models) {
    for (const jsonMode of [true, false]) {
      try {
        const r = await fetch(GROQ_URL, {
          method: 'POST',
          headers: { Authorization: `Bearer ${key.trim()}`, 'Content-Type': 'application/json' },
          body: JSON.stringify({
            model,
            temperature: prompt.temperature,
            // gpt-oss models "think" first; give them room and keep the
            // thinking short so the actual answer isn't cut off.
            ...(model.startsWith('openai/gpt-oss')
              ? { max_tokens: 2000, reasoning_effort: 'low' }
              : { max_tokens: 350 }),
            ...(jsonMode ? { response_format: { type: 'json_object' } } : {}),
            messages: [
              { role: 'system', content: prompt.system },
              { role: 'user', content: prompt.user },
            ],
          }),
        })
        if (!r.ok) {
          const detail = await r.text().catch(() => '')
          let msg = detail
          try {
            msg = JSON.parse(detail)?.error?.message || detail
          } catch {
            /* keep raw text */
          }
          lastProblem = `Groq ${r.status} (${model}): ${String(msg).slice(0, 160)}`
          problems.push(`${model}: ${r.status}`)
          console.error(lastProblem)
          // A bad key won't be fixed by another model — stop and say so.
          if (r.status === 401 || r.status === 403) {
            return res.status(502).json({ error: lastProblem })
          }
          // Rate limited: each Groq model has its own free limit, so skip
          // straight to the next (smaller, higher-limit) model.
          if (r.status === 429) break
          continue // try without JSON mode / next model
        }
        const json = await r.json()
        const content = json?.choices?.[0]?.message?.content || ''
        if (!content.trim()) {
          lastProblem = `${model}: empty reply`
          problems.push(lastProblem)
          continue
        }
        // Pull the JSON object out even if the model wrapped it in text.
        const match = content.match(/\{[\s\S]*\}/)
        const result = shapeResult(type, JSON.parse(match ? match[0] : content))
        res.setHeader('Cache-Control', 'no-store')
        return res.status(200).json(result)
      } catch (e) {
        lastProblem = `${model}: ${e?.message || e}`
        problems.push(lastProblem)
        console.error('AI attempt failed', lastProblem)
      }
    }
  }
  // Mostly "busy" (429) across models -> friendly retry message.
  const limited = problems.filter((p) => /: 429/.test(p)).length >= Math.max(1, models.length - 1)
  return res
    .status(limited ? 429 : 502)
    .json({
      error: limited
        ? 'The free AI needs a short breather. Try again in a minute.'
        : problems.length
        ? `AI failed (${[...new Set(problems)].slice(0, 4).join('; ')})`
        : 'Could not get an answer from the AI.',
    })
}