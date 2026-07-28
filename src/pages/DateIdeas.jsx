import { useEffect, useMemo, useState } from 'react'
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import { FiCheck, FiCompass, FiPlus, FiTrash2 } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import { DATE_IDEAS, DATE_IDEA_TAGS } from '../data/dateIdeas'
import EmptyState from '../components/EmptyState'

function tagLabel(value) {
  return DATE_IDEA_TAGS.find((t) => t.value === value)?.label || value
}

export default function DateIdeas() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  // Progress on the built-in curated ideas: keyed by the idea's static id.
  const [progress, setProgress] = useState({})
  // Couple-added ideas — full documents, not just progress.
  const [customIdeas, setCustomIdeas] = useState([])

  const [activeTag, setActiveTag] = useState(null) // null = all
  const [newTitle, setNewTitle] = useState('')
  const [newTags, setNewTags] = useState([])
  const [showAddForm, setShowAddForm] = useState(false)

  useEffect(() => {
    if (!coupleId) return
    const unsub1 = onSnapshot(collection(db, 'couples', coupleId, 'dateIdeaProgress'), (snap) => {
      const p = {}
      snap.docs.forEach((d) => (p[d.id] = d.data()))
      setProgress(p)
    })
    const unsub2 = onSnapshot(collection(db, 'couples', coupleId, 'customDateIdeas'), (snap) =>
      setCustomIdeas(snap.docs.map((d) => ({ id: d.id, custom: true, ...d.data() })))
    )
    return () => {
      unsub1()
      unsub2()
    }
  }, [coupleId])

  // Combine the curated list (with live done/not-done from `progress`) and
  // the couple's own custom ideas into one array to render and filter.
  const allIdeas = useMemo(() => {
    const builtIn = DATE_IDEAS.map((idea) => ({
      ...idea,
      custom: false,
      done: !!progress[idea.id]?.done,
      doneBy: progress[idea.id]?.doneBy || null,
    }))
    return [...builtIn, ...customIdeas]
  }, [progress, customIdeas])

  const filtered = useMemo(
    () => (activeTag ? allIdeas.filter((i) => i.tags?.includes(activeTag)) : allIdeas),
    [allIdeas, activeTag]
  )

  const doneCount = filtered.filter((i) => i.done).length
  const total = filtered.length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  async function toggle(idea) {
    try {
      if (idea.custom) {
        const ref = doc(db, 'couples', coupleId, 'customDateIdeas', idea.id)
        await updateDoc(ref, idea.done ? { done: false, doneBy: null } : { done: true, doneBy: firebaseUser.uid })
      } else {
        const ref = doc(db, 'couples', coupleId, 'dateIdeaProgress', idea.id)
        if (idea.done) {
          await setDoc(ref, { done: false, doneBy: null }, { merge: true })
        } else {
          await setDoc(ref, { done: true, doneBy: firebaseUser.uid, doneAt: serverTimestamp() }, { merge: true })
          toast.success(`"${idea.title}" — checked off! 🎉`)
        }
      }
    } catch (e) {
      toast.error("Couldn't update that — try again.")
    }
  }

  async function removeCustom(idea) {
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'customDateIdeas', idea.id))
    } catch (e) {
      toast.error("Couldn't remove that — try again.")
    }
  }

  function toggleNewTag(value) {
    setNewTags((tags) => (tags.includes(value) ? tags.filter((t) => t !== value) : [...tags, value]))
  }

  async function addCustomIdea() {
    const title = newTitle.trim()
    if (!title || !coupleId) return
    try {
      await addDoc(collection(db, 'couples', coupleId, 'customDateIdeas'), {
        title,
        tags: newTags,
        done: false,
        doneBy: null,
        addedBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      })
      setNewTitle('')
      setNewTags([])
      setShowAddForm(false)
      toast.success('Added to your date ideas.')
    } catch (e) {
      toast.error("Couldn't add that — try again.")
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Date ideas</h1>
        <p className="text-sm text-[#7a6a7c]">A pool of things to try together — check them off as you go.</p>
      </div>

      {total > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">
              {doneCount} of {total} done{activeTag ? ` in ${tagLabel(activeTag)}` : ''}
            </span>
            <span className="text-xs text-[#9a8a9c] font-semibold">{pct}%</span>
          </div>
          <div className="h-2 rounded-full bg-black/5 overflow-hidden">
            <div
              className="h-full rounded-full bg-gradient-to-r from-peach to-gold transition-all"
              style={{ width: `${pct}%` }}
            />
          </div>
        </div>
      )}

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setActiveTag(null)}
          className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
            !activeTag ? 'bg-plumdeep text-white border-plumdeep' : 'border-black/10 text-[#9a8a9c] hover:bg-black/5'
          }`}
        >
          All
        </button>
        {DATE_IDEA_TAGS.map(({ value, label }) => (
          <button
            key={value}
            onClick={() => setActiveTag(value)}
            className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
              activeTag === value
                ? 'bg-plumdeep text-white border-plumdeep'
                : 'border-black/10 text-[#9a8a9c] hover:bg-black/5'
            }`}
          >
            {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-5">
        {filtered.length === 0 ? (
          <EmptyState icon={FiCompass} title="No ideas match" subtitle="Try a different tag, or add your own below." />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((idea) => (
              <div
                key={idea.id}
                className={`flex items-start gap-2.5 border border-black/10 rounded-xl p-3.5 ${
                  idea.done ? 'bg-[#faf6f8]' : 'bg-white'
                }`}
              >
                <div
                  onClick={() => toggle(idea)}
                  className={`w-5 h-5 rounded-md border flex items-center justify-center cursor-pointer mt-0.5 flex-shrink-0 ${
                    idea.done ? 'border-ok bg-ok text-white' : 'border-black/20'
                  }`}
                >
                  {idea.done && <FiCheck size={12} strokeWidth={3} />}
                </div>
                <div className="flex-1 min-w-0">
                  <div className={idea.done ? 'text-sm line-through opacity-50' : 'text-sm'}>{idea.title}</div>
                  <div className="flex flex-wrap gap-1 mt-1.5">
                    {(idea.tags || []).map((t) => (
                      <span key={t} className="text-[10px] text-[#a892a9] bg-black/[0.03] rounded-full px-2 py-0.5">
                        {tagLabel(t)}
                      </span>
                    ))}
                  </div>
                  {idea.done && idea.doneBy && (
                    <div className="text-[11px] text-[#9a8a9c] mt-1.5">checked off by {names[idea.doneBy] || '...'}</div>
                  )}
                </div>
                {idea.custom && (
                  <button
                    onClick={() => removeCustom(idea)}
                    aria-label="Remove"
                    className="w-6 h-6 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c] flex-shrink-0"
                  >
                    <FiTrash2 size={11} />
                  </button>
                )}
              </div>
            ))}
          </div>
        )}

        <div className="mt-4 pt-4 border-t border-black/10">
          {!showAddForm ? (
            <button
              onClick={() => setShowAddForm(true)}
              className="flex items-center gap-1.5 text-xs font-semibold text-[#7a6a7c] hover:text-ink"
            >
              <FiPlus size={14} /> Add your own idea
            </button>
          ) : (
            <>
              <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">New idea</label>
              <input
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm mb-2"
                placeholder="e.g. Recreate our first date"
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && addCustomIdea()}
              />
              <div className="flex flex-wrap gap-1.5 mb-3">
                {DATE_IDEA_TAGS.map(({ value, label }) => (
                  <button
                    key={value}
                    type="button"
                    onClick={() => toggleNewTag(value)}
                    aria-pressed={newTags.includes(value)}
                    className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                      newTags.includes(value)
                        ? 'bg-gradient-to-br from-peach to-gold text-plumdeep border-transparent'
                        : 'border-black/10 text-[#7a6a7c] hover:bg-black/5'
                    }`}
                  >
                    {label}
                  </button>
                ))}
              </div>
              <div className="flex gap-2">
                <button
                  onClick={addCustomIdea}
                  disabled={!newTitle.trim()}
                  className="py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
                >
                  Add idea
                </button>
                <button
                  onClick={() => {
                    setShowAddForm(false)
                    setNewTitle('')
                    setNewTags([])
                  }}
                  className="py-2.5 px-4 rounded-xl font-semibold text-sm border border-black/10 text-[#7a6a7c]"
                >
                  Cancel
                </button>
              </div>
            </>
          )}
        </div>
      </div>
    </div>
  )
}
