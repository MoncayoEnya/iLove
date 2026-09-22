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
import { useSearchParams } from 'react-router-dom'
import toast from 'react-hot-toast'
import { FiBookOpen, FiEdit2, FiHeart, FiMoreHorizontal, FiTrash2, FiX } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { useMemberNames } from '../hooks/useMemberNames'
import { friendlyDate, todayStr, yesterdayStr } from '../utils/date'
import EmptyState from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'

export default function Journal({ embedded = false }) {
  const { firebaseUser, couple } = useAuth()
  const { hasPartner } = usePartner()
  const [, setSearchParams] = useSearchParams()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)
  const today = todayStr()
  const yesterday = useMemo(() => yesterdayStr(), [])

  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [jarCount, setJarCount] = useState(0)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
  const [openMenuId, setOpenMenuId] = useState(null)
  const [confirmingDelete, setConfirmingDelete] = useState(null)

  useEffect(() => {
    if (!coupleId) return
    const q = query(collection(db, 'couples', coupleId, 'journalEntries'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => {
      setEntries(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
      setLoading(false)
    })
    return unsub
  }, [coupleId])

  // Just a count, for the "Love Jar" teaser card — the jar's own tab owns
  // the actual notes.
  useEffect(() => {
    if (!coupleId) return
    const unsub = onSnapshot(collection(db, 'couples', coupleId, 'jar'), (snap) => setJarCount(snap.size))
    return unsub
  }, [coupleId])

  async function addEntry() {
    const t = text.trim()
    if (!t || !coupleId || saving) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'couples', coupleId, 'journalEntries'), {
        text: t,
        authorUid: firebaseUser.uid,
        date: today,
        createdAt: serverTimestamp(),
        editedAt: null,
      })
      setText('')
    } catch (e) {
      toast.error("Couldn't save that entry — try again.")
    } finally {
      setSaving(false)
    }
  }

  function startEdit(entry) {
    setOpenMenuId(null)
    setEditingId(entry.id)
    setEditingText(entry.text)
  }

  function cancelEdit() {
    setEditingId(null)
    setEditingText('')
  }

  async function saveEdit(entry) {
    const t = editingText.trim()
    if (!t) return
    try {
      await updateDoc(doc(db, 'couples', coupleId, 'journalEntries', entry.id), {
        text: t,
        editedAt: serverTimestamp(),
      })
      cancelEdit()
    } catch (e) {
      toast.error("Couldn't save your edit — try again.")
    }
  }

  async function remove(entry) {
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'journalEntries', entry.id))
      setConfirmingDelete(null)
      setOpenMenuId(null)
    } catch (e) {
      toast.error("Couldn't remove that entry — try again.")
    }
  }

  // Group entries by date for a day-by-day feed, most recent day first.
  const grouped = useMemo(() => {
    const map = {}
    for (const e of entries) {
      const d = e.date || 'Undated'
      if (!map[d]) map[d] = []
      map[d].push(e)
    }
    return map
  }, [entries])

  const sortedDates = Object.keys(grouped).sort((a, b) => (a < b ? 1 : -1))

  return (
    <div>
      {!embedded && (
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1">Journal</h1>
          <p className="text-sm text-[#7a6a7c]">
            A shared, browsable log — write whenever something's worth remembering, not just at
            check-in.
          </p>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr,260px] gap-5 items-start">
        <div className="min-w-0">
          <div className="bg-white border border-black/10 rounded-2xl p-5 mb-5">
            <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-2">
              New entry
            </label>
            <textarea
              rows={3}
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm bg-[#faf8f5] focus:bg-white transition-colors"
              placeholder="What's on your mind today?"
              value={text}
              onChange={(e) => setText(e.target.value)}
            />
            <div className="flex justify-end mt-2.5">
              <button
                onClick={addEntry}
                disabled={saving || !text.trim()}
                className="py-2 px-5 rounded-full font-semibold text-sm bg-gradient-to-r from-peach to-[#e88fa0] text-white disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Add entry'}
              </button>
            </div>
          </div>

          {loading ? (
            <SkeletonList count={3} lines={2} />
          ) : sortedDates.length === 0 ? (
            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <EmptyState
                icon={FiBookOpen}
                title="No entries yet"
                subtitle="Write the first one above — a good day, a hard day, or just a thought worth keeping."
              />
            </div>
          ) : (
            <div className="flex flex-col gap-3">
              {sortedDates.map((dateStr) =>
                grouped[dateStr].map((entry) => {
                  const isMine = entry.authorUid === firebaseUser.uid
                  const who = isMine ? 'You' : names[entry.authorUid] || (hasPartner ? 'Partner' : '...')
                  const isEditing = editingId === entry.id
                  const menuOpen = openMenuId === entry.id

                  return (
                    <div key={entry.id} className="bg-white border border-black/10 rounded-2xl p-5 relative">
                      <div className="flex items-start justify-between mb-1.5 gap-2">
                        <div>
                          <div className="text-sm font-semibold text-peach">
                            {friendlyDate(dateStr, today, yesterday)}
                          </div>
                          <div className="text-[11px] text-[#a892a9] mt-0.5">{who}</div>
                        </div>
                        {isMine && !isEditing && (
                          <div className="relative flex-shrink-0">
                            <button
                              onClick={() => setOpenMenuId(menuOpen ? null : entry.id)}
                              aria-label="Entry options"
                              className="w-7 h-7 rounded-lg flex items-center justify-center text-[#9a8a9c] hover:bg-black/5"
                            >
                              <FiMoreHorizontal size={15} />
                            </button>
                            {menuOpen && (
                              <div className="absolute right-0 top-8 z-10 bg-white border border-black/10 rounded-xl shadow-lg py-1 w-32">
                                <button
                                  onClick={() => startEdit(entry)}
                                  className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left hover:bg-black/5"
                                >
                                  <FiEdit2 size={12} /> Edit
                                </button>
                                {confirmingDelete === entry.id ? (
                                  <button
                                    onClick={() => remove(entry)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-[#9b3b3b] hover:bg-black/5"
                                  >
                                    <FiTrash2 size={12} /> Confirm delete
                                  </button>
                                ) : (
                                  <button
                                    onClick={() => setConfirmingDelete(entry.id)}
                                    className="w-full flex items-center gap-2 px-3 py-2 text-xs text-left text-[#9b3b3b] hover:bg-black/5"
                                  >
                                    <FiTrash2 size={12} /> Delete
                                  </button>
                                )}
                              </div>
                            )}
                          </div>
                        )}
                      </div>

                      {isEditing ? (
                        <div>
                          <textarea
                            rows={3}
                            className="w-full px-3 py-2 rounded-xl border border-black/10 text-sm"
                            value={editingText}
                            onChange={(e) => setEditingText(e.target.value)}
                            autoFocus
                          />
                          <div className="flex justify-end gap-2 mt-2">
                            <button
                              onClick={cancelEdit}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg border border-black/10"
                            >
                              Cancel
                            </button>
                            <button
                              onClick={() => saveEdit(entry)}
                              disabled={!editingText.trim()}
                              className="text-xs font-semibold px-3 py-1.5 rounded-lg bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
                            >
                              Save
                            </button>
                          </div>
                        </div>
                      ) : (
                        <>
                          <p className="font-serif italic text-[15px] leading-relaxed whitespace-pre-wrap">
                            {entry.text}
                          </p>
                          {entry.editedAt && <div className="text-[10.5px] text-[#a892a9] mt-1.5">edited</div>}
                        </>
                      )}
                    </div>
                  )
                })
              )}

              <div className="border border-dashed border-black/10 rounded-2xl py-6 flex flex-col items-center justify-center gap-1.5 text-[#c2b4c4]">
                <FiBookOpen size={16} />
                <span className="text-xs">Older entries appear here</span>
              </div>
            </div>
          )}
        </div>

        {/* Love Jar teaser card */}
        <div className="bg-blush rounded-2xl p-6 text-center lg:sticky lg:top-4">
          <div className="w-14 h-14 mx-auto rounded-2xl bg-white/70 flex items-center justify-center mb-4">
            <FiHeart size={22} className="text-peach" fill="currentColor" />
          </div>
          <h3 className="font-semibold text-plumdeep">The Love Jar</h3>
          <p className="text-[10px] font-semibold uppercase tracking-wide text-[#8a6b70] mt-1 mb-4">
            {jarCount} moment{jarCount === 1 ? '' : 's'} collected
          </p>
          <button
            onClick={() => setSearchParams({ tab: 'jar' })}
            className="w-full py-2.5 rounded-xl font-semibold text-sm bg-white text-peach border border-peach/30 hover:bg-peach/5 transition-colors"
          >
            Drop a heart
          </button>
        </div>
      </div>
    </div>
  )
}