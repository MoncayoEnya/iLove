import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import {
  FiCalendar,
  FiCheck,
  FiCheckCircle,
  FiCloud,
  FiMoreVertical,
  FiPlus,
  FiSearch,
  FiTrash2,
  FiX,
} from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'

const STAGES = [
  {
    key: 'dreaming',
    label: 'Dreaming',
    subtitle: 'Ideas for our future adventures.',
    icon: FiCloud,
    tint: 'bg-[#eaf5ef]',
  },
  {
    key: 'planning',
    label: 'Planning',
    subtitle: 'Turning dreams into plans.',
    icon: FiCalendar,
    tint: '',
  },
  {
    key: 'done',
    label: 'Done',
    subtitle: 'Great memories together.',
    icon: FiCheckCircle,
    tint: '',
  },
]

function stageOf(item) {
  if (item.stage === 'planning' || item.stage === 'done') return item.stage
  return 'dreaming'
}

function initialAvatarTone(name) {
  const tones = [
    'bg-[#d7efe9] text-[#1f7a68]',
    'bg-blush text-peach',
    'bg-[#fbe9c8] text-[#a3781f]',
    'bg-[#e3ddf5] text-[#5c4aa3]',
  ]
  const idx = (name || '?').charCodeAt(0) % tones.length
  return tones[idx]
}

function Avatar({ name }) {
  return (
    <div
      className={`w-5 h-5 rounded-full flex items-center justify-center text-[10px] font-semibold flex-shrink-0 ${initialAvatarTone(
        name
      )}`}
    >
      {(name || '?')[0]?.toUpperCase()}
    </div>
  )
}

