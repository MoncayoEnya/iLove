import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { FiGift, FiLock, FiUnlock } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import { todayStr } from '../utils/date'
import EmptyState from '../components/EmptyState'

export default function TimeCapsule() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [capsules, setCapsules] = useState([])
  const [message, setMessage] = useState('')
  const [unlockDate, setUnlockDate] = useState(dayjs().add(1, 'month').format('YYYY-MM-DD'))
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!coupleId) return
    const unsub = onSnapshot(collection(db, 'couples', coupleId, 'timeCapsules'), (snap) =>
      setCapsules(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [coupleId])

  const today = todayStr()

  const { locked, unlocked } = useMemo(() => {
    const locked = capsules
      .filter((c) => c.unlockDate > today)
      .sort((a, b) => (a.unlockDate < b.unlockDate ? -1 : 1))
    const unlocked = capsules
      .filter((c) => c.unlockDate <= today)
      .sort((a, b) => (a.unlockDate < b.unlockDate ? 1 : -1))
    return { locked, unlocked }
  }, [capsules, today])

  async function seal() {
    const text = message.trim()
    if (!text || !coupleId) return
    if (unlockDate <= today) {
      toast.error('Pick a date in the future — that\'s the whole point of a time capsule.')
      return
    }
    setSaving(true)
    try {
      await addDoc(collection(db, 'couples', coupleId, 'timeCapsules'), {
        message: text,
        authorId: firebaseUser.uid,
        unlockDate,
        opened: false,
        openedAt: null,
        createdAt: serverTimestamp(),
      })
      setMessage('')
      toast.success(`Sealed until ${dayjs(unlockDate).format('MMM D, YYYY')} ❤️`)
    } catch (e) {
      toast.error("Couldn't seal that — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function reveal(capsule) {
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'timeCapsules', capsule.id), {
        opened: true,
        openedAt: serverTimestamp(),
      })
    } catch (e) {
      toast.error("Couldn't open that — try again.")
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Time capsule</h1>
        <p className="text-sm text-[#7a6a7c]">
          Write something for future you two. It stays sealed until the date you pick.
        </p>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
        <h3 className="font-semibold mb-3">Seal a new capsule</h3>
        <textarea
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          placeholder="A note, a wish, a memory to open together later..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="flex flex-col sm:flex-row gap-2 mt-3">
          <div className="flex-1">
            <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Opens on</label>
            <input
              type="date"
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              value={unlockDate}
              min={dayjs().add(1, 'day').format('YYYY-MM-DD')}
              onChange={(e) => setUnlockDate(e.target.value)}
            />
          </div>
          <button
            onClick={seal}
            disabled={saving || !message.trim()}
            className="sm:self-end py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
          >
            Seal it
          </button>
        </div>
      </div>

      {capsules.length === 0 ? (
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <EmptyState
            icon={FiGift}
            title="No capsules yet"
            subtitle="Seal your first one above — a future you two will get a little surprise."
          />
        </div>
      ) : (
        <>
          {unlocked.length > 0 && (
            <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
              <h3 className="font-semibold mb-3">Ready to open</h3>
              <div className="flex flex-col gap-3">
                {unlocked.map((c) => (
                  <div key={c.id} className="border border-black/10 rounded-xl p-4 bg-[#faf6f8]">
                    {c.opened ? (
                      <>
                        <p className="text-sm text-ink leading-snug">"{c.message}"</p>
                        <div className="flex items-center gap-1.5 text-[11px] text-[#9a8a9c] mt-2.5">
                          <FiUnlock size={11} /> from {names[c.authorId] || '...'} · opened{' '}
                          {dayjs(c.unlockDate).format('MMM D, YYYY')}
                        </div>
                      </>
                    ) : (
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <div className="text-sm font-semibold">A capsule is ready to open</div>
                          <div className="text-xs text-[#9a8a9c] mt-0.5">
                            Sealed on {dayjs(c.unlockDate).format('MMM D, YYYY')} — tap to reveal it.
                          </div>
                        </div>
                        <button
                          onClick={() => reveal(c)}
                          className="shrink-0 flex items-center gap-1.5 py-2 px-4 rounded-xl font-semibold text-xs bg-gradient-to-br from-peach to-gold text-plumdeep"
                        >
                          <FiUnlock size={13} /> Open
                        </button>
                      </div>
                    )}
                  </div>
                ))}
              </div>
            </div>
          )}

          {locked.length > 0 && (
            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <h3 className="font-semibold mb-3">Still sealed</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {locked.map((c) => {
                  const daysUntil = dayjs(c.unlockDate).diff(dayjs(today), 'day')
                  return (
                    <div
                      key={c.id}
                      className="border border-black/10 rounded-xl p-4 bg-black/[0.02] flex items-start gap-3"
                    >
                      <div className="w-9 h-9 rounded-lg bg-black/5 text-[#9a8a9c] flex items-center justify-center flex-shrink-0">
                        <FiLock size={15} />
                      </div>
                      <div>
                        <div className="text-sm font-semibold">
                          Opens {dayjs(c.unlockDate).format('MMM D, YYYY')} ❤️
                        </div>
                        <div className="text-xs text-[#9a8a9c] mt-0.5">
                          {daysUntil} day{daysUntil === 1 ? '' : 's'} to go
                        </div>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
