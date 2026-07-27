import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, onSnapshot } from 'firebase/firestore'
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
  FiGrid,
} from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import EmptyState from '../components/EmptyState'

export const JAR_CATEGORIES = [
  { value: 'appreciation', label: 'Appreciation', icon: FiHeart },
  { value: 'funny', label: 'Funny', icon: FiSmile },
  { value: 'sweet', label: 'Sweet', icon: FiSun },
  { value: 'support', label: 'Support', icon: FiLifeBuoy },
  { value: 'birthday', label: 'Birthday', icon: FiGift },
  { value: 'anniversary', label: 'Anniversary', icon: FiCalendar },
]

function categoryMeta(value) {
  return JAR_CATEGORIES.find((c) => c.value === value) || JAR_CATEGORIES[0]
}

export default function LoveJar() {
  const { firebaseUser, couple } = useAuth()
  const [notes, setNotes] = useState([])
  const names = useMemberNames(couple?.members)
  const [text, setText] = useState('')
  const [category, setCategory] = useState('appreciation')
  const [revealed, setRevealed] = useState(null)
  const [activeFilter, setActiveFilter] = useState(null) // null = all
  const [query, setQuery] = useState('')
  const [showBrowse, setShowBrowse] = useState(false)

  useEffect(() => {
    if (!couple?.id) return
    const unsub = onSnapshot(collection(db, 'couples', couple.id, 'jar'), (snap) =>
      setNotes(snap.docs.map((d) => ({ id: d.id, category: 'appreciation', ...d.data() })))
    )
    return unsub
  }, [couple?.id])

  const filteredNotes = useMemo(() => {
    const q = query.trim().toLowerCase()
    return notes.filter((n) => {
      const matchesCategory = !activeFilter || n.category === activeFilter
      const matchesQuery = !q || n.text.toLowerCase().includes(q)
      return matchesCategory && matchesQuery
    })
  }, [notes, activeFilter, query])

  async function addNote() {
    if (!text.trim()) return
    const t = text.trim()
    const c = category
    setText('')
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
  }

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Love jar</h1>
          <p className="text-sm text-[#7a6a7c]">Drop in appreciation notes. Open the jar whenever you need a lift.</p>
        </div>
        <button
          onClick={() => setShowBrowse((s) => !s)}
          className={`shrink-0 mt-1 flex items-center gap-1.5 text-xs font-semibold px-3 py-2 rounded-lg border transition-colors ${
            showBrowse
              ? 'bg-plumdeep text-white border-plumdeep'
              : 'border-black/10 text-[#7a6a7c] hover:bg-black/5'
          }`}
        >
          <FiGrid size={14} /> {showBrowse ? 'Hide notes' : 'Browse notes'}
        </button>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Add a note</h3>
          <textarea
            rows={3}
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
            className="w-full mt-3 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            Drop it in the jar
          </button>
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Open the jar</h3>
          <div className={notes.length === 0 && !revealed ? 'text-center' : 'text-center py-6'}>
            {revealed ? (
              <>
                <div className="jar-note">"{revealed.text}"</div>
                <div className="flex items-center justify-center gap-1.5 text-xs text-[#9a8a9c] mt-2.5">
                  {(() => {
                    const Icon = categoryMeta(revealed.category).icon
                    return <Icon size={12} />
                  })()}
                  {categoryMeta(revealed.category).label} · {names[revealed.from] || '...'}
                </div>
              </>
            ) : notes.length === 0 ? (
              <EmptyState
                icon={FiHeart}
                title="The jar is empty"
                subtitle="Drop in the first appreciation note — you'll be able to reveal a random one here anytime."
              />
            ) : (
              <div className="text-sm text-[#9a8a9c]">
                {activeFilter
                  ? `${notes.filter((n) => n.category === activeFilter).length} ${categoryMeta(activeFilter).label.toLowerCase()} note${
                      notes.filter((n) => n.category === activeFilter).length === 1 ? '' : 's'
                    } in this filter`
                  : `${notes.length} note${notes.length === 1 ? '' : 's'} saved so far`}
              </div>
            )}
          </div>

          <div className="flex flex-wrap gap-1.5 justify-center mb-3">
            <button
              onClick={() => setActiveFilter(null)}
              className={`text-[11px] font-medium px-2 py-1 rounded-full border transition-colors ${
                !activeFilter ? 'bg-plumdeep text-white border-plumdeep' : 'border-black/10 text-[#9a8a9c] hover:bg-black/5'
              }`}
            >
              All
            </button>
            {JAR_CATEGORIES.map(({ value, label, icon: Icon }) => (
              <button
                key={value}
                onClick={() => setActiveFilter(value)}
                className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1 rounded-full border transition-colors ${
                  activeFilter === value
                    ? 'bg-plumdeep text-white border-plumdeep'
                    : 'border-black/10 text-[#9a8a9c] hover:bg-black/5'
                }`}
              >
                <Icon size={11} /> {label}
              </button>
            ))}
          </div>

          <button
            onClick={openJar}
            disabled={notes.length === 0 || (activeFilter && !notes.some((n) => n.category === activeFilter))}
            className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep flex items-center justify-center gap-1.5 disabled:opacity-50"
          >
            <FiHeart size={14} fill="currentColor" /> Open love jar
          </button>
        </div>
      </div>

      {showBrowse && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mt-4">
          <div className="flex items-center gap-2 mb-4">
            <FiSearch size={14} className="text-[#9a8a9c]" />
            <input
              type="text"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Search notes..."
              className="flex-1 text-sm bg-transparent outline-none placeholder:text-[#b6a4b8]"
            />
            {query && (
              <button onClick={() => setQuery('')} className="text-[#9a8a9c] hover:text-ink">
                <FiX size={14} />
              </button>
            )}
          </div>

          {filteredNotes.length === 0 ? (
            <EmptyState
              icon={FiSearch}
              title="No notes match"
              subtitle="Try a different search term or category filter."
            />
          ) : (
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {filteredNotes
                .slice()
                .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0))
                .map((n) => {
                  const meta = categoryMeta(n.category)
                  const Icon = meta.icon
                  return (
                    <div key={n.id} className="border border-black/10 rounded-xl p-3.5 bg-[#faf6f8]">
                      <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#a892a9] mb-1.5">
                        <Icon size={12} /> {meta.label}
                      </div>
                      <p className="text-sm text-ink leading-snug">{n.text}</p>
                      <div className="text-[11px] text-[#9a8a9c] mt-2">— {names[n.from] || '...'}</div>
                    </div>
                  )
                })}
            </div>
          )}
        </div>
      )}
    </div>
  )
}