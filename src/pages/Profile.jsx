import { useEffect, useRef, useState } from 'react'
import { Link } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import dayjs from 'dayjs'
import { ClipLoader } from 'react-spinners'
import { FiCamera, FiHeart, FiLock, FiMoon, FiShield, FiSun, FiTrash2 } from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import { profileSchema, zodResolver, LOVE_LANGUAGES } from '../lib/schemas'
import { compressImage } from '../utils/compressImage'
import CropModal from '../components/CropModal'
import ThemePicker from '../components/ThemePicker'

export default function Profile() {
  const { profile, couple, updateProfile, resetPassword } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const [serverErr, setServerErr] = useState('')
  const [favoriteMemories, setFavoriteMemories] = useState([])
  const [cropSrc, setCropSrc] = useState(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')
  const fileInputRef = useRef(null)

  const {
    register,
    handleSubmit,
    watch,
    setValue,
    formState: { errors, isSubmitting },
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

  const displayName = watch('displayName')
  const photoURL = watch('photoURL')
  const anniversaryDate = watch('anniversaryDate')
  const loveLanguage = watch('loveLanguage')
  const loveLanguageInfo = LOVE_LANGUAGES.find((l) => l.value === loveLanguage)

  const daysOfLove = anniversaryDate
    ? dayjs().startOf('day').diff(dayjs(anniversaryDate).startOf('day'), 'day') + 1
    : null

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
      })
      toast.success('Profile saved.')
    } catch (err) {
      setServerErr(err.message)
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Your profile</h1>
        <p className="text-sm text-[#7a6a7c]">This is what your partner sees on the dashboard.</p>
      </div>

      <form onSubmit={handleSubmit(onSubmit)} noValidate>
        <div className="grid grid-cols-1 lg:grid-cols-[1fr,300px] gap-5 items-start">
          {/* Public profile */}
          <div className="bg-white border border-black/10 rounded-2xl p-6">
            <div className="flex items-center gap-4 mb-6">
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="relative w-20 h-20 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-peach to-gold flex items-center justify-center text-plumdeep text-2xl font-semibold group"
                aria-label="Change profile photo"
              >
                {photoURL ? (
                  <img src={photoURL} alt="" className="w-full h-full object-cover" />
                ) : (
                  (displayName || profile?.displayName || '?')[0]?.toUpperCase()
                )}
                <span className="absolute inset-0 bg-black/0 group-hover:bg-black/30 transition-colors flex items-center justify-center">
                  {photoLoading ? (
                    <ClipLoader size={18} color="#fff" />
                  ) : (
                    <FiCamera size={18} className="text-white opacity-0 group-hover:opacity-100 transition-opacity" />
                  )}
                </span>
                <span className="absolute bottom-0 right-0 w-6 h-6 rounded-full bg-plumdeep border-2 border-white flex items-center justify-center">
                  <FiCamera size={11} className="text-white" />
                </span>
              </button>
              <div>
                <h3 className="font-serif text-lg font-semibold">Public Profile</h3>
                <p className="text-xs text-[#9a8a9c] mt-0.5">This is what your partner sees on their dashboard.</p>
                {couple?.streak > 0 && (
                  <div className="flex items-center gap-1 text-xs text-peach font-semibold mt-1.5">
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
            </div>

            <input ref={fileInputRef} type="file" accept="image/*" onChange={handlePhotoPick} className="hidden" />
            <CropModal imageSrc={cropSrc} aspect={1} onCancel={() => setCropSrc(null)} onCropped={handleCropped} />

            <div className="flex flex-col gap-4">
              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
                  Display name
                </label>
                <input
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                  {...register('displayName')}
                />
                {errors.displayName && <div className="text-xs text-[#9b3b3b] mt-1">{errors.displayName.message}</div>}
              </div>

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
                  Profile photo
                </label>
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => fileInputRef.current?.click()}
                    disabled={photoLoading}
                    className="flex items-center gap-1.5 px-3.5 py-2 rounded-xl border border-black/10 text-sm font-medium disabled:opacity-60"
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
                </div>
                {photoError && <div className="text-xs text-[#9b3b3b] mt-1">{photoError}</div>}
                <input type="hidden" {...register('photoURL')} />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
                    Anniversary
                  </label>
                  <input
                    type="date"
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                    {...register('anniversaryDate')}
                  />
                </div>
                <div>
                  <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
                    Love language
                  </label>
                  <select
                    className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm bg-white"
                    {...register('loveLanguage')}
                  >
                    <option value="">Not set</option>
                    {LOVE_LANGUAGES.map((l) => (
                      <option key={l.value} value={l.value}>
                        {l.value}
                      </option>
                    ))}
                  </select>
                </div>
              </div>
              {loveLanguageInfo && <p className="text-xs text-[#9a8a9c] -mt-2">{loveLanguageInfo.description}</p>}

              <div>
                <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
                  Favorite song
                </label>
                <input
                  className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
                  placeholder="Song — Artist"
                  {...register('favoriteSong')}
                />
                {errors.favoriteSong && <div className="text-xs text-[#9b3b3b] mt-1">{errors.favoriteSong.message}</div>}
              </div>

              {serverErr && (
                <div className="text-sm text-[#9b3b3b] bg-[#fbe4e4] rounded-lg px-3.5 py-2.5">{serverErr}</div>
              )}

              <button
                type="submit"
                disabled={isSubmitting}
                className="py-2.5 rounded-xl font-semibold text-sm bg-peach text-white hover:opacity-90 transition-opacity disabled:opacity-60 flex items-center justify-center gap-2"
              >
                {isSubmitting && <ClipLoader size={14} color="#fff" />}
                {isSubmitting ? 'Saving' : 'Save Changes'}
              </button>
            </div>
          </div>

          {/* Right column: security, appearance, journey */}
          <div className="flex flex-col gap-4">
            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <h3 className="font-semibold flex items-center gap-1.5 mb-4">
                <FiLock size={14} className="text-[#9a8a9c]" /> Security
              </h3>
              <label className="block text-[10px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1">
                Email address
              </label>
              <div className="text-sm mb-4 truncate">{profile?.email}</div>
              <button
                type="button"
                onClick={handleResetPassword}
                className="w-full py-2.5 rounded-xl text-sm font-semibold border border-black/10 text-peach hover:bg-peach/5 transition-colors"
              >
                Reset Password
              </button>
              {resetSent && <div className="text-xs text-[#2f6d3f] mt-2">Check your inbox for a reset link.</div>}
              {resetError && <div className="text-xs text-[#9b3b3b] mt-2">{resetError}</div>}
            </div>

            <div className="bg-white border border-black/10 rounded-2xl p-5">
              <h3 className="font-semibold mb-4">Appearance</h3>
              <div className="flex items-center justify-between mb-4">
                <span className="flex items-center gap-2 text-sm">
                  {theme === 'dark' ? <FiMoon size={15} /> : <FiSun size={15} />} Dark Theme
                </span>
                <button
                  type="button"
                  onClick={toggleTheme}
                  role="switch"
                  aria-checked={theme === 'dark'}
                  className={`relative w-11 h-6 rounded-full transition-colors flex-shrink-0 ${
                    theme === 'dark' ? 'bg-peach' : 'bg-black/15'
                  }`}
                >
                  <span
                    className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                      theme === 'dark' ? 'translate-x-[22px]' : 'translate-x-0.5'
                    }`}
                  />
                </button>
              </div>
              <p className="text-[10px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-2.5">
                Accent palette
              </p>
              <ThemePicker />
            </div>

            <div className="rounded-2xl p-5 bg-gradient-to-br from-peach to-gold text-white relative overflow-hidden">
              <FiHeart
                size={90}
                fill="currentColor"
                className="absolute -bottom-4 -right-4 text-white/15 pointer-events-none"
              />
              <div className="relative">
                <div className="text-sm font-medium text-white/85">Our Journey</div>
                <div className="font-serif text-3xl font-bold mt-1">
                  {daysOfLove != null ? daysOfLove.toLocaleString() : '—'}
                </div>
                <div className="text-[11px] font-semibold uppercase tracking-wide text-white/85 mt-0.5">
                  Days of love
                </div>
              </div>
            </div>
          </div>
        </div>
      </form>

      <div className="mt-6">
        <div className="flex items-center justify-between mb-3">
          <h3 className="font-serif text-lg font-semibold flex items-center gap-1.5">
            <FiHeart size={14} fill="currentColor" className="text-peach" /> Favorite Memories
          </h3>
          <Link to="/memories" className="text-sm font-semibold text-peach hover:underline">
            View all
          </Link>
        </div>
        {favoriteMemories.length === 0 ? (
          <p className="text-xs text-[#9a8a9c]">Heart a photo on the Memories page to pin it here.</p>
        ) : (
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
            {favoriteMemories.map((m) => (
              <div key={m.id} className="rounded-2xl overflow-hidden border border-black/10">
                <img src={m.photoData} alt={m.caption || ''} className="w-full h-24 object-cover" />
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}