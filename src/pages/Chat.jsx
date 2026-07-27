import { useEffect, useMemo, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  deleteField,
  doc,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import {
  FiBookmark,
  FiCamera,
  FiCornerUpLeft,
  FiMessageCircle,
  FiSearch,
  FiSmile,
  FiStar,
  FiX,
} from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'
import { compressImage } from '../utils/compressImage'
import EmptyState from '../components/EmptyState'

const REACTION_EMOJIS = ['❤️', '😂', '😮', '😢', '👍', '🔥']
const TYPING_TIMEOUT_MS = 2000
const TYPING_STALE_MS = 5000

export default function Chat() {
  const { firebaseUser, couple } = useAuth()
  const { partner, partnerUid } = usePartner()

  const [messages, setMessages] = useState([])
  const [text, setText] = useState('')
  const [partnerTyping, setPartnerTyping] = useState(false)
  const [pickerOpenFor, setPickerOpenFor] = useState(null)
  const [searchOpen, setSearchOpen] = useState(false)
  const [searchTerm, setSearchTerm] = useState('')
  const [favoritesOnly, setFavoritesOnly] = useState(false)
  const [imgError, setImgError] = useState('')
  const [uploadingImage, setUploadingImage] = useState(false)
  const [replyingTo, setReplyingTo] = useState(null)
  const [savingMemoryFor, setSavingMemoryFor] = useState(null)

  const bottomRef = useRef(null)
  const fileInputRef = useRef(null)
  const inputRef = useRef(null)
  const typingTimeoutRef = useRef(null)
  const readReceiptsSent = useRef(new Set())

  const coupleId = couple?.id

  // --- Load messages ---
  useEffect(() => {
    if (!coupleId) return
    const q = query(collection(db, 'couples', coupleId, 'messages'), orderBy('createdAt'))
    const unsub = onSnapshot(q, (snap) =>
      setMessages(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [coupleId])

  // --- Auto scroll on new messages ---
  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' })
  }, [messages.length])

  // --- Mark partner's messages as read while this page is open ---
  useEffect(() => {
    if (!coupleId || !firebaseUser) return
    messages.forEach((m) => {
      if (m.from === firebaseUser.uid) return
      if ((m.readBy || []).includes(firebaseUser.uid)) return
      if (readReceiptsSent.current.has(m.id)) return
      readReceiptsSent.current.add(m.id)
      updateDoc(doc(db, 'couples', coupleId, 'messages', m.id), {
        readBy: Array.from(new Set([...(m.readBy || []), firebaseUser.uid])),
      }).catch(() => readReceiptsSent.current.delete(m.id))
    })
  }, [messages, coupleId, firebaseUser])

  // --- Watch partner's typing status ---
  useEffect(() => {
    if (!coupleId || !partnerUid) {
      setPartnerTyping(false)
      return
    }
    const unsub = onSnapshot(doc(db, 'couples', coupleId, 'typing', partnerUid), (snap) => {
      const d = snap.data()
      const updatedMs = d?.updatedAt?.toMillis?.() ?? 0
      setPartnerTyping(!!d?.typing && Date.now() - updatedMs < TYPING_STALE_MS)
    })
    return unsub
  }, [coupleId, partnerUid])

  async function setMyTyping(isTyping) {
    if (!coupleId || !firebaseUser) return
    await setDoc(
      doc(db, 'couples', coupleId, 'typing', firebaseUser.uid),
      { typing: isTyping, updatedAt: serverTimestamp() },
      { merge: true }
    )
  }

  function handleTextChange(value) {
    setText(value)
    setMyTyping(true)
    clearTimeout(typingTimeoutRef.current)
    typingTimeoutRef.current = setTimeout(() => setMyTyping(false), TYPING_TIMEOUT_MS)
  }

  function startReply(message) {
    setPickerOpenFor(null)
    setReplyingTo(message)
    inputRef.current?.focus()
  }

  async function send() {
    const t = text.trim()
    if (!t || !coupleId) return
    setText('')
    clearTimeout(typingTimeoutRef.current)
    setMyTyping(false)
    const replySnapshot = replyingTo
      ? {
          id: replyingTo.id,
          from: replyingTo.from,
          type: replyingTo.type,
          text: replyingTo.type === 'image' ? '' : (replyingTo.text || ''),
        }
      : null
    setReplyingTo(null)
    await addDoc(collection(db, 'couples', coupleId, 'messages'), {
      type: 'text',
      from: firebaseUser.uid,
      text: t,
      createdAt: serverTimestamp(),
      readBy: [firebaseUser.uid],
      reactions: {},
      favorites: {},
      ...(replySnapshot ? { replyTo: replySnapshot } : {}),
    })
  }

  async function handleImagePick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file || !coupleId) return
    if (!file.type.startsWith('image/')) {
      setImgError('Please choose an image file.')
      return
    }
    setImgError('')
    setUploadingImage(true)
    try {
      const dataUrl = await compressImage(file)
      const replySnapshot = replyingTo
        ? {
            id: replyingTo.id,
            from: replyingTo.from,
            type: replyingTo.type,
            text: replyingTo.type === 'image' ? '' : (replyingTo.text || ''),
          }
        : null
      setReplyingTo(null)
      await addDoc(collection(db, 'couples', coupleId, 'messages'), {
        type: 'image',
        from: firebaseUser.uid,
        imageData: dataUrl,
        createdAt: serverTimestamp(),
        readBy: [firebaseUser.uid],
        reactions: {},
        favorites: {},
        ...(replySnapshot ? { replyTo: replySnapshot } : {}),
      })
    } catch (err) {
      setImgError(err.message)
    } finally {
      setUploadingImage(false)
    }
  }

  async function toggleReaction(message, emoji) {
    if (!coupleId) return
    const mine = message.reactions?.[firebaseUser.uid]
    setPickerOpenFor(null)
    await updateDoc(doc(db, 'couples', coupleId, 'messages', message.id), {
      [`reactions.${firebaseUser.uid}`]: mine === emoji ? deleteField() : emoji,
    })
  }

  async function toggleFavorite(message) {
    if (!coupleId) return
    const mine = !!message.favorites?.[firebaseUser.uid]
    await updateDoc(doc(db, 'couples', coupleId, 'messages', message.id), {
      [`favorites.${firebaseUser.uid}`]: mine ? deleteField() : true,
    })
  }

  async function saveAsMemory(message) {
    if (!coupleId || message.type !== 'image' || savingMemoryFor) return
    setSavingMemoryFor(message.id)
    try {
      await addDoc(collection(db, 'couples', coupleId, 'memories'), {
        photoData: message.imageData,
        caption: '',
        from: firebaseUser.uid,
        createdAt: new Date(),
      })
      await updateDoc(doc(db, 'couples', coupleId, 'messages', message.id), {
        savedAsMemory: true,
      })
      toast.success('Saved to Memories.')
    } catch (e) {
      toast.error("Couldn't save that — try again.")
    } finally {
      setSavingMemoryFor(null)
    }
  }

  function groupedReactions(reactions) {
    const groups = {}
    Object.entries(reactions || {}).forEach(([uid, emoji]) => {
      if (!groups[emoji]) groups[emoji] = []
      groups[emoji].push(uid)
    })
    return groups
  }

  function scrollToMessage(id) {
    const el = document.getElementById(`msg-${id}`)
    if (!el) return
    el.scrollIntoView({ behavior: 'smooth', block: 'center' })
    el.classList.add('ring-2', 'ring-peach')
    setTimeout(() => el.classList.remove('ring-2', 'ring-peach'), 1200)
  }

  const visibleMessages = useMemo(() => {
    let list = messages
    if (favoritesOnly) list = list.filter((m) => m.favorites?.[firebaseUser.uid])
    if (searchTerm.trim()) {
      const q = searchTerm.trim().toLowerCase()
      list = list.filter((m) => m.type === 'text' && m.text?.toLowerCase().includes(q))
    }
    return list
  }, [messages, searchTerm, favoritesOnly, firebaseUser.uid])

  const lastMine = [...messages].reverse().find((m) => m.from === firebaseUser.uid)
  const lastMineSeen = lastMine && partnerUid && (lastMine.readBy || []).includes(partnerUid)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4">
        <div>
          <h1 className="text-2xl font-semibold mb-1">Chat</h1>
          <p className="text-sm text-[#7a6a7c]">Just between you and {partner?.displayName || 'your partner'}.</p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFavoritesOnly((v) => !v)}
            aria-pressed={favoritesOnly}
            title="Show favorites only"
            className={`flex items-center gap-1.5 px-3.5 py-2 rounded-xl border text-sm font-semibold whitespace-nowrap ${
              favoritesOnly ? 'border-peach bg-peachsoft text-plumdeep' : 'border-black/10'
            }`}
          >
            <FiStar size={14} fill={favoritesOnly ? 'currentColor' : 'none'} />
            Favorites
          </button>
          <button
            onClick={() => {
              setSearchOpen((v) => !v)
              if (searchOpen) setSearchTerm('')
            }}
            className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-black/10 text-sm font-semibold whitespace-nowrap"
          >
            {searchOpen ? 'Close search' : (
              <>
                <FiSearch size={14} /> Search
              </>
            )}
          </button>
        </div>
      </div>

      {searchOpen && (
        <div className="mb-3">
          <input
            autoFocus
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Search messages..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
          />
          {searchTerm.trim() && (
            <div className="text-xs text-[#9a8a9c] mt-1.5">
              {visibleMessages.length} result{visibleMessages.length === 1 ? '' : 's'}
            </div>
          )}
        </div>
      )}

      <div className="bg-white border border-black/10 rounded-2xl flex flex-col h-[calc(100vh-260px)] overflow-hidden">
        <div className="flex-1 overflow-y-auto p-5 flex flex-col gap-2.5">
          {visibleMessages.length === 0 && (
            searchTerm.trim() ? (
              <EmptyState icon={FiSearch} title="No messages match that search" />
            ) : favoritesOnly ? (
              <EmptyState
                icon={FiStar}
                title="No favorites yet"
                subtitle="Tap the star on a message to keep it close."
              />
            ) : (
              <EmptyState
                icon={FiMessageCircle}
                title="Say hi."
                subtitle="This is your space to check in, share your day, or just say you're thinking of them."
              />
            )
          )}

          {visibleMessages.map((m) => {
            const mine = m.from === firebaseUser.uid
            const groups = groupedReactions(m.reactions)
            const myFavorite = !!m.favorites?.[firebaseUser.uid]
            const favoriteCount = Object.keys(m.favorites || {}).length
            return (
              <div key={m.id} id={`msg-${m.id}`} className={`flex flex-col ${mine ? 'items-end' : 'items-start'} group rounded-xl transition-shadow`}>
                <div className="relative max-w-[65%]">
                  <div
                    className={`px-3.5 py-2.5 rounded-2xl text-sm ${
                      mine
                        ? 'bg-gradient-to-br from-peach to-gold text-plumdeep rounded-br-sm'
                        : 'bg-blush text-ink rounded-bl-sm'
                    }`}
                  >
                    <div className="text-[10px] opacity-60 font-semibold mb-0.5">
                      {mine ? 'You' : partner?.displayName || 'Partner'}
                    </div>

                    {m.replyTo && (
                      <button
                        onClick={() => scrollToMessage(m.replyTo.id)}
                        className={`block w-full text-left mb-1.5 px-2 py-1 rounded-lg text-[11px] border-l-2 ${
                          mine ? 'border-plumdeep/40 bg-white/30' : 'border-plumdeep/20 bg-white/50'
                        } opacity-80 truncate`}
                      >
                        <span className="font-semibold">
                          {m.replyTo.from === firebaseUser.uid ? 'You' : partner?.displayName || 'Partner'}
                        </span>{' '}
                        {m.replyTo.type === 'image' ? '📷 Photo' : m.replyTo.text}
                      </button>
                    )}

                    {m.type === 'image' ? (
                      <img
                        src={m.imageData}
                        alt="Shared"
                        className="rounded-xl max-w-full max-h-64 object-cover"
                      />
                    ) : (
                      <div className="whitespace-pre-wrap break-words">{m.text}</div>
                    )}
                  </div>

                  {/* hover action row */}
                  <div
                    className={`absolute top-0 flex flex-col gap-1 opacity-0 group-hover:opacity-100 transition-opacity ${
                      mine ? '-left-8' : '-right-8'
                    }`}
                  >
                    <button
                      onClick={() => setPickerOpenFor(pickerOpenFor === m.id ? null : m.id)}
                      className="w-6 h-6 rounded-full border border-black/10 bg-white flex items-center justify-center text-[#9a8a9c]"
                      title="React"
                      aria-label="React to message"
                    >
                      <FiSmile size={13} />
                    </button>
                    <button
                      onClick={() => startReply(m)}
                      className="w-6 h-6 rounded-full border border-black/10 bg-white flex items-center justify-center text-[#9a8a9c]"
                      title="Reply"
                      aria-label="Reply to message"
                    >
                      <FiCornerUpLeft size={13} />
                    </button>
                    <button
                      onClick={() => toggleFavorite(m)}
                      className={`w-6 h-6 rounded-full border bg-white flex items-center justify-center ${
                        myFavorite ? 'border-peach text-peach' : 'border-black/10 text-[#9a8a9c]'
                      }`}
                      title={myFavorite ? 'Unfavorite' : 'Favorite'}
                      aria-label={myFavorite ? 'Remove from favorites' : 'Add to favorites'}
                      aria-pressed={myFavorite}
                    >
                      <FiStar size={13} fill={myFavorite ? 'currentColor' : 'none'} />
                    </button>
                    {m.type === 'image' && !m.savedAsMemory && (
                      <button
                        onClick={() => saveAsMemory(m)}
                        disabled={savingMemoryFor === m.id}
                        className="w-6 h-6 rounded-full border border-black/10 bg-white flex items-center justify-center text-[#9a8a9c] disabled:opacity-50"
                        title="Save as Memory"
                        aria-label="Save image as memory"
                      >
                        <FiBookmark size={13} />
                      </button>
                    )}
                  </div>

                  {pickerOpenFor === m.id && (
                    <div
                      className={`absolute z-10 -top-10 ${
                        mine ? 'right-0' : 'left-0'
                      } bg-white border border-black/10 rounded-full shadow-md px-2 py-1 flex gap-1`}
                    >
                      {REACTION_EMOJIS.map((e) => (
                        <button
                          key={e}
                          onClick={() => toggleReaction(m, e)}
                          className="text-base hover:scale-125 transition-transform"
                        >
                          {e}
                        </button>
                      ))}
                    </div>
                  )}
                </div>

                <div className={`flex items-center gap-1.5 mt-1 ${mine ? 'flex-row-reverse' : ''}`}>
                  {Object.keys(groups).length > 0 && (
                    <div className={`flex gap-1 ${mine ? 'flex-row-reverse' : ''}`}>
                      {Object.entries(groups).map(([emoji, uids]) => (
                        <button
                          key={emoji}
                          onClick={() => toggleReaction(m, emoji)}
                          className={`text-[11px] px-1.5 py-0.5 rounded-full border flex items-center gap-1 ${
                            uids.includes(firebaseUser.uid)
                              ? 'border-peach bg-peachsoft'
                              : 'border-black/10 bg-white'
                          }`}
                        >
                          <span>{emoji}</span>
                          <span className="text-[#9a8a9c]">{uids.length}</span>
                        </button>
                      ))}
                    </div>
                  )}
                  {favoriteCount > 0 && (
                    <div className="flex items-center gap-0.5 text-[11px] text-[#9a8a9c]">
                      <FiStar size={11} className="text-peach" fill="currentColor" />
                      {favoriteCount}
                    </div>
                  )}
                  {m.savedAsMemory && (
                    <div className="flex items-center gap-0.5 text-[10px] text-[#9a8a9c]" title="Saved to Memories">
                      <FiBookmark size={10} /> Saved
                    </div>
                  )}
                </div>
              </div>
            )
          })}

          {partnerTyping && (
            <div className="self-start bg-blush text-ink px-3.5 py-2.5 rounded-2xl rounded-bl-sm text-sm inline-flex gap-1 items-center w-fit">
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.3s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce [animation-delay:-0.15s]" />
              <span className="w-1.5 h-1.5 rounded-full bg-current animate-bounce" />
            </div>
          )}

          {lastMine && !searchTerm.trim() && (
            <div className="self-end text-[10px] text-[#9a8a9c] pr-1">
              {lastMineSeen ? 'Seen' : 'Delivered'}
            </div>
          )}

          <div ref={bottomRef} />
        </div>

        {imgError && <div className="px-3.5 pt-2 text-xs text-[#9b3b3b]">{imgError}</div>}

        {replyingTo && (
          <div className="flex items-center gap-2 px-3.5 pt-2.5 -mb-1">
            <div className="flex-1 flex items-center gap-2 px-3 py-1.5 rounded-xl bg-blush text-xs text-ink border-l-2 border-peach">
              <FiCornerUpLeft size={12} className="flex-shrink-0" />
              <span className="truncate">
                Replying to {replyingTo.from === firebaseUser.uid ? 'yourself' : partner?.displayName || 'partner'}
                {replyingTo.type === 'image' ? ' — 📷 Photo' : `: ${replyingTo.text}`}
              </span>
            </div>
            <button
              onClick={() => setReplyingTo(null)}
              className="w-6 h-6 rounded-full border border-black/10 flex items-center justify-center text-[#9a8a9c] flex-shrink-0"
              title="Cancel reply"
              aria-label="Cancel reply"
            >
              <FiX size={13} />
            </button>
          </div>
        )}

        <div className="flex gap-2.5 p-3.5 border-t border-black/10 items-center">
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleImagePick}
          />
          <button
            onClick={() => fileInputRef.current?.click()}
            disabled={uploadingImage}
            className="w-10 h-10 flex-shrink-0 rounded-xl border border-black/10 flex items-center justify-center text-[#7a6a7c] disabled:opacity-50"
            title="Send an image"
          >
            {uploadingImage ? (
              <span className="w-3.5 h-3.5 rounded-full border-2 border-current border-t-transparent animate-spin" />
            ) : (
              <FiCamera size={16} />
            )}
          </button>
          <input
            ref={inputRef}
            className="flex-1 px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Type a message..."
            value={text}
            onChange={(e) => handleTextChange(e.target.value)}
            onKeyDown={(e) => e.key === 'Enter' && send()}
          />
          <button
            onClick={send}
            className="px-4 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep whitespace-nowrap"
          >
            Send
          </button>
        </div>
      </div>
    </div>
  )
}
