import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, limit, onSnapshot, orderBy, query } from 'firebase/firestore'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import {
  FiHeart,
  FiSmile,
  FiSun,
  FiLifeBuoy,
  FiGift,
  FiCalendar,
  FiSearch,
  FiX,
  FiPlus,
} from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'

export const JAR_CATEGORIES = [
  { value: 'appreciation', label: 'Appreciation', icon: FiHeart },
  { value: 'funny', label: 'Funny', icon: FiSmile },
  { value: 'sweet', label: 'Sweet', icon: FiSun },
  { value: 'support', label: 'Support', icon: FiLifeBuoy },
  { value: 'birthday', label: 'Birthday', icon: FiGift },
  { value: 'anniversary', label: 'Anniversary', icon: FiCalendar },
]

// The pastel sticky-note colors the grid cycles through, in order —
// matches the yellow / lavender / mint / pink rotation from the design.
const NOTE_COLORS = [
  { bg: '#fdf6db', border: '#f3e6ab' },
  { bg: '#ece6fa', border: '#d9cdf0' },
  { bg: '#ddf3ea', border: '#bfe6d7' },
  { bg: '#fbdfe3', border: '#f3bfc7' },
]

function categoryMeta(value) {
  return JAR_CATEGORIES.find((c) => c.value === value) || JAR_CATEGORIES[0]
}

