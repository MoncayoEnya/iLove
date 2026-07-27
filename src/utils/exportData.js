import { collection, getDocs } from 'firebase/firestore'
import { db } from '../firebase'

// Every subcollection under a couple's space, and how to sort it once fetched.
// (Sorting happens client-side, after fetch — not via a Firestore orderBy —
// so a doc that's missing its sort field for any reason still comes through
// instead of silently getting excluded from the export.)
const COLLECTIONS = [
  { key: 'messages', sortBy: 'createdAt' },
  { key: 'memories', sortBy: 'createdAt' },
  { key: 'checkins', sortBy: 'date' },
  { key: 'goals', sortBy: 'createdAt' },
  { key: 'tasks', sortBy: 'createdAt' },
  { key: 'conflictSessions', sortBy: 'createdAt' },
  { key: 'jar', sortBy: 'createdAt' },
  { key: 'events', sortBy: 'date' },
]

function toComparable(v) {
  if (v && typeof v.toDate === 'function') return v.toDate().getTime()
  if (typeof v === 'string') return v
  return 0
}

function serializeValue(v) {
  if (v && typeof v.toDate === 'function') return v.toDate().toISOString()
  if (Array.isArray(v)) return v.map(serializeValue)
  if (v && typeof v === 'object') {
    const out = {}
    for (const [k, val] of Object.entries(v)) out[k] = serializeValue(val)
    return out
  }
  return v
}

/** Pulls every subcollection for a couple space into one plain object, oldest first. */
export async function fetchCoupleData(coupleId) {
  const out = {}
  for (const { key, sortBy } of COLLECTIONS) {
    const snap = await getDocs(collection(db, 'couples', coupleId, key))
    const docs = snap.docs.map((d) => ({ id: d.id, ...serializeValue(d.data()) }))
    docs.sort((a, b) => (toComparable(a[sortBy]) > toComparable(b[sortBy]) ? 1 : -1))
    out[key] = docs
  }
  return out
}

function triggerDownload(blob, filename) {
  const url = URL.createObjectURL(blob)
  const a = document.createElement('a')
  a.href = url
  a.download = filename
  document.body.appendChild(a)
  a.click()
  a.remove()
  URL.revokeObjectURL(url)
}

export function downloadJSON(data, filename) {
  const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })
  triggerDownload(blob, filename)
}

export function downloadHTML(html, filename) {
  const blob = new Blob([html], { type: 'text/html' })
  triggerDownload(blob, filename)
}

function esc(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#39;',
  }[c]))
}

function fmtDate(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return esc(iso)
  return d.toLocaleDateString(undefined, { year: 'numeric', month: 'short', day: 'numeric' })
}

function fmtDateTime(iso) {
  if (!iso) return ''
  const d = new Date(iso)
  if (isNaN(d.getTime())) return esc(iso)
  return d.toLocaleString(undefined, { year: 'numeric', month: 'short', day: 'numeric', hour: 'numeric', minute: '2-digit' })
}

const CONFLICT_PROMPTS = [
  { id: 'happened', label: 'What happened, from your side?' },
  { id: 'feelings', label: 'How did it make you feel?' },
  { id: 'understand', label: 'What do you think your partner needs to understand?' },
  { id: 'resolve', label: 'What would help you feel like this is resolved?' },
]

/**
 * Builds a single self-contained HTML page (inline styles, embedded photos)
 * summarizing everything in `data`. `names` maps uid -> display name.
 */
