import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  addDoc,
  collection,
  doc,
  onSnapshot,
  orderBy,
  query,
  runTransaction,
  where,
} from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { compressImage } from '../utils/compressImage'

const MOODS = [
  { v: 'amazing', e: '😊', l: 'Amazing' },
  { v: 'good', e: '🙂', l: 'Good' },
  { v: 'okay', e: '😐', l: 'Okay' },
  { v: 'sad', e: '😔', l: 'Sad' },
  { v: 'hard', e: '😢', l: 'Hard day' },
]

function todayStr() {
  return new Date().toISOString().slice(0, 10)
}

// Given "YYYY-MM-DD", returns years together so far and days until the
// next anniversary (0 = today).
function anniversaryInfo(dateStr) {
  if (!dateStr) return null
  const start = new Date(dateStr + 'T00:00:00')
  if (Number.isNaN(start.getTime())) return null

  const now = new Date()
  const todayMidnight = new Date(now.getFullYear(), now.getMonth(), now.getDate())

  let next = new Date(todayMidnight.getFullYear(), start.getMonth(), start.getDate())
  if (next < todayMidnight) {
    next = new Date(todayMidnight.getFullYear() + 1, start.getMonth(), start.getDate())
  }

  const years = next.getFullYear() - start.getFullYear()
  const daysUntil = Math.round((next - todayMidnight) / 86400000)

  return { years, daysUntil }
}

