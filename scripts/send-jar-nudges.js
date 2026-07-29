// Runs OUTSIDE the browser entirely (via GitHub Actions on a schedule) — this
// is what lets a nudge fire even while every phone is locked and no tab is
// open anywhere. Needs no Firebase billing plan: the Admin SDK works on the
// free Spark plan same as the client SDK does.
//
// Env vars expected (set as GitHub Actions secrets — see
// .github/workflows/jar-nudges.yml):
//   FIREBASE_SERVICE_ACCOUNT  - full JSON from Firebase Console > Project
//                               Settings > Service accounts > Generate new
//                               private key
//   VAPID_PUBLIC_KEY          - same public key used in the client .env
//   VAPID_PRIVATE_KEY         - private half of the same key pair (never
//                               put this in client code)

import admin from 'firebase-admin'
import webpush from 'web-push'

const JAR_NUDGE_AFTER_DAYS = 3

admin.initializeApp({
  credential: admin.credential.cert(JSON.parse(process.env.FIREBASE_SERVICE_ACCOUNT)),
})
const db = admin.firestore()

webpush.setVapidDetails(
  'mailto:you@example.com', // replace with a real contact address
  process.env.VAPID_PUBLIC_KEY,
  process.env.VAPID_PRIVATE_KEY
)

async function run() {
  const couplesSnap = await db.collection('couples').get()

  for (const coupleDoc of couplesSnap.docs) {
    const coupleId = coupleDoc.id

    const jarSnap = await db
      .collection('couples')
      .doc(coupleId)
      .collection('jar')
      .orderBy('createdAt', 'desc')
      .limit(1)
      .get()

    if (jarSnap.empty) continue // no notes yet — don't nag brand-new couples

    const latest = jarSnap.docs[0].data()
    const lastAtMs = latest.createdAt?.toMillis
      ? latest.createdAt.toMillis()
      : new Date(latest.createdAt).getTime()
    const daysSince = Math.floor((Date.now() - lastAtMs) / (24 * 60 * 60 * 1000))

    if (daysSince < JAR_NUDGE_AFTER_DAYS) continue

    const subsSnap = await db.collection('pushSubscriptions').where('coupleId', '==', coupleId).get()

    for (const subDoc of subsSnap.docs) {
      const { subscription } = subDoc.data()
      try {
        await webpush.sendNotification(
          subscription,
          JSON.stringify({
            title: "It's been a while",
            body: `It's been ${daysSince} days since anyone dropped a note in the love jar. Add one for your partner to find.`,
            tag: 'jar-inactivity',
          })
        )
      } catch (err) {
        // 410/404 = the subscription is dead (uninstalled, permissions
        // revoked, etc.) — clean it up so we stop trying to send to it.
        if (err.statusCode === 410 || err.statusCode === 404) {
          await subDoc.ref.delete()
        } else {
          console.error(`Push failed for ${subDoc.id}:`, err.message)
        }
      }
    }
  }
}

run()
  .then(() => {
    console.log('Jar nudge check complete.')
    process.exit(0)
  })
  .catch((err) => {
    console.error(err)
    process.exit(1)
  })
