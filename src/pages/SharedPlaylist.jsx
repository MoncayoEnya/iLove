import { useEffect, useMemo, useRef, useState } from 'react'
import { addDoc, collection, doc, onSnapshot, serverTimestamp, updateDoc } from 'firebase/firestore'
import { AnimatePresence, motion } from 'framer-motion'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import {
  FiExternalLink,
  FiHeart,
  FiImage,
  FiLink,
  FiMoon,
  FiMoreHorizontal,
  FiMusic,
  FiPause,
  FiPlay,
  FiPlus,
  FiShuffle,
  FiSun,
  FiTrash2,
  FiX,
  FiZap,
} from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'
import EmptyState from '../components/EmptyState'
import BottomSheet from '../components/BottomSheet'
import ReactionBar from '../components/ReactionBar'
import { undoableDelete } from '../utils/undoDelete'
import { fetchLinkInfo, parseMusicLink } from '../utils/musicLinks'
import { haptic } from '../utils/haptics'

// Shared playlist. Still no Spotify/YouTube login or API key: a song is a
// title/artist plus an optional link. Pasting a Spotify or YouTube link
// fills in the title, artist and cover automatically (public oEmbed), and
// those links play right here with the platforms' free embed players.
// Only one song plays at a time, in the "Now playing" bar at the top.

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

function coverFor(song) {
  return song.coverUrl || parseMusicLink(song.url)?.cover || ''
}

// Cover art that never shows a broken image: falls back to the tag's
// gradient + icon if there's no URL or the image fails to load.
function SongCover({ song, className = '', iconSize = 22, rounded = 'rounded-xl' }) {
  const [failed, setFailed] = useState(false)
  const src = coverFor(song)
  const meta = tagMeta(song.tag)
  const Icon = meta.icon
  useEffect(() => setFailed(false), [src])
  return (
    <div className={`relative overflow-hidden flex items-center justify-center playlist-cover-${meta.value} ${rounded} ${className}`}>
      {src && !failed ? (
        <img src={src} alt="" loading="lazy" onError={() => setFailed(true)} className="w-full h-full object-cover" />
      ) : (
        <Icon size={iconSize} className={`playlist-tag-${meta.value} !bg-transparent`} />
      )}
    </div>
  )
}

// Animated equalizer bars shown on whatever's playing.
function Equalizer({ className = '' }) {
  return (
    <span className={`inline-flex items-end gap-[2px] h-3 ${className}`} aria-hidden="true">
      {[0, 1, 2].map((i) => (
        <motion.span
          key={i}
          className="w-[3px] rounded-full bg-current"
          animate={{ height: ['30%', '100%', '45%', '80%', '30%'] }}
          transition={{ duration: 1 + i * 0.2, repeat: Infinity, ease: 'easeInOut' }}
        />
      ))}
    </span>
  )
}