export default function Dashboard() {
  const { firebaseUser, profile, couple } = useAuth()
  const { partner, hasPartner } = usePartner()
  const today = todayStr()

  const [tasks, setTasks] = useState([])
  const [events, setEvents] = useState([])
  const [jar, setJar] = useState([])
  const [checkins, setCheckins] = useState([])
  const [pickedMood, setPickedMood] = useState(null)
  const [gratitude, setGratitude] = useState('')
  const [journal, setJournal] = useState('')
  const [photoData, setPhotoData] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)
  const photoInputRef = useRef(null)

  const coupleId = couple?.id

  useEffect(() => {
    if (!coupleId) return
    const unsubs = [
      onSnapshot(query(collection(db, 'couples', coupleId, 'tasks'), where('done', '==', false)), (s) =>
        setTasks(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(query(collection(db, 'couples', coupleId, 'events'), orderBy('date')), (s) =>
        setEvents(s.docs.map((d) => ({ id: d.id, ...d.data() })).filter((e) => e.date >= today))
      ),
      onSnapshot(collection(db, 'couples', coupleId, 'jar'), (s) =>
        setJar(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
      onSnapshot(query(collection(db, 'couples', coupleId, 'checkins'), where('date', '==', today)), (s) =>
        setCheckins(s.docs.map((d) => ({ id: d.id, ...d.data() })))
      ),
    ]
    return () => unsubs.forEach((u) => u())
  }, [coupleId, today])

  const myCheckin = checkins.find((c) => c.uid === firebaseUser.uid)
  const lastJarNote = jar.sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))[0]
  const anniversary = anniversaryInfo(profile?.anniversaryDate || partner?.anniversaryDate)

  async function handlePhotoPick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.')
      return
    }
    setPhotoError('')
    setPhotoLoading(true)
    try {
      setPhotoData(await compressImage(file))
    } catch (err) {
      setPhotoError(err.message)
    } finally {
      setPhotoLoading(false)
    }
  }

  async function submitCheckin() {
    if (!pickedMood) return
    await addDoc(collection(db, 'couples', coupleId, 'checkins'), {
      date: today,
      uid: firebaseUser.uid,
      mood: pickedMood,
      gratitude: gratitude.trim(),
      journal: journal.trim(),
      photoData: photoData || null,
      createdAt: new Date(),
    })

    // If both partners have now checked in today, bump the streak (once)
    const members = couple.members
    if (members.length === 2) {
      const otherUid = members.find((m) => m !== firebaseUser.uid)
      const otherCheckedIn = checkins.some((c) => c.uid === otherUid)
      if (otherCheckedIn && couple.lastCheckinDate !== today) {
        const coupleRef = doc(db, 'couples', coupleId)
        await runTransaction(db, async (tx) => {
          const snap = await tx.get(coupleRef)
          const data = snap.data()
          if (data.lastCheckinDate !== today) {
            tx.update(coupleRef, { streak: (data.streak || 0) + 1, lastCheckinDate: today })
          }
        })
      }
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Hi {profile.displayName} 🌷</h1>
        <p className="text-sm text-[#7a6a7c]">
          {!hasPartner
            ? 'Waiting for your partner to join with your invite code.'
            : `You and ${partner?.displayName || '...'} — day ${couple?.streak || 0} of your streak.`}
        </p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">😊 Daily check-in</h3>
          {myCheckin ? (
            <>
              <div className="text-sm text-[#9a8a9c]">
                You checked in today: {MOODS.find((m) => m.v === myCheckin.mood)?.e}{' '}
                {MOODS.find((m) => m.v === myCheckin.mood)?.l}
              </div>
              {myCheckin.journal && (
                <div className="text-sm mt-3 whitespace-pre-wrap">{myCheckin.journal}</div>
              )}
              {myCheckin.gratitude && <div className="jar-note mt-3 text-sm">{myCheckin.gratitude}</div>}
              {myCheckin.photoData && (
                <img
                  src={myCheckin.photoData}
                  alt="Today's check-in"
                  className="rounded-xl mt-3 max-h-48 w-full object-cover"
                />
              )}
            </>
          ) : (
            <>
              <div className="flex gap-2 mt-2">
                {MOODS.map((m) => (
                  <div
                    key={m.v}
                    onClick={() => setPickedMood(m.v)}
                    className={`flex-1 border rounded-xl py-3 text-center cursor-pointer text-2xl ${
                      pickedMood === m.v ? 'border-peach bg-peachsoft' : 'border-black/10'
                    }`}
                  >
                    <div>{m.e}</div>
                    <div className="text-[10px] text-[#9a8a9c] mt-1">{m.l}</div>
                  </div>
                ))}
              </div>
              <textarea
                rows={2}
                className="w-full mt-2.5 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                placeholder="How was today, really? (optional journal entry)"
                value={journal}
                onChange={(e) => setJournal(e.target.value)}
              />
              <input
                className="w-full mt-2.5 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                placeholder="One thing you appreciated today (optional)"
                value={gratitude}
                onChange={(e) => setGratitude(e.target.value)}
              />

              <input
                ref={photoInputRef}
                type="file"
                accept="image/*"
                className="hidden"
                onChange={handlePhotoPick}
              />
              <div className="flex items-center gap-2.5 mt-2.5">
                <button
                  onClick={() => photoInputRef.current?.click()}
                  disabled={photoLoading}
                  className="text-sm px-3.5 py-2 rounded-xl border border-black/10 disabled:opacity-50"
                >
                  {photoLoading ? 'Adding photo...' : photoData ? '📷 Change photo' : '📷 Add a photo (optional)'}
                </button>
                {photoData && (
                  <button
                    onClick={() => setPhotoData(null)}
                    className="text-xs text-[#9a8a9c]"
                  >
                    Remove
                  </button>
                )}
              </div>
              {photoData && (
                <img src={photoData} alt="Preview" className="rounded-xl mt-2.5 max-h-32 object-cover" />
              )}
              {photoError && <div className="text-xs text-[#9b3b3b] mt-1.5">{photoError}</div>}

              <button
                onClick={submitCheckin}
                className="w-full mt-3 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
              >
                Save check-in
              </button>
            </>
          )}
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">✓ Today's tasks</h3>
          {tasks.length === 0 ? (
            <div className="text-sm text-[#a892a9]">Nothing open — nice.</div>
          ) : (
            tasks.slice(0, 4).map((t) => (
              <div key={t.id} className="text-sm py-1.5">
                • {t.text}
              </div>
            ))
          )}
          <Link to="/tasks" className="inline-block mt-3 text-sm border border-black/10 rounded-xl px-4 py-2">
            Go to tasks
          </Link>
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">▤ Coming up</h3>
          {events.length === 0 ? (
            <div className="text-sm text-[#a892a9]">Nothing planned yet.</div>
          ) : (
            events.slice(0, 3).map((ev) => (
              <div key={ev.id} className="text-sm py-1.5">
                <span className="text-[10.5px] bg-blush text-plum px-2 py-0.5 rounded-full font-semibold mr-2">
                  {ev.date}
                </span>
                {ev.title}
              </div>
            ))
          )}
          <Link to="/calendar" className="inline-block mt-3 text-sm border border-black/10 rounded-xl px-4 py-2">
            Open calendar
          </Link>
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">💍 Anniversary</h3>
          {!anniversary ? (
            <div className="text-sm text-[#a892a9]">
              Add your anniversary date on your{' '}
              <Link to="/profile" className="underline">
                profile
              </Link>{' '}
              to see the countdown here.
            </div>
          ) : anniversary.daysUntil === 0 ? (
            <div className="text-sm">
              🎉 Happy anniversary! {anniversary.years} year{anniversary.years === 1 ? '' : 's'} together today.
            </div>
          ) : (
            <div className="text-sm">
              <span className="text-2xl font-semibold">{anniversary.daysUntil}</span>{' '}
              day{anniversary.daysUntil === 1 ? '' : 's'} until your {anniversary.years}
              {anniversary.years === 1 ? 'st' : anniversary.years === 2 ? 'nd' : anniversary.years === 3 ? 'rd' : 'th'}{' '}
              anniversary.
            </div>
          )}
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">❤ Latest from the love jar</h3>
          {!lastJarNote ? (
            <div className="text-sm text-[#a892a9]">No notes saved yet.</div>
          ) : (
            <div className="jar-note">"{lastJarNote.text}"</div>
          )}
          <Link to="/jar" className="inline-block mt-3 text-sm border border-black/10 rounded-xl px-4 py-2">
            Open love jar
          </Link>
        </div>
      </div>
    </div>
  )
}