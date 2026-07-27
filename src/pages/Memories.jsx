import { useEffect, useRef, useState } from 'react'
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
import toast from 'react-hot-toast'
import { ClipLoader } from 'react-spinners'
import { FiCamera, FiImage, FiHeart, FiSearch, FiTag, FiX } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import { compressImage } from '../utils/compressImage'
import CropModal from '../components/CropModal'
import EmptyState from '../components/EmptyState'

export default function Memories() {
  const { firebaseUser, couple } = useAuth()
  const names = useMemberNames(couple?.members)

  const [memories, setMemories] = useState([])
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

  useEffect(() => {
    if (!couple?.id) return
    const unsub = onSnapshot(
      query(collection(db, 'couples', couple.id, 'memories'), orderBy('createdAt', 'desc')),
      (snap) => setMemories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [couple?.id])

  function handlePhotoPick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.')
      return
    }
    setPhotoError('')
    // Open the crop dialog first — the actual compression happens once
    // the person confirms their crop, in handleCropped below.
    setCropSrc(URL.createObjectURL(file))
  }

  async function handleCropped(croppedFile) {
    setCropSrc(null)
    setPhotoLoading(true)
    try {
      // A bit bigger than the chat/check-in default since memories are
      // meant to be looked back on — still well under Firestore's 1MB
      // document limit, so no Cloud Storage (and no billing plan) needed.
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

  const allTags = [...new Set(memories.flatMap((m) => m.tags || []))].sort()

  const filteredMemories = memories.filter((m) => {
    if (activeTag && !(m.tags || []).includes(activeTag)) return false
    if (search.trim()) {
      const q = search.trim().toLowerCase()
      const hay = `${m.caption || ''} ${(m.tags || []).join(' ')}`.toLowerCase()
      if (!hay.includes(q)) return false
    }
    return true
  })

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Memories</h1>
        <p className="text-sm text-[#7a6a7c]">A shared photo album for the moments you want to keep.</p>
      </div>

      <CropModal
        imageSrc={cropSrc}
        aspect={4 / 3}
        onCancel={() => setCropSrc(null)}
        onCropped={handleCropped}
      />

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
      </div>

      {memories.length === 0 ? (
        <EmptyState
          icon={FiImage}
          title="No memories saved yet"
          subtitle="Add your first photo above — the little moments are worth keeping."
        />
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