export function buildReadableHTML(data, names, coupleLabel) {
  const nameOf = (uid) => esc(names[uid] || 'Someone')

  const section = (title, bodyHtml) => `
    <section>
      <h2>${esc(title)}</h2>
      ${bodyHtml}
    </section>`

  const memoriesHtml = data.memories.length
    ? `<div class="grid">${data.memories
        .map(
          (m) => `
        <figure>
          <img src="${m.photoData}" alt="${esc(m.caption)}" />
          <figcaption>
            ${m.caption ? `<div>${esc(m.caption)}</div>` : ''}
            ${(m.tags || []).length ? `<div class="tags">${m.tags.map((t) => `#${esc(t)}`).join(' ')}</div>` : ''}
            <div class="meta">${nameOf(m.from)} · ${fmtDate(m.createdAt)}${m.pinned ? ' · ♥ favorite' : ''}</div>
          </figcaption>
        </figure>`
        )
        .join('')}</div>`
    : '<p class="empty">No memories saved.</p>'

  const messagesHtml = data.messages.length
    ? `<div class="log">${data.messages
        .map((m) => {
          const body =
            m.type === 'image'
              ? `<img class="chat-img" src="${m.imageData}" alt="" />`
              : `<div>${esc(m.text)}</div>`
          const reactions = m.reactions && Object.keys(m.reactions).length
            ? `<div class="meta">${Object.values(m.reactions).join(' ')}</div>`
            : ''
          return `<div class="msg"><div class="meta">${nameOf(m.from)} · ${fmtDateTime(m.createdAt)}</div>${body}${reactions}</div>`
        })
        .join('')}</div>`
    : '<p class="empty">No messages yet.</p>'

  const checkinsHtml = data.checkins.length
    ? `<div class="log">${data.checkins
        .map(
          (c) => `
        <div class="msg">
          <div class="meta">${nameOf(c.uid)} · ${fmtDate(c.date)} · mood: ${esc(c.mood)}</div>
          ${c.journal ? `<div>${esc(c.journal)}</div>` : ''}
          ${c.gratitude ? `<div class="quote">"${esc(c.gratitude)}"</div>` : ''}
          ${c.photoData ? `<img class="chat-img" src="${c.photoData}" alt="" />` : ''}
        </div>`
        )
        .join('')}</div>`
    : '<p class="empty">No check-ins yet.</p>'

  const goalsHtml = data.goals.length
    ? `<ul>${data.goals
        .map(
          (g) => `<li><strong>${esc(g.title)}</strong> — ${g.progress ?? 0}%${g.done ? ' (done)' : ''}${
            g.description ? `<div class="meta">${esc(g.description)}</div>` : ''
          }</li>`
        )
        .join('')}</ul>`
    : '<p class="empty">No goals yet.</p>'

  const tasksHtml = data.tasks.length
    ? `<ul>${data.tasks
        .map((t) => `<li>${t.done ? '☑' : '☐'} ${esc(t.text)}${t.dueDate ? ` <span class="meta">(due ${fmtDate(t.dueDate)})</span>` : ''}</li>`)
        .join('')}</ul>`
    : '<p class="empty">No tasks yet.</p>'

  const conflictHtml = data.conflictSessions.length
    ? data.conflictSessions
        .map((s) => {
          const responses = Object.entries(s.responses || {})
            .map(([uid, r]) => {
              const answers = CONFLICT_PROMPTS.map(
                (p) => `<div><em>${esc(p.label)}</em><br/>${esc(r.answers?.[p.id] || '')}</div>`
              ).join('')
              return `<div class="msg"><div class="meta">${nameOf(uid)}</div>${answers}</div>`
            })
            .join('')
          return `<div class="conflict-session"><h3>${esc(s.topic)}</h3><div class="meta">${fmtDate(s.createdAt)} · ${esc(s.status)}</div>${responses}</div>`
        })
        .join('')
    : '<p class="empty">No conflict recovery sessions yet.</p>'

  const jarHtml = data.jar.length
    ? `<ul>${data.jar.map((j) => `<li class="quote">"${esc(j.text)}" <span class="meta">— ${nameOf(j.from)}, ${fmtDate(j.createdAt)}</span></li>`).join('')}</ul>`
    : '<p class="empty">No love jar notes yet.</p>'

  const eventsHtml = data.events.length
    ? `<ul>${data.events.map((e) => `<li><strong>${fmtDate(e.date)}</strong> — ${esc(e.title)}${e.note ? `<div class="meta">${esc(e.note)}</div>` : ''}</li>`).join('')}</ul>`
    : '<p class="empty">No calendar events yet.</p>'

  return `<!doctype html>
<html>
<head>
<meta charset="utf-8" />
<title>${esc(coupleLabel)} — Backup</title>
<style>
  body { font-family: -apple-system, Segoe UI, Roboto, sans-serif; max-width: 760px; margin: 40px auto; padding: 0 20px; color: #2a1f2b; line-height: 1.5; }
  h1 { margin-bottom: 4px; }
  .exported-at { color: #9a8a9c; font-size: 13px; margin-bottom: 40px; }
  section { margin-bottom: 40px; }
  h2 { border-bottom: 2px solid #e8a87c; padding-bottom: 6px; }
  .empty { color: #a892a9; font-style: italic; }
  .grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 12px; }
  figure { margin: 0; }
  figure img { width: 100%; height: 140px; object-fit: cover; border-radius: 10px; }
  figcaption { font-size: 13px; margin-top: 4px; }
  .meta { color: #9a8a9c; font-size: 12px; margin: 2px 0; }
  .quote { font-style: italic; }
  .log { display: flex; flex-direction: column; gap: 14px; }
  .msg { border-left: 3px solid #f2d9c4; padding-left: 12px; }
  .chat-img { max-width: 240px; border-radius: 10px; display: block; margin-top: 4px; }
  ul { padding-left: 20px; }
  li { margin-bottom: 8px; }
  .conflict-session { margin-bottom: 24px; }
  .conflict-session h3 { margin-bottom: 2px; }
</style>
</head>
<body>
  <h1>${esc(coupleLabel)}</h1>
  <div class="exported-at">Exported ${new Date().toLocaleString()}</div>

  ${section('Memories', memoriesHtml)}
  ${section('Chat', messagesHtml)}
  ${section('Daily check-ins', checkinsHtml)}
  ${section('Goals', goalsHtml)}
  ${section('Tasks', tasksHtml)}
  ${section('Conflict recovery', conflictHtml)}
  ${section('Love jar', jarHtml)}
  ${section('Calendar', eventsHtml)}
</body>
</html>`
}
