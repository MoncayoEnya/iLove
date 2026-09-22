import { useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ClipLoader } from 'react-spinners'
import {
  FiCamera,
  FiChevronRight,
  FiDownload,
  FiLock,
  FiMoon,
  FiShield,
  FiSmartphone,
  FiSun,
  FiTrash2,
} from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'
import { collection, doc, onSnapshot, query, setDoc, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTheme, PALETTES } from '../context/ThemeContext'
import { usePartner } from '../hooks/usePartner'
import { useLinkCouple } from '../hooks/useLinkCouple'
import { profileSchema, zodResolver, LOVE_LANGUAGES, joinCodeSchema } from '../lib/schemas'
import { compressImage } from '../utils/compressImage'
import { anniversaryInfo } from '../utils/date'
import { fetchCoupleData, downloadJSON, downloadHTML, buildReadableHTML } from '../utils/exportData'
import { useMemberNames } from '../hooks/useMemberNames'
import CropModal from '../components/CropModal'

const NOTIF_OPTIONS = [
  ['notifyChat', 'New messages'],
  ['notifyTasks', 'Task updates'],
  ['notifyCalendar', 'Upcoming events'],
  ['notifyStreak', 'Streak reminders'],
]

const PALETTE_SWATCH = {
  blush: '#d97a6a',
  sakura: '#e88ba3',
  ocean: '#3d8fa6',
}

