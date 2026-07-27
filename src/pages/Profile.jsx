import { useState } from 'react'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { ClipLoader } from 'react-spinners'
import { useAuth } from '../context/AuthContext'
import { profileSchema, zodResolver } from '../lib/schemas'

export default function Profile() {
  const { profile, updateProfile } = useAuth()
  const [serverErr, setServerErr] = useState('')

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(profileSchema),
    defaultValues: {
      displayName: profile?.displayName || '',
      photoURL: profile?.photoURL || '',
      anniversaryDate: profile?.anniversaryDate || '',
    },
  })

  const displayName = watch('displayName')
  const photoURL = watch('photoURL')

  async function onSubmit(values) {
    setServerErr('')
    try {
      await updateProfile({
        displayName: values.displayName.trim(),
        photoURL: values.photoURL?.trim() || null,
        anniversaryDate: values.anniversaryDate || null,
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
          <div className="w-20 h-20 rounded-full overflow-hidden flex-shrink-0 bg-gradient-to-br from-peach to-gold flex items-center justify-center text-plumdeep text-2xl font-semibold">
            {photoURL ? (
              <img src={photoURL} alt="" className="w-full h-full object-cover" />
            ) : (
              (displayName || profile?.displayName || '?')[0]?.toUpperCase()
            )}
          </div>
          <div>
            <div className="font-semibold">{profile?.displayName}</div>
            <div className="text-sm text-[#9a8a9c]">{profile?.email}</div>
          </div>
        </div>

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
              Photo URL
            </label>
            <input
              type="url"
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              placeholder="https://..."
              {...register('photoURL')}
            />
            {errors.photoURL && (
              <div className="text-xs text-[#9b3b3b] mt-1">{errors.photoURL.message}</div>
            )}
            <p className="text-xs text-[#9a8a9c] mt-1">
              Paste a link to a photo hosted elsewhere (Google Photos share link, Imgur,
              etc). Right-click any photo online, then "Copy image address" usually gives you
              a link that works here.
            </p>
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
    </div>
  )
}
