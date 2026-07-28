import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'
import { FiCoffee, FiCompass, FiExternalLink, FiHeart, FiMapPin, FiStar, FiSun, FiTrash2 } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import EmptyState from '../components/EmptyState'

// Same tagging pattern as Love Jar's categories — a fixed set of chips,
// no free-tagging. Kept to a simple list for v1 (no Maps SDK / pins);
// the address field just powers a plain Google Maps search link.
const PLACE_CATEGORIES = [
  { value: 'date-spot', label: 'Date spot', icon: FiHeart },
  { value: 'restaurant', label: 'Restaurant / cafe', icon: FiCoffee },
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

export default function SharedPlaces() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [places, setPlaces] = useState([])
  const [activeFilter, setActiveFilter] = useState(null) // null = all

  const [name, setName] = useState('')
  const [address, setAddress] = useState('')
  const [note, setNote] = useState('')
  const [category, setCategory] = useState('date-spot')
  const [saving, setSaving] = useState(false)

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
        addedBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      })
      setName('')
      setAddress('')
      setNote('')
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
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Shared places</h1>
        <p className="text-sm text-[#7a6a7c]">Spots you love, want to try, or want to go back to — together.</p>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
        <h3 className="font-semibold mb-3">Add a place</h3>
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

        <div className="flex flex-wrap gap-1.5 mb-3">
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
          Save place
        </button>
      </div>

      <div className="flex flex-wrap gap-1.5 mb-4">
        <button
          onClick={() => setActiveFilter(null)}
          className={`text-[11px] font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
            !activeFilter ? 'bg-plumdeep text-white border-plumdeep' : 'border-black/10 text-[#9a8a9c] hover:bg-black/5'
          }`}
        >
          All
        </button>
        {PLACE_CATEGORIES.map(({ value, label, icon: Icon }) => (
          <button
            key={value}
            onClick={() => setActiveFilter(value)}
            className={`flex items-center gap-1 text-[11px] font-medium px-2 py-1.5 rounded-full border transition-colors ${
              activeFilter === value
                ? 'bg-plumdeep text-white border-plumdeep'
                : 'border-black/10 text-[#9a8a9c] hover:bg-black/5'
            }`}
          >
            <Icon size={11} /> {label}
          </button>
        ))}
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-5">
        {filtered.length === 0 ? (
          <EmptyState
            icon={FiMapPin}
            title="No places yet"
            subtitle="Add the first spot above — a favorite, a date idea, or somewhere you want to go together."
          />
        ) : (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {filtered.map((p) => {
              const meta = categoryMeta(p.category)
              const Icon = meta.icon
              return (
                <div key={p.id} className="border border-black/10 rounded-xl p-3.5 bg-[#faf6f8]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#a892a9]">
                      <Icon size={12} /> {meta.label}
                    </div>
                    <button
                      onClick={() => removePlace(p)}
                      aria-label="Remove"
                      className="w-6 h-6 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c] flex-shrink-0"
                    >
                      <FiTrash2 size={11} />
                    </button>
                  </div>
                  <div className="text-sm font-semibold text-ink mt-1.5">{p.name}</div>
                  {p.address && <div className="text-xs text-[#9a8a9c] mt-0.5">{p.address}</div>}
                  {p.note && <p className="text-sm text-ink leading-snug mt-1.5">{p.note}</p>}
                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-[11px] text-[#9a8a9c]">added by {names[p.addedBy] || '...'}</span>
                    <a
                      href={mapsSearchUrl(p)}
                      target="_blank"
                      rel="noreferrer"
                      className="flex items-center gap-1 text-[11px] font-semibold text-[#7a6a7c] hover:text-ink"
                    >
                      Open in Maps <FiExternalLink size={11} />
                    </a>
                  </div>
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