export default function SharedPlaylist() {
  const { firebaseUser, couple } = useAuth()
  const coupleId = couple?.id
  const uid = firebaseUser?.uid
  const names = useMemberNames(couple?.members)

  const [songs, setSongs] = useState([])
  const [activeFilter, setActiveFilter] = useState(null) // null = all
  const [playingId, setPlayingId] = useState(null)
  const [menuOpenId, setMenuOpenId] = useState(null)
  const [sheetOpen, setSheetOpen] = useState(false)
  const playerRef = useRef(null)

  // add-song form
  const [url, setUrl] = useState('')
  const [title, setTitle] = useState('')
  const [artist, setArtist] = useState('')
  const [note, setNote] = useState('')
  const [coverUrl, setCoverUrl] = useState('')
  const [showCoverField, setShowCoverField] = useState(false)
  const [tag, setTag] = useState('our-song')
  const [lookingUp, setLookingUp] = useState(false)
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!coupleId) return undefined
    const unsub = onSnapshot(collection(db, 'couples', coupleId, 'playlist'), (snap) =>
      setSongs(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [coupleId])

  // Older Spotify songs saved without a cover: look the cover up once and
  // save it, so it shows for both of you from then on.
  useEffect(() => {
    if (!coupleId) return
    songs
      .filter((s) => !s.coverUrl && parseMusicLink(s.url)?.type === 'spotify')
      .slice(0, 5)
      .forEach(async (s) => {
        const info = await fetchLinkInfo(s.url)
        // Only save on success; if the lookup failed (offline, blocked) it
        // simply tries again next time the page opens.
        if (info?.cover) {
          updateDoc(doc(db, 'couples', coupleId, 'playlist', s.id), { coverUrl: info.cover }).catch(() => {})
        }
      })
  }, [songs, coupleId])

  // Paste a link -> fill in title/artist/cover (only fields still empty).
  useEffect(() => {
    if (!sheetOpen || !parseMusicLink(url)) return undefined
    let cancelled = false
    setLookingUp(true)
    const t = setTimeout(async () => {
      const info = await fetchLinkInfo(url.trim())
      if (cancelled) return
      setLookingUp(false)
      if (!info) return
      setTitle((v) => v || info.title)
      setArtist((v) => v || info.artist)
      setCoverUrl((v) => v || info.cover)
    }, 350)
    return () => {
      cancelled = true
      clearTimeout(t)
      setLookingUp(false)
    }
  }, [url, sheetOpen])

  const sorted = useMemo(
    () => songs.slice().sort((a, b) => (b.createdAt?.seconds || 0) - (a.createdAt?.seconds || 0)),
    [songs]
  )
  const ourSong = sorted.find((s) => s.tag === 'our-song') || null
  const filtered = activeFilter ? sorted.filter((s) => s.tag === activeFilter) : sorted
  const listSongs = !activeFilter && ourSong ? filtered.filter((s) => s.id !== ourSong.id) : filtered
  const counts = useMemo(() => {
    const c = {}
    songs.forEach((s) => {
      c[s.tag] = (c[s.tag] || 0) + 1
    })
    return c
  }, [songs])
  const playing = songs.find((s) => s.id === playingId) || null
  const playingEmbed = playing ? parseMusicLink(playing.url) : null
  const mineCount = songs.filter((s) => s.addedBy === uid).length

  function resetForm() {
    setUrl('')
    setTitle('')
    setArtist('')
    setNote('')
    setCoverUrl('')
    setShowCoverField(false)
  }

  function openAddSheet() {
    resetForm()
    // Only suggest "Our song" when you don't have one yet, so adding a
    // song never silently replaces the one in the spotlight.
    setTag(songs.some((x) => x.tag === 'our-song') ? 'love' : 'our-song')
    setSheetOpen(true)
  }

  async function addSong() {
    const t = title.trim()
    if (!t || !coupleId || saving) return
    setSaving(true)
    try {
      await addDoc(collection(db, 'couples', coupleId, 'playlist'), {
        title: t,
        artist: artist.trim(),
        url: url.trim(),
        note: note.trim(),
        coverUrl: coverUrl.trim(),
        tag,
        addedBy: uid,
        createdAt: serverTimestamp(),
      })
      haptic('success')
      toast.success('Added to your playlist')
      resetForm()
      setSheetOpen(false)
    } catch {
      toast.error("Couldn't add that — try again.")
    } finally {
      setSaving(false)
    }
  }

  async function removeSong(song) {
    setMenuOpenId(null)
    if (playingId === song.id) setPlayingId(null)
    try {
      await undoableDelete(doc(db, 'couples', coupleId, 'playlist', song.id), song, 'Song removed')
    } catch {
      toast.error("Couldn't remove that — try again.")
    }
  }

  function play(song) {
    setMenuOpenId(null)
    const link = parseMusicLink(song.url)
    if (!link) {
      if (song.url) window.open(song.url, '_blank', 'noopener')
      else toast('Add a Spotify or YouTube link to play this here.', { icon: <FiLink /> })
      return
    }
    setPlayingId((cur) => (cur === song.id ? null : song.id))
    haptic('light')
    setTimeout(() => playerRef.current?.scrollIntoView({ behavior: 'smooth', block: 'nearest' }), 80)
  }

  function shuffle() {
    const playable = (activeFilter ? filtered : songs).filter((s) => parseMusicLink(s.url) && s.id !== playingId)
    if (!playable.length) {
      toast('No playable songs to shuffle yet.', { icon: <FiShuffle /> })
      return
    }
    play(playable[Math.floor(Math.random() * playable.length)])
  }

  const linkInfo = parseMusicLink(url)

  return (
    <div onClick={() => menuOpenId && setMenuOpenId(null)}>
      {/* ---------- header ---------- */}
      <div className="flex flex-wrap items-end justify-between gap-4 mb-6">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Shared playlist</h1>
          <p className="text-sm text-[#7a6a7c]">
            {songs.length
              ? `${songs.length} song${songs.length === 1 ? '' : 's'} · ${mineCount} from you, ${songs.length - mineCount} from your partner`
              : 'Songs that mean something. Build it together, one track at a time.'}
          </p>
        </div>
        <div className="flex gap-2">
          {songs.length > 1 && (
            <button
              onClick={shuffle}
              className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm border border-black/10 bg-white"
            >
              <FiShuffle size={14} /> Shuffle
            </button>
          )}
          <button
            onClick={openAddSheet}
            className="flex items-center gap-1.5 px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            <FiPlus size={15} /> Add a song
          </button>
        </div>
      </div>

      {/* ---------- now playing ---------- */}
      <AnimatePresence>
        {playing && playingEmbed && (
          <motion.div
            ref={playerRef}
            data-lv-off
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: 'auto' }}
            exit={{ opacity: 0, height: 0 }}
            className="overflow-hidden"
          >
            <div className="bg-white border border-black/10 rounded-2xl p-4 mb-5">
              <div className="flex items-center gap-3 mb-3">
                <SongCover song={playing} className="w-11 h-11 flex-shrink-0" iconSize={16} />
                <div className="flex-1 min-w-0">
                  <div className="text-[11px] font-semibold uppercase tracking-wide text-peach flex items-center gap-1.5">
                    <Equalizer /> Now playing
                  </div>
                  <div className="font-semibold truncate">
                    {playing.title}
                    {playing.artist && <span className="text-[#9a8a9c] font-normal"> · {playing.artist}</span>}
                  </div>
                </div>
                <button
                  onClick={() => setPlayingId(null)}
                  aria-label="Close player"
                  className="w-8 h-8 rounded-full flex items-center justify-center text-[#9a8a9c] hover:bg-black/5"
                >
                  <FiX size={16} />
                </button>
              </div>
              <div className={`rounded-xl overflow-hidden ${playingEmbed.type === 'youtube' ? 'aspect-video max-w-3xl' : ''}`}>
                <iframe
                  key={playing.id}
                  src={playingEmbed.embedUrl}
                  width="100%"
                  height={playingEmbed.type === 'youtube' ? '100%' : playingEmbed.height}
                  style={{ border: 0, display: 'block' }}
                  allow="autoplay; encrypted-media; fullscreen; picture-in-picture; clipboard-write"
                  title={playing.title}
                />
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* ---------- our song spotlight ---------- */}
      {ourSong && !activeFilter && (
        <div
          className="rounded-2xl p-5 sm:p-6 mb-5 text-white relative overflow-hidden flex flex-col sm:flex-row items-center gap-5 sm:gap-7"
          style={{ background: 'linear-gradient(120deg, #3d2340 0%, #7a3f8c 60%, #e8a87c 130%)' }}
        >
          <div className="relative w-36 h-36 flex-shrink-0">
            {/* the record peeks out from behind the sleeve and spins while playing */}
            <motion.div
              className="absolute top-2 left-10 w-32 h-32 rounded-full bg-[#1c1420] border-[6px] border-[#2b1e2f] shadow-xl flex items-center justify-center"
              animate={playingId === ourSong.id ? { rotate: 360 } : { rotate: 0 }}
              transition={playingId === ourSong.id ? { duration: 4, repeat: Infinity, ease: 'linear' } : { duration: 0.6 }}
            >
              <div className="absolute inset-3 rounded-full border border-white/5" />
              <div className="absolute inset-6 rounded-full border border-white/5" />
              <SongCover song={ourSong} className="w-11 h-11" rounded="rounded-full" iconSize={14} />
            </motion.div>
            <SongCover song={ourSong} className="absolute inset-0 w-32 h-32 shadow-2xl" iconSize={34} />
          </div>
          <div className="flex-1 min-w-0 text-center sm:text-left sm:pl-6">
            <div className="text-[11px] font-semibold uppercase tracking-[0.2em] opacity-80 flex items-center gap-1.5 justify-center sm:justify-start">
              <FiHeart size={12} fill="currentColor" /> Our song
            </div>
            <div className="font-serif text-3xl font-semibold mt-1 truncate">{ourSong.title}</div>
            {ourSong.artist && <div className="opacity-85 mt-0.5 truncate">{ourSong.artist}</div>}
            {ourSong.note && <p className="font-serif italic opacity-90 mt-2 line-clamp-2">"{ourSong.note}"</p>}
            <div className="text-xs opacity-70 mt-2">
              Added by {ourSong.addedBy === uid ? 'you' : names[ourSong.addedBy] || 'your partner'}
              {ourSong.createdAt?.toDate ? ` · ${dayjs(ourSong.createdAt.toDate()).format('MMM D, YYYY')}` : ''}
            </div>
          </div>
          <button
            onClick={() => play(ourSong)}
            className="flex items-center gap-2 px-5 py-3 rounded-full bg-white text-plumdeep font-semibold text-sm flex-shrink-0"
          >
            {playingId === ourSong.id ? <FiPause size={15} /> : <FiPlay size={15} />}
            {playingId === ourSong.id ? 'Pause' : parseMusicLink(ourSong.url) ? 'Play our song' : ourSong.url ? 'Open' : 'Play'}
          </button>
        </div>
      )}

      {/* ---------- filters ---------- */}
      {songs.length > 0 && (
        <div className="flex gap-2 mb-5 overflow-x-auto -mx-1 px-1 pb-1">
          <button
            onClick={() => setActiveFilter(null)}
            className={`flex-shrink-0 text-xs font-semibold px-3.5 py-2 rounded-full border ${
              !activeFilter ? 'bg-plumdeep text-white border-plumdeep' : 'bg-white border-black/10 text-[#7a6a7c]'
            }`}
          >
            All · {songs.length}
          </button>
          {TAGS.filter((t) => counts[t.value]).map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              onClick={() => setActiveFilter(activeFilter === value ? null : value)}
              className={`flex-shrink-0 flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-full border ${
                activeFilter === value ? 'bg-plumdeep text-white border-plumdeep' : 'bg-white border-black/10 text-[#7a6a7c]'
              }`}
            >
              <Icon size={12} /> {label} · {counts[value]}
            </button>
          ))}
        </div>
      )}

      {/* ---------- songs ---------- */}
      {songs.length === 0 ? (
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <EmptyState
            icon={FiMusic}
            title="No songs yet"
            subtitle="Add your song, a favorite, or one that just reminds you of them."
            action={{ label: 'Add the first song', onClick: openAddSheet }}
          />
        </div>
      ) : listSongs.length === 0 ? (
        <p className="text-sm text-[#9a8a9c] px-1">Only your song so far. Add more to grow the playlist.</p>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {listSongs.map((s) => {
            const meta = tagMeta(s.tag)
            const isPlaying = playingId === s.id
            const playable = !!parseMusicLink(s.url)
            return (
              <div
                key={s.id}
                className={`group bg-white border rounded-2xl flex flex-col ${
                  isPlaying ? 'border-peach/60 ring-2 ring-peach/30' : 'border-black/10'
                }`}
              >
                <div className="relative rounded-t-2xl overflow-hidden">
                  <SongCover song={s} className="w-full aspect-[16/9]" rounded="rounded-none" iconSize={30} />
                  <button
                    onClick={() => play(s)}
                    aria-label={isPlaying ? `Stop ${s.title}` : `Play ${s.title}`}
                    className={`absolute bottom-3 right-3 w-11 h-11 rounded-full bg-white text-plumdeep shadow-lg flex items-center justify-center transition-all ${
                      isPlaying ? 'opacity-100' : 'opacity-100 sm:opacity-0 sm:translate-y-2 group-hover:opacity-100 group-hover:translate-y-0'
                    }`}
                  >
                    {isPlaying ? <FiPause size={16} /> : playable ? <FiPlay size={16} className="ml-0.5" /> : <FiExternalLink size={15} />}
                  </button>
                  <span className={`absolute top-3 left-3 text-[11px] font-semibold px-2.5 py-1 rounded-full playlist-tag-${meta.value}`}>
                    {meta.label}
                  </span>
                  {isPlaying && (
                    <span className="absolute top-3 right-3 bg-white/90 text-peach rounded-full px-2 py-1">
                      <Equalizer />
                    </span>
                  )}
                </div>

                <div className="p-4 flex-1 flex flex-col">
                  <div className="flex items-start gap-2">
                    <div className="flex-1 min-w-0">
                      <div className="font-semibold truncate">{s.title}</div>
                      <div className="text-sm text-[#9a8a9c] truncate">{s.artist || 'Unknown artist'}</div>
                    </div>
                    <div className="relative">
                      <button
                        onClick={(e) => {
                          e.stopPropagation()
                          setMenuOpenId((cur) => (cur === s.id ? null : s.id))
                        }}
                        aria-label="More options"
                        className="w-8 h-8 rounded-full flex items-center justify-center text-[#9a8a9c] hover:bg-black/5"
                      >
                        <FiMoreHorizontal size={16} />
                      </button>
                      <AnimatePresence>
                        {menuOpenId === s.id && (
                          <motion.div
                            initial={{ opacity: 0, scale: 0.95, y: -4 }}
                            animate={{ opacity: 1, scale: 1, y: 0 }}
                            exit={{ opacity: 0, scale: 0.95, y: -4 }}
                            onClick={(e) => e.stopPropagation()}
                            className="absolute right-0 top-9 z-20 bg-white border border-black/10 rounded-xl shadow-lg py-1.5 w-44 text-sm"
                          >
                            {s.url && (
                              <a
                                href={s.url}
                                target="_blank"
                                rel="noreferrer"
                                onClick={() => setMenuOpenId(null)}
                                className="w-full text-left px-3.5 py-2 hover:bg-black/5 flex items-center gap-2"
                              >
                                <FiExternalLink size={13} /> Open in {playable ? (parseMusicLink(s.url).type === 'spotify' ? 'Spotify' : 'YouTube') : 'browser'}
                              </a>
                            )}
                            <button
                              onClick={() => removeSong(s)}
                              className="w-full text-left px-3.5 py-2 hover:bg-black/5 text-[#9b3b3b] flex items-center gap-2"
                            >
                              <FiTrash2 size={13} /> Remove
                            </button>
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                  </div>
                  {s.note && <p className="text-sm text-[#7a6a7c] italic font-serif mt-2 line-clamp-2">"{s.note}"</p>}
                  <div className="flex items-center justify-between gap-2 mt-auto pt-3">
                    <ReactionBar path={['couples', coupleId, 'playlist', s.id]} reactions={s.reactions} uid={uid} names={names} />
                    <span className="text-[11px] text-[#9a8a9c] truncate">
                      {s.addedBy === uid ? 'You' : names[s.addedBy] || 'Partner'}
                    </span>
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}

      {/* ---------- add song sheet ---------- */}
      <BottomSheet
        open={sheetOpen}
        onClose={() => {
          setSheetOpen(false)
        }}
        title="Add a song"
      >
        <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">Spotify or YouTube link</label>
        <div className="relative">
          <FiLink size={14} className="absolute left-3.5 top-1/2 -translate-y-1/2 text-[#b6a5b8]" />
          <input
            autoFocus
            className="w-full pl-9 pr-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Paste a link to fill everything in"
            value={url}
            onChange={(e) => setUrl(e.target.value)}
          />
        </div>
        <p className="text-[11px] text-[#9a8a9c] mt-1.5 min-h-[16px]">
          {lookingUp
            ? 'Looking up the song…'
            : linkInfo
            ? `${linkInfo.type === 'spotify' ? 'Spotify' : 'YouTube'} link found. It will play right here in the app.`
            : url
            ? 'Not a Spotify or YouTube link. It will open in a new tab instead.'
            : 'Optional. You can also just type the song below.'}
        </p>

        {/* preview */}
        <div className="flex items-center gap-3 mt-3 p-3 rounded-xl bg-[#faf6f8]">
          <SongCover song={{ coverUrl, url, tag }} className="w-16 h-16 flex-shrink-0" iconSize={20} />
          <div className="flex-1 min-w-0 space-y-2">
            <input
              className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm bg-white font-semibold"
              placeholder="Song title"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
            />
            <input
              className="w-full px-3 py-2 rounded-lg border border-black/10 text-sm bg-white"
              placeholder="Artist"
              value={artist}
              onChange={(e) => setArtist(e.target.value)}
            />
          </div>
        </div>
        {showCoverField ? (
          <input
            className="w-full mt-2 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Paste an image link for the cover"
            value={coverUrl}
            onChange={(e) => setCoverUrl(e.target.value)}
          />
        ) : (
          <button
            type="button"
            onClick={() => setShowCoverField(true)}
            className="text-xs text-[#9a8a9c] mt-2 flex items-center gap-1.5 hover:text-peach"
          >
            <FiImage size={12} /> Use a different cover image
          </button>
        )}

        <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5 mt-4">Why this song? (optional)</label>
        <input
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          placeholder="e.g. Reminds me of our trip"
          value={note}
          onChange={(e) => setNote(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && addSong()}
        />

        <div className="flex flex-wrap gap-1.5 mt-4">
          {TAGS.map(({ value, label, icon: Icon }) => (
            <button
              key={value}
              type="button"
              onClick={() => setTag(value)}
              aria-pressed={tag === value}
              className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1.5 rounded-full border ${
                tag === value
                  ? 'bg-gradient-to-br from-peach to-gold text-plumdeep border-transparent'
                  : 'border-black/10 text-[#7a6a7c] hover:bg-black/5'
              }`}
            >
              <Icon size={12} /> {label}
            </button>
          ))}
        </div>
        {tag === 'our-song' && ourSong && (
          <p className="text-[11px] text-[#9a8a9c] mt-2">
            This will become the song in the spotlight (currently "{ourSong.title}").
          </p>
        )}

        <button
          onClick={addSong}
          disabled={saving || !title.trim()}
          className="w-full mt-5 flex items-center justify-center gap-1.5 py-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-50"
        >
          <FiPlus size={15} /> {saving ? 'Adding…' : 'Add to playlist'}
        </button>
      </BottomSheet>
    </div>
  )
}