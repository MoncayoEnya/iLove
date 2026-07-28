import { useEffect, useState } from 'react'
import dayjs from 'dayjs'
import { FiHeart, FiRefreshCw, FiShield, FiX } from 'react-icons/fi'
import { HiSparkles } from 'react-icons/hi2'
import { useCompanion } from '../hooks/useCompanion'
import { usePartner } from '../hooks/usePartner'
import EmptyState from '../components/EmptyState'

function formatCooldown(ms) {
  const totalMins = Math.ceil(ms / 60000)
  const h = Math.floor(totalMins / 60)
  const m = totalMins % 60
  if (h <= 0) return `${m}m`
  return `${h}h ${m}m`
}

export default function AICompanion() {
  const { hasPartner } = usePartner()
  const {
    enabled,
    setEnabled,
    suggestions,
    latest,
    loading,
    generating,
    generate,
    dismiss,
    cooldownMsLeft,
  } = useCompanion()

  // Just for a live-ticking "come back in Xh Ym" label.
  const [, forceTick] = useState(0)
  useEffect(() => {
    const id = setInterval(() => forceTick((n) => n + 1), 60_000)
    return () => clearInterval(id)
  }, [])

  const onCooldown = cooldownMsLeft > 0
  const history = suggestions.slice(1) // latest is shown in the hero card

  if (!hasPartner) {
    return (
      <div>
        <div className="mb-6">
          <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
            <HiSparkles className="text-peach" /> AI Companion
          </h1>
          <p className="text-sm text-[#7a6a7c]">Waiting for your partner to join with your invite code.</p>
        </div>
      </div>
    )
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1 flex items-center gap-2">
          <HiSparkles className="text-peach" /> AI Companion
        </h1>
        <p className="text-sm text-[#7a6a7c]">
          One gentle, optional suggestion — never a chat log, never anything sent without your say-so.
        </p>
      </div>

      {/* Opt-in / privacy card */}
      <div className="bg-white border border-black/10 rounded-2xl p-5 mb-4">
        <div className="flex items-start justify-between gap-4">
          <div className="flex items-start gap-3">
            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-peach/20 to-gold/20 flex items-center justify-center flex-shrink-0">
              <FiShield size={16} className="text-peach" />
            </div>
            <div>
              <div className="font-semibold text-sm">Turn on AI Companion</div>
              <p className="text-xs text-[#9a8a9c] mt-0.5 max-w-md">
                When it's on, we send only anonymized numbers — streaks, check-in counts, mood tallies, and
                your love language labels. Never message text, journal entries, or names. You can turn it
                off anytime and nothing more is generated.
              </p>
            </div>
          </div>
          <button
            role="switch"
            aria-checked={enabled}
            onClick={() => setEnabled(!enabled)}
            className={`relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ${
              enabled ? 'bg-peach' : 'bg-black/15'
            }`}
          >
            <span
              className={`absolute top-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform ${
                enabled ? 'translate-x-[22px]' : 'translate-x-0.5'
              }`}
            />
          </button>
        </div>
      </div>

      {!enabled ? (
        <EmptyState
          icon={HiSparkles}
          title="Companion is off"
          subtitle="Turn it on above whenever you're ready for an occasional gentle nudge."
        />
      ) : (
        <>
          {/* Latest suggestion */}
          <div
            className="rounded-2xl p-6 mb-4 text-white"
            style={{ background: 'linear-gradient(135deg, #e07a52, #d9a441)' }}
          >
            {latest && !latest.dismissed ? (
              <>
                <div className="flex items-center gap-2 text-xs opacity-80 mb-2 uppercase tracking-wide font-semibold">
                  <HiSparkles size={13} /> Today's suggestion
                </div>
                <p className="text-lg font-medium leading-snug">{latest.text}</p>
                <div className="flex items-center justify-between mt-4">
                  <span className="text-xs opacity-75">
                    {latest.createdAt?.seconds
                      ? dayjs.unix(latest.createdAt.seconds).format('MMM D, h:mm A')
                      : 'Just now'}
                  </span>
                  <button
                    onClick={() => dismiss(latest.id)}
                    className="text-xs opacity-80 hover:opacity-100 flex items-center gap-1"
                  >
                    <FiX size={13} /> Dismiss
                  </button>
                </div>
              </>
            ) : (
              <div className="text-sm opacity-90">
                No suggestion yet — tap below to get your first one.
              </div>
            )}
          </div>

          <button
            onClick={generate}
            disabled={generating || onCooldown}
            className="w-full sm:w-auto flex items-center justify-center gap-2 bg-plumdeep text-white text-sm font-semibold px-5 py-3 rounded-xl disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {generating ? (
              <>
                <FiRefreshCw size={15} className="animate-spin" /> Thinking of something...
              </>
            ) : onCooldown ? (
              <>
                <FiHeart size={15} /> Next suggestion in {formatCooldown(cooldownMsLeft)}
              </>
            ) : (
              <>
                <HiSparkles size={15} /> Get a suggestion
              </>
            )}
          </button>

          {/* History */}
          {!loading && history.length > 0 && (
            <div className="mt-8">
              <h3 className="text-xs font-semibold uppercase tracking-wide text-[#9a8a9c] mb-3">
                Past suggestions
              </h3>
              <div className="flex flex-col gap-2.5">
                {history.map((s) => (
                  <div
                    key={s.id}
                    className={`bg-white border border-black/10 rounded-xl p-4 text-sm ${
                      s.dismissed ? 'opacity-50' : ''
                    }`}
                  >
                    <p className="text-ink">{s.text}</p>
                    <span className="text-[11px] text-[#9a8a9c] mt-1.5 block">
                      {s.createdAt?.seconds ? dayjs.unix(s.createdAt.seconds).format('MMM D, h:mm A') : ''}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          )}
        </>
      )}
    </div>
  )
}
