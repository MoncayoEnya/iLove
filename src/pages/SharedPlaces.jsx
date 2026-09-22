import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import dayjs from 'dayjs'
import toast from 'react-hot-toast'
import { ClipLoader } from 'react-spinners'
import {
  FiCamera,
  FiCoffee,
  FiCompass,
  FiExternalLink,
  FiHeart,
  FiMapPin,
  FiPlus,
  FiStar,
  FiSun,
  FiTrash2,
} from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import { compressImage } from '../utils/compressImage'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import CropModal from '../components/CropModal'

// Same tagging pattern as Love Jar's categories — a fixed set of chips,
// no free-tagging. Kept to a simple list for v1 (no Maps SDK / pins);
// the address field just powers a plain Google Maps search link.
const PLACE_CATEGORIES = [
  { value: 'date-spot', label: 'Date spot', icon: FiHeart },
  { value: 'restaurant', label: 'Restaurant', icon: FiCoffee },
  { value: 'outdoor', label: 'Outdoor', icon: FiSun },
  { value: 'travel-goal', label: 'Travel goal', icon: FiCompass },
  { value: 'favorite', label: 'Favorite', icon: FiStar },
  { value: 'other', label: 'Other', icon: FiMapPin },
]

function categoryMeta(value) {
  return PLACE_CATEGORIES.find((c) => c.value === value) || PLACE_CATEGORIES[PLACE_CATEGORIES.length - 1]
}

function mapsSearchUrl(place) {
  const q = [place.name, place.address].filter(Boolean).join(', ')
  return `https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(q)}`
}

function addedDate(place) {
  const ts = place.createdAt
  if (ts?.toDate) return dayjs(ts.toDate()).format('MMM D')
  if (ts instanceof Date) return dayjs(ts).format('MMM D')
  return 'just now'
}

export default function SharedPlaces() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [places, setPlaces] = useState([])
  const [activeFilter, setActiveFilter] = useState(null) // null = all
  const [sheetOpen, setSheetOpen] = useState(false)

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('date-spot')
  const [saving, setSaving] = useState(false)

  const [photoData, setPhotoData] = useState(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [cropSrc, setCropSrc] = useState(null)
  const fileInputRef = useRef(null)

  useEffect(() => {
    if (!coupleId) return
    const unsub = onSnapshot(collection(db, 'couples', coupleId, 'sharedPlaces'), (snap) =>
      setPlaces(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [coupleId])

  const filtered = useMemo(
    () =>
      (activeFilter ? places.filter((p) => p.category === activeFilter) : places)
        .slice()
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)),
    [places, activeFilter]
  )

  function handlePhotoPick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    setPhotoError('')
    setCropSrc(URL.createObjectURL(file))
  }

  async function handleCropped(croppedFile) {
    setCropSrc(null)
    setPhotoLoading(true)
    try {
      setPhotoData(await compressImage(croppedFile, { maxWidth: 1000, maxHeight: 750, maxBytes: 800_000 }))
    } catch (err) {
      setPhotoError(err.message || "Couldn't use that photo.")
    } finally {
      setPhotoLoading(false)
    }
  }

  function resetForm() {
    setName('')
    setAddress('')
    setNote('')
    setCategory('date-spot')
    setPhotoData(null)
    setPhotoError('')
  }

  async function addPlace() {
    const n = name.trim()
    if (!n || !coupleId) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'couples', coupleId, 'sharedPlaces'), {
        name: n,
        address: address.trim(),
        note: note.trim(),
        category,
        imageUrl: photoData || null,
        addedBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      })
      resetForm()
      setSheetOpen(false)
      toast.success('Added to your places.')
    } catch (e) {
      toast.error("Couldn't add that — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function removePlace(place) {
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'sharedPlaces', place.id))
    } catch (e) {
      toast.error("Couldn't remove that — try again.")
    }
  }

  return (
    <div>
      <div className="flex flex-wrap items-start justify-between gap-3 mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Shared places</h1>
          <p className="text-sm text-[#7a6a7c]">A curated map of your world, from first dates to future dreams.</p>
        </div>
        <button
          onClick={() => setSheetOpen(true)}
          className="flex items-center gap-1.5 px-4 py-2.5 rounded-full font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep shadow-sm hover:shadow-md transition-shadow flex-shrink-0"
        >
          <FiPlus size={15} /> Add new place
        </button>
      </div>

      <div className="flex flex-wrap gap-2 mb-5">
        <button
          onClick={() => setActiveFilter(null)}
          className={`text-xs font-semibold px-3.5 py-2 rounded-full border transition-colors ${
            !activeFilter
              ? 'bg-plumdeep text-white border-plumdeep'
              : 'bg-white border-black/10 text-[#7a6a7c] hover:bg-black/5'
          }`}
        >
          All spots
        </button>
        {PLACE_CATEGORIES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setActiveFilter(value)}
            className={`flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border transition-colors ${
              activeFilter === value
                ? 'bg-plumdeep text-white border-plumdeep'
                : 'bg-white border-black/10 text-[#7a6a7c] hover:bg-black/5'
            }`}
          >
            <Icon size={12} /> {label}
          </button>
        ))}
      </div>

      {filtered.length === 0 ? (
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <EmptyState
            icon={FiMapPin}
            title="No places yet"
            subtitle="Add the first spot — a favorite, a date idea, or somewhere you want to go together."
          />
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-5">
          {filtered.map((p) => {
            const meta = categoryMeta(p.category)
            const Icon = meta.icon
            return (
              <div
                key={p.id}
                className="group bg-white border border-black/10 rounded-2xl overflow-hidden hover:shadow-lg hover:-translate-y-0.5 transition-all duration-200"
              >
                <div className={`relative h-44 overflow-hidden place-cover-${meta.value}`}>
                  {p.imageUrl ? (
                    <img
                      src={p.imageUrl}
                      alt={p.name}
                      className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-300"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center">
                      <Icon size={30} className={`place-tag-${meta.value}`} style={{ background: 'transparent' }} />
                    </div>
                  )}
                  <button
                    onClick={() => removePlace(p)}
                    aria-label="Remove"
                    className="absolute top-2 right-2 w-7 h-7 rounded-full bg-white/85 backdrop-blur flex items-center justify-center text-[#9a8a9c] opacity-0 group-hover:opacity-100 transition-opacity shadow-sm"
                  >
                    <FiTrash2 size={12} />
                  </button>
                </div>

                <div className="p-4">
                  <div className="flex items-center justify-between gap-2">
                    <span className={`text-[10.5px] font-bold tracking-wide uppercase px-2 py-1 rounded-full place-tag-${meta.value}`}>
                      {meta.label}
                    </span>
                    {p.address && <span className="text-xs text-[#9a8a9c] truncate max-w-[45%]">{p.address}</span>}
                  </div>

                  <div className="text-lg font-bold text-ink mt-2 truncate">{p.name}</div>

                  {p.note && (
                    <p className="text-sm text-[#7a6a7c] italic font-serif leading-snug mt-1.5 line-clamp-2">
                      "{p.note}"
                    </p>
                  )}

                  <div className="flex items-center justify-between mt-3 pt-2.5 border-t border-black/5">
                    <span className="text-[11px] text-[#9a8a9c]">
                      Added {addedDate(p)}
                      {names[p.addedBy] && ` · ${names[p.addedBy]}`}
                    </span>
                    <div className="flex items-center gap-2">
                      <a
                        href={mapsSearchUrl(p)}
                        target="_blank"
                        rel="noreferrer"
                        aria-label="Open in Maps"
                        title="Open in Maps"
                        className="w-6 h-6 rounded-full border border-black/10 flex items-center justify-center text-[#7a6a7c] hover:text-ink hover:bg-black/5 transition-colors"
                      >
                        <FiExternalLink size={11} />
                      </a>
                      <span className={`w-2.5 h-2.5 rounded-full place-dot-${meta.value}`} />
                    </div>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      <BottomSheet open={sheetOpen} onClose={() => setSheetOpen(false)} title="Add a place">
        <CropModal imageSrc={cropSrc} aspect={4 / 3} onCancel={() => setCropSrc(null)} onCropped={handleCropped} />

        <input ref={fileInputRef} type="file" accept="image/*" className="hidden" onChange={handlePhotoPick} />

        {!photoData ? (
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={photoLoading}
            className="w-full flex flex-col items-center justify-center gap-1.5 py-6 rounded-xl border-2 border-dashed border-black/10 text-[#9a8a9c] hover:bg-black/[0.03] transition-colors disabled:opacity-50 mb-3"
          >
            {photoLoading ? (
              <>
                <ClipLoader size={16} color="#3d2340" />
                <span className="text-xs font-medium mt-1">Adding photo…</span>
              </>
            ) : (
              <>
                <FiCamera size={18} />
                <span className="text-xs font-medium">Add a cover photo (optional)</span>
              </>
            )}
          </button>
        ) : (
          <div className="relative mb-3">
            <img src={photoData} alt="Preview" className="w-full h-36 object-cover rounded-xl" />
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute bottom-2 right-2 text-[11px] font-semibold bg-white/90 backdrop-blur px-2.5 py-1 rounded-full text-plumdeep shadow-sm"
            >
              Change photo
            </button>
          </div>
        )}
        {photoError && <div className="text-xs text-[#9b3b3b] mb-2">{photoError}</div>}

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <input
            className="px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Place name"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <input
            className="px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Address (optional)"
            value={address}
            onChange={(e) => setAddress(e.target.value)}
          />
        </div>
        <input
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm mb-3"
          placeholder="Note — why you love it, what to order, when to go..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex flex-wrap gap-1.5 mb-4">
          {PLACE_CATEGORIES.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setCategory(value)}
              aria-pressed={category === value}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                category === value
                  ? 'bg-gradient-to-br from-peach to-gold text-plumdeep border-transparent'
                  : 'border-black/10 text-[#7a6a7c] hover:bg-black/5'
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <button
          onClick={addPlace}
          disabled={saving || !name.trim()}
          className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
        >
          {saving ? 'Saving…' : 'Save place'}
        </button>
      </BottomSheet>
    </div>
  )
}