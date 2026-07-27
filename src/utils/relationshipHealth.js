// Relationship Health score: a single 0-100 number meant to feel like a
// gentle pulse-check, not a grade. Every input below is something the
// couple already does in the app — nothing new to fill out.
//
// Weights (should add up to 1):
//   30% check-in consistency this week   — are you both showing up daily?
//   20% streak momentum                  — capped at 14 days, so an old
//                                           streak doesn't dominate forever
//   20% appreciation notes this week     — capped at 5 notes/week
//   15% tasks done together this week    — neutral (50%) if no tasks touched,
//                                           so an idle week isn't punished
//   15% plans on the calendar            — is there something to look
//                                           forward to in the next couple weeks?
//
// Exposed as `factors` too, so the UI can show its work rather than just
// dropping a percentage on someone.

const WEIGHTS = {
  checkins: 0.3,
  streak: 0.2,
  appreciation: 0.2,
  tasks: 0.15,
  plans: 0.15,
}

function clamp01(n) {
  if (typeof n !== 'number' || Number.isNaN(n)) return 0
  return Math.max(0, Math.min(1, n))
}

/**
 * @param {object} input
 * @param {number} input.weekCheckinDays - distinct days in the last 7 where check-in(s) happened (0-7)
 * @param {number} input.streak - current couple streak, in days
 * @param {number} input.appreciationsLast7 - love jar notes added in the last 7 days
 * @param {number} input.tasksDoneLast7 - tasks completed in the last 7 days
 * @param {number} input.tasksTotalLast7 - tasks touched (created or completed) in the last 7 days
 * @param {number|null} input.daysUntilNextEvent - days until the next calendar event, or null if none
 * @returns {{ score: number, factors: Array<{key:string,label:string,weight:number,value:number}> }}
 */
export function computeRelationshipHealth({
  weekCheckinDays = 0,
  streak = 0,
  appreciationsLast7 = 0,
  tasksDoneLast7 = 0,
  tasksTotalLast7 = 0,
  daysUntilNextEvent = null,
} = {}) {
  const factors = [
    {
      key: 'checkins',
      label: 'Daily check-ins this week',
      weight: WEIGHTS.checkins,
      value: clamp01(weekCheckinDays / 7),
    },
    {
      key: 'streak',
      label: 'Streak momentum',
      weight: WEIGHTS.streak,
      value: clamp01(streak / 14),
    },
    {
      key: 'appreciation',
      label: 'Appreciation notes',
      weight: WEIGHTS.appreciation,
      value: clamp01(appreciationsLast7 / 5),
    },
    {
      key: 'tasks',
      label: 'Tasks done together',
      weight: WEIGHTS.tasks,
      value: tasksTotalLast7 > 0 ? clamp01(tasksDoneLast7 / tasksTotalLast7) : 0.5,
    },
    {
      key: 'plans',
      label: 'Plans ahead',
      weight: WEIGHTS.plans,
      value:
        daysUntilNextEvent == null
          ? 0
          : daysUntilNextEvent <= 14
          ? 1
          : daysUntilNextEvent <= 30
          ? 0.5
          : 0.15,
    },
  ]

  const score = Math.round(factors.reduce((sum, f) => sum + f.weight * f.value, 0) * 100)
  return { score, factors }
}
