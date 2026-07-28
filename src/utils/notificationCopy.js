// Templated notification copy. Kept as a pure, dependency-free module so it's
// easy to extend with more event types later without touching the scheduling
// logic in useLocalReminders.js.

// One gentle, actionable nudge per love language — used to personalize the
// body of a reminder when the calendar event itself has no custom note.
// Deliberately keyed off the PARTNER's love language, not the notified
// person's own: the nudge is "here's something that would land well for
// them," not a description of what the notified person likes.
const LOVE_LANGUAGE_NUDGES = {
  'Words of Affirmation': 'A good moment to tell them one thing you appreciate about them.',
  'Quality Time': 'A good moment to set aside a little uninterrupted time together.',
  'Acts of Service': 'A good moment to take one small thing off their plate.',
  'Receiving Gifts': 'A good moment for a small, thoughtful gesture — it does not need to be big.',
  'Physical Touch': 'A good moment for a hug or a few minutes sitting close.',
}

const DEFAULT_NUDGE = 'Coming up on your shared calendar.'

/** Body copy to use when a calendar event has no custom note attached. */
export function eventFallbackBody(partnerLoveLanguage) {
  return LOVE_LANGUAGE_NUDGES[partnerLoveLanguage] || DEFAULT_NUDGE
}

const RECURRENCE_PREFIX = {
  daily: 'Daily reminder',
  weekly: 'Weekly reminder',
  monthly: 'Monthly reminder',
  yearly: 'Yearly reminder',
}

/**
 * Title/body for a calendar-event reminder. Distinguishes recurring events
 * from one-offs and folds in a personalized fallback body when the event
 * has no note of its own.
 */
export function eventReminderCopy(event, partnerLoveLanguage) {
  const prefix = RECURRENCE_PREFIX[event.recurrence]
  const title = prefix ? `${prefix}: ${event.title || 'Untitled event'}` : event.title || 'Reminder'
  const body = event.note?.trim() || eventFallbackBody(partnerLoveLanguage)
  return { title, body }
}

/** Title/body for the "your streak is about to lapse" nudge. */
export function streakRiskCopy(streak, hoursLeft, partnerLoveLanguage) {
  const hourWord = hoursLeft === 1 ? 'hour' : 'hours'
  return {
    title: `Your streak ends in ${hoursLeft} ${hourWord}`,
    body: `You're at ${streak} day${streak === 1 ? '' : 's'} — check in before midnight to keep it going. ${eventFallbackBody(
      partnerLoveLanguage
    )}`,
  }
}
