import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { FiBell, FiGift, FiLock, FiPlus, FiUnlock } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import { todayStr } from '../utils/date'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'

export default function TimeCapsule({ embedded = false }) {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [capsules, setCapsules] = useState([])
  const [title, setTitle] = useState('')
  const [message, setMessage] = useState('')
  const [unlockDate, setUnlockDate] = useState(dayjs().add(1, 'month').format('YYYY-MM-DD'))
  const [saving, setSaving] = useState(false)
  const [showSeal, setShowSeal] = useState(false)

  useEffect(() => {
    if (!coupleId) return
    const unsub = onSnapshot(collection(db, 'couples', coupleId, 'timeCapsules'), (snap) =>
      setCapsules(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [coupleId])

  const today = todayStr()

  const { readyToOpen, locked, opened } = useMemo(() => {
    const readyToOpen = capsules
      .filter((c) => c.unlockDate <= today && !c.opened)
      .sort((a, b) => (a.unlockDate < b.unlockDate ? -1 : 1))
    const locked = capsules
      .filter((c) => c.unlockDate > today)
      .sort((a, b) => (a.unlockDate < b.unlockDate ? -1 : 1))
    const opened = capsules
      .filter((c) => c.opened)
      .sort((a, b) => (b.openedAt?.seconds || 0) - (a.openedAt?.seconds || 0))
    return { readyToOpen, locked, opened }
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
        title: title.trim() || 'A memory for later',
        message: text,
        authorId: firebaseUser.uid,
        unlockDate,
        opened: false,
        openedAt: null,
        createdAt: serverTimestamp(),
      })
      setTitle('')
      setMessage('')
      setShowSeal(false)
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

  function lockedProgress(c) {
    const sealedAt = c.createdAt?.seconds ? dayjs.unix(c.createdAt.seconds) : dayjs(c.unlockDate).subtract(1, 'month')
    const total = dayjs(c.unlockDate).diff(sealedAt, 'day') || 1
    const elapsed = dayjs(today).diff(sealedAt, 'day')
    return Math.min(100, Math.max(4, Math.round((elapsed / total) * 100)))
  }

  return (
    <div>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1">Time capsule</h1>
          <p className="text-sm text-[#7a6a7c]">
            Write something for future you two. It stays sealed until the date you pick.
          </p>
        </div>
      )}

      {capsules.length === 0 ? (
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <EmptyState
            icon={FiGift}
            title="No capsules yet"
            subtitle="Seal your first one — a future you two will get a little surprise."
          />
          <div className="flex justify-center mt-4">
            <button
              onClick={() => setShowSeal(true)}
              className="py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
            >
              Seal a new memory
            </button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 mb-4 items-stretch">
          {readyToOpen.map((c) => (
            <button
              key={c.id}
              onClick={() => reveal(c)}
              className="text-left rounded-2xl bg-plumdeep text-white p-5 min-h-[200px] flex flex-col justify-end relative overflow-hidden group"
            >
              <span className="inline-flex self-start items-center gap-1 bg-gold text-plumdeep text-[10px] font-bold uppercase tracking-wide px-2.5 py-1 rounded-full mb-4">
                Ready to open
              </span>
              <div className="font-serif text-lg font-semibold leading-snug mb-1 group-hover:underline">
                {c.title || 'A memory for later'}
              </div>
              <div className="text-xs text-white/60">Sealed {dayjs(c.createdAt?.seconds ? dayjs.unix(c.createdAt.seconds) : c.unlockDate).format('MMM D, YYYY')}</div>
            </button>
          ))}

          {locked.map((c) => {
            const daysUntil = dayjs(c.unlockDate).diff(dayjs(today), 'day')
            return (
              <div key={c.id} className="rounded-2xl bg-blush p-5 min-h-[200px] flex flex-col">
                <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center mb-5">
                  <FiLock size={16} className="text-[#8a6b70]" />
                </div>
                <div className="flex-1">
                  <div className="font-semibold text-plumdeep text-center leading-snug">
                    {c.title || 'A memory for later'}
                  </div>
                </div>
                <div className="text-center mt-3">
                  <div className="text-[10px] font-semibold uppercase tracking-wide text-[#a5806f]">
                    Unlocks in
                  </div>
                  <div className="font-serif text-lg font-semibold text-plumdeep">
                    {daysUntil} Day{daysUntil === 1 ? '' : 's'}
                  </div>
                </div>
                <div className="h-1 rounded-full bg-black/10 mt-3 overflow-hidden">
                  <div className="h-full bg-gold" style={{ width: `${lockedProgress(c)}%` }} />
                </div>
              </div>
            )
          })}

          <button
            onClick={() => setShowSeal(true)}
            className="rounded-2xl border-2 border-dashed border-black/15 p-5 min-h-[200px] flex flex-col items-center justify-center gap-2 text-[#9a8a9c] hover:border-peach/50 hover:text-peach transition-colors"
          >
            <span className="w-10 h-10 rounded-full bg-black/5 flex items-center justify-center">
              <FiPlus size={16} />
            </span>
            <div className="text-sm font-semibold">Seal a new memory</div>
            <div className="text-xs text-center px-4">Choose a date in the future to reveal this moment again.</div>
          </button>
        </div>
      )}

      {opened.length > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
          <h3 className="font-semibold mb-3 text-sm">Already opened</h3>
          <div className="flex flex-col gap-3">
            {opened.map((c) => (
              <div key={c.id} className="border border-black/10 rounded-xl p-4 bg-[#faf6f8]">
                <div className="text-xs font-semibold text-[#9a8a9c] mb-1">{c.title || 'A memory for later'}</div>
                <p className="text-sm text-ink leading-snug">"{c.message}"</p>
                <div className="flex items-center gap-1.5 text-[11px] text-[#9a8a9c] mt-2.5">
                  <FiUnlock size={11} /> from {names[c.authorId] || '...'} · opened{' '}
                  {dayjs(c.unlockDate).format('MMM D, YYYY')}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {capsules.length > 0 && (
        <div className="flex items-center justify-between gap-4 bg-white border border-black/10 rounded-2xl p-4 flex-wrap">
          <div className="flex items-center gap-3 min-w-0">
            <div className="w-9 h-9 rounded-full bg-black/5 flex items-center justify-center flex-shrink-0">
              <FiBell size={15} className="text-[#7a6a7c]" />
            </div>
            <div className="min-w-0">
              <div className="text-sm font-semibold">Vault protection</div>
              <div className="text-xs text-[#9a8a9c]">
                Memories in the capsule are encrypted and cannot be viewed until the unlock date.
              </div>
            </div>
          </div>
          <button
            onClick={() => toast('Archive management is on the roadmap.')}
            className="flex-shrink-0 text-xs font-bold uppercase tracking-wide px-4 py-2.5 rounded-xl bg-plumdeep text-white"
          >
            Manage archives
          </button>
        </div>
      )}

      <BottomSheet open={showSeal} onClose={() => setShowSeal(false)} title="Seal a new capsule">
        <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Name it (optional)</label>
        <input
          type="text"
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm mb-3"
          placeholder="e.g. Letters for our future home"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
        />
        <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Message</label>
        <textarea
          rows={3}
          autoFocus
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          placeholder="A note, a wish, a memory to open together later..."
          value={message}
          onChange={(e) => setMessage(e.target.value)}
        />
        <div className="mt-3">
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
          className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
        >
          {saving ? 'Sealing...' : 'Seal it'}
        </button>
      </BottomSheet>
    </div>
  )
}