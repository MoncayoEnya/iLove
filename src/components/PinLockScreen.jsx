import { useState } from 'react'
import Logo from './Logo'
import { usePinLock } from '../context/PinLockContext'
import { useAuth } from '../context/AuthContext'

export default function PinLockScreen() {
  const { verifyPin, forgetPin } = usePinLock()
  const { logout } = useAuth()
  const [pin, setPin] = useState('')
  const [error, setError] = useState('')
  const [checking, setChecking] = useState(false)
  const [confirmingReset, setConfirmingReset] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!pin) return
    setChecking(true)
    setError('')
    const ok = await verifyPin(pin)
    setChecking(false)
    if (!ok) {
      setError('Wrong PIN — try again.')
      setPin('')
    }
  }

  async function handleForgot() {
    // No way to recover the old PIN (it's only ever stored as a hash), so
    // resetting means signing out of this device and starting fresh.
    forgetPin()
    await logout()
  }

  return (
    <div
      className="min-h-screen flex items-center justify-center p-6"
      style={{
        background:
          'radial-gradient(ellipse at 20% 0%, #4a2b4f 0%, #3d2340 45%, #26152a 100%)',
      }}
    >
      <div className="bg-paper rounded-[22px] max-w-[400px] w-full p-9 shadow-2xl">
        <div className="flex items-center gap-2.5 mb-2">
          <Logo size="lg" />
          <span className="font-serif text-2xl font-semibold">iLove</span>
        </div>
        <div className="text-[11px] tracking-[2px] uppercase text-peach/90 ml-[46px] mb-6">
          welcome back
        </div>

        <form onSubmit={handleSubmit} noValidate>
          <label className="text-xs font-semibold text-[#9a8a9c] uppercase tracking-wide mb-1.5 block">
            Enter your PIN
          </label>
          <input
            type="password"
            inputMode="numeric"
            autoFocus
            maxLength={8}
            value={pin}
            onChange={(e) => {
              setPin(e.target.value.replace(/\D/g, ''))
              setError('')
            }}
            className="w-full font-mono text-lg tracking-[0.4em] bg-white border border-black/10 rounded-xl px-4 py-3 text-center focus:outline-none focus:border-peach"
            placeholder="••••"
          />
          {error && <div className="text-sm text-[#9b3b3b] mt-2.5">{error}</div>}

          <button
            type="submit"
            disabled={checking || !pin}
            className="w-full mt-4 text-sm font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60"
          >
            {checking ? 'Checking...' : 'Unlock'}
          </button>
        </form>

        {!confirmingReset ? (
          <button
            onClick={() => setConfirmingReset(true)}
            className="text-xs text-[#9a8a9c] mt-5 underline block mx-auto"
          >
            Forgot your PIN?
          </button>
        ) : (
          <div className="bg-[#fbe4e4] rounded-xl p-4 mt-5">
            <p className="text-sm text-[#9b3b3b] mb-3">
              We can't recover a forgotten PIN — it's only ever stored as a scrambled hash on
              this device. Resetting signs you out here; sign back in and set a new PIN.
            </p>
            <div className="flex gap-2">
              <button
                onClick={handleForgot}
                className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#9b3b3b] text-white"
              >
                Sign out & reset
              </button>
              <button
                onClick={() => setConfirmingReset(false)}
                className="text-sm font-semibold px-4 py-2 rounded-xl border border-black/10"
              >
                Cancel
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
