import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  arrayRemove,
  arrayUnion,
  collection,
  deleteDoc,
  doc,
  onSnapshot,
  orderBy,
  query,
  updateDoc,
} from 'firebase/firestore'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { ClipLoader } from 'react-spinners'
import {
  FiCalendar,
  FiCamera,
  FiCompass,
  FiGift,
  FiGrid,
  FiHeart,
  FiImage,
  FiList,
  FiMusic,
  FiSearch,
  FiStar,
  FiTag,
  FiX,
} from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import { compressImage } from '../utils/compressImage'
import { friendlyDate, todayStr } from '../utils/date'
import CropModal from '../components/CropModal'
import EmptyState from '../components/EmptyState'

// Milestone types a person can log by hand. "Streak" milestones are instead
// generated automatically below, never added manually here.
const MILESTONE_TYPES = [
  { key: 'first_date', label: 'First date', icon: FiStar, color: '#d9a06a' },
  { key: 'anniversary', label: 'Anniversary', icon: FiHeart, color: '#d97a6a' },
  { key: 'birthday', label: 'Birthday', icon: FiGift, color: '#e8b978' },
  { key: 'vacation', label: 'Trip / vacation', icon: FiCompass, color: '#7a9c8a' },
  { key: 'song', label: 'Favorite song', icon: FiMusic, color: '#a892a9' },
  { key: 'other', label: 'Other milestone', icon: FiStar, color: '#9a8a9c' },
]
const STREAK_MILESTONE = { key: 'streak', label: 'Streak', icon: FaFire, color: '#e07a52' }
const STREAK_THRESHOLDS = [7, 30, 50, 100, 200, 365, 500, 750, 1000]

function milestoneMeta(milestoneType) {
  if (milestoneType === 'streak') return STREAK_MILESTONE
  return MILESTONE_TYPES.find((m) => m.key === milestoneType) || MILESTONE_TYPES[MILESTONE_TYPES.length - 1]
}

// Firestore returns a Timestamp for createdAt on synced docs, or a plain JS
// Date right after a local write before the round trip completes. This
// normalizes either shape to 'YYYY-MM-DD' so entries can be grouped by day.
function entryDateStr(entry) {
  if (entry.date) return entry.date
  const ts = entry.createdAt
  if (!ts) return null
  if (typeof ts.toDate === 'function') return dayjs(ts.toDate()).format('YYYY-MM-DD')
  if (ts instanceof Date) return dayjs(ts).format('YYYY-MM-DD')
  return null
}

export default function Memories() {
  const { firebaseUser, couple } = useAuth()
  const names = useMemberNames(couple?.members)

  const [memories, setMemories] = useState([])
  const [loading, setLoading] = useState(true)
  const [layout, setLayout] = useState('timeline') // 'timeline' | 'grid'

  const [caption, setCaption] = useState('')
  const [tagsInput, setTagsInput] = useState('')
  const [search, setSearch] = useState('')
  const [activeTag, setActiveTag] = useState(null)
  const [newTag, setNewTag] = useState('')
  const [photoData, setPhotoData] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const [cropSrc, setCropSrc] = useState(null)
  const fileInputRef = useRef(null)

  // Add-entry form: photo (default, existing flow) or a hand-logged milestone.
  const [entryMode, setEntryMode] = useState('photo') // 'photo' | 'milestone'
  const [milestoneType, setMilestoneType] = useState('first_date')
  const [milestoneTitle, setMilestoneTitle] = useState('')
  const [milestoneDate, setMilestoneDate] = useState(todayStr())
  const [milestoneSaving, setMilestoneSaving] = useState(false)

  useEffect(() => {
    if (!couple?.id) return
    const unsub = onSnapshot(
      query(collection(db, 'couples', couple.id, 'memories'), orderBy('createdAt', 'desc')),
      (snap) => {
        setMemories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
        setLoading(false)
      }
    )
    return unsub
  }, [couple?.id])

  // --- Auto-generate a streak milestone the first time the couple crosses
  // each threshold. Self-contained: reads couple.streak (already tracked by
  // the dashboard) and writes into this same memories collection, guarded
  // against duplicates by checking what's already there.
  useEffect(() => {
    if (!couple?.id || loading) return
    const streak = couple.streak || 0
    const already = new Set(
      memories.filter((m) => m.entryType === 'milestone' && m.milestoneType === 'streak').map((m) => m.streakValue)
    )
    const nextThreshold = [...STREAK_THRESHOLDS].reverse().find((t) => streak >= t && !already.has(t))
    if (!nextThreshold) return
    ;(async () => {
      try {
        await addDoc(collection(db, 'couples', couple.id, 'memories'), {
          entryType: 'milestone',
          milestoneType: 'streak',
          streakValue: nextThreshold,
          title: `${nextThreshold} Day Streak`,
          date: todayStr(),
          caption: '',
          tags: [],
          from: firebaseUser.uid,
          auto: true,
          createdAt: new Date(),
        })
      } catch (e) {
        // Silent — this is a background nicety, not worth surfacing an error toast for.
      }
    })()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [couple?.id, couple?.streak, loading, memories.length])

  function handlePhotoPick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.')
      return
    }
    setPhotoError('')
    setCropSrc(URL.createObjectURL(file))
  }

  async function handleCropped(croppedFile) {
    setCropSrc(null)
    setPhotoLoading(true)
    try {
      setPhotoData(await compressImage(croppedFile, { maxWidth: 1200, maxHeight: 1200, maxBytes: 900_000 }))
    } catch (err) {
      setPhotoError(err.message)
    } finally {
      setPhotoLoading(false)
    }
  }

  async function addMemory() {
    if (!photoData) return
    setSaving(true)
    try {
      const tags = [...new Set(tagsInput.split(',').map((t) => t.trim().toLowerCase()).filter(Boolean))]
      await addDoc(collection(db, 'couples', couple.id, 'memories'), {
        entryType: 'photo',
        photoData,
        caption: caption.trim(),
        tags,
        from: firebaseUser.uid,
        createdAt: new Date(),
      })
      setCaption('')
      setTagsInput('')
      setPhotoData(null)
      toast.success('Memory saved.')
    } catch (e) {
      toast.error("Couldn't save that memory — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function addMilestone() {
    const title = milestoneTitle.trim()
    if (!title || !milestoneDate) return
    setMilestoneSaving(true)
    try {
      await addDoc(collection(db, 'couples', couple.id, 'memories'), {
        entryType: 'milestone',
        milestoneType,
        title,
        date: milestoneDate,
        caption: '',
        tags: [],
        from: firebaseUser.uid,
        auto: false,
        createdAt: new Date(`${milestoneDate}T12:00:00`),
      })
      setMilestoneTitle('')
      setMilestoneDate(todayStr())
      toast.success('Milestone added.')
    } catch (e) {
      toast.error("Couldn't save that milestone — try again.")
    } finally {
      setMilestoneSaving(false)
    }
  }

  async function togglePinned(memory) {
    try {
      await updateDoc(doc(db, 'couples', couple.id, 'memories', memory.id), {
        pinned: !memory.pinned,
      })
    } catch (e) {
      toast.error("Couldn't update that — try again.")
    }
  }

  async function removeMemory(id) {
    try {
      await deleteDoc(doc(db, 'couples', couple.id, 'memories', id))
      setLightbox(null)
      toast.success('Memory deleted.')
    } catch (e) {
      toast.error("Couldn't delete that memory — try again.")
    }
  }

  async function addTagToLightbox() {
    const tag = newTag.trim().toLowerCase()
    if (!tag || !lightbox) return
    setNewTag('')
    try {
      await updateDoc(doc(db, 'couples', couple.id, 'memories', lightbox.id), { tags: arrayUnion(tag) })
      setLightbox((l) => (l ? { ...l, tags: [...new Set([...(l.tags || []), tag])] } : l))
    } catch (e) {
      toast.error("Couldn't add that tag — try again.")
    }
  }

  async function removeTagFromLightbox(tag) {
    try {
      await updateDoc(doc(db, 'couples', couple.id, 'memories', lightbox.id), { tags: arrayRemove(tag) })
      setLightbox((l) => (l ? { ...l, tags: (l.tags || []).filter((t) => t !== tag) } : l))
    } catch (e) {
      toast.error("Couldn't remove that tag — try again.")
    }
  }

  const photoMemories = useMemo(() => memories.filter((m) => (m.entryType || 'photo') === 'photo'), [memories])
  const allTags = [...new Set(photoMemories.flatMap((m) => m.tags || []))].sort()

  const filteredMemories = photoMemories.filter((m) => {
    if (activeTag && !(m.tags || []).includes(activeTag)) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const hay = `${m.caption || ''} ${(m.tags || []).join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  // Chronological feed mixing photos and milestones, grouped by day.
  const timelineGroups = useMemo(() => {
    const withDates = memories
      .map((m) => ({ ...m, _dateStr: entryDateStr(m) }))
      .filter((m) => m._dateStr)
    const map = {}
    withDates.forEach((m) => {
      if (!map[m._dateStr]) map[m._dateStr] = []
      map[m._dateStr].push(m)
    })
    return Object.entries(map).sort((a, b) => (a[0] < b[0] ? 1 : -1))
  }, [memories])

  return (
    <div>
      <div className="mb-6 flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Memories</h1>
          <p className="text-sm text-[#7a6a7c]">Photos and milestones, in the order you made them.</p>
        </div>
        <div className="flex items-center gap-1.5 bg-black/[0.03] rounded-full p-1 w-fit">
          <button
            onClick={() => setLayout('timeline')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              layout === 'timeline' ? 'bg-white shadow-sm text-plum' : 'text-[#9a8a9c] hover:text-plum'
            }`}
          >
            <FiList size={13} /> Timeline
          </button>
          <button
            onClick={() => setLayout('grid')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              layout === 'grid' ? 'bg-white shadow-sm text-plum' : 'text-[#9a8a9c] hover:text-plum'
            }`}
          >
            <FiGrid size={13} /> Grid
          </button>
        </div>
      </div>

      <CropModal
        imageSrc={cropSrc}
        aspect={4 / 3}
        onCancel={() => setCropSrc(null)}
        onCropped={handleCropped}
      />

      <div className="bg-white border border-black/10 rounded-2xl p-5 mb-6">
        <div className="flex items-center gap-1.5 bg-black/[0.03] rounded-full p-1 mb-4 w-fit">
          <button
            onClick={() => setEntryMode('photo')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              entryMode === 'photo' ? 'bg-white shadow-sm text-plum' : 'text-[#9a8a9c] hover:text-plum'
            }`}
          >
            <FiCamera size={13} /> Add a photo
          </button>
          <button
            onClick={() => setEntryMode('milestone')}
            className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
              entryMode === 'milestone' ? 'bg-white shadow-sm text-plum' : 'text-[#9a8a9c] hover:text-plum'
            }`}
          >
            <FiStar size={13} /> Log a milestone
          </button>
        </div>

        {entryMode === 'photo' ? (
          <>
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              className="hidden"
              onChange={handlePhotoPick}
            />

            {!photoData ? (
              <button
                onClick={() => fileInputRef.current?.click()}
                disabled={photoLoading}
                className="flex items-center gap-1.5 text-sm px-3.5 py-2 rounded-xl border border-black/10 disabled:opacity-50"
              >
                <FiCamera size={14} />
                {photoLoading ? (
                  <>
                    <ClipLoader size={12} color="#3d2340" /> Adding photo
                  </>
                ) : (
                  'Choose a photo'
                )}
              </button>
            ) : (
              <div>
                <img src={photoData} alt="Preview" className="rounded-xl max-h-64 object-cover" />
                <button
                  onClick={() => fileInputRef.current?.click()}
                  className="text-xs text-peach font-semibold mt-2"
                >
                  Choose a different photo
                </button>
              </div>
            )}
            {photoError && <div className="text-xs text-[#9b3b3b] mt-1.5">{photoError}</div>}

            {photoData && (
              <>
                <textarea
                  rows={2}
                  className="w-full mt-3 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                  placeholder="Say something about this one (optional)"
                  value={caption}
                  onChange={(e) => setCaption(e.target.value)}
                />
                <input
                  className="w-full mt-2.5 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                  placeholder="Tags, comma separated (optional) — e.g. trip, anniversary, food"
                  value={tagsInput}
                  onChange={(e) => setTagsInput(e.target.value)}
                />
                <div className="flex gap-2 mt-3">
                  <button
                    onClick={addMemory}
                    disabled={saving}
                    className="flex items-center gap-2 py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
                  >
                    {saving && <ClipLoader size={12} color="#3d2340" />}
                    {saving ? 'Saving' : 'Save memory'}
                  </button>
                  <button
                    onClick={() => {
                      setPhotoData(null)
                      setCaption('')
                      setTagsInput('')
                    }}
                    disabled={saving}
                    className="py-2.5 px-5 rounded-xl text-sm border border-black/10"
                  >
                    Cancel
                  </button>
                </div>
              </>
            )}
          </>
        ) : (
          <div>
            <div className="flex flex-wrap gap-1.5 mb-3">
              {MILESTONE_TYPES.map((t) => {
                const Icon = t.icon
                const active = milestoneType === t.key
                return (
                  <button
                    key={t.key}
                    onClick={() => setMilestoneType(t.key)}
                    className={`flex items-center gap-1.5 text-xs px-2.5 py-1.5 rounded-full border ${
                      active ? 'border-peach bg-peachsoft font-semibold' : 'border-black/10 text-[#7a6a7c]'
                    }`}
                  >
                    <Icon size={12} style={{ color: active ? undefined : t.color }} /> {t.label}
                  </button>
                )
              })}
            </div>
            <div className="grid sm:grid-cols-2 gap-3">
              <input
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                placeholder="e.g. Our first date at the beach"
                value={milestoneTitle}
                onChange={(e) => setMilestoneTitle(e.target.value)}
              />
              <input
                type="date"
                className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                value={milestoneDate}
                onChange={(e) => setMilestoneDate(e.target.value)}
              />
            </div>
            <button
              onClick={addMilestone}
              disabled={milestoneSaving || !milestoneTitle.trim()}
              className="mt-3 py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
            >
              {milestoneSaving ? 'Saving...' : 'Add milestone'}
            </button>
            <p className="text-xs text-[#9a8a9c] mt-2.5">
              Streak milestones show up here on their own — no need to log those by hand.
            </p>
          </div>
        )}
      </div>

      {loading ? null : memories.length === 0 ? (
        <EmptyState
          icon={FiImage}
          title="No memories saved yet"
          subtitle="Add your first photo or milestone above — the little moments are worth keeping."
        />
      ) : layout === 'timeline' ? (
        <div className="flex flex-col gap-4">
          {timelineGroups.map(([dateStr, entries]) => (
            <div key={dateStr} className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="text-xs font-semibold text-[#9a8a9c] uppercase tracking-wide mb-3">
                {friendlyDate(dateStr)}
              </div>
              <div className="flex flex-col gap-3">
                {entries.map((entry) => {
                  if ((entry.entryType || 'photo') === 'milestone') {
                    const meta = milestoneMeta(entry.milestoneType)
                    const Icon = meta.icon
                    return (
                      <div
                        key={entry.id}
                        className="flex items-center gap-3 border border-black/5 rounded-xl p-3.5"
                      >
                        <div
                          className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                          style={{ backgroundColor: `${meta.color}20` }}
                        >
                          <Icon size={16} style={{ color: meta.color }} />
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-semibold">{entry.title}</div>
                          <div className="text-[10.5px] text-[#9a8a9c]">
                            {meta.label}
                            {entry.auto ? ' · auto-tracked' : ` · added by ${names[entry.from] || '...'}`}
                          </div>
                        </div>
                        {!entry.auto && entry.from === firebaseUser.uid && (
                          <button
                            onClick={() => removeMemory(entry.id)}
                            aria-label="Delete milestone"
                            className="w-7 h-7 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c] flex-shrink-0"
                          >
                            <FiX size={12} />
                          </button>
                        )}
                      </div>
                    )
                  }
                  return (
                    <button
                      key={entry.id}
                      onClick={() => {
                        setNewTag('')
                        setLightbox(entry)
                      }}
                      className="flex items-center gap-3 border border-black/5 rounded-xl p-2.5 text-left hover:bg-black/[0.02]"
                    >
                      <img
                        src={entry.photoData}
                        alt={entry.caption || ''}
                        className="w-14 h-14 rounded-lg object-cover flex-shrink-0"
                      />
                      <div className="flex-1 min-w-0">
                        <div className="text-sm truncate">{entry.caption || 'Untitled memory'}</div>
                        <div className="text-[10.5px] text-[#9a8a9c]">added by {names[entry.from] || '...'}</div>
                      </div>
                      {entry.pinned && <FiHeart size={13} className="text-peach flex-shrink-0" fill="currentColor" />}
                    </button>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-2 mb-3">
            <div className="relative flex-1">
              <FiSearch
                size={14}
                className="absolute left-3 top-1/2 -translate-y-1/2 text-[#9a8a9c]"
              />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Search captions and tags"
                className="w-full pl-8 pr-3 py-2 rounded-xl border border-black/10 text-sm"
              />
            </div>
          </div>

          {allTags.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-4">
              {allTags.map((t) => (
                <button
                  key={t}
                  onClick={() => setActiveTag((cur) => (cur === t ? null : t))}
                  className={`text-xs px-2.5 py-1 rounded-full border ${
                    activeTag === t
                      ? 'bg-peach text-plumdeep border-peach font-semibold'
                      : 'border-black/10 text-[#7a6a7c]'
                  }`}
                >
                  #{t}
                </button>
              ))}
            </div>
          )}

          {filteredMemories.length === 0 ? (
            <div className="text-sm text-[#a892a9] py-6 text-center">
              No memories match that search.
            </div>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
              {filteredMemories.map((m) => (
                <div key={m.id} className="relative rounded-2xl overflow-hidden border border-black/10">
                  <button
                    onClick={() => {
                      setNewTag('')
                      setLightbox(m)
                    }}
                    className="block w-full text-left"
                  >
                    <img src={m.photoData} alt={m.caption || ''} className="w-full h-40 object-cover" />
                  </button>
                  <button
                    onClick={(e) => {
                      e.stopPropagation()
                      togglePinned(m)
                    }}
                    aria-label={m.pinned ? 'Remove from favorite memories' : 'Add to favorite memories'}
                    aria-pressed={!!m.pinned}
                    title={m.pinned ? 'Remove from favorite memories' : 'Add to favorite memories'}
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-black/40 flex items-center justify-center text-white"
                  >
                    <FiHeart size={13} fill={m.pinned ? 'currentColor' : 'none'} />
                  </button>
                </div>
              ))}
            </div>
          )}
        </>
      )}

      {lightbox && (
        <div
          className="fixed inset-0 bg-black/60 flex items-center justify-center p-6 z-50"
          onClick={() => setLightbox(null)}
        >
          <div
            className="bg-white rounded-2xl overflow-hidden max-w-lg w-full"
            onClick={(e) => e.stopPropagation()}
          >
            <img src={lightbox.photoData} alt={lightbox.caption || ''} className="w-full max-h-[70vh] object-cover" />
            <div className="p-5">
              {lightbox.caption && <div className="text-sm mb-2">{lightbox.caption}</div>}
              <div className="text-xs text-[#9a8a9c]">
                Added by {names[lightbox.from] || '...'}
              </div>

              <div className="flex flex-wrap items-center gap-1.5 mt-3">
                {(lightbox.tags || []).map((t) => (
                  <span
                    key={t}
                    className="flex items-center gap-1 text-xs px-2.5 py-1 rounded-full border border-black/10 text-[#7a6a7c]"
                  >
                    #{t}
                    <button
                      onClick={() => removeTagFromLightbox(t)}
                      aria-label={`Remove tag ${t}`}
                      className="text-[#a892a9]"
                    >
                      <FiX size={11} />
                    </button>
                  </span>
                ))}
                <div className="flex items-center gap-1">
                  <FiTag size={12} className="text-[#a892a9]" />
                  <input
                    value={newTag}
                    onChange={(e) => setNewTag(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault()
                        addTagToLightbox()
                      }
                    }}
                    placeholder="Add tag"
                    className="text-xs px-2 py-1 rounded-full border border-black/10 w-20 focus:w-28 transition-all"
                  />
                </div>
              </div>
              <div className="flex gap-2 mt-4">
                <button
                  onClick={() => {
                    togglePinned(lightbox)
                    setLightbox((l) => (l ? { ...l, pinned: !l.pinned } : l))
                  }}
                  className="flex items-center gap-1.5 text-xs py-2 px-3.5 rounded-xl border border-black/10"
                >
                  <FiHeart size={12} fill={lightbox.pinned ? 'currentColor' : 'none'} />
                  {lightbox.pinned ? 'Favorited' : 'Favorite'}
                </button>
                {lightbox.from === firebaseUser.uid && (
                  <button
                    onClick={() => removeMemory(lightbox.id)}
                    className="text-xs text-[#9b3b3b] py-2 px-3.5 rounded-xl border border-black/10"
                  >
                    Delete
                  </button>
                )}
                <button
                  onClick={() => setLightbox(null)}
                  className="text-xs py-2 px-3.5 rounded-xl border border-black/10 ml-auto"
                >
                  Close
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}