import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'
import {
  FiExternalLink,
  FiHeart,
  FiMoon,
  FiMoreVertical,
  FiMusic,
  FiPause,
  FiPlay,
  FiPlus,
  FiSun,
  FiTrash2,
  FiZap,
} from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import EmptyState from '../components/EmptyState'

// No Spotify/YouTube OAuth or API key here on purpose — this is the "80% of
// the emotional value, none of the integration cost" version from the
// feature plan. A song is just a title/artist (free text) plus an optional
// link. If that link is a public YouTube or Spotify URL we detect it and
// render the official public embed player (no auth needed for either); any
// other link just becomes a plain "Open" button. This keeps the whole
// feature on the free Firebase Spark plan with zero backend work.

const TAGS = [
  { value: 'our-song', label: 'Our song', icon: FiHeart },
  { value: 'love', label: 'Love', icon: FiHeart },
  { value: 'chill', label: 'Chill', icon: FiMoon },
  { value: 'hype', label: 'Hype', icon: FiZap },
  { value: 'nostalgic', label: 'Nostalgic', icon: FiSun },
  { value: 'other', label: 'Other', icon: FiMusic },
]

function tagMeta(value) {
  return TAGS.find((t) => t.value === value) || TAGS[TAGS.length - 1]
}

// Returns { type: 'youtube' | 'spotify', embedUrl, height } or null if the
// url doesn't match either platform (or is empty) — in which case we just
// show a plain external link instead of an embed.
function detectEmbed(url) {
  if (!url) return null
  const yt = url.match(
    /(?:youtube\.com\/(?:watch\?v=|embed\/|shorts\/)|youtu\.be\/|music\.youtube\.com\/watch\?v=)([a-zA-Z0-9_-]{11})/
  )
  if (yt) {
    return { type: 'youtube', embedUrl: `https://www.youtube.com/embed/${yt[1]}`, height: 200 }
  }
  const sp = url.match(/open\.spotify\.com\/(track|album|playlist|episode)\/([a-zA-Z0-9]+)/)
  if (sp) {
    const [, kind, id] = sp
    return {
      type: 'spotify',
      embedUrl: `https://open.spotify.com/embed/${kind}/${id}`,
      height: kind === 'track' || kind === 'episode' ? 152 : 352,
    }
  }
  return null
}

