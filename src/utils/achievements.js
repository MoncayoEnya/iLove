// Achievement definitions. Each one is evaluated client-side against stats
// already being fetched elsewhere in the app — no new writes except the
// `unlockedAchievements` array on the couple doc, so a badge doesn't feel
// newly-earned every time the page reloads.
//
// `check` returns true/false against a stats snapshot.
// `progress` (optional) returns [current, target] so locked cards can show
// how close a couple is, instead of just "locked".

export const ACHIEVEMENTS = [
  {
    id: 'first-note',
    title: 'First Love Note',
    description: 'Leave your first note in the Love Jar.',
    check: (s) => s.jarCount >= 1,
    progress: (s) => [s.jarCount, 1],
  },
  {
    id: 'streak-3',
    title: "Three's a Streak",
    description: 'Check in together 3 days in a row.',
    check: (s) => s.streak >= 3,
    progress: (s) => [s.streak, 3],
  },
  {
    id: 'streak-7',
    title: 'One Week Strong',
    description: 'Hit a 7 day check-in streak.',
    check: (s) => s.streak >= 7,
    progress: (s) => [s.streak, 7],
  },
  {
    id: 'streak-30',
    title: '30 Days of Us',
    description: 'Hit a 30 day check-in streak.',
    check: (s) => s.streak >= 30,
    progress: (s) => [s.streak, 30],
  },
  {
    id: 'streak-100',
    title: 'Century Streak',
    description: 'Hit a 100 day check-in streak.',
    check: (s) => s.streak >= 100,
    progress: (s) => [s.streak, 100],
  },
  {
    id: 'jar-25',
    title: 'Jar Full of Love',
    description: 'Collect 25 notes in the Love Jar.',
    check: (s) => s.jarCount >= 25,
    progress: (s) => [s.jarCount, 25],
  },
  {
    id: 'jar-100',
    title: 'Overflowing',
    description: 'Collect 100 notes in the Love Jar.',
    check: (s) => s.jarCount >= 100,
    progress: (s) => [s.jarCount, 100],
  },
  {
    id: 'chat-50',
    title: 'Chatterbox',
    description: 'Send 50 messages to each other.',
    check: (s) => s.messageCount >= 50,
    progress: (s) => [s.messageCount, 50],
  },
  {
    id: 'chat-500',
    title: 'Never Runs Out of Words',
    description: 'Send 500 messages to each other.',
    check: (s) => s.messageCount >= 500,
    progress: (s) => [s.messageCount, 500],
  },
  {
    id: 'memories-10',
    title: 'Memory Keeper',
    description: 'Add 10 entries to your Memory Timeline.',
    check: (s) => s.memoriesCount >= 10,
    progress: (s) => [s.memoriesCount, 10],
  },
  {
    id: 'memories-50',
    title: 'Living Scrapbook',
    description: 'Add 50 entries to your Memory Timeline.',
    check: (s) => s.memoriesCount >= 50,
    progress: (s) => [s.memoriesCount, 50],
  },
  {
    id: 'tasks-25',
    title: 'Team Player',
    description: 'Complete 25 shared tasks together.',
    check: (s) => s.tasksDoneCount >= 25,
    progress: (s) => [s.tasksDoneCount, 25],
  },
  {
    id: 'journal-10',
    title: 'Open Book',
    description: 'Write 10 journal entries.',
    check: (s) => s.journalCount >= 10,
    progress: (s) => [s.journalCount, 10],
  },
  {
    id: 'bucket-5',
    title: 'Bucket List Crusher',
    description: 'Check 5 items off your bucket list.',
    check: (s) => s.bucketDoneCount >= 5,
    progress: (s) => [s.bucketDoneCount, 5],
  },
  {
    id: 'checkins-30',
    title: 'Daily Ritual',
    description: 'Log 30 check-ins total.',
    check: (s) => s.checkinsCount >= 30,
    progress: (s) => [s.checkinsCount, 30],
  },
]

/** Returns the ids of every achievement currently met by this stats snapshot. */
export function evaluateAchievements(stats) {
  return ACHIEVEMENTS.filter((a) => a.check(stats)).map((a) => a.id)
}
