// AI Companion — Cloud Function backend.
//
// Why this lives server-side instead of calling the Anthropic API straight
// from the React app: an API key can't be shipped in client code, and
// keeping the call server-side also means we control exactly what data
// leaves the app. This function pulls only aggregate numbers and love-
// language labels out of Firestore — never message text, journal text,
// jar note text, or names — and that's all Claude ever sees.
//
// Setup:
//   1. cd functions && npm install
//   2. firebase functions:secrets:set ANTHROPIC_API_KEY
//   3. firebase deploy --only functions
//
// The client calls this via httpsCallable('generateCompanionSuggestion').
// See src/hooks/useCompanion.js.

import { onCall, HttpsError } from 'firebase-functions/v2/https'
import { defineSecret } from 'firebase-functions/params'
import { initializeApp } from 'firebase-admin/app'
import { getFirestore, FieldValue, Timestamp } from 'firebase-admin/firestore'

initializeApp()
const db = getFirestore()

const ANTHROPIC_API_KEY = defineSecret('ANTHROPIC_API_KEY')

// One suggestion per couple per window — this is meant to read as a
// once-in-a-while gentle nudge, not something to refresh-spam, and it
// keeps API cost predictable.
const COOLDOWN_MS = 12 * 60 * 60 * 1000
const MODEL = 'claude-haiku-4-5-20251001' // fast + cheap; plenty for one short suggestion

export const generateCompanionSuggestion = onCall(
  { secrets: [ANTHROPIC_API_KEY], cors: true },
  async (request) => {
    const uid = request.auth?.uid
    if (!uid) throw new HttpsError('unauthenticated', 'Sign in required.')

    const userSnap = await db.collection('users').doc(uid).get()
    const coupleId = userSnap.data()?.coupleId
    if (!coupleId) throw new HttpsError('failed-precondition', 'Link with your partner first.')

    const coupleRef = db.collection('couples').doc(coupleId)
    const coupleSnap = await coupleRef.get()
    const couple = coupleSnap.data()
    if (!couple || !(couple.members || []).includes(uid)) {
      throw new HttpsError('permission-denied', "You're not a member of this couple.")
    }
    if (!couple.companionEnabled) {
      throw new HttpsError(
        'failed-precondition',
        'AI Companion is turned off. Turn it on in the Companion tab first.'
      )
    }

    const lastAt = couple.companionLastGeneratedAt?.toMillis?.() || 0
    if (Date.now() - lastAt < COOLDOWN_MS) {
      const minsLeft = Math.ceil((COOLDOWN_MS - (Date.now() - lastAt)) / 60000)
      throw new HttpsError('resource-exhausted', `Come back in about ${minsLeft} minutes for a new one.`)
    }

    const stats = await gatherAnonymizedStats(coupleId, couple)
    const text = await callClaude(stats, ANTHROPIC_API_KEY.value())

    const suggestionRef = coupleRef.collection('companionSuggestions').doc()
    await suggestionRef.set({
      text,
      createdAt: FieldValue.serverTimestamp(),
      dismissed: false,
    })
    await coupleRef.set({ companionLastGeneratedAt: FieldValue.serverTimestamp() }, { merge: true })

    return { id: suggestionRef.id, text }
  }
)

/** Pulls together an anonymized, aggregate-only snapshot. No names, no
 *  freeform text (jar/journal/message/task bodies) ever leaves Firestore. */
async function gatherAnonymizedStats(coupleId, couple) {
  const since14 = Timestamp.fromMillis(Date.now() - 14 * 24 * 60 * 60 * 1000)
  const since7 = Timestamp.fromMillis(Date.now() - 7 * 24 * 60 * 60 * 1000)

  const [checkinsSnap, jarSnap, tasksSnap, usersSnap] = await Promise.all([
    db
      .collection('couples')
      .doc(coupleId)
      .collection('checkins')
      .where('createdAt', '>=', since14)
      .get(),
    db.collection('couples').doc(coupleId).collection('jar').where('createdAt', '>=', since7).get(),
    db.collection('couples').doc(coupleId).collection('tasks').get(),
    Promise.all(
      (couple.members || []).map((uid) => db.collection('users').doc(uid).get())
    ),
  ])

  const moods = checkinsSnap.docs.map((d) => d.data().mood).filter(Boolean)
  const positiveMoods = moods.filter((m) => m === 'amazing' || m === 'good').length
  const hardMoods = moods.filter((m) => m === 'sad' || m === 'hard').length

  const tasksLast7 = tasksSnap.docs
    .map((d) => d.data())
    .filter((t) => (t.completedAt?.toMillis?.() || 0) >= since7.toMillis())
  const tasksDoneLast7 = tasksLast7.filter((t) => t.done).length

  const loveLanguages = usersSnap
    .map((s) => s.data()?.loveLanguage)
    .filter(Boolean)

  return {
    streak: couple.streak || 0,
    checkinDaysLast14: new Set(checkinsSnap.docs.map((d) => d.data().date)).size,
    positiveMoodCheckinsLast14: positiveMoods,
    hardMoodCheckinsLast14: hardMoods,
    appreciationNotesLast7: jarSnap.size,
    tasksCompletedLast7: tasksDoneLast7,
    loveLanguages, // e.g. ["Words of Affirmation", "Acts of Service"] — labels only
  }
}

async function callClaude(stats, apiKey) {
  const systemPrompt = `You are a gentle, optional relationship companion inside a couples app called iLovee.
You receive only anonymized aggregate stats about a couple — never names, never message or journal content.
Write exactly ONE short suggestion (2-4 sentences, under 60 words) for something kind, small, and doable today.
Tone: warm, encouraging, never clinical or judgmental. Never imply anything is wrong with the relationship.
If a love language is provided, tailor the suggestion to it. If check-ins have been low or moods have skewed
difficult, be extra gentle and low-pressure — suggest something tiny, not a big gesture.
Do not use the words "score" or "algorithm". Do not add a greeting or sign-off. Output only the suggestion text.`

  const userPrompt = `Couple stats (last 14 days unless noted):
- Current streak: ${stats.streak} days
- Check-in days: ${stats.checkinDaysLast14}/14
- Positive-mood check-ins: ${stats.positiveMoodCheckinsLast14}
- Hard-mood check-ins: ${stats.hardMoodCheckinsLast14}
- Appreciation notes added (last 7 days): ${stats.appreciationNotesLast7}
- Tasks completed together (last 7 days): ${stats.tasksCompletedLast7}
- Love language(s) on file: ${stats.loveLanguages.length ? stats.loveLanguages.join(', ') : 'not set'}

Write today's suggestion.`

  const response = await fetch('https://api.anthropic.com/v1/messages', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    },
    body: JSON.stringify({
      model: MODEL,
      max_tokens: 200,
      system: systemPrompt,
      messages: [{ role: 'user', content: userPrompt }],
    }),
  })

  if (!response.ok) {
    const errBody = await response.text().catch(() => '')
    console.error('Anthropic API error:', response.status, errBody)
    throw new HttpsError('internal', "Couldn't reach the companion right now — try again shortly.")
  }

  const data = await response.json()
  const text = data.content
    ?.filter((block) => block.type === 'text')
    .map((block) => block.text)
    .join('\n')
    .trim()

  if (!text) throw new HttpsError('internal', 'Got an empty suggestion — try again.')
  return text
}