export default function LoveJar({ embedded = false }) {
  const { firebaseUser, couple } = useAuth()
  const [notes, setNotes] = useState([])
  const [recent, setRecent] = useState([])
  const names = useMemberNames(couple?.members)
  const [text, setText] = useState('')
  const [category, setCategory] = useState('appreciation')
  const [revealed, setRevealed] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null) // null = all
  const [query_, setQuery] = useState('')
  const [showAdd, setShowAdd] = useState(false)
  const [showReveal, setShowReveal] = useState(false)

  useEffect(() => {
    if (!couple?.id) return
    const unsub = onSnapshot(collection(db, 'couples', couple.id, 'jar'), (snap) =>
      setNotes(snap.docs.map((d) => ({ id: d.id, category: 'appreciation', ...d.data() })))
    )
    return unsub
  }, [couple?.id])

  // Small "recent timeline" read for the sidebar card — reuses the same
  // memories collection the Timeline tab writes to.
  useEffect(() => {
    if (!couple?.id) return
    const unsub = onSnapshot(
      query(collection(db, 'couples', couple.id, 'memories'), orderBy('createdAt', 'desc'), limit(2)),
      (snap) => setRecent(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [couple?.id])

  const filteredNotes = useMemo(() => {
    const q = query_.trim().toLowerCase()
    return notes
      .filter((n) => {
        const matchesCategory = !activeFilter || n.category === activeFilter
        const matchesQuery = !q || n.text.toLowerCase().includes(q)
        return matchesCategory && matchesQuery
      })
      .slice()
      .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
  }, [notes, activeFilter, query_])

  async function addNote() {
    if (!text.trim()) return
    const t = text.trim()
    const c = category
    setText('')
    setShowAdd(false)
    try {
      await addDoc(collection(db, 'couples', couple.id, 'jar'), {
        text: t,
        category: c,
        from: firebaseUser.uid,
        createdAt: new Date(),
      })
      toast.success('Dropped in the jar.')
    } catch (e) {
      setText(t)
      toast.error("Couldn't save that note — try again.")
    }
  }

  function openJar() {
    const pool = activeFilter ? notes.filter((n) => n.category === activeFilter) : notes
    if (pool.length === 0) return
    setRevealed(pool[Math.floor(Math.random() * pool.length)])
    setShowReveal(true)
  }

  return (
    <div>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1">Love jar</h1>
          <p className="text-sm text-[#7a6a7c]">Drop in appreciation notes. Open the jar whenever you need a lift.</p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px,1fr] gap-5 items-start">
        {/* Left column: the jar itself + a peek at the timeline */}
        <div className="flex flex-col gap-4 lg:sticky lg:top-4">
          <div className="rounded-3xl p-6 text-center bg-blush">
            <button
              onClick={openJar}
              disabled={notes.length === 0}
              aria-label="Open the love jar"
              className="w-16 h-16 mx-auto rounded-full bg-white flex items-center justify-center mb-4 disabled:opacity-60"
            >
              <FiHeart size={24} className="text-peach" fill="currentColor" />
            </button>
            <h3 className="font-serif text-xl font-semibold text-plumdeep">The Love Jar</h3>
            <p className="text-xs text-[#8a6b70] mt-1 mb-4">
              {notes.length} note{notes.length === 1 ? '' : 's'} of appreciation
            </p>
            <button
              onClick={() => setShowAdd(true)}
              className="w-full py-2.5 rounded-xl font-semibold text-sm bg-plumdeep text-white hover:opacity-90 transition-opacity"
            >
              Drop a new note
            </button>
          </div>

          <div className="bg-white border border-black/10 rounded-2xl p-5">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-3">
              Recent timeline
            </div>
            {recent.length === 0 ? (
              <p className="text-xs text-[#a892a9]">Nothing logged on the timeline yet.</p>
            ) : (
              <div className="flex flex-col gap-3">
                {recent.map((m, i) => (
                  <div key={m.id} className="flex items-start gap-2.5">
                    <span
                      className={`mt-1.5 w-1.5 h-1.5 rounded-full flex-shrink-0 ${i === 0 ? 'bg-peach' : 'bg-black/15'}`}
                    />
                    <div className="min-w-0">
                      <div className="text-sm font-medium truncate">
                        {m.title || m.caption || 'A shared memory'}
                      </div>
                      <div className="text-[11px] text-[#a892a9]">
                        {m.date ? dayjs(m.date).format('D MMM YYYY') : ''}
                      </div>
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>
        </div>

        {/* Right column: the notes, laid out like scattered sticky notes */}
        <div>
          {notes.length > 0 && (
            <div className="flex items-center gap-2 mb-4 flex-wrap">
              <div className="flex items-center gap-2 bg-white border border-black/10 rounded-xl px-3 py-2 flex-1 min-w-[160px]">
                <FiSearch size={13} className="text-[#9a8a9c] flex-shrink-0" />
                <input
                  type="text"
                  value={query_}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Search notes..."
                  className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#b6a4b8] min-w-0"
                />
                {query_ && (
                  <button onClick={() => setQuery('')} className="text-[#9a8a9c] hover:text-ink flex-shrink-0">
                    <FiX size={13} />
                  </button>
                )}
              </div>
              <div className="flex flex-wrap gap-1.5">
                <button
                  onClick={() => setActiveFilter(null)}
                  className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                    !activeFilter ? 'bg-plumdeep text-white border-plumdeep' : 'border-black/10 text-[#9a8a9c] hover:bg-black/5'
                  }`}
                >
                  All
                </button>
                {JAR_CATEGORIES.map(({ value, label }) => (
                  <button
                    key={value}
                    onClick={() => setActiveFilter(activeFilter === value ? null : value)}
                    className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                      activeFilter === value
                        ? 'bg-plumdeep text-white border-plumdeep'
                        : 'border-black/10 text-[#9a8a9c] hover:bg-black/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
            </div>
          )}

          {notes.length === 0 ? (
            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <EmptyState
                icon={FiHeart}
                title="The jar is empty"
                subtitle="Drop in the first appreciation note — it'll show up here, and you'll be able to reveal a random one anytime."
              />
            </div>
          ) : filteredNotes.length === 0 ? (
            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <EmptyState icon={FiSearch} title="No notes match" subtitle="Try a different search term or category filter." />
            </div>
          ) : (
            <div className="columns-1 sm:columns-2 gap-4 [column-fill:_balance]">
              {filteredNotes.map((n, i) => {
                const color = NOTE_COLORS[i % NOTE_COLORS.length]
                return (
                  <div
                    key={n.id}
                    className="break-inside-avoid mb-4 rounded-2xl border p-5"
                    style={{ backgroundColor: color.bg, borderColor: color.border }}
                  >
                    <p className="font-serif italic text-[15px] leading-snug text-plumdeep">"{n.text}"</p>
                    <div className="text-right mt-3 text-sm font-serif italic text-[#7a6a7c]">
                      — {names[n.from] || '...'}
                    </div>
                  </div>
                )
              })}

              <button
                onClick={() => setShowAdd(true)}
                className="break-inside-avoid mb-4 w-full min-h-[140px] rounded-2xl border border-dashed border-black/15 flex flex-col items-center justify-center gap-2 text-[#9a8a9c] hover:border-peach/50 hover:text-peach transition-colors"
              >
                <FiPlus size={18} />
                <span className="text-sm font-medium">Add a moment</span>
              </button>
            </div>
          )}
        </div>
      </div>

      <BottomSheet open={showAdd} onClose={() => setShowAdd(false)} title="Drop a note in the jar">
        <textarea
          rows={3}
          autoFocus
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          placeholder="Thank you for... / I loved when you... / I appreciate..."
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex flex-wrap gap-1.5 mt-3">
          {JAR_CATEGORIES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              aria-pressed={category === value}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                category === value
                  ? 'bg-gradient-to-br from-peach to-gold text-plumdeep border-transparent'
                  : 'border-black/10 text-[#7a6a7c] hover:bg-black/5'
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        <button
          onClick={addNote}
          disabled={!text.trim()}
          className="w-full mt-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
        >
          Drop it in the jar
        </button>
      </BottomSheet>

      <BottomSheet open={showReveal} onClose={() => setShowReveal(false)} title="From the jar">
        {revealed && (
          <div className="text-center py-4">
            <p className="jar-note">"{revealed.text}"</p>
            <div className="flex items-center justify-center gap-1.5 text-xs text-[#9a8a9c] mt-3">
              {(() => {
                const Icon = categoryMeta(revealed.category).icon
                return <Icon size={12} />
              })()}
              {categoryMeta(revealed.category).label} · {names[revealed.from] || '...'}
            </div>
            <button
              onClick={openJar}
              className="mt-5 text-sm font-semibold px-4 py-2 rounded-xl border border-black/10 hover:bg-black/5"
            >
              Draw another
            </button>
          </div>
        )}
      </BottomSheet>
    </div>
  )
}