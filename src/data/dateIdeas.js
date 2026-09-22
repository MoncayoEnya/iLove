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

// Section groupings shown on the Date ideas page — purely presentational
// (bucketing the flat idea list into themed groups with a header color).
// `key` must match each idea's `category` below; `cls` names a CSS class
// defined in index.css (light + dark variants) for that header bar. Icons
// for each group are mapped separately in DateIdeas.jsx (kept out of this
// data file so it doesn't need to import React components).
export const DATE_IDEA_CATEGORIES = [
  { key: 'cozy', label: 'Cozy & Relaxed', cls: 'cat-cozy' },
  { key: 'outabout', label: 'Out & About', cls: 'cat-outabout' },
  { key: 'trynew', label: 'Try Something New', cls: 'cat-trynew' },
  { key: 'movie', label: 'Movie & Entertainment', cls: 'cat-movie' },
  { key: 'creative', label: 'Creative & Reflective', cls: 'cat-creative' },
]

export const DATE_IDEAS = [
  { id: 'cook-new-recipe', title: 'Cook a new recipe together', tags: ['food', 'indoor', 'low-budget'], category: 'cozy' },
  { id: 'blanket-fort-movie', title: 'Build a blanket fort and watch a movie', tags: ['indoor', 'movies', 'low-budget'], category: 'cozy' },
  { id: 'picnic-park', title: 'Have a picnic in the park', tags: ['outdoor', 'food', 'low-budget'], category: 'outabout' },
  { id: 'scenic-hike', title: 'Take a scenic hike', tags: ['outdoor', 'adventure'], category: 'outabout' },
  { id: 'new-restaurant', title: "Try a restaurant you've never been to", tags: ['food', 'surprise'], category: 'trynew' },
  { id: 'home-spa-night', title: 'Have a home spa night', tags: ['indoor', 'low-budget'], category: 'cozy' },
  { id: 'stargazing', title: 'Go stargazing', tags: ['outdoor', 'low-budget', 'surprise'], category: 'outabout' },
  { id: 'museum-gallery', title: 'Visit a local museum or gallery', tags: ['indoor', 'adventure'], category: 'trynew' },
  { id: 'dance-class', title: 'Take a dance class together', tags: ['adventure', 'surprise'], category: 'trynew' },
  { id: 'movie-marathon', title: 'Marathon your favorite trilogy', tags: ['indoor', 'movies', 'low-budget'], category: 'movie' },
  { id: 'fruit-picking', title: 'Go apple or fruit picking', tags: ['outdoor', 'food', 'adventure'], category: 'outabout' },
  { id: 'puzzle-night', title: 'Have a jigsaw puzzle date night', tags: ['indoor', 'low-budget', 'study'], category: 'cozy' },
  { id: 'spontaneous-road-trip', title: 'Take a road trip to somewhere new', tags: ['adventure', 'outdoor', 'surprise'], category: 'outabout' },
  { id: 'learn-language', title: 'Learn a new language together for 30 minutes', tags: ['study', 'indoor', 'low-budget'], category: 'trynew' },
  { id: 'bowling', title: 'Go bowling', tags: ['indoor', 'adventure', 'low-budget'], category: 'trynew' },
  { id: 'game-night', title: 'Have a game night with cards or board games', tags: ['indoor', 'low-budget'], category: 'cozy' },
  { id: 'sunrise-sunset', title: 'Watch the sunrise or sunset together', tags: ['outdoor', 'low-budget', 'surprise'], category: 'outabout' },
  { id: 'volunteer', title: 'Volunteer together for a cause you both care about', tags: ['outdoor', 'surprise'], category: 'trynew' },
  { id: 'photo-walk', title: 'Take a photography walk around your neighborhood', tags: ['outdoor', 'low-budget', 'adventure'], category: 'outabout' },
  { id: 'letter-to-future', title: 'Write each other a letter to open in a year', tags: ['indoor', 'low-budget', 'surprise'], category: 'creative' },
  { id: 'paint-and-sip', title: 'Try a paint-and-sip night at home', tags: ['indoor', 'food', 'low-budget'], category: 'creative' },
  { id: 'farmers-market-cook', title: 'Visit a farmers market and cook what you find', tags: ['outdoor', 'food'], category: 'outabout' },
  { id: 'scavenger-hunt', title: 'Plan a surprise mini scavenger hunt for your partner', tags: ['indoor', 'surprise'], category: 'creative' },
  { id: 'study-session', title: 'Take an online course or study session on something new', tags: ['study', 'indoor'], category: 'trynew' },
]