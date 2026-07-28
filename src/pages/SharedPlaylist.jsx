import { useEffect, useMemo, useState } from 'react'
import { addDoc, collection, deleteDoc, doc, onSnapshot, serverTimestamp } from 'firebase/firestore'
import toast from 'react-hot-toast'
import {
  FiChevronDown,
  FiChevronUp,
  FiExternalLink,
  FiHeart,
  FiMoon,
  FiMusic,
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

  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [url, setUrl] = useState('')
  const [note, setNote] = useState('')
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
        tag,
        addedBy: firebaseUser.uid,
        createdAt: serverTimestamp(),
      })
      setTitle('')
      setArtist('')
      setUrl('')
      setNote('')
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
    }
  }

  function toggleExpanded(id) {
    setExpanded((e) => ({ ...e, [id]: !e[id] }))
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Shared playlist</h1>
        <p className="text-sm text-[#7a6a7c]">
          Songs that mean something — yours to build together, one track at a time.
        </p>
      </div>

      <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
        <h3 className="font-semibold mb-3">Add a song</h3>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 mb-2">
          <input
            className="px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Song title"
            value={title}
            onChange={(e) => setTitle(e.target.value)}
          />
          <input
            className="px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Artist (optional)"
            value={artist}
            onChange={(e) => setArtist(e.target.value)}
          />
        </div>
        <input
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm mb-2"
          placeholder="YouTube or Spotify link (optional)"
          value={url}
          onChange={(e) => setUrl(e.target.value)}
        />
        <input
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm mb-3"
          placeholder="Note — why this one, when it's from, what it means..."
          value={note}
          onChange={(e) => setNote(e.target.value)}
        />

        <div className="flex flex-wrap gap-1.5 mb-3">
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
          className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
        >
          Add to playlist
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
        {TAGS.map(({ value, label, icon: Icon }) => (
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
            icon={FiMusic}
            title="No songs yet"
            subtitle="Add the first track above — your song, a favorite, or one that just reminds you of them."
          />
        ) : (
          <div className="grid grid-cols-1 gap-3">
            {filtered.map((s) => {
              const meta = tagMeta(s.tag)
              const Icon = meta.icon
              const embed = detectEmbed(s.url)
              const isOpen = !!expanded[s.id]
              return (
                <div key={s.id} className="border border-black/10 rounded-xl p-3.5 bg-[#faf6f8]">
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex items-center gap-1.5 text-[11px] font-medium text-[#a892a9]">
                      <Icon size={12} /> {meta.label}
                    </div>
                    <button
                      onClick={() => removeSong(s)}
                      aria-label="Remove"
                      className="w-6 h-6 rounded-lg border border-black/10 flex items-center justify-center text-[#9a8a9c] flex-shrink-0"
                    >
                      <FiTrash2 size={11} />
                    </button>
                  </div>

                  <div className="text-sm font-semibold text-ink mt-1.5">{s.title}</div>
                  {s.artist && <div className="text-xs text-[#9a8a9c] mt-0.5">{s.artist}</div>}
                  {s.note && <p className="text-sm text-ink leading-snug mt-1.5">{s.note}</p>}

                  <div className="flex items-center justify-between mt-2.5">
                    <span className="text-[11px] text-[#9a8a9c]">added by {names[s.addedBy] || '...'}</span>

                    {s.url &&
                      (embed ? (
                        <button
                          onClick={() => toggleExpanded(s.id)}
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#7a6a7c] hover:text-ink"
                        >
                          {isOpen ? 'Hide player' : 'Play'}
                          {isOpen ? <FiChevronUp size={11} /> : <FiChevronDown size={11} />}
                        </button>
                      ) : (
                        <a
                          href={s.url}
                          target="_blank"
                          rel="noreferrer"
                          className="flex items-center gap-1 text-[11px] font-semibold text-[#7a6a7c] hover:text-ink"
                        >
                          Open link <FiExternalLink size={11} />
                        </a>
                      ))}
                  </div>

                  {embed && isOpen && (
                    <div className="mt-3 rounded-lg overflow-hidden">
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
                  )}
                </div>
              )
            })}
          </div>
        )}
      </div>
    </div>
  )
}
