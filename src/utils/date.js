import dayjs from 'dayjs'

/** Today as 'YYYY-MM-DD'. */
export function todayStr() {
  return dayjs().format('YYYY-MM-DD')
}

/** Yesterday as 'YYYY-MM-DD'. */
export function yesterdayStr() {
  return dayjs().subtract(1, 'day').format('YYYY-MM-DD')
}

/** Adds `n` days (negative allowed) to a 'YYYY-MM-DD' string and returns 'YYYY-MM-DD'. */
export function addDaysStr(dateStr, n) {
  return dayjs(dateStr).add(n, 'day').format('YYYY-MM-DD')
}

/** Last `n` days as 'YYYY-MM-DD' strings, most recent first (today included). */
export function lastNDays(n) {
  const out = []
  for (let i = 0; i < n; i++) out.push(dayjs().subtract(i, 'day').format('YYYY-MM-DD'))
  return out
}

/** 'YYYY-MM-DD' -> 'Today' / 'Yesterday' / e.g. 'Tue, Jun 3'. */
export function friendlyDate(dateStr, today = todayStr(), yesterday = yesterdayStr()) {
  if (dateStr === today) return 'Today'
  if (dateStr === yesterday) return 'Yesterday'
  return dayjs(dateStr).format('ddd, MMM D')
}

/**
 * Given "YYYY-MM-DD", returns { years, daysUntil } for the next occurrence
 * of that month/day (0 = today). Used for the anniversary countdown.
 */
export function anniversaryInfo(dateStr) {
  if (!dateStr) return null
  const start = dayjs(dateStr)
  if (!start.isValid()) return null

  const today = dayjs().startOf('day')
  let next = today.year(today.year()).month(start.month()).date(start.date())
  if (next.isBefore(today)) next = next.add(1, 'year')

  const years = next.year() - start.year()
  const daysUntil = next.diff(today, 'day')

  return { years, daysUntil }
}
