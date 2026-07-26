# iLove — a companion for two

A relationship companion web app built with React + Vite + Tailwind CSS, backed by Firebase
(Auth + Firestore). Two people link up with an invite code and share a dashboard, chat,
tasks, calendar, daily check-ins, and a Love Jar of appreciation notes.

## What's already working

- **Auth** — email/password signup & login (`src/context/AuthContext.jsx`)
- **Couple linking** — generate/share a 6-character invite code to pair two accounts
  (`src/hooks/useLinkCouple.js`, `src/pages/LinkPartner.jsx`)
- **Dashboard** — streak, daily mood check-in + gratitude note, open tasks, upcoming
  events, latest Love Jar note
- **Chat** — realtime 1:1 messaging
- **Tasks** — shared to-do list with completion + attribution
- **Calendar** — shared events with an optional love note per event
- **Love Jar** — drop in appreciation notes, "open the jar" to reveal a random one

## Not yet built (from the spec, left for a follow-up pass)

Memories (photo timeline), push Notifications, a Settings page, image/read-receipt/typing
features in Chat, and recurring calendar events.

## Setup

### 1. Install dependencies

```bash
npm install
```

### 2. Create a Firebase project

1. Go to the [Firebase Console](https://console.firebase.google.com) → **Add project**.
2. Inside the project, click the **Web** icon (`</>`) to register a web app — this gives
   you the config values you need below.
3. **Authentication** → Sign-in method → enable **Email/Password**.
4. **Firestore Database** → Create database → start in **production mode** (the rules
   file below locks it down properly).

### 3. Configure environment variables

```bash
cp .env.example .env
```

Fill in `.env` with the values from step 2 (Project settings → General → Your apps).

### 4. Deploy Firestore security rules

Install the Firebase CLI if you don't have it, then from this folder:

```bash
npm install -g firebase-tools
firebase login
firebase use --add          # pick your project, give it an alias
firebase deploy --only firestore:rules
```

`firestore.rules` restricts every document so a user can only read/write their own
profile and the couple space (and its sub-collections) they're a member of.

### 5. Run it

```bash
npm run dev
```

Open the printed `localhost` URL, sign up with one account, then sign up with a second
(e.g. an incognito window) and use the invite code from the first account to link them.

### 6. Deploy to Firebase Hosting (optional)

```bash
firebase deploy --only hosting
# or: npm run deploy
```

## Project structure

```
src/
  components/   AuthCard, Sidebar, ProtectedRoute
  context/      AuthContext (firebase user, profile, couple, auth actions)
  hooks/        useLinkCouple, usePartner, useMemberNames
  pages/        Login, Signup, LinkPartner, Dashboard, Chat, Tasks, CalendarPage, LoveJar
  firebase.js   Firebase app/auth/db initialization
```

## Firestore data model

```
users/{uid}                displayName, email, coupleId
couples/{coupleId}          members: [uid, uid], inviteCode, streak, lastCheckinDate
  /tasks/{taskId}           text, done, createdBy, createdAt
  /events/{eventId}         date, title, note, createdBy, createdAt
  /messages/{messageId}     from, text, createdAt
  /jar/{noteId}             text, from, createdAt
  /checkins/{checkinId}     date, uid, mood, gratitude, createdAt
```