export default function ProfileSettings() {
  const {
    firebaseUser,
    profile,
    couple,
    updateProfile,
    resetPassword,
    unlinkPartner,
    logout,
  } = useAuth()
  const { partner, hasPartner } = usePartner()
  const { theme, toggleTheme, palette, setPalette } = useTheme()
  const { createSpace, joinWithCode } = useLinkCouple()
  const names = useMemberNames(couple?.members)
  const navigate = useNavigate()

  const [serverErr, setServerErr] = useState('')
  const [favoriteMemories, setFavoriteMemories] = useState([])
  const [cropSrc, setCropSrc] = useState(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const fileInputRef = useRef(null)

  // These two aren't part of the couple's original profile schema yet, so
  // they're tracked locally and merged into the save payload by hand rather
  // than going through the zod-validated form fields below.
  const [pronouns, setPronouns] = useState(profile?.pronouns || '')
  const [bio, setBio] = useState(profile?.bio || '')

  const prefs = profile?.prefs || {}
  const [editingAnniversary, setEditingAnniversary] = useState(false)
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')
  const [confirmingUnlink, setConfirmingUnlink] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [unlinkError, setUnlinkError] = useState('')
  const [exporting, setExporting] = useState(null)
  const [creating, setCreating] = useState(false)
  const [createError, setCreateError] = useState('')
  const [joining, setJoining] = useState(false)
  const [joinError, setJoinError] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)
  const [cancelling, setCancelling] = useState(false)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    reset,
    formState: { errors, isSubmitting, isDirty },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: profile?.displayName || '',
      photoURL: profile?.photoURL || '',
      anniversaryDate: profile?.anniversaryDate || '',
      favoriteSong: profile?.favoriteSong || '',
      loveLanguage: profile?.loveLanguage || '',
    },
  })

  const {
    register: registerJoin,
    handleSubmit: handleJoinSubmit,
    reset: resetJoinForm,
    formState: { errors: joinFieldErrors },
  } = useForm({ resolver: zodResolver(joinCodeSchema), defaultValues: { joinCode: '' } })

  const displayName = watch('displayName')
  const photoURL = watch('photoURL')
  const anniversaryDate = watch('anniversaryDate')
  const loveLanguage = watch('loveLanguage')

  const isPending = !!couple && !hasPartner
  const anniversary = anniversaryInfo(anniversaryDate)
  const anniversaryProgress = anniversary ? Math.round(((365 - anniversary.daysUntil) / 365) * 100) : 0

  const coupleLabel =
    profile?.displayName && partner?.displayName
      ? `${profile.displayName} & ${partner.displayName}`
      : profile?.displayName || 'Profile'

  function handlePhotoPick(e) {
    const file = e.target.files?.[0]
    e.target.value = ''
    if (!file) return
    if (!file.type.startsWith('image/')) {
      setPhotoError('Please choose an image file.')
      return
    }
    setPhotoError('')
    setCropSrc(URL.createObjectURL(file))
  }

  async function handleCropped(croppedFile) {
    setCropSrc(null)
    setPhotoLoading(true)
    try {
      const dataUrl = await compressImage(croppedFile, { maxWidth: 500, maxHeight: 500, maxBytes: 400_000 })
      setValue('photoURL', dataUrl, { shouldDirty: true })
    } catch (err) {
      setPhotoError(err.message)
    } finally {
      setPhotoLoading(false)
    }
  }

  function removePhoto() {
    setValue('photoURL', '', { shouldDirty: true })
    setPhotoError('')
  }

  // Pull in whichever memories either partner has hearted on the Memories page.
  useEffect(() => {
    if (!couple?.id) return
    const unsub = onSnapshot(
      query(collection(db, 'couples', couple.id, 'memories'), where('pinned', '==', true)),
      (snap) => setFavoriteMemories(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [couple?.id])

  async function onSubmit(values) {
    setServerErr('')
    try {
      await updateProfile({
        displayName: values.displayName.trim(),
        photoURL: values.photoURL?.trim() || null,
        anniversaryDate: values.anniversaryDate || null,
        favoriteSong: values.favoriteSong?.trim() || null,
        loveLanguage: values.loveLanguage || null,
        pronouns: pronouns.trim() || null,
        bio: bio.trim() || null,
      })
      toast.success('Profile updated.')
    } catch (err) {
      setServerErr(err.message)
    }
  }

  function handleDiscard() {
    reset()
    setPronouns(profile?.pronouns || '')
    setBio(profile?.bio || '')
    setServerErr('')
  }

  async function togglePref(key) {
    await setDoc(
      doc(db, 'users', firebaseUser.uid),
      { prefs: { ...prefs, [key]: !prefs[key] } },
      { merge: true }
    )
  }

  async function handleExport(format) {
    if (!couple?.id || exporting) return
    setExporting(format)
    try {
      const data = await fetchCoupleData(couple.id)
      const stamp = new Date().toISOString().slice(0, 10)
      const label = `${profile?.displayName || 'You'}${partner?.displayName ? ' & ' + partner.displayName : ''}`
      if (format === 'json') {
        downloadJSON(data, `iLovee-backup-${stamp}.json`)
      } else {
        downloadHTML(buildReadableHTML(data, names, label), `iLovee-summary-${stamp}.html`)
      }
      toast.success('Export ready — check your downloads.')
    } catch {
      toast.error("Couldn't put that export together — try again.")
    } finally {
      setExporting(null)
    }
  }

  async function handleResetPassword() {
    setResetError('')
    try {
      await resetPassword(profile.email)
      setResetSent(true)
      toast.success('Reset email sent.')
    } catch (err) {
      setResetError(err.message)
    }
  }

  async function handleUnlink() {
    setUnlinking(true)
    setUnlinkError('')
    try {
      await unlinkPartner()
      navigate('/link', { replace: true })
    } catch (err) {
      setUnlinkError(err.message)
      setUnlinking(false)
    }
  }

  async function handleCancelSpace() {
    setCancelling(true)
    try {
      await unlinkPartner()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCancelling(false)
    }
  }

  async function handleCreateSpace() {
    setCreating(true)
    setCreateError('')
    try {
      await createSpace()
    } catch (err) {
      setCreateError(err.message)
    } finally {
      setCreating(false)
    }
  }

  async function handleJoin(values) {
    setJoining(true)
    setJoinError('')
    try {
      await joinWithCode(values.joinCode)
      resetJoinForm()
      toast.success('Linked up!')
    } catch (err) {
      setJoinError(err.message)
    } finally {
      setJoining(false)
    }
  }

  async function handleCopyCode() {
    if (!couple?.inviteCode) return
    try {
      await navigator.clipboard.writeText(couple.inviteCode)
      setCodeCopied(true)
      toast.success('Invite code copied.')
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      toast.error("Couldn't copy — select and copy it manually.")
    }
  }

  const memorySlots = Array.from({ length: 5 }, (_, i) => favoriteMemories[i] || null)

  return (
    <div>
      <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
        {coupleLabel.toUpperCase()} <span className="text-black/20 mx-1">/</span> Profile Settings
      </p>
      <h1 className="text-3xl font-serif mb-1.5">Personal Space</h1>
      <p className="text-sm text-[#7a6a7c] mb-6 max-w-md">
        Manage how you appear to your partner and customize your shared digital sanctuary.
      </p>

      <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoPick} className="hidden" />
      <CropModal imageSrc={cropSrc} aspect={1} onCancel={() => setCropSrc(null)} onCropped={handleCropped} />

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="flex flex-col gap-5">
          {/* Row 1 — Portrait & fields + Love language / Favorite song */}
          <div className="grid grid-cols-1 lg:grid-cols-[1.7fr_1fr] gap-5">
            <div className="bg-[#faf6f8] border border-black/5 rounded-2xl p-6">
              <div className="flex flex-col sm:flex-row gap-6">
                <button
                  type="button"
                  onClick={() => fileInputRef.current?.click()}
                  className="relative w-28 h-28 rounded-full overflow-hidden flex-shrink-0 bg-white border border-black/10 flex items-center justify-center text-plumdeep text-2xl font-semibold group mx-auto sm:mx-0"
                  aria-label="Change portrait"
                >
                  {photoURL ? (
                    <img src={photoURL} alt="" className="w-full h-full object-cover" />
                  ) : (
                    <span className="text-[10px] font-semibold uppercase tracking-wide text-[#9a8a9c]">
                      Portrait
                    </span>
                  )}
                  <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                    {photoLoading ? (
                      <ClipLoader size={18} color="#fff" />
                    ) : (
                      <FiCamera size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                    )}
                  </span>
                  <span className="absolute bottom-0.5 right-0.5 w-7 h-7 rounded-full bg-plumdeep border-2 border-white flex items-center justify-center">
                    <FiCamera size={12} className="text-white" />
                  </span>
                </button>

                <div className="flex-1 flex flex-col gap-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
                        Preferred name
                      </label>
                      <input
                        className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-sm"
                        {...register('displayName')}
                      />
                      {errors.displayName && (
                        <div className="text-xs text-[#9b3b3b] mt-1">{errors.displayName.message}</div>
                      )}
                    </div>
                    <div>
                      <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
                        Identity
                      </label>
                      <input
                        className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-sm"
                        placeholder="She/Her, He/Him, They/Them…"
                        value={pronouns}
                        onChange={(e) => setPronouns(e.target.value)}
                      />
                    </div>
                  </div>

                  <div>
                    <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
                      Personal bio
                    </label>
                    <textarea
                      rows={3}
                      className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-sm resize-none"
                      placeholder="Tell your partner a little about you…"
                      value={bio}
                      onChange={(e) => setBio(e.target.value)}
                      maxLength={280}
                    />
                  </div>
                </div>
              </div>

              <div className="mt-4">
                <label className="block text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
                  Profile photo
                </label>
                <div className="flex items-center gap-2 flex-wrap">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-black/10 bg-white text-sm font-medium disabled:opacity-60"
                  >
                    <FiCamera size={14} />
                    {photoLoading ? 'Uploading…' : photoURL ? 'Change photo' : 'Upload photo'}
                  </button>
                  {photoURL && (
                    <button
                      type="button"
                      onClick={removePhoto}
                      className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl text-sm font-medium text-[#9b3b3b] hover:bg-[#fbe4e4]"
                    >
                      <FiTrash2 size={14} /> Remove
                    </button>
                  )}
                  {couple?.streak > 0 && (
                    <div className="flex items-center gap-1 text-xs text-peach font-semibold ml-auto">
                      <FaFire size={12} />
                      {couple.streak} day streak
                      {couple?.streakGraceAvailable !== false && (
                        <span
                          title="Miss a day and your streak survives once, automatically."
                          className="flex items-center gap-0.5 ml-1 font-normal text-[#9a8a9c]"
                        >
                          <FiShield size={12} /> grace day available
                        </span>
                      )}
                    </div>
                  )}
                </div>
                {photoError && <div className="text-xs text-[#9b3b3b] mt-1">{photoError}</div>}
                <input type="hidden" {...register('photoURL')} />
              </div>
            </div>

            <div className="flex flex-col gap-5">
              <div className="bg-[#fbe4e4]/50 border border-black/5 rounded-2xl p-5">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#c2665a] mb-3">
                  Love language
                </p>
                <div className="flex flex-wrap gap-2">
                  {LOVE_LANGUAGES.map((l) => {
                    const active = loveLanguage === l.value
                    return (
                      <button
                        key={l.value}
                        type="button"
                        onClick={() => setValue('loveLanguage', active ? '' : l.value, { shouldDirty: true })}
                        className={`text-xs font-semibold px-3.5 py-2 rounded-full transition-colors ${
                          active
                            ? 'bg-peach text-white'
                            : 'bg-white text-[#9a8a9c] border border-black/10 hover:bg-black/5'
                        }`}
                      >
                        {l.value}
                      </button>
                    )
                  })}
                </div>
                {loveLanguage && (
                  <p className="text-xs text-[#9a8a9c] mt-3 leading-snug">
                    {LOVE_LANGUAGES.find((l) => l.value === loveLanguage)?.description}
                  </p>
                )}
              </div>

              <div className="bg-[#faf6f8] border border-black/5 rounded-2xl p-5 flex-1">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-3">
                  Favorite song
                </p>
                <div className="flex items-center gap-3 mb-3">
                  <div className="w-10 h-10 rounded-xl bg-plumdeep flex items-center justify-center flex-shrink-0">
                    <FiSmartphone size={14} className="text-white" />
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-semibold truncate">
                      {watch('favoriteSong')?.split(' — ')[0] || 'Not set yet'}
                    </p>
                    {watch('favoriteSong')?.includes(' — ') && (
                      <p className="text-xs text-[#9a8a9c] truncate">{watch('favoriteSong').split(' — ')[1]}</p>
                    )}
                  </div>
                </div>
                <input
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 bg-white text-sm"
                  placeholder="Song — artist"
                  {...register('favoriteSong')}
                />
                {errors.favoriteSong && (
                  <div className="text-xs text-[#9b3b3b] mt-1">{errors.favoriteSong.message}</div>
                )}
              </div>
            </div>
          </div>

          {/* Row 2 — Anniversary + Favorite memories */}
          <div className="grid grid-cols-1 lg:grid-cols-[1fr_1.4fr] gap-5">
            <div className="bg-gradient-to-br from-gold/15 to-peach/10 border border-gold/25 rounded-2xl p-5">
              <div className="flex items-start justify-between mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c]">Anniversary</p>
                {anniversary && (
                  <span className="font-serif italic text-lg text-peach leading-none">
                    {anniversary.years} Years
                  </span>
                )}
              </div>

              {editingAnniversary ? (
                <div className="mb-2">
                  <input
                    type="date"
                    autoFocus
                    className="w-full px-3.5 py-2 rounded-xl border border-black/10 bg-white text-sm"
                    {...register('anniversaryDate')}
                    onBlur={() => setEditingAnniversary(false)}
                  />
                </div>
              ) : (
                <button
                  type="button"
                  onClick={() => setEditingAnniversary(true)}
                  className="text-sm font-semibold mb-3 hover:text-peach transition-colors text-left"
                >
                  {anniversaryDate ? new Date(anniversaryDate).toLocaleDateString(undefined, {
                    year: 'numeric',
                    month: 'long',
                    day: 'numeric',
                  }) : 'Add your anniversary date'}
                </button>
              )}

              {anniversary && (
                <>
                  <div className="h-1.5 rounded-full bg-black/5 overflow-hidden mb-2">
                    <div
                      className="h-full rounded-full bg-gradient-to-r from-gold to-peach"
                      style={{ width: `${anniversaryProgress}%` }}
                    />
                  </div>
                  <p className="text-[11px] text-[#9a8a9c] uppercase tracking-wide">
                    {anniversary.daysUntil} day{anniversary.daysUntil === 1 ? '' : 's'} until celebration
                  </p>
                </>
              )}
            </div>

            <div className="bg-[#faf6f8] border border-black/5 rounded-2xl p-5">
              <div className="flex items-center justify-between mb-4">
                <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c]">
                  Favorite memories
                </p>
                <a href="/memories" className="text-xs font-semibold text-peach">
                  View gallery
                </a>
              </div>
              <div className="grid grid-cols-3 sm:grid-cols-5 gap-3">
                {memorySlots.map((m, i) =>
                  m ? (
                    <div key={m.id} className="aspect-square rounded-xl overflow-hidden border border-black/10">
                      <img src={m.photoData} alt={m.caption || ''} className="w-full h-full object-cover" />
                    </div>
                  ) : (
                    <div
                      key={i}
                      className="aspect-square rounded-xl bg-black/5 flex items-center justify-center text-[9px] font-semibold uppercase tracking-wide text-[#c2b8c4]"
                    >
                      New
                    </div>
                  )
                )}
              </div>
              <p className="text-xs text-[#9a8a9c] mt-3">Heart a photo on the Memories page to pin it here.</p>
            </div>
          </div>

          {/* Row 3 — Preferences / Account security / Notifications */}
          <div className="grid grid-cols-1 md:grid-cols-3 gap-5">
            <div className="bg-[#faf6f8] border border-black/5 rounded-2xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-4">Preferences</p>

              <div className="flex items-center justify-between mb-4">
                <span className="text-sm">Accent choice</span>
                <div className="flex items-center gap-1.5">
                  {PALETTES.map((p) => (
                    <button
                      key={p}
                      type="button"
                      onClick={() => setPalette(p)}
                      aria-pressed={palette === p}
                      aria-label={`${p} accent`}
                      title={p}
                      className={`w-5 h-5 rounded-full transition-all ${
                        palette === p ? 'ring-2 ring-offset-2 ring-peach' : 'opacity-70 hover:opacity-100'
                      }`}
                      style={{ background: PALETTE_SWATCH[p] }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex items-center justify-between mb-4">
                <span className="text-sm">Quiet mode</span>
                <button
                  type="button"
                  onClick={() => togglePref('quietMode')}
                  role="switch"
                  aria-checked={!!prefs.quietMode}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                    prefs.quietMode ? 'bg-peach' : 'bg-black/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      prefs.quietMode ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>

              <div className="flex items-center justify-between pt-4 border-t border-black/10">
                <span className="flex items-center gap-2 text-sm">
                  {theme === 'dark' ? <FiMoon size={14} /> : <FiSun size={14} />}
                  {theme === 'dark' ? 'Dark mode' : 'Light mode'}
                </span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  role="switch"
                  aria-checked={theme === 'dark'}
                  className={`relative w-10 h-6 rounded-full transition-colors flex-shrink-0 ${
                    theme === 'dark' ? 'bg-peach' : 'bg-black/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      theme === 'dark' ? 'translate-x-[18px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
            </div>

            <div className="bg-[#faf6f8] border border-black/5 rounded-2xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-4">
                Account security
              </p>
              <button
                type="button"
                onClick={handleResetPassword}
                className="w-full flex items-center justify-between text-sm font-medium py-1.5 hover:text-peach transition-colors"
              >
                <span className="flex items-center gap-2">
                  <FiLock size={14} /> Change password
                </span>
                <FiChevronRight size={15} className="text-[#9a8a9c]" />
              </button>
              {resetSent && <p className="text-xs text-[#2f6d3f] mt-1.5">Check your inbox for a reset link.</p>}
              {resetError && <p className="text-xs text-[#9b3b3b] mt-1.5">{resetError}</p>}

              <div className="flex items-center justify-between pt-3 mt-3 border-t border-black/10">
                <span className="flex items-center gap-2 text-sm font-medium">
                  <FiSmartphone size={14} /> Two-factor auth
                </span>
                <span className="text-xs font-semibold text-[#9a8a9c] bg-black/5 px-2.5 py-1 rounded-full">
                  Not available yet
                </span>
              </div>
            </div>

            <div className="bg-[#faf6f8] border border-black/5 rounded-2xl p-5">
              <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-4">Notifications</p>
              <div className="flex flex-col gap-3">
                {NOTIF_OPTIONS.map(([key, label]) => {
                  const on = prefs[key] !== false
                  return (
                    <label key={key} className="flex items-center justify-between text-sm cursor-pointer">
                      <span>{label}</span>
                      <button
                        type="button"
                        onClick={() => togglePref(key)}
                        aria-pressed={on}
                        className={`w-5 h-5 rounded-md border flex items-center justify-center transition-colors ${
                          on ? 'bg-peach border-peach' : 'bg-white border-black/20'
                        }`}
                      >
                        {on && <span className="w-2 h-2 rounded-sm bg-white" />}
                      </button>
                    </label>
                  )
                })}
              </div>
            </div>
          </div>

          {serverErr && (
            <div className="text-sm text-[#9b3b3b] bg-[#fbe4e4] rounded-lg px-3.5 py-2.5">{serverErr}</div>
          )}

          {/* Bottom action bar, matching the reference */}
          <div className="flex items-center justify-end gap-4 pt-1">
            <button
              type="button"
              onClick={handleDiscard}
              disabled={!isDirty}
              className="text-sm font-semibold text-[#9a8a9c] hover:text-ink disabled:opacity-40 transition-colors"
            >
              Discard changes
            </button>
            <button
              type="submit"
              disabled={isSubmitting}
              className="px-6 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60 flex items-center justify-center gap-2"
            >
              {isSubmitting && <ClipLoader size={14} color="#3d2340" />}
              {isSubmitting ? 'Updating…' : 'Update profile'}
            </button>
          </div>
        </div>
      </form>

      {/* Shared space & account-level actions — not part of the visual
          reference, but real functionality that has to live somewhere. */}
      <div className="mt-8 pt-6 border-t border-black/10">
        <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-4">
          Shared space &amp; data
        </p>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-5">
          <div className="bg-white border border-black/10 rounded-2xl p-5">
            <h3 className="font-semibold mb-3">Shared space</h3>

            {couple && hasPartner && (
              <>
                <div className="text-sm text-[#7a6a7c] mb-4">
                  Linked with <span className="font-semibold text-ink">{partner?.displayName || '...'}</span>
                </div>
                {!confirmingUnlink ? (
                  <button
                    onClick={() => setConfirmingUnlink(true)}
                    className="text-sm font-semibold px-4 py-2 rounded-xl border border-[#e5b7b7] text-[#9b3b3b] hover:bg-[#fbe4e4]"
                  >
                    Unlink partner
                  </button>
                ) : (
                  <div className="bg-[#fbe4e4] rounded-xl p-4">
                    <p className="text-sm text-[#9b3b3b] mb-3">
                      This removes shared chat, tasks, calendar, and love jar access between you two.
                      This can't be undone from here. Are you sure?
                    </p>
                    {unlinkError && <div className="text-sm text-[#9b3b3b] mb-2">{unlinkError}</div>}
                    <div className="flex gap-2">
                      <button
                        onClick={handleUnlink}
                        disabled={unlinking}
                        className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#9b3b3b] text-white disabled:opacity-60"
                      >
                        {unlinking ? 'Unlinking...' : 'Yes, unlink'}
                      </button>
                      <button
                        onClick={() => setConfirmingUnlink(false)}
                        disabled={unlinking}
                        className="text-sm font-semibold px-4 py-2 rounded-xl border border-black/10"
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </>
            )}

            {isPending && (
              <>
                <p className="text-sm text-[#9a8a9c] mb-4">
                  Waiting for your partner to join. Share this code with them:
                </p>
                <div className="flex items-center gap-2 mb-4">
                  <div className="flex-1 font-mono text-lg tracking-[0.2em] bg-[#faf6f8] border border-black/10 rounded-xl px-4 py-2.5 text-center">
                    {couple.inviteCode}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-black/10 hover:bg-black/5"
                  >
                    {codeCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
                {createError && <div className="text-sm text-[#9b3b3b] mb-3">{createError}</div>}
                <button
                  onClick={handleCancelSpace}
                  disabled={cancelling}
                  className="text-sm font-semibold px-4 py-2 rounded-xl border border-[#e5b7b7] text-[#9b3b3b] hover:bg-[#fbe4e4] disabled:opacity-60"
                >
                  {cancelling ? 'Cancelling...' : 'Cancel — start over'}
                </button>
              </>
            )}

            {!couple && (
              <div className="flex flex-col gap-5">
                <p className="text-sm text-[#9a8a9c]">
                  You're not linked with anyone yet. Start a space and invite your partner, or enter
                  the code they sent you.
                </p>
                <button
                  onClick={handleCreateSpace}
                  disabled={creating}
                  className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60"
                >
                  {creating ? 'Starting...' : 'Start a new space — invite my partner'}
                </button>
                {createError && <div className="text-sm text-[#9b3b3b]">{createError}</div>}

                <div className="h-px bg-black/10" />

                <form onSubmit={handleJoinSubmit(handleJoin)} noValidate>
                  <div className="text-xs font-semibold text-[#9a8a9c] mb-1.5 uppercase tracking-wide">
                    Invite code from your partner
                  </div>
                  <div className="flex items-center gap-2">
                    <input
                      type="text"
                      placeholder="e.g. 8K3PQZ"
                      maxLength={12}
                      className="flex-1 font-mono text-lg tracking-[0.2em] bg-white border border-black/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-peach uppercase"
                      {...registerJoin('joinCode')}
                    />
                    <button
                      type="submit"
                      disabled={joining}
                      className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-peach text-white disabled:opacity-60"
                    >
                      {joining ? 'Linking...' : 'Link accounts'}
                    </button>
                  </div>
                  {joinFieldErrors.joinCode && (
                    <div className="text-sm text-[#9b3b3b] mt-2.5">{joinFieldErrors.joinCode.message}</div>
                  )}
                  {joinError && <div className="text-sm text-[#9b3b3b] mt-2.5">{joinError}</div>}
                </form>
              </div>
            )}
          </div>

          <div className="flex flex-col gap-5">
            {couple && (
              <div className="bg-white border border-black/10 rounded-2xl p-5">
                <h3 className="font-semibold mb-1">Data &amp; backup</h3>
                <p className="text-xs text-[#9a8a9c] mb-4">
                  Download everything — chat, memories, check-ins, goals, tasks, and the love jar.
                </p>
                <div className="flex flex-wrap gap-2">
                  <button
                    onClick={() => handleExport('json')}
                    disabled={!!exporting}
                    className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-black/10 hover:bg-black/5 disabled:opacity-60"
                  >
                    <FiDownload size={14} />
                    {exporting === 'json' ? 'Preparing…' : 'JSON backup'}
                  </button>
                  <button
                    onClick={() => handleExport('html')}
                    disabled={!!exporting}
                    className="flex items-center gap-1.5 text-sm font-semibold px-4 py-2 rounded-xl border border-black/10 hover:bg-black/5 disabled:opacity-60"
                  >
                    <FiDownload size={14} />
                    {exporting === 'html' ? 'Preparing…' : 'Readable summary'}
                  </button>
                </div>
              </div>
            )}

            <button
              onClick={logout}
              className="text-left text-sm font-semibold px-4 py-2.5 rounded-xl border border-black/10 hover:bg-black/5 bg-white"
            >
              Sign out
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
