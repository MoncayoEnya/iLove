import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, setDoc } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'

const NOTIF_OPTIONS = [
  ['notifyChat', 'New messages'],
  ['notifyTasks', 'Task updates'],
  ['notifyCalendar', 'Upcoming events'],
  ['notifyStreak', 'Streak reminders'],
]

export default function Settings() {
  const { firebaseUser, profile, couple, resetPassword, unlinkPartner, linkPartner, logout } =
    useAuth()
  const { partner } = usePartner()
  const navigate = useNavigate()

  const prefs = profile?.prefs || {}
  const [resetSent, setResetSent] = useState(false)
  const [resetError, setResetError] = useState('')
  const [confirmingUnlink, setConfirmingUnlink] = useState(false)
  const [unlinking, setUnlinking] = useState(false)
  const [unlinkError, setUnlinkError] = useState('')

  const [partnerCode, setPartnerCode] = useState('')
  const [linking, setLinking] = useState(false)
  const [linkError, setLinkError] = useState('')
  const [codeCopied, setCodeCopied] = useState(false)

  async function togglePref(key) {
    await setDoc(
      doc(db, 'users', firebaseUser.uid),
      { prefs: { ...prefs, [key]: !prefs[key] } },
      { merge: true }
    )
  }

  async function handleResetPassword() {
    setResetError('')
    try {
      await resetPassword(profile.email)
      setResetSent(true)
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

  async function handleLinkPartner(e) {
    e.preventDefault()
    setLinking(true)
    setLinkError('')
    try {
      await linkPartner(partnerCode)
      setPartnerCode('')
    } catch (err) {
      setLinkError(err.message)
    } finally {
      setLinking(false)
    }
  }

  async function handleCopyCode() {
    if (!profile?.inviteCode) return
    try {
      await navigator.clipboard.writeText(profile.inviteCode)
      setCodeCopied(true)
      setTimeout(() => setCodeCopied(false), 2000)
    } catch {
      // clipboard API can fail (permissions, non-secure context) — no big deal
    }
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Settings</h1>
        <p className="text-sm text-[#7a6a7c]">Account, notifications, and your shared space.</p>
      </div>

      <div className="flex flex-col gap-5 max-w-lg">
        {/* Account */}
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Account</h3>
          <div className="text-sm text-[#7a6a7c] mb-4">{profile?.email}</div>
          <button
            onClick={handleResetPassword}
            className="text-sm font-semibold px-4 py-2 rounded-xl border border-black/10 hover:bg-black/5"
          >
            Send password reset email
          </button>
          {resetSent && (
            <div className="text-sm text-[#2f6d3f] mt-2.5">
              Check your inbox for a reset link.
            </div>
          )}
          {resetError && <div className="text-sm text-[#9b3b3b] mt-2.5">{resetError}</div>}
        </div>

        {/* Notifications */}
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-1">Notifications</h3>
          <p className="text-xs text-[#9a8a9c] mb-4">
            Choose what shows up in your notification center.
          </p>
          <div className="flex flex-col gap-3">
            {NOTIF_OPTIONS.map(([key, label]) => (
              <label key={key} className="flex items-center justify-between text-sm cursor-pointer">
                <span>{label}</span>
                <input
                  type="checkbox"
                  checked={prefs[key] !== false}
                  onChange={() => togglePref(key)}
                  className="w-4 h-4 accent-peach"
                />
              </label>
            ))}
          </div>
        </div>

        {/* Shared space */}
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Shared space</h3>
          {couple ? (
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
                    This removes shared chat, tasks, calendar, and love jar access between
                    you two. This can't be undone from here. Are you sure?
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
          ) : (
            <div className="flex flex-col gap-5">
              <p className="text-sm text-[#9a8a9c]">
                You're not linked with anyone yet. Share your code with your partner, or
                enter theirs below.
              </p>

              {/* Your own invite code */}
              <div>
                <div className="text-xs font-semibold text-[#9a8a9c] mb-1.5 uppercase tracking-wide">
                  Your invite code
                </div>
                <div className="flex items-center gap-2">
                  <div className="flex-1 font-mono text-lg tracking-[0.2em] bg-[#faf6f8] border border-black/10 rounded-xl px-4 py-2.5">
                    {profile?.inviteCode || 'Generating...'}
                  </div>
                  <button
                    type="button"
                    onClick={handleCopyCode}
                    disabled={!profile?.inviteCode}
                    className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-black/10 hover:bg-black/5 disabled:opacity-60"
                  >
                    {codeCopied ? 'Copied!' : 'Copy'}
                  </button>
                </div>
              </div>

              <div className="h-px bg-black/10" />

              {/* Enter partner's code */}
              <form onSubmit={handleLinkPartner}>
                <div className="text-xs font-semibold text-[#9a8a9c] mb-1.5 uppercase tracking-wide">
                  Invite code from your partner
                </div>
                <div className="flex items-center gap-2">
                  <input
                    type="text"
                    value={partnerCode}
                    onChange={(e) => setPartnerCode(e.target.value.toUpperCase())}
                    placeholder="e.g. XW6637"
                    maxLength={12}
                    className="flex-1 font-mono text-lg tracking-[0.2em] bg-white border border-black/10 rounded-xl px-4 py-2.5 focus:outline-none focus:border-peach"
                  />
                  <button
                    type="submit"
                    disabled={linking || !partnerCode.trim()}
                    className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-peach text-white disabled:opacity-60"
                  >
                    {linking ? 'Linking...' : 'Link accounts'}
                  </button>
                </div>
                {linkError && <div className="text-sm text-[#9b3b3b] mt-2.5">{linkError}</div>}
              </form>
            </div>
          )}
        </div>

        <button
          onClick={logout}
          className="text-left text-sm font-semibold px-4 py-2.5 rounded-xl border border-black/10 hover:bg-black/5"
        >
          Sign out
        </button>
      </div>
    </div>
  )
}