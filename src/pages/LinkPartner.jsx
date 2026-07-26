import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import { useLinkCouple } from '../hooks/useLinkCouple'
import AuthCard from '../components/AuthCard'

export default function LinkPartner() {
  const { profile } = useAuth()
  const { createSpace, joinWithCode } = useLinkCouple()
  const navigate = useNavigate()

  const [mode, setMode] = useState('choose') // choose | join
  const [generated, setGenerated] = useState('')
  const [joinCode, setJoinCode] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleCreate() {
    setBusy(true)
    try {
      const code = await createSpace()
      setGenerated(code)
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  async function handleJoin() {
    setErr('')
    setBusy(true)
    try {
      await joinWithCode(joinCode)
      navigate('/dashboard')
    } catch (e) {
      setErr(e.message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard>
      <h2 className="font-serif text-lg mt-2 mb-1">Hi {profile?.displayName}</h2>
      <p className="text-sm text-[#9a8a9c] mb-1.5">Last step — link up with your partner.</p>

      {mode === 'choose' && !generated && (
        <>
          <button
            disabled={busy}
            onClick={handleCreate}
            className="w-full mt-5 py-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            Start a new space — invite my partner
          </button>
          <button
            onClick={() => setMode('join')}
            className="w-full mt-2.5 py-3 rounded-xl font-semibold text-sm border border-black/10 text-plum"
          >
            I have an invite code
          </button>
        </>
      )}

      {generated && (
        <>
          <p className="text-sm text-[#9a8a9c] mt-4">Share this code with your partner:</p>
          <div className="font-serif text-3xl tracking-[6px] text-center bg-blush rounded-xl p-4 my-4 text-plumdeep font-semibold">
            {generated}
          </div>
          <button
            onClick={() => navigate('/dashboard')}
            className="w-full py-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            I've sent it — continue
          </button>
        </>
      )}

      {mode === 'join' && (
        <>
          <label className="block text-xs text-[#6b5a6d] mt-3.5 mb-1.5 font-semibold">
            Invite code from your partner
          </label>
          <input
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="e.g. 8K3PQZ"
            value={joinCode}
            onChange={(e) => setJoinCode(e.target.value.toUpperCase())}
          />
          {err && <div className="bg-[#fbe4e4] text-[#9b3b3b] text-sm px-3 py-2 rounded-lg mt-3.5">{err}</div>}
          <button
            disabled={busy}
            onClick={handleJoin}
            className="w-full mt-4 py-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            Link accounts
          </button>
          <button
            onClick={() => { setMode('choose'); setErr('') }}
            className="w-full mt-2.5 py-3 rounded-xl font-semibold text-sm border border-black/10 text-plum"
          >
            Back
          </button>
        </>
      )}
    </AuthCard>
  )
}