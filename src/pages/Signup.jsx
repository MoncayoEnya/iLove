import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'
import AuthCard from '../components/AuthCard'

export default function Signup() {
  const { signup } = useAuth()
  const navigate = useNavigate()
  const [displayName, setDisplayName] = useState('')
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [err, setErr] = useState('')
  const [busy, setBusy] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    setErr('')
    if (!displayName || !email || password.length < 6) {
      setErr('Fill in every field — password needs at least 6 characters.')
      return
    }
    setBusy(true)
    try {
      await signup({ displayName, email, password })
      navigate('/link')
    } catch (e) {
      setErr(e.message.replace('Firebase: ', ''))
    } finally {
      setBusy(false)
    }
  }

  return (
    <AuthCard>
      <form onSubmit={handleSubmit}>
        <label className="block text-xs text-[#6b5a6d] mt-3.5 mb-1.5 font-semibold">
          Your name
        </label>
        <input
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          placeholder="What your partner calls you"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
        />
        <label className="block text-xs text-[#6b5a6d] mt-3.5 mb-1.5 font-semibold">
          Email
        </label>
        <input
          type="email"
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
        />
        <label className="block text-xs text-[#6b5a6d] mt-3.5 mb-1.5 font-semibold">
          Password
        </label>
        <input
          type="password"
          className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
        />
        {err && <div className="bg-[#fbe4e4] text-[#9b3b3b] text-sm px-3 py-2 rounded-lg mt-3.5">{err}</div>}
        <button
          disabled={busy}
          className="w-full mt-5 py-3 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60"
        >
          {busy ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <div className="text-center mt-4 text-sm text-[#7a6a7c]">
        Already have one?{' '}
        <Link to="/login" className="text-peach font-semibold">
          Log in
        </Link>
      </div>
    </AuthCard>
  )
}