function IdeaCard({ item, stageKey, ownerName, onToggle, onMove, onRemove, menuOpen, onToggleMenu }) {
  const isDone = stageKey === 'done'

  return (
    <div className="relative bg-white border border-black/10 rounded-xl p-3.5">
      <div className="flex items-start gap-2.5">
        <div
          onClick={() => onToggle(item)}
          role="checkbox"
          aria-checked={isDone}
          tabIndex={0}
          onKeyDown={(e) => e.key === 'Enter' && onToggle(item)}
          className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer mt-0.5 flex-shrink-0 transition-colors ${
            isDone ? 'bg-ok border-ok text-white' : 'border-black/20'
          }`}
        >
          {isDone && <FiCheck size={12} strokeWidth={3} />}
        </div>

        <div className="flex-1 min-w-0">
          <div className={`font-semibold text-sm ${isDone ? 'line-through opacity-50' : ''}`}>{item.text}</div>
          <div className="flex items-center gap-1.5 mt-1.5">
            <Avatar name={ownerName} />
            <span className="text-xs text-[#9a8a9c]">Added by {ownerName || '...'}</span>
          </div>
        </div>

        <button
          onClick={() => onToggleMenu(item.id)}
          aria-label="More options"
          className="w-6 h-6 rounded-md flex items-center justify-center text-[#9a8a9c] hover:bg-black/5 flex-shrink-0"
        >
          <FiMoreVertical size={15} />
        </button>
      </div>

      {menuOpen && (
        <div className="absolute right-3 top-10 z-10 bg-white border border-black/10 rounded-xl shadow-lg py-1.5 w-44 text-sm">
          {STAGES.filter((s) => s.key !== stageKey).map((s) => (
            <button
              key={s.key}
              onClick={() => onMove(item, s.key)}
              className="w-full text-left px-3.5 py-2 hover:bg-black/5"
            >
              Move to {s.label}
            </button>
          ))}
          <button
            onClick={() => onRemove(item)}
            className="w-full text-left px-3.5 py-2 hover:bg-black/5 text-[#9b3b3b] flex items-center gap-2"
          >
            <FiTrash2 size={13} /> Remove
          </button>
        </div>
      )}
    </div>
  )
}

function Column({ stage, items, names, onToggle, onMove, onRemove, onAdd, menuOpenId, onToggleMenu, isLast }) {
  const Icon = stage.icon
  const emptyDreaming = stage.key === 'dreaming'

  return (
    <div className={`flex flex-col ${isLast ? '' : 'md:border-r md:border-black/10'}`}>
      <div className={`px-5 py-4 border-b border-black/10 flex items-center gap-3 flex-shrink-0 ${stage.tint}`}>
        <div className="w-9 h-9 rounded-full bg-white border border-black/10 flex items-center justify-center flex-shrink-0 text-[#7a6a7c]">
          <Icon size={16} />
        </div>
        <div className="flex-1 min-w-0">
          <div className="font-semibold text-sm">{stage.label}</div>
          <div className="text-xs text-[#9a8a9c] truncate">{stage.subtitle}</div>
        </div>
        <span className="text-xs font-semibold text-[#6b5a6d] bg-black/5 rounded-full w-6 h-6 flex items-center justify-center flex-shrink-0">
          {items.length}
        </span>
      </div>

      <div className="p-5 flex-1 flex flex-col gap-3 min-h-[260px]">
        {items.length === 0 ? (
          emptyDreaming ? (
            <button onClick={onAdd} className="flex-1 flex flex-col text-left">
              <EmptyState
                icon={FiCloud}
                title="No ideas yet"
                subtitle="Add something you both want to experience — a trip, a first, a tradition."
                className="flex-1 justify-center"
              />
            </button>
          ) : (
            <button
              onClick={onAdd}
              className="flex-1 flex flex-col items-center justify-center text-center gap-2 border-2 border-dashed border-black/10 rounded-xl hover:border-black/20 transition-colors"
            >
              <div className="w-11 h-11 rounded-full border border-black/15 flex items-center justify-center text-[#9a8a9c]">
                <Icon size={18} />
              </div>
              <div className="text-sm font-semibold text-ink">
                {stage.key === 'planning' ? 'No plans yet' : 'Nothing here yet'}
              </div>
              <p className="text-xs text-[#9a8a9c] max-w-[220px]">
                {stage.key === 'planning'
                  ? "Move ideas here when you're ready to make them happen."
                  : 'Completed adventures will show up here.'}
              </p>
            </button>
          )
        ) : (
          <>
            {items.map((item) => (
              <IdeaCard
                key={item.id}
                item={item}
                stageKey={stage.key}
                ownerName={names[item.addedBy]}
                onToggle={onToggle}
                onMove={onMove}
                onRemove={onRemove}
                menuOpen={menuOpenId === item.id}
                onToggleMenu={onToggleMenu}
              />
            ))}
            <button
              onClick={onAdd}
              className="text-xs font-semibold text-peach flex items-center gap-1 mt-1 hover:opacity-75 transition-opacity"
            >
              <FiPlus size={12} /> Add
            </button>
          </>
        )}
      </div>
    </div>
  )
}

export default function BucketList() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [items, setItems] = useState([])
  const [menuOpenId, setMenuOpenId] = useState(null)

  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')

  const [modalOpen, setModalOpen] = useState(false)
  const [text, setText] = useState('')
  const [stage, setStage] = useState('dreaming')

  useEffect(() => {
    if (!coupleId) return
    const q = query(collection(db, 'couples', coupleId, 'bucketList'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [coupleId])

  function openModal(presetStage) {
    setStage(presetStage || 'dreaming')
    setModalOpen(true)
  }

  function toggleMenu(id) {
    setMenuOpenId((cur) => (cur === id ? null : id))
  }

  async function addItem() {
    const t = text.trim()
    if (!t || !coupleId) return
    try {
      await addDoc(collection(db, 'couples', coupleId, 'bucketList'), {
        text: t,
        stage,
        done: stage === 'done',
        completedAt: stage === 'done' ? serverTimestamp() : null,
        addedBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      })
      setText('')
      setStage('dreaming')
      setModalOpen(false)
    } catch (e) {
      toast.error("Couldn't add that — try again.")
    }
  }

  async function toggle(item) {
    setMenuOpenId(null)
    const ref = doc(db, 'couples', coupleId, 'bucketList', item.id)
    try {
      if (item.done) {
        await updateDoc(ref, { done: false, stage: 'planning', completedAt: null })
      } else {
        await updateDoc(ref, { done: true, stage: 'done', completedAt: serverTimestamp() })
        toast.success(`"${item.text}" — checked off!`)
      }
    } catch (e) {
      toast.error("Couldn't update that — try again.")
    }
  }

  async function moveStage(item, newStage) {
    setMenuOpenId(null)
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'bucketList', item.id), {
        stage: newStage,
        done: newStage === 'done',
        completedAt: newStage === 'done' ? serverTimestamp() : null,
      })
    } catch (e) {
      toast.error("Couldn't move that — try again.")
    }
  }

  async function remove(item) {
    setMenuOpenId(null)
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'bucketList', item.id))
    } catch (e) {
      toast.error("Couldn't remove that — try again.")
    }
  }

  const visibleItems = useMemo(() => {
    const term = searchTerm.trim().toLowerCase()
    if (!term) return items
    return items.filter((i) => i.text.toLowerCase().includes(term))
  }, [items, searchTerm])

  const byStage = useMemo(() => {
    const grouped = { dreaming: [], planning: [], done: [] }
    for (const i of visibleItems) grouped[stageOf(i)].push(i)
    return grouped
  }, [visibleItems])

  const total = items.length
  const doneCount = items.filter((i) => i.done).length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div>
      <div className="flex items-start justify-between gap-4 flex-wrap mb-6">
        <div>
          <div className="text-xs font-semibold uppercase tracking-wider text-[#9a8a9c] mb-1">Our journey</div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-1">Bucket list</h1>
          <p className="text-sm text-[#7a6a7c]">The things you want to do together, someday and soon.</p>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          <button
            onClick={() => {
              setSearchOpen((v) => !v)
              if (searchOpen) setSearchTerm('')
            }}
            aria-pressed={searchOpen}
            title="Search ideas"
            className={`w-10 h-10 rounded-xl border flex items-center justify-center flex-shrink-0 ${
              searchOpen ? 'border-peach text-peach bg-peachsoft' : 'border-black/10 text-[#7a6a7c]'
            }`}
          >
            {searchOpen ? <FiX size={16} /> : <FiSearch size={16} />}
          </button>
          <button
            onClick={() => openModal('dreaming')}
            className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            <FiPlus size={15} /> New idea
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="mb-4">
          <input
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Search ideas..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm.trim() && (
            <div className="text-xs text-[#9a8a9c] mt-1.5">
              {visibleItems.length} result{visibleItems.length === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}

      {total > 0 && (
        <div className="flex items-center gap-4 mb-4">
          <span className="text-sm font-semibold whitespace-nowrap">
            {doneCount} of {total} complete
          </span>
          <div className="flex-1 h-2 rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-peach to-gold transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
          <span className="text-xs text-[#9a8a9c] font-semibold whitespace-nowrap">{pct}%</span>
        </div>
      )}

      <div
        onClick={() => menuOpenId && setMenuOpenId(null)}
        className="bg-white border border-black/10 rounded-2xl overflow-hidden"
      >
        <div className="grid grid-cols-1 md:grid-cols-3">
          {STAGES.map((s, i) => (
            <Column
              key={s.key}
              stage={s}
              items={byStage[s.key]}
              names={names}
              onToggle={toggle}
              onMove={moveStage}
              onRemove={remove}
              onAdd={() => openModal(s.key)}
              menuOpenId={menuOpenId}
              onToggleMenu={toggleMenu}
              isLast={i === STAGES.length - 1}
            />
          ))}
        </div>
      </div>

      <BottomSheet open={modalOpen} onClose={() => setModalOpen(false)} title="New idea">
        <div>
          <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Idea</label>
          <input
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="e.g. Watch the sunrise together"
            value={text}
            onChange={(e) => setText(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && addItem()}
          />

          <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold mt-3">Stage</label>
          <div className="flex gap-2">
            {STAGES.map((s) => (
              <button
                key={s.key}
                type="button"
                onClick={() => setStage(s.key)}
                className={`flex-1 py-2 rounded-xl text-sm font-medium border transition-colors ${
                  stage === s.key ? 'bg-peach/15 border-peach text-plum' : 'border-black/10 text-[#7a6a7c]'
                }`}
              >
                {s.label}
              </button>
            ))}
          </div>

          <button
            onClick={addItem}
            className="mt-4 w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            Add idea
          </button>
        </div>
      </BottomSheet>
    </div>
  )
}