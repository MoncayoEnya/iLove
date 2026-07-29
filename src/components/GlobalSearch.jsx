import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { collection, getDocs, limit, query } from 'firebase/firestore'
import { FiBookOpen, FiCheckSquare, FiImage, FiSearch, FiTarget } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import BottomSheet from './BottomSheet'

// Rule #9: one search instead of hunting through pages by hand. Each
// collection loads once when the sheet first opens, then everything is
// filtered client-side as the person types — plenty fast for the volume of
// data one couple accumulates, without standing up a dedicated search index.
export default function GlobalSearch() {
  const { couple } = useAuth()
  const coupleId = couple?.id
  const [open, setOpen] = useState(false)
  const [q, setQ] = useState('')
  const [loading, setLoading] = useState(false)
  const [loaded, setLoaded] = useState(false)
  const [data, setData] = useState({ tasks: [], memories: [], journal: [], goals: [] })

  useEffect(() => {
    if (!open || !coupleId || loaded) return
    setLoading(true)
    ;(async () => {
      try {
        const [tasksSnap, memoriesSnap, journalSnap, goalsSnap] = await Promise.all([
          getDocs(query(collection(db, 'couples', coupleId, 'tasks'), limit(200))),
          getDocs(query(collection(db, 'couples', coupleId, 'memories'), limit(200))),
          getDocs(query(collection(db, 'couples', coupleId, 'journalEntries'), limit(200))),
          getDocs(query(collection(db, 'couples', coupleId, 'goals'), limit(200))),
        ])
        setData({
          tasks: tasksSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          memories: memoriesSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          journal: journalSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
          goals: goalsSnap.docs.map((d) => ({ id: d.id, ...d.data() })),
        })
        setLoaded(true)
      } catch (e) {
        // Silent — search staying empty on a transient failure isn't worth a toast.
      } finally {
        setLoading(false)
      }
    })()
  }, [open, coupleId, loaded])

  const term = q.trim().toLowerCase()
  const matches = (text) => !!text && text.toLowerCase().includes(term)

  const results = term
    ? {
        tasks: data.tasks.filter((t) => matches(t.text)).slice(0, 5),
        memories: data.memories
          .filter((m) => matches(m.caption) || matches(m.title) || (m.tags || []).some((tag) => matches(tag)))
          .slice(0, 5),
        journal: data.journal.filter((j) => matches(j.text)).slice(0, 5),
        goals: data.goals.filter((g) => matches(g.title) || matches(g.description)).slice(0, 5),
      }
    : { tasks: [], memories: [], journal: [], goals: [] }

  const totalResults = results.tasks.length + results.memories.length + results.journal.length + results.goals.length

  function close() {
    setOpen(false)
    setQ('')
  }

  return (
    <>
      <button
        onClick={() => setOpen(true)}
        aria-label="Search"
        className="w-9 h-9 rounded-lg border border-white/15 flex items-center justify-center flex-shrink-0 text-[#f3e6e8]"
      >
        <FiSearch size={16} />
      </button>

      <BottomSheet open={open} onClose={close} title="Search">
        <div className="relative">
          <FiSearch size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8a9c]" />
          <input
            autoFocus
            value={q}
            onChange={(e) => setQ(e.target.value)}
            placeholder="Search tasks, memories, journal, goals"
            className="w-full pl-8 pr-3 py-2.5 rounded-xl border border-black/10 text-sm"
          />
        </div>

        <div className="mt-4 space-y-4">
          {loading && <div className="text-sm text-[#a892a9] text-center py-6">Loading...</div>}

          {!loading && term && totalResults === 0 && (
            <div className="text-sm text-[#a892a9] text-center py-6">No matches for "{q}".</div>
          )}

          {!loading && !term && (
            <div className="text-sm text-[#a892a9] text-center py-6">
              Search across tasks, memories, journal entries, and goals.
            </div>
          )}

          {results.tasks.length > 0 && (
            <ResultGroup
              label="Tasks"
              icon={FiCheckSquare}
              items={results.tasks.map((t) => ({ id: t.id, label: t.text, to: '/tasks' }))}
              onNavigate={close}
            />
          )}
          {results.memories.length > 0 && (
            <ResultGroup
              label="Memories"
              icon={FiImage}
              items={results.memories.map((m) => ({
                id: m.id,
                label: m.caption || m.title || 'Untitled memory',
                to: '/memories',
              }))}
              onNavigate={close}
            />
          )}
          {results.journal.length > 0 && (
            <ResultGroup
              label="Journal"
              icon={FiBookOpen}
              items={results.journal.map((j) => ({ id: j.id, label: j.text, to: '/memories?tab=journal' }))}
              onNavigate={close}
            />
          )}
          {results.goals.length > 0 && (
            <ResultGroup
              label="Goals"
              icon={FiTarget}
              items={results.goals.map((g) => ({ id: g.id, label: g.title, to: '/goals' }))}
              onNavigate={close}
            />
          )}
        </div>
      </BottomSheet>
    </>
  )
}

function ResultGroup({ label, icon: Icon, items, onNavigate }) {
  return (
    <div>
      <div className="text-[10px] font-semibold uppercase tracking-wider text-[#a892a9] mb-1.5 px-1">{label}</div>
      <div className="flex flex-col gap-1">
        {items.map((item) => (
          <Link
            key={item.id}
            to={item.to}
            onClick={onNavigate}
            className="flex items-center gap-2.5 px-3 py-2.5 rounded-xl hover:bg-black/[0.03] text-sm"
          >
            <Icon size={14} className="text-peach flex-shrink-0" />
            <span className="truncate">{item.label}</span>
          </Link>
        ))}
      </div>
    </div>
  )
}
