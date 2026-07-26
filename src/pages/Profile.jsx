import { useState } from 'react'
import { useAuth } from '../context/AuthContext'

export default function Profile() {
  const { profile, updateProfile } = useAuth()

  const [displayName, setDisplayName] = useState(profile?.displayName || '')
  const [photoURL, setPhotoURL] = useState(profile?.photoURL || '')
  const [anniversaryDate, setAnniversaryDate] = useState(profile?.anniversaryDate || '')
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [saved, setSaved] = useState(false)

  async function handleSave(e) {
    e.preventDefault()
    setError('')
    setSaved(false)
    setSaving(true)
    try {
      await updateProfile({
        displayName: displayName.trim(),
        photoURL: photoURL.trim() || null,
        anniversaryDate: anniversaryDate || null,
      })
      setSaved(true)
      setTimeout(() => setSaved(false), 2500)
    } catch (err) {
      setError(err.message)
    } finally {
      setSaving(false)
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

        <form onSubmit={handleSave} className="flex flex-col gap-4">
          <div>
            <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">
              Display name
            </label>
            <input
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              required
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-[#7a6a7c] mb-1.5">
              Photo URL
            </label>
            <input
              type="url"
              className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
              placeholder="https://..."
              value={photoURL}
              onChange={(e) => setPhotoURL(e.target.value)}
            />
            <p className="text-xs text-[#9a8a9c] mt-1">
              Paste a link to a photo hosted elsewhere (Google Photos share link, Imgur,
              etc). Right-click any photo online → "Copy image address" usually gives you
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
              value={anniversaryDate}
              onChange={(e) => setAnniversaryDate(e.target.value)}
            />
            <p className="text-xs text-[#9a8a9c] mt-1">
              Powers the anniversary countdown on your dashboard.
            </p>
          </div>

          {error && (
            <div className="text-sm text-[#9b3b3b] bg-[#fbe4e4] rounded-lg px-3.5 py-2.5">
              {error}
            </div>
          )}
          {saved && (
            <div className="text-sm text-[#2f6d3f] bg-[#e5f3e8] rounded-lg px-3.5 py-2.5">
              Saved.
            </div>
          )}

          <button
            type="submit"
            disabled={saving}
            className="py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60"
          >
            {saving ? 'Saving...' : 'Save changes'}
          </button>
        </form>
      </div>
    </div>
  )
}