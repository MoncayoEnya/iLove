// Curated starter set of date ideas. No backend needed for these — only
// per-couple *progress* on them (done / not done) is stored in Firestore.
// Tag set matches the brainstorm doc: Indoor / Outdoor / Low Budget / Food /
// Movies / Adventure / Study / Surprise. Ideas can carry multiple tags.

export const DATE_IDEA_TAGS = [
  { value: 'indoor', label: 'Indoor' },
  { value: 'outdoor', label: 'Outdoor' },
  { value: 'low-budget', label: 'Low budget' },
  { value: 'food', label: 'Food' },
  { value: 'movies', label: 'Movies' },
  { value: 'adventure', label: 'Adventure' },
  { value: 'study', label: 'Study' },
  { value: 'surprise', label: 'Surprise' },
]

export const DATE_IDEAS = [
  { id: 'cook-new-recipe', title: 'Cook a new recipe together', tags: ['food', 'indoor', 'low-budget'] },
  { id: 'blanket-fort-movie', title: 'Build a blanket fort and watch a movie', tags: ['indoor', 'movies', 'low-budget'] },
  { id: 'picnic-park', title: 'Have a picnic in the park', tags: ['outdoor', 'food', 'low-budget'] },
  { id: 'scenic-hike', title: 'Take a scenic hike', tags: ['outdoor', 'adventure'] },
  { id: 'new-restaurant', title: "Try a restaurant you've never been to", tags: ['food', 'surprise'] },
  { id: 'home-spa-night', title: 'Have a home spa night', tags: ['indoor', 'low-budget'] },
  { id: 'stargazing', title: 'Go stargazing', tags: ['outdoor', 'low-budget', 'surprise'] },
  { id: 'museum-gallery', title: 'Visit a local museum or gallery', tags: ['indoor', 'adventure'] },
  { id: 'dance-class', title: 'Take a dance class together', tags: ['adventure', 'surprise'] },
  { id: 'movie-marathon', title: 'Marathon your favorite trilogy', tags: ['indoor', 'movies', 'low-budget'] },
  { id: 'fruit-picking', title: 'Go apple or fruit picking', tags: ['outdoor', 'food', 'adventure'] },
  { id: 'puzzle-night', title: 'Have a jigsaw puzzle date night', tags: ['indoor', 'low-budget', 'study'] },
  { id: 'spontaneous-road-trip', title: 'Take a road trip to somewhere new', tags: ['adventure', 'outdoor', 'surprise'] },
  { id: 'learn-language', title: 'Learn a new language together for 30 minutes', tags: ['study', 'indoor', 'low-budget'] },
  { id: 'bowling', title: 'Go bowling', tags: ['indoor', 'adventure', 'low-budget'] },
  { id: 'game-night', title: 'Have a game night with cards or board games', tags: ['indoor', 'low-budget'] },
  { id: 'sunrise-sunset', title: 'Watch the sunrise or sunset together', tags: ['outdoor', 'low-budget', 'surprise'] },
  { id: 'volunteer', title: 'Volunteer together for a cause you both care about', tags: ['outdoor', 'surprise'] },
  { id: 'photo-walk', title: 'Take a photography walk around your neighborhood', tags: ['outdoor', 'low-budget', 'adventure'] },
  { id: 'letter-to-future', title: 'Write each other a letter to open in a year', tags: ['indoor', 'low-budget', 'surprise'] },
  { id: 'paint-and-sip', title: 'Try a paint-and-sip night at home', tags: ['indoor', 'food', 'low-budget'] },
  { id: 'farmers-market-cook', title: 'Visit a farmers market and cook what you find', tags: ['outdoor', 'food'] },
  { id: 'scavenger-hunt', title: 'Plan a surprise mini scavenger hunt for your partner', tags: ['indoor', 'surprise'] },
  { id: 'study-session', title: 'Take an online course or study session on something new', tags: ['study', 'indoor'] },
]
