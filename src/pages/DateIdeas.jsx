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
import {
  FiBookmark,
  FiCheck,
  FiChevronDown,
  FiClock,
  FiCompass,
  FiDollarSign,
  FiFeather,
  FiFilm,
  FiHeart,
  FiMapPin,
  FiPlus,
  FiStar,
  FiSun,
  FiTrash2,
  FiX,
  FiZap,
} from 'react-icons/fi'
import { FaDice } from 'react-icons/fa'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import { DATE_IDEAS, DATE_IDEA_TAGS, DATE_IDEA_CATEGORIES } from '../data/dateIdeas'
import EmptyState from '../components/EmptyState'

function tagLabel(value) {
  return DATE_IDEA_TAGS.find((t) => t.value === value)?.label || value
}

// Icon per category key — kept here (rather than in the data file) so the
// data module doesn't need to import React components. "yours" covers the
// couple's own custom-added ideas, which aren't part of DATE_IDEA_CATEGORIES.
const CATEGORY_ICONS = {
  cozy: FiHeart,
  outabout: FiSun,
  trynew: FiCompass,
  movie: FiFilm,
  creative: FiFeather,
  yours: FiBookmark,
}

// Small single-select pill group used four times in the "Pick our next
// date" panel (Time / Energy / Cost / Setting) — same look, different
// icon/options/state each time.
function PrefGroup({ icon: Icon, label, options, value, onChange }) {
  return (
    <div>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-2">
        <Icon size={13} /> {label}
      </div>
      <div className="flex flex-wrap gap-1.5">
        {options.map((opt) => (
          <button
            key={opt.value}
            onClick={() => onChange(opt.value)}
            aria-pressed={value === opt.value}
            className={`text-xs font-semibold px-3 py-1.5 rounded-full border transition-colors ${
              value === opt.value
                ? 'bg-peach text-plumdeep border-peach'
                : 'border-black/10 text-[#7a6a7c] hover:bg-black/5'
            }`}
          >
            {opt.label}
          </button>
        ))}
      </div>
    </div>
  )
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
  const [collapsed, setCollapsed] = useState(() => new Set()) // collapsed category keys

  const [addOpen, setAddOpen] = useState(false)
  const [newTitle, setNewTitle] = useState('')
  const [newTags, setNewTags] = useState([])

  // "Pick our next date" picker — defaults mirror the mock: Tonight / Easy /
  // Low / Inside all pre-selected.
  const [timePref, setTimePref] = useState('tonight')
  const [energyPref, setEnergyPref] = useState('easy')
  const [costPref, setCostPref] = useState('low')
  const [settingPref, setSettingPref] = useState('inside')
  const [picked, setPicked] = useState(null)

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

  // Curated ideas bucketed by category, in DATE_IDEA_CATEGORIES order, then
  // custom (couple-added) ideas as a trailing "Your ideas" group. A group is
  // dropped entirely once the active tag filter leaves it empty.
  const groups = useMemo(() => {
    const byCat = DATE_IDEA_CATEGORIES.map((cat) => ({
      ...cat,
      ideas: filtered.filter((i) => !i.custom && i.category === cat.key),
    })).filter((g) => g.ideas.length > 0)
    const yours = filtered.filter((i) => i.custom)
    if (yours.length > 0) {
      byCat.push({ key: 'yours', label: 'Your ideas', cls: null, ideas: yours })
    }
    return byCat
  }, [filtered])

  function toggleCollapsed(key) {
    setCollapsed((cur) => {
      const next = new Set(cur)
      next.has(key) ? next.delete(key) : next.add(key)
      return next
    })
  }

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
      setAddOpen(false)
      toast.success('Added to your date ideas.')
    } catch (e) {
      toast.error("Couldn't add that — try again.")
    }
  }

  // Picks a random idea matching the current Time/Energy/Cost/Setting
  // preferences. These map onto the existing tag set as a best-effort
  // heuristic (there's no dedicated "energy"/"time" field on ideas), and
  // constraints are relaxed one at a time if they'd otherwise leave nothing
  // to pick from, so the button never comes up empty as long as at least
  // one idea exists.
  function surpriseUs() {
    const rules = [
      settingPref === 'inside' ? (i) => i.tags?.includes('indoor') : (i) => i.tags?.includes('outdoor'),
      costPref === 'low' ? (i) => i.tags?.includes('low-budget') : null,
      energyPref === 'active' ? (i) => i.tags?.includes('adventure') : (i) => !i.tags?.includes('adventure'),
      timePref === 'weekend' ? (i) => i.tags?.includes('adventure') || i.tags?.includes('outdoor') : null,
    ].filter(Boolean)

    const notDone = allIdeas.filter((i) => !i.done)
    const base = notDone.length > 0 ? notDone : allIdeas
    if (base.length === 0) return

    let pool = base
    for (const rule of rules) {
      const next = pool.filter(rule)
      if (next.length > 0) pool = next
    }
    // Avoid repeating the currently-shown pick when other options exist.
    const options = pool.length > 1 ? pool.filter((i) => i.id !== picked?.id) : pool
    const choice = options[Math.floor(Math.random() * options.length)]
    setPicked(choice)
  }

  return (
    <div>
      <div className="mb-5 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Date ideas</h1>
          <p className="text-sm text-[#7a6a7c]">A pool of things to try together — check them off as you go.</p>
        </div>
        <button
          onClick={() => setAddOpen(true)}
          className="flex items-center gap-1.5 py-2.5 px-4 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep flex-shrink-0"
        >
          <FiPlus size={15} /> Add idea
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-5">
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

      <div className="grid lg:grid-cols-[1fr_360px] gap-6 items-start">
        <div className="bg-white border border-black/10 rounded-2xl overflow-hidden">
          {groups.length === 0 ? (
            <div className="p-5">
              <EmptyState icon={FiCompass} title="No ideas match" subtitle="Try a different tag, or add your own." />
            </div>
          ) : (
            groups.map((group, gi) => {
              const isCollapsed = collapsed.has(group.key)
              const CatIcon = CATEGORY_ICONS[group.key] || FiStar
              return (
                <div key={group.key} className={gi > 0 ? 'border-t border-black/5' : ''}>
                  <button
                    onClick={() => toggleCollapsed(group.key)}
                    className={`w-full flex items-center justify-between px-5 py-3 text-sm font-bold ${
                      group.cls ? group.cls : 'bg-blush text-plum'
                    }`}
                  >
                    <span className="flex items-center gap-2">
                      <CatIcon size={15} /> {group.label}
                    </span>
                    <FiChevronDown
                      size={16}
                      className={`transition-transform ${isCollapsed ? 'rotate-180' : ''}`}
                    />
                  </button>
                  {!isCollapsed && (
                    <div className="divide-y divide-black/5">
                      {group.ideas.map((idea) => (
                        <div key={idea.id} className="flex items-center gap-3 px-5 py-3">
                          <button
                            onClick={() => toggle(idea)}
                            aria-pressed={idea.done}
                            aria-label={idea.done ? 'Mark as not done' : 'Mark as done'}
                            className={`w-5 h-5 rounded-md border flex items-center justify-center flex-shrink-0 ${
                              idea.done ? 'border-ok bg-ok text-white' : 'border-black/20'
                            }`}
                          >
                            {idea.done && <FiCheck size={12} strokeWidth={3} />}
                          </button>
                          <div className={`flex-1 min-w-0 text-sm ${idea.done ? 'line-through opacity-50' : ''}`}>
                            {idea.title}
                            {idea.done && idea.doneBy && (
                              <div className="text-[11px] text-[#9a8a9c] font-normal mt-0.5">
                                checked off by {names[idea.doneBy] || '...'}
                              </div>
                            )}
                          </div>
                          <div className="flex flex-wrap justify-end gap-1 flex-shrink-0">
                            {(idea.tags || []).map((t) => (
                              <span key={t} className="text-[10px] text-[#a892a9] bg-black/[0.03] rounded-full px-2 py-0.5 whitespace-nowrap">
                                {tagLabel(t)}
                              </span>
                            ))}
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
                </div>
              )
            })
          )}
        </div>

        <aside className="lg:sticky lg:top-4 bg-white border border-black/10 rounded-2xl p-5">
          <div className="flex items-start justify-between gap-2 mb-1">
            <h2 className="font-serif text-xl font-semibold leading-tight">Pick our next date</h2>
            <FiStar size={16} className="text-peach mt-1 flex-shrink-0" />
          </div>
          <p className="text-xs text-[#7a6a7c] mb-5">Set a vibe, spin the compass, or let fate decide.</p>

          <div className="grid grid-cols-2 gap-x-4 gap-y-5 mb-5">
            <PrefGroup
              icon={FiClock}
              label="Time"
              value={timePref}
              onChange={setTimePref}
              options={[
                { value: 'tonight', label: 'Tonight' },
                { value: 'weekend', label: 'Weekend' },
              ]}
            />
            <PrefGroup
              icon={FiZap}
              label="Energy"
              value={energyPref}
              onChange={setEnergyPref}
              options={[
                { value: 'easy', label: 'Easy' },
                { value: 'active', label: 'Active' },
              ]}
            />
            <PrefGroup
              icon={FiDollarSign}
              label="Cost"
              value={costPref}
              onChange={setCostPref}
              options={[
                { value: 'low', label: 'Low' },
                { value: 'any', label: 'Any' },
              ]}
            />
            <PrefGroup
              icon={FiMapPin}
              label="Setting"
              value={settingPref}
              onChange={setSettingPref}
              options={[
                { value: 'inside', label: 'Inside' },
                { value: 'outside', label: 'Outside' },
              ]}
            />
          </div>

          <div className="relative w-28 h-28 mx-auto mb-5">
            <div className="absolute inset-0 rounded-full border-2 border-peach/50" />
            <div className="absolute inset-3 rounded-full border border-peach/25" />
            <div className="absolute left-1/2 -top-0.5 -translate-x-1/2 w-0.5 h-3 bg-peach/50" />
            <div className="absolute left-1/2 -bottom-0.5 -translate-x-1/2 w-0.5 h-3 bg-peach/50" />
            <div className="absolute -left-0.5 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-peach/50" />
            <div className="absolute -right-0.5 top-1/2 -translate-y-1/2 w-3 h-0.5 bg-peach/50" />
            <div className="absolute inset-0 flex items-center justify-center">
              <FiHeart size={26} className="text-peach" fill="currentColor" />
            </div>
          </div>

          <button
            onClick={surpriseUs}
            className="w-full flex items-center justify-center gap-2 py-3 rounded-full font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep mb-2"
          >
            <FaDice size={15} /> Surprise us
          </button>

          {picked && (
            <div className="bg-blush rounded-xl p-3.5 mb-1 text-center">
              <div className="text-sm font-semibold text-plumdeep">{picked.title}</div>
              <div className="flex flex-wrap justify-center gap-1 mt-1.5">
                {(picked.tags || []).map((t) => (
                  <span key={t} className="text-[10px] text-plum/70 bg-white/60 rounded-full px-2 py-0.5">
                    {tagLabel(t)}
                  </span>
                ))}
              </div>
              <div className="flex gap-2 mt-2.5 justify-center">
                <button onClick={surpriseUs} className="text-xs font-semibold text-plum">
                  Try another
                </button>
                {!picked.done && (
                  <button
                    onClick={() => {
                      toggle(picked)
                      setPicked((p) => (p ? { ...p, done: true } : p))
                    }}
                    className="text-xs font-semibold text-[#2f6d3f]"
                  >
                    Mark as done
                  </button>
                )}
              </div>
            </div>
          )}

          {total > 0 && (
            <div className="mt-5 pt-5 border-t border-black/10">
              <div className="flex items-center justify-between mb-2">
                <span className="text-sm font-semibold">Our progress</span>
                <span className="text-xs text-[#9a8a9c] font-semibold">
                  {doneCount} of {total}
                </span>
              </div>
              <div className="h-2 rounded-full bg-black/5 overflow-hidden">
                <div
                  className="h-full rounded-full bg-gradient-to-r from-peach to-gold transition-all"
                  style={{ width: `${pct}%` }}
                />
              </div>
              <div className="text-right text-[11px] text-[#9a8a9c] mt-1">{pct}%</div>
            </div>
          )}

          <div className="mt-5 pt-5 border-t border-black/10 text-center">
            <div className="flex flex-col items-center gap-1.5 mb-3">
              <span className="text-[11px] font-semibold uppercase tracking-wide bg-black/[0.03] text-[#7a6a7c] rounded-full px-3 py-1">
                Good dates
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide bg-black/[0.03] text-[#7a6a7c] rounded-full px-3 py-1">
                Brighter days
              </span>
              <span className="text-[11px] font-semibold uppercase tracking-wide bg-black/[0.03] text-[#7a6a7c] rounded-full px-3 py-1">
                Together
              </span>
            </div>
            <p className="text-xs text-[#9a8a9c] italic font-serif">Same direction. More to explore.</p>
          </div>
        </aside>
      </div>

      {addOpen && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50"
          onClick={() => setAddOpen(false)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-md w-full p-5"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between mb-3">
              <h3 className="text-sm font-bold">Add your own idea</h3>
              <button onClick={() => setAddOpen(false)} aria-label="Close" className="text-[#9a8a9c]">
                <FiX size={16} />
              </button>
            </div>
            <input
              autoFocus
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm mb-2"
              placeholder="e.g. Recreate our first date"
              value={newTitle}
              onChange={(e) => setNewTitle(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCustomIdea()}
            />
            <div className="flex flex-wrap gap-1.5 mb-4">
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
                className="flex-1 py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
              >
                Add idea
              </button>
              <button
                onClick={() => setAddOpen(false)}
                className="py-2.5 px-4 rounded-xl font-semibold text-sm border border-black/10 text-[#7a6a7c]"
              >
                Cancel
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}