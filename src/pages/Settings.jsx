import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { doc, setDoc } from 'firebase/firestore'
import { useForm } from 'react-hook-form'
import toast from 'react-hot-toast'
import { FiMoon, FiSun, FiDownload } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useTheme } from '../context/ThemeContext'
import ThemePicker from '../components/ThemePicker'
import { usePartner } from '../hooks/usePartner'
import { useLinkCouple } from '../hooks/useLinkCouple'
import { useMemberNames } from '../hooks/useMemberNames'
import { joinCodeSchema, zodResolver } from '../lib/schemas'
import { fetchCoupleData, downloadJSON, downloadHTML, buildReadableHTML } from '../utils/exportData'

const NOTIF_OPTIONS = [
  ['notifyChat', 'New messages'],
  ['notifyTasks', 'Task updates'],
  ['notifyCalendar', 'Upcoming events'],
  ['notifyStreak', 'Streak reminders'],
]

export default function Settings() {
  const { firebaseUser, profile, couple, resetPassword, unlinkPartner, logout } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const { partner, hasPartner } = usePartner()
  const { createSpace, joinWithCode } = useLinkCouple()
  const names = useMemberNames(couple?.members)
  const navigate = useNavigate()

  const prefs = profile?.prefs || {}
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
    register: registerJoin,
    handleSubmit: handleJoinSubmit,
    reset: resetJoinForm,
    formState: { errors: joinFieldErrors },
  } = useForm({ resolver: zodResolver(joinCodeSchema), defaultValues: { joinCode: '' } })

  // You can be in one of three states here:
  //  - fully linked: `couple` exists AND has a partner
  //  - pending: `couple` exists (you started a space) but partner hasn't joined yet
  //  - unlinked: no `couple` at all
  const isPending = !!couple && !hasPartner

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
    } catch (e) {
      toast.error("Couldn't put that export together — try again.")
    } finally {
      setExporting(null)
    }
  }

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

  // Same underlying call as "unlink" — if you're the only member, it just
  // deletes the pending space instead of navigating anywhere.
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

        {/* Appearance */}
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-1">Appearance</h3>
          <p className="text-xs text-[#9a8a9c] mb-4">Switch between light and dark theme.</p>
          <div className="flex items-center justify-between">
            <span className="flex items-center gap-2 text-sm">
              {theme === 'dark' ? <FiMoon size={15} /> : <FiSun size={15} />}
              {theme === 'dark' ? 'Dark mode' : 'Light mode'}
            </span>
            <button
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

          <div className="mt-4 pt-4 border-t border-black/10">
            <p className="text-xs text-[#9a8a9c] mb-2.5">Accent color</p>
            <ThemePicker />
          </div>
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

        {/* Data & backup */}
        {couple && (
          <div className="bg-white border border-black/10 rounded-2xl p-5">
            <h3 className="font-semibold mb-1">Data & backup</h3>
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
            <p className="text-xs text-[#9a8a9c] mt-3">
              JSON keeps the raw data (handy if you ever want it elsewhere); the summary is a
              browsable page you can open, print, or save as a PDF from your browser's print dialog.
            </p>
          </div>
        )}

        {/* Shared space */}
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
                You're not linked with anyone yet. Start a space and invite your partner,
                or enter the code they sent you.
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