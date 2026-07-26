import { useEffect, useRef, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, orderBy, query } from 'firebase/firestore'
import { FiCamera } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import { compressImage } from '../utils/compressImage'

export default function Memories() {
  const { firebaseUser, couple } = useAuth()
  const names = useMemberNames(couple?.members)

  const [memories, setMemories] = useState([])
  const [caption, setCaption] = useState('')
  const [photoData, setPhotoData] = useState(null)
  const [photoError, setPhotoError] = useState('')
  const [photoLoading, setPhotoLoading] = useState(false)
  const [saving, setSaving] = useState(false)
  const [lightbox, setLightbox] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!couple?.id) return
    const unsub = onSnapshot(
      query(collection(db, 'couples', couple.id, 'memories'), orderBy('createdAt', 'desc')),
      (snap) => setMemories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [couple?.id])

  async function handlePhotoPick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.')
      return
    }
    setPhotoError('')
    setPhotoLoading(true)
    try {
      // A bit bigger than the chat/check-in default since memories are
      // meant to be looked back on — still well under Firestore's 1MB
      // document limit, so no Cloud Storage (and no billing plan) needed.
      setPhotoData(await compressImage(file, { maxWidth: 1200, maxHeight: 1200, maxBytes: 900_000 }))
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
      await addDoc(collection(db, 'couples', couple.id, 'memories'), {
        photoData,
        caption: caption.trim(),
        from: firebaseUser.uid,
        createdAt: new Date(),
      })
      setCaption('')
      setPhotoData(null)
    } finally {
      setSaving(false)
    }
  }

  async function removeMemory(id) {
    await deleteDoc(doc(db, 'couples', couple.id, 'memories', id))
    setLightbox(null)
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Memories</h1>
        <p className="text-sm text-[#7a6a7c]">A shared photo album for the moments you want to keep.</p>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-5 mb-6">
        <h3 className="font-semibold mb-3">Add a memory</h3>

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
            {photoLoading ? 'Adding photo...' : 'Choose a photo'}
          </button>
        ) : (
          <img src={photoData} alt="Preview" className="rounded-xl max-h-64 object-cover" />
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
            <div className="flex gap-2 mt-3">
              <button
                onClick={addMemory}
                disabled={saving}
                className="py-2.5 px-5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
              >
                {saving ? 'Saving...' : 'Save memory'}
              </button>
              <button
                onClick={() => {
                  setPhotoData(null)
                  setCaption('')
                }}
                disabled={saving}
                className="py-2.5 px-5 rounded-xl text-sm border border-black/10"
              >
                Cancel
              </button>
            </div>
          </>
        )}
      </div>

      {memories.length === 0 ? (
        <div className="text-sm text-[#a892a9]">No memories saved yet — add your first one above.</div>
      ) : (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          {memories.map((m) => (
            <button
              key={m.id}
              onClick={() => setLightbox(m)}
              className="rounded-2xl overflow-hidden border border-black/10 text-left"
            >
              <img src={m.photoData} alt={m.caption || ''} className="w-full h-40 object-cover" />
            </button>
          ))}
        </div>
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
              <div className="flex gap-2 mt-4">
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