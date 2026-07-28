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
import { FiBookOpen, FiEdit2, FiTrash2, FiX } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { useMemberNames } from '../hooks/useMemberNames'
import { friendlyDate, todayStr, yesterdayStr } from '../utils/date'
import EmptyState from '../components/EmptyState'
import { SkeletonList } from '../components/Skeleton'

export default function Journal() {
  const { firebaseUser, couple } = useAuth()
  const { hasPartner } = usePartner()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)
  const today = todayStr()
  const yesterday = useMemo(() => yesterdayStr(), [])

  const [entries, setEntries] = useState([])
  const [loading, setLoading] = useState(true)
  const [text, setText] = useState('')
  const [saving, setSaving] = useState(false)
  const [editingId, setEditingId] = useState(null)
  const [editingText, setEditingText] = useState('')
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Journal</h1>
        <p className="text-sm text-[#7a6a7c]">
          A shared, browsable log — write whenever something's worth remembering, not just at
          check-in.
        </p>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-5 mb-5">
        <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">New entry</label>
        <textarea
          rows={3}
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          placeholder="What's on your mind today?"
          value={text}
          onChange={(e) => setText(e.target.value)}
        />
        <div className="flex justify-end mt-2.5">
          <button
            onClick={addEntry}
            disabled={saving || !text.trim()}
            className="py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
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
        <div className="flex flex-col gap-4">
          {sortedDates.map((dateStr) => (
            <div key={dateStr} className="bg-white border border-black/10 rounded-2xl p-5">
              <div className="text-xs font-semibold text-[#9a8a9c] uppercase tracking-wide mb-3">
                {friendlyDate(dateStr, today, yesterday)}
              </div>
              <div className="flex flex-col gap-3">
                {grouped[dateStr].map((entry) => {
                  const isMine = entry.authorUid === firebaseUser.uid
                  const who = isMine ? 'You' : names[entry.authorUid] || (hasPartner ? 'Partner' : '...')
                  const isEditing = editingId === entry.id

                  return (
                    <div key={entry.id} className="border border-black/5 rounded-xl p-3.5">
                      <div className="flex items-center justify-between mb-1.5">
                        <span className="text-sm font-semibold">{who}</span>
                        {isMine && !isEditing && (
                          <div className="flex items-center gap-1">
                            <button
                              onClick={() => startEdit(entry)}
                              aria-label="Edit entry"
                              className="w-7 h-7 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c]"
                            >
                              <FiEdit2 size={12} />
                            </button>
                            {confirmingDelete === entry.id ? (
                              <>
                                <button
                                  onClick={() => remove(entry)}
                                  className="text-xs font-semibold px-2.5 py-1 rounded-lg border border-[#e5b7b7] text-[#9b3b3b] whitespace-nowrap"
                                >
                                  Delete
                                </button>
                                <button
                                  onClick={() => setConfirmingDelete(null)}
                                  aria-label="Cancel delete"
                                  className="w-7 h-7 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c]"
                                >
                                  <FiX size={12} />
                                </button>
                              </>
                            ) : (
                              <button
                                onClick={() => setConfirmingDelete(entry.id)}
                                aria-label="Delete entry"
                                className="w-7 h-7 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c]"
                              >
                                <FiTrash2 size={12} />
                              </button>
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
                          <div className="text-sm whitespace-pre-wrap">{entry.text}</div>
                          {entry.editedAt && (
                            <div className="text-[10.5px] text-[#a892a9] mt-1.5">edited</div>
                          )}
                        </>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
