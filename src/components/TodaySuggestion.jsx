import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import dayjs from 'dayjs'
import { motion } from 'framer-motion'
import { FiArrowRight, FiBell, FiCalendar, FiHeart, FiSun, FiHelpCircle } from 'react-icons/fi'
import { DATE_IDEAS } from '../data/dateIdeas'

// One clear "do this next" suggestion at the top of the dashboard, picked
// from what's actually going on, in priority order. Only one shows at a
// time so it reads as a nudge, not a to-do list.
export default function TodaySuggestion({
  myCheckin,
  partnerCheckin,
  partnerName,
  events,
  jar,
  myUid,
  answeredDailyQuestion,
  onCheckin,
  onNudge,
  nudgeDisabled,
}) {
  const today = dayjs().format('YYYY-MM-DD')

  const suggestion = useMemo(() => {
    if (!myCheckin) {
      return {
        icon: FiSun,
        title: "Start with today's check-in",
        text: 'Takes ten seconds and keeps your streak alive.',
        action: { label: 'Check in', onClick: onCheckin },
      }
    }
    if (!partnerCheckin) {
      return {
        icon: FiBell,
        title: `${partnerName} hasn't checked in yet`,
        text: 'A gentle nudge goes a long way.',
        action: { label: 'Send a nudge', onClick: onNudge, disabled: nudgeDisabled },
      }
    }
    if (answeredDailyQuestion === false) {
      return {
        icon: FiHelpCircle,
        title: "Today's question is waiting",
        text: "Answer it to see what they said.",
        action: { label: 'Answer', href: '#daily-question' },
      }
    }
    const weekEnd = dayjs().add(7, 'day').format('YYYY-MM-DD')
    const hasPlans = (events || []).some((e) => e.date >= today && e.date <= weekEnd)
    if (!hasPlans) {
      const seed = Number(today.replace(/-/g, ''))
      const idea = DATE_IDEAS[seed % DATE_IDEAS.length]
      return {
        icon: FiCalendar,
        title: 'Nothing planned this week',
        text: `How about: ${idea.title.charAt(0).toLowerCase()}${idea.title.slice(1)}?`,
        action: { label: 'See date ideas', to: '/date-ideas' },
      }
    }
    const threeDaysAgo = dayjs().subtract(3, 'day').unix()
    const wroteRecently = (jar || []).some(
      (n) => n.from === myUid && (n.createdAt?.seconds || 0) >= threeDaysAgo
    )
    if (!wroteRecently) {
      return {
        icon: FiHeart,
        title: `Tell ${partnerName} something you love`,
        text: "You haven't added to the love jar in a few days.",
        action: { label: 'Write a note', to: '/memories?tab=jar' },
      }
    }
    return null
  }, [myCheckin, partnerCheckin, partnerName, events, jar, myUid, answeredDailyQuestion, onCheckin, onNudge, nudgeDisabled, today])

  if (!suggestion) return null
  const Icon = suggestion.icon
  const a = suggestion.action
  const btnCls =
    'flex items-center gap-1.5 px-4 py-2 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep flex-shrink-0 disabled:opacity-60'

  return (
    <motion.div
      key={suggestion.title}
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ type: 'spring', stiffness: 300, damping: 26 }}
      className="mb-4 rounded-2xl p-4 bg-gradient-to-br from-peach/15 to-gold/20 border border-peach/30 flex flex-col sm:flex-row sm:items-center gap-3"
    >
      <div className="flex items-center gap-3 flex-1 min-w-0">
        <div className="w-10 h-10 rounded-full bg-white/70 flex items-center justify-center flex-shrink-0 text-peach">
          <Icon size={18} />
        </div>
        <div className="min-w-0">
          <div className="font-semibold text-[15px]">{suggestion.title}</div>
          <div className="text-xs text-[#7a6a7c]">{suggestion.text}</div>
        </div>
      </div>
      {a.to ? (
        <Link to={a.to} className={btnCls}>
          {a.label} <FiArrowRight size={13} className="lv-arrow" />
        </Link>
      ) : a.href ? (
        <a href={a.href} className={btnCls}>
          {a.label} <FiArrowRight size={13} className="lv-arrow" />
        </a>
      ) : (
        <button onClick={a.onClick} disabled={a.disabled} className={btnCls}>
          {a.label}
        </button>
      )}
    </motion.div>
  )
}