export default function SharedPlaylist() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const names = useMemberNames(couple?.members)

  const [songs, setSongs] = useState([])
  const [activeFilter, setActiveFilter] = useState(null) // null = all
  const [expanded, setExpanded] = useState({}) // songId -> bool, embed open/closed
  const [menuOpenId, setMenuOpenId] = useState(null)

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [tag, setTag] = useState('our-song')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!coupleId) return
    const unsub = onSnapshot(collection(db, 'couples', coupleId, 'playlist'), (snap) =>
      setSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [coupleId])

  const filtered = useMemo(
    () =>
      (activeFilter ? songs.filter((s) => s.tag === activeFilter) : songs)
        .slice()
        .sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)),
    [songs, activeFilter]
  )

  async function addSong() {
    const t = title.trim()
    if (!t || !coupleId) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'couples', coupleId, 'playlist'), {
        title: t,
        artist: artist.trim(),
        url: url.trim(),
        note: note.trim(),
        coverUrl: coverUrl.trim(),
        tag,
        addedBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      })
      setTitle('')
      setArtist('')
      setUrl('')
      setNote('')
      setCoverUrl('')
      toast.success('Added to your playlist.')
    } catch (e) {
      toast.error("Couldn't add that — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function removeSong(song) {
    try {
      await deleteDoc(doc(db, 'couples', coupleId, 'playlist', song.id))
    } catch (e) {
      toast.error("Couldn't remove that — try again.")
    } finally {
      setMenuOpenId(null)
    }
  }

  function toggleExpanded(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
    setMenuOpenId(null)
  }

  function toggleMenu(id, e) {
    e.stopPropagation()
    setMenuOpenId((cur) => (cur === id ? null : id))
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Shared playlist</h1>
        <p className="flex items-center gap-1.5 text-sm text-[#7a6a7c]">
          Songs that mean something — build it together, one track at a time.
          <FiHeart size={13} className="text-peach flex-shrink-0" />
        </p>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-5 sm:p-6 mb-5">
        <h3 className="font-bold text-lg mb-4">Add a song</h3>

        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3 mb-3">
          <div>
            <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">Song title</label>
            <input
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              placeholder="e.g. Golden Hour"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">Artist</label>
            <input
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              placeholder="e.g. JVKE"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">Link</label>
            <input
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              placeholder="Spotify, YouTube..."
              value={url}
              onChange={(e) => setUrl(e.target.value)}
            />
          </div>
          <div>
            <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">Note (optional)</label>
            <input
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              placeholder="e.g. Reminds me of our trip"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
          </div>
        </div>

        <div className="mb-3">
          <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">Cover image URL (optional)</label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Paste an album art image link"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />
        </div>

        <div className="flex flex-wrap gap-1.5 mb-4">
          {TAGS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTag(value)}
              aria-pressed={tag === value}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border transition-colors ${
                tag === value
                  ? 'bg-gradient-to-br from-peach to-gold text-plumdeep border-transparent'
                  : 'border-black/10 text-[#7a6a7c] hover:bg-black/5'
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>

        <button
          onClick={addSong}
          disabled={saving || !title.trim()}
          className="flex items-center gap-1.5 px-5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
        >
          <FiPlus size={15} /> {saving ? 'Adding…' : 'Add to playlist'}
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
          All
        </button>
        {TAGS.map(({ value, label, icon: Icon }) => (
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
            icon={FiMusic}
            title="No songs yet"
            subtitle="Add the first track above — your song, a favorite, or one that just reminds you of them."
          />
        </div>
      ) : (
        <div
          onClick={() => menuOpenId && setMenuOpenId(null)}
          className="bg-white border border-black/10 rounded-2xl overflow-hidden divide-y divide-black/5"
        >
          {filtered.map((s) => {
            const meta = tagMeta(s.tag)
            const Icon = meta.icon
            const embed = detectEmbed(s.url)
            const isOpen = !!expanded[s.id]
            const menuOpen = menuOpenId === s.id
            return (
              <div key={s.id} className="relative">
                <div className="flex items-center gap-3 px-4 py-3 hover:bg-black/[0.02] transition-colors">
                  <div
                    className={`w-14 h-14 rounded-xl overflow-hidden flex-shrink-0 flex items-center justify-center playlist-cover-${meta.value}`}
                  >
                    {s.coverUrl ? (
                      <img src={s.coverUrl} alt={s.title} className="w-full h-full object-cover" />
                    ) : (
                      <Icon size={20} className={`playlist-tag-${meta.value}`} style={{ background: 'transparent' }} />
                    )}
                  </div>

                  <div className="flex-1 min-w-0">
                    <div className="font-bold text-sm sm:text-base text-ink truncate">{s.title}</div>
                    {s.artist && <div className="text-xs sm:text-sm text-[#9a8a9c] truncate">{s.artist}</div>}
                    {s.note && (
                      <p className="text-xs text-[#9a8a9c] italic font-serif truncate mt-0.5">"{s.note}"</p>
                    )}
                  </div>

                  <span
                    className={`hidden sm:inline-flex flex-shrink-0 text-xs font-semibold px-3 py-1.5 rounded-full whitespace-nowrap playlist-tag-${meta.value}`}
                  >
                    {meta.label}
                  </span>

                  <button
                    onClick={(e) => toggleMenu(s.id, e)}
                    aria-label="More options"
                    className="w-8 h-8 rounded-full flex items-center justify-center text-[#9a8a9c] hover:bg-black/5 flex-shrink-0"
                  >
                    <FiMoreVertical size={16} />
                  </button>
                </div>

                {menuOpen && (
                  <div
                    onClick={(e) => e.stopPropagation()}
                    className="absolute right-4 top-14 z-10 bg-white border border-black/10 rounded-xl shadow-lg py-1.5 w-48 text-sm"
                  >
                    <div className="px-3.5 pb-1.5 mb-1 border-b border-black/5 text-[10.5px] text-[#9a8a9c]">
                      Added by {names[s.addedBy] || '...'}
                    </div>
                    {embed && (
                      <button
                        onClick={() => toggleExpanded(s.id)}
                        className="w-full text-left px-3.5 py-2 hover:bg-black/5 flex items-center gap-2"
                      >
                        {isOpen ? <FiPause size={13} /> : <FiPlay size={13} />}
                        {isOpen ? 'Hide player' : 'Play'}
                      </button>
                    )}
                    {!embed && s.url && (
                      <a
                        href={s.url}
                        target="_blank"
                        rel="noreferrer"
                        onClick={() => setMenuOpenId(null)}
                        className="w-full text-left px-3.5 py-2 hover:bg-black/5 flex items-center gap-2"
                      >
                        <FiExternalLink size={13} /> Open link
                      </a>
                    )}
                    <button
                      onClick={() => removeSong(s)}
                      className="w-full text-left px-3.5 py-2 hover:bg-black/5 text-[#9b3b3b] flex items-center gap-2"
                    >
                      <FiTrash2 size={13} /> Remove
                    </button>
                  </div>
                )}

                {embed && isOpen && (
                  <div className="px-4 pb-3.5">
                    <div className="rounded-lg overflow-hidden">
                      <iframe
                        src={embed.embedUrl}
                        width="100%"
                        height={embed.height}
                        style={{ border: 0 }}
                        allow="autoplay; encrypted-media; fullscreen; picture-in-picture"
                        loading="lazy"
                        title={s.title}
                      />
                    </div>
                  </div>
                )}
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}