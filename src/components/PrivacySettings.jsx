import { useState } from 'react'
import { FiLock } from 'react-icons/fi'
import { usePinLock } from '../context/PinLockContext'

function normalizePin(v) {
  return v.replace(/\D/g, '').slice(0, 8)
}

export default function PrivacySettings() {
  const { hasPin, setPin, removePin, lockNow } = usePinLock()
  const [editing, setEditing] = useState(false)
  const [confirmingRemove, setConfirmingRemove] = useState(false)
  const [pin, setPinValue] = useState('')
  const [confirmPin, setConfirmPin] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  function startEditing() {
    setPinValue('')
    setConfirmPin('')
    setError('')
    setEditing(true)
  }

  async function handleSave(e) {
    e.preventDefault()
    if (pin.length < 4) {
      setError('Use at least 4 digits.')
      return
    }
    if (pin !== confirmPin) {
      setError("PINs don't match.")
      return
    }
    setSaving(true)
    await setPin(pin)
    setSaving(false)
    setEditing(false)
  }

  function handleRemove() {
    removePin()
    setConfirmingRemove(false)
  }

  return (
    <div className="bg-white border border-black/10 rounded-2xl p-5">
      <h3 className="font-semibold mb-1 flex items-center gap-1.5">
        <FiLock size={14} /> Privacy
      </h3>
      <p className="text-xs text-[#9a8a9c] mb-4">
        Add a PIN so the Love Jar, Journal, and Conflict Recovery aren't left open if someone
        else picks up this device.
      </p>

      {!editing ? (
        <div className="flex flex-wrap gap-2">
          {hasPin ? (
            <>
              <button
                onClick={startEditing}
                className="text-sm font-semibold px-4 py-2 rounded-xl border border-black/10 hover:bg-black/5"
              >
                Change PIN
              </button>
              <button
                onClick={lockNow}
                className="text-sm font-semibold px-4 py-2 rounded-xl border border-black/10 hover:bg-black/5"
              >
                Lock now
              </button>
              {!confirmingRemove ? (
                <button
                  onClick={() => setConfirmingRemove(true)}
                  className="text-sm font-semibold px-4 py-2 rounded-xl border border-[#e5b7b7] text-[#9b3b3b] hover:bg-[#fbe4e4]"
                >
                  Remove PIN
                </button>
              ) : (
                <div className="bg-[#fbe4e4] rounded-xl p-4 w-full">
                  <p className="text-sm text-[#9b3b3b] mb-3">
                    This turns off the lock screen entirely. Remove it?
                  </p>
                  <div className="flex gap-2">
                    <button
                      onClick={handleRemove}
                      className="text-sm font-semibold px-4 py-2 rounded-xl bg-[#9b3b3b] text-white"
                    >
                      Yes, remove it
                    </button>
                    <button
                      onClick={() => setConfirmingRemove(false)}
                      className="text-sm font-semibold px-4 py-2 rounded-xl border border-black/10"
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              )}
            </>
          ) : (
            <button
              onClick={startEditing}
              className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-br from-peach to-gold text-plumdeep"
            >
              Set a PIN
            </button>
          )}
        </div>
      ) : (
        <form onSubmit={handleSave} className="flex flex-col gap-3">
          <div>
            <label className="text-xs font-semibold text-[#9a8a9c] uppercase tracking-wide mb-1.5 block">
              New PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              autoFocus
              value={pin}
              onChange={(e) => {
                setPinValue(normalizePin(e.target.value))
                setError('')
              }}
              className="w-full font-mono text-lg tracking-[0.4em] bg-white border border-black/10 rounded-xl px-4 py-2.5 text-center focus:outline-none focus:border-peach"
              placeholder="••••"
            />
          </div>
          <div>
            <label className="text-xs font-semibold text-[#9a8a9c] uppercase tracking-wide mb-1.5 block">
              Confirm PIN
            </label>
            <input
              type="password"
              inputMode="numeric"
              value={confirmPin}
              onChange={(e) => {
                setConfirmPin(normalizePin(e.target.value))
                setError('')
              }}
              className="w-full font-mono text-lg tracking-[0.4em] bg-white border border-black/10 rounded-xl px-4 py-2.5 text-center focus:outline-none focus:border-peach"
              placeholder="••••"
            />
          </div>
          {error && <div className="text-sm text-[#9b3b3b]">{error}</div>}
          <div className="flex gap-2">
            <button
              type="submit"
              disabled={saving}
              className="text-sm font-semibold px-4 py-2.5 rounded-xl bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60"
            >
              {saving ? 'Saving...' : 'Save PIN'}
            </button>
            <button
              type="button"
              onClick={() => setEditing(false)}
              className="text-sm font-semibold px-4 py-2.5 rounded-xl border border-black/10"
            >
              Cancel
            </button>
          </div>
        </form>
      )}
    </div>
  )
}
