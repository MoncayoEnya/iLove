import { useEffect, useRef, useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ClipLoader } from 'react-spinners'
import { FiCamera, FiHeart, FiShield, FiTrash2 } from 'react-icons/fi'
import { FaFire } from 'react-icons/fa'
import { collection, onSnapshot, query, where } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { profileSchema, zodResolver, LOVE_LANGUAGES } from '../lib/schemas'
import { compressImage } from '../utils/compressImage'
import CropModal from '../components/CropModal'

export default function Profile() {
  const { profile, couple, updateProfile } = useAuth()
  const [serverErr, setServerErr] = useState('')
  const [favoriteMemories, setFavoriteMemories] = useState([])
  const [cropSrc, setCropSrc] = useState(null)
  const [photoLoading, setPhotoLoading] = useState(false)
  const [photoError, setPhotoError] = useState('')
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
  const loveLanguage = watch('loveLanguage')
  const loveLanguageInfo = LOVE_LANGUAGES.find((l) => l.value === loveLanguage)

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

      <div className="bg-white border border-black/10 rounded-2xl p-6 max-w-lg">
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
            <div className="font-semibold">{profile?.displayName}</div>
            <div className="text-sm text-[#9a8a9c]">{profile?.email}</div>
            {couple?.streak > 0 && (
              <div className="flex items-center gap-1 text-xs text-peach font-semibold mt-1">
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

        <input
          ref={fileInputRef}
          type="file"
          accept="image/*"
          onChange={handlePhotoPick}
          className="hidden"
        />

        <CropModal imageSrc={cropSrc} aspect={1} onCancel={() => setCropSrc(null)} onCropped={handleCropped} />

        <form onSubmit={handleSubmit(onSubmit)} className="flex flex-col gap-4" noValidate>
          <div>
            <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">
              Display name
            </label>
            <input
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              {...register('displayName')}
            />
            {errors.displayName && (
              <div className="text-xs text-[#9b3b3b] mt-1">{errors.displayName.message}</div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">
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
            {errors.photoURL && (
              <div className="text-xs text-[#9b3b3b] mt-1">{errors.photoURL.message}</div>
            )}
            <p className="text-xs text-[#9a8a9c] mt-1">JPG or PNG, up to a few MB — you'll be able to crop it first.</p>
            <input type="hidden" {...register('photoURL')} />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">
              Anniversary date
            </label>
            <input
              type="date"
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              {...register('anniversaryDate')}
            />
            <p className="text-xs text-[#9a8a9c] mt-1">
              Powers the anniversary countdown on your dashboard.
            </p>
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">
              Favorite song
            </label>
            <input
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              placeholder="Song — artist"
              {...register('favoriteSong')}
            />
            {errors.favoriteSong && (
              <div className="text-xs text-[#9b3b3b] mt-1">{errors.favoriteSong.message}</div>
            )}
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">
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
            {loveLanguageInfo && (
              <p className="text-xs text-[#9a8a9c] mt-1">{loveLanguageInfo.description}</p>
            )}
          </div>

          {serverErr && (
            <div className="text-sm text-[#9b3b3b] bg-[#fbe4e4] rounded-lg px-3.5 py-2.5">
              {serverErr}
            </div>
          )}

          <button
            type="submit"
            disabled={isSubmitting}
            className="py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60 flex items-center justify-center gap-2"
          >
            {isSubmitting && <ClipLoader size={14} color="#3d2340" />}
            {isSubmitting ? 'Saving' : 'Save changes'}
          </button>
        </form>
      </div>

      {favoriteMemories.length > 0 && (
        <div className="mt-6 max-w-lg">
          <h3 className="font-semibold mb-3 flex items-center gap-1.5">
            <FiHeart size={14} fill="currentColor" className="text-peach" /> Favorite memories
          </h3>
          <div className="grid grid-cols-3 gap-3">
            {favoriteMemories.map((m) => (
              <div key={m.id} className="rounded-2xl overflow-hidden border border-black/10">
                <img src={m.photoData} alt={m.caption || ''} className="w-full h-24 object-cover" />
              </div>
            ))}
          </div>
          <p className="text-xs text-[#9a8a9c] mt-2">
            Heart a photo on the Memories page to pin it here.
          </p>
        </div>
      )}
    </div>
  )
}