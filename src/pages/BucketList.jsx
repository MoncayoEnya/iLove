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
import { FiCheck, FiList, FiTrash2 } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import EmptyState from '../components/EmptyState'

export default function BucketList() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [items, setItems] = useState([])
  const [text, setText] = useState('')

  useEffect(() => {
    if (!coupleId) return
    const q = query(collection(db, 'couples', coupleId, 'bucketList'), orderBy('createdAt', 'desc'))
    const unsub = onSnapshot(q, (snap) => setItems(snap.docs.map((d) => ({ id: d.id, ...d.data() }))))
    return unsub
  }, [coupleId])

  async function addItem() {
    const t = text.trim()
    if (!t || !coupleId) return
    setText('')
    try {
      await addDoc(collection(db, 'couples', coupleId, 'bucketList'), {
        text: t,
        done: false,
        completedAt: null,
        addedBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      })
    } catch (e) {
      setText(t)
      toast.error("Couldn't add that — try again.")
    }
  }

  async function toggle(item) {
    const ref = doc(db, 'couples', coupleId, 'bucketList', item.id)
    try {
      if (item.done) {
        await updateDoc(ref, { done: false, completedAt: null })
      } else {
        await updateDoc(ref, { done: true, completedAt: serverTimestamp() })
        toast.success(`"${item.text}" — checked off!`)
      }
    } catch (e) {
      toast.error("Couldn't update that — try again.")
    }
  }

  async function remove(item) {
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'bucketList', item.id))
    } catch (e) {
      toast.error("Couldn't remove that — try again.")
    }
  }

  const openItems = useMemo(() => items.filter((i) => !i.done), [items])
  const doneItems = useMemo(
    () => items.filter((i) => i.done).sort((a, b) => (b.completedAt?.seconds || 0) - (a.completedAt?.seconds || 0)),
    [items]
  )
  const total = items.length
  const doneCount = doneItems.length
  const pct = total > 0 ? Math.round((doneCount / total) * 100) : 0

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Bucket list</h1>
        <p className="text-sm text-[#7a6a7c]">The things you want to do together, someday and soon.</p>
      </div>

      {total > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold">
              {doneCount} of {total} complete
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

      <div className="bg-white border border-black/10 rounded-2xl p-5">
        <h3 className="font-semibold mb-3">To do together</h3>

        {openItems.length === 0 && (
          <EmptyState
            icon={FiList}
            title="No items yet"
            subtitle="Add something you both want to experience — a trip, a first, a tradition — below."
          />
        )}

        {openItems.map((item) => (
          <div key={item.id} className="flex items-start gap-2.5 py-2.5 border-b border-black/10 last:border-b-0">
            <div
              onClick={() => toggle(item)}
              className="w-5 h-5 rounded-md border border-black/20 flex items-center justify-center text-xs cursor-pointer mt-0.5 flex-shrink-0"
            />
            <div className="flex-1">
              <span>{item.text}</span>
              <div className="text-xs text-[#9a8a9c] mt-1">added by {names[item.addedBy] || '...'}</div>
            </div>
            <button
              onClick={() => remove(item)}
              aria-label="Remove"
              className="w-7 h-7 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c] flex-shrink-0 mt-0.5"
            >
              <FiTrash2 size={13} />
            </button>
          </div>
        ))}

        <div className="mt-4 pt-4 border-t border-black/10">
          <label className="block text-xs text-[#6b5a6d] mb-1.5 font-semibold">Add to the list</label>
          <div className="flex gap-2">
            <input
              className="flex-1 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              placeholder="e.g. Watch the sunrise together"
              value={text}
              onChange={(e) => setText(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addItem()}
            />
            <button
              onClick={addItem}
              className="py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep flex-shrink-0"
            >
              Add
            </button>
          </div>
        </div>
      </div>

      {doneItems.length > 0 && (
        <div className="bg-white border border-black/10 rounded-2xl p-5 mt-4">
          <h3 className="font-semibold mb-3">Completed</h3>
          {doneItems.map((item) => (
            <div key={item.id} className="flex items-start gap-2.5 py-2 border-b border-black/10 last:border-b-0">
              <div
                onClick={() => toggle(item)}
                className="w-5 h-5 rounded-md border border-ok bg-ok text-white flex items-center justify-center cursor-pointer mt-0.5 flex-shrink-0"
              >
                <FiCheck size={12} strokeWidth={3} />
              </div>
              <div className="flex-1">
                <div className="line-through opacity-50">{item.text}</div>
                <div className="text-xs text-[#9a8a9c] mt-1">added by {names[item.addedBy] || '...'}</div>
              </div>
              <button
                onClick={() => remove(item)}
                aria-label="Remove"
                className="w-7 h-7 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c] flex-shrink-0"
              >
                <FiTrash2 size={13} />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
