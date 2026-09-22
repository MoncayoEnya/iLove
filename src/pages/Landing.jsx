import { useState } from 'react'
import { Link, Navigate } from 'react-router-dom'
import {
  FiCalendar,
  FiCheckCircle,
  FiChevronRight,
  FiCpu,
  FiHeart,
  FiImage,
  FiLock,
  FiMapPin,
  FiMessageCircle,
  FiMusic,
  FiTarget,
} from 'react-icons/fi'
import { FaLightbulb, FaPiggyBank, FaTrophy, FaMagic } from 'react-icons/fa'
import { useAuth } from '../context/AuthContext'
import avatarA from '../assets/avatar-a.jpg'
import avatarB from '../assets/avatar-b.jpg'

// ---------- Tour content (unchanged from the design) ----------
const TOUR_TABS = [
  { key: 'everyday', label: 'Everyday connection' },
  { key: 'planning', label: 'Planning' },
  { key: 'memories', label: 'Memories' },
  { key: 'growth', label: 'Growth' },
  { key: 'reflection', label: 'Private reflection' },
]

const FEATURE_GROUPS = {
  everyday: [
    { icon: FiMessageCircle, title: 'Chat', detail: 'A thread that belongs to just the two of you.' },
    { icon: FiHeart, title: 'Daily check-ins', detail: 'Share a mood and stay close on ordinary days.' },
    { icon: FiCpu, title: 'AI companion', detail: 'Thoughtful prompts when you need a fresh way in.' },
  ],
  planning: [
    { icon: FiCalendar, title: 'Shared calendar', detail: 'Dates, appointments, anniversaries, and reminders.' },
    { icon: FiCheckCircle, title: 'Shared tasks', detail: 'Carry the week together without keeping score.' },
    { icon: FaLightbulb, title: 'Date ideas', detail: 'Keep a ready list for the next free evening.' },
    { icon: FiTarget, title: 'Goals & bucket list', detail: 'Turn someday into something you can both see.' },
    { icon: FaPiggyBank, title: 'Shared savings', detail: 'Watch the next trip or big idea get closer.' },
  ],
  memories: [
    { icon: FiImage, title: 'Memories', detail: 'Photos, stories, and milestones in one timeline.' },
    { icon: FiHeart, title: 'Love jar', detail: 'Save the small things you notice about each other.' },
    { icon: FiMusic, title: 'Shared playlist', detail: 'Keep the songs that sound like your life together.' },
    { icon: FiMapPin, title: 'Shared places', detail: 'Remember the places you love and want to return to.' },
    { icon: FiLock, title: 'Time capsules', detail: 'Seal a note now and choose when it can be opened.' },
  ],
  growth: [
    { icon: FaMagic, title: 'Insights', detail: 'A gentle look at your rhythms and what is working.' },
    { icon: FiTarget, title: 'Relationship goals', detail: 'Make progress on the promises you choose together.' },
    { icon: FaTrophy, title: 'Achievements', detail: 'Mark streaks, milestones, and shared follow-through.' },
  ],
  reflection: [
    { icon: FiLock, title: 'Private journal', detail: 'A personal space for thoughts that are only yours.' },
    { icon: FiHeart, title: 'Conflict recovery', detail: 'Guided steps for finding your way back after a hard moment.' },
    { icon: FiCpu, title: 'AI companion', detail: 'Reflect privately and discover calmer next steps.' },
  ],
}

const TOUR_SCENES = {
  everyday: { eyebrow: "Tonight's ritual", title: 'How was your day, really?', stat: '14 day streak', lines: ['Sam · feeling grateful', 'Alex · a little tired', 'One thing we appreciated today'] },
  planning: { eyebrow: 'This week', title: "Everything we're carrying", stat: '5 plans', lines: ['Dinner · Thursday, 6:30', 'Book the weekend train', 'Save toward Lisbon · 68%'] },
  memories: { eyebrow: 'Our story', title: 'The moments worth keeping', stat: '126 memories', lines: ['First morning in this apartment', 'The playlist from our road trip', 'A note sealed until next spring'] },
  growth: { eyebrow: 'A gentle pulse', title: 'Small patterns, made visible', stat: '82% connected', lines: ['Checked in 6 days this week', 'Three goals moving forward', 'New milestone unlocked'] },
  reflection: { eyebrow: 'Your private corner', title: 'Space to understand the moment', stat: 'Only you', lines: ['Write without sharing', 'Repair after a hard conversation', 'Ask the companion for a prompt'] },
}

const STEPS = [
  ['1', 'Create your account', 'Just an email and password.'],
  ['2', 'Invite your partner', 'Send the six-character code that links you.'],
  ['3', 'Start your shared space', 'Add a date, a task, a note, or simply check in.'],
]

function TourScene({ activeTour }) {
  const scene = TOUR_SCENES[activeTour]
  return (
    <div className="ilove-glass ilove-glass-shadow rounded-xl p-6 sm:p-8" style={{ minHeight: 360 }}>
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div>
          <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--i-plum-soft)' }}>{scene.eyebrow}</p>
          <h3 className="ilove-font-serif mt-2 max-w-[22ch] text-3xl font-medium leading-tight">{scene.title}</h3>
        </div>
        <span className="rounded-full px-3 py-1 text-xs font-semibold whitespace-nowrap" style={{ background: 'var(--i-blush)', color: 'var(--i-plum-soft)' }}>{scene.stat}</span>
      </div>
      <div className="mt-8 space-y-3">
        {scene.lines.map((line, index) => (
          <div key={line} className="ilove-surface-strong flex items-center gap-3 rounded-xl p-4">
            <span
              className="rounded-full shrink-0"
              style={{
                width: 10,
                height: 10,
                background: index === 0 ? 'var(--i-primary)' : index === 1 ? 'var(--i-peach)' : 'var(--i-plum-soft)',
              }}
            />
            <p className="text-sm font-medium sm:text-base">{line}</p>
            {index === 0 && <FiHeart className="ml-auto shrink-0" style={{ color: 'var(--i-primary)' }} size={16} />}
          </div>
        ))}
      </div>
      <div className="mt-8 flex items-end gap-2" aria-hidden="true">
        {[42, 66, 52, 82, 70, 91, 76].map((height, index) => (
          <span
            key={index}
            className="flex-1 rounded-t-sm"
            style={{ height, background: index === 5 ? 'var(--i-primary)' : 'color-mix(in oklab, var(--i-primary) 15%, transparent)' }}
          />
        ))}
      </div>
    </div>
  )
}

export default function Landing() {
  const { firebaseUser, profile, loading } = useAuth()
  const [activeTour, setActiveTour] = useState('everyday')

  // Signed-in visitors don't need the pitch — send them straight to their space.
  if (!loading && firebaseUser && profile) {
    return <Navigate to={profile.coupleId ? '/dashboard' : '/link'} replace />
  }

  const activeFeatures = FEATURE_GROUPS[activeTour]

  return (
    <div className="ilove-landing-root relative min-h-screen overflow-x-hidden">
      <style>{`
        @import url('https://fonts.googleapis.com/css2?family=Fraunces:opsz,wght@9..144,400;9..144,500;9..144,600&family=Figtree:wght@400;500;600;700&display=swap');

        .ilove-landing-root {
          --i-background: oklch(0.965 0.018 48);
          --i-foreground: oklch(0.31 0.035 343);
          --i-primary: oklch(0.37 0.07 343);
          --i-primary-foreground: oklch(0.965 0.018 48);
          --i-muted-foreground: oklch(0.51 0.04 345);
          --i-plum-soft: oklch(0.5 0.07 343);
          --i-peach: oklch(0.79 0.1 43);
          --i-blush: oklch(0.9 0.04 28);
          --i-glass: oklch(1 0 0 / 48%);
          --i-glass-border: oklch(1 0 0 / 62%);
          --i-surface-strong: oklch(1 0 0 / 78%);
          background: var(--i-background);
          color: var(--i-foreground);
          font-family: 'Figtree', system-ui, sans-serif;
        }
        .ilove-font-serif { font-family: 'Fraunces', Georgia, serif; }
        .ilove-glass { background: var(--i-glass); border: 1px solid var(--i-glass-border); backdrop-filter: blur(20px); -webkit-backdrop-filter: blur(20px); }
        .ilove-surface-strong { background: var(--i-surface-strong); border: 1px solid var(--i-glass-border); }
        .ilove-glass-shadow { box-shadow: 0 30px 60px -30px color-mix(in oklab, var(--i-primary) 50%, transparent); }
        .ilove-wash {
          background-image:
            radial-gradient(60rem 40rem at 85% -10%, color-mix(in oklab, var(--i-peach) 35%, transparent), transparent 60%),
            radial-gradient(50rem 40rem at 0% 20%, color-mix(in oklab, var(--i-plum-soft) 22%, transparent), transparent 55%),
            radial-gradient(40rem 30rem at 60% 100%, color-mix(in oklab, var(--i-blush) 60%, transparent), transparent 60%);
        }
        .ilove-btn { display: inline-flex; align-items: center; justify-content: center; gap: 0.5rem; white-space: nowrap; border-radius: 0.5rem; font-size: 0.95rem; font-weight: 600; padding: 0.75rem 1.5rem; transition: transform 0.15s ease, background 0.15s ease; cursor: pointer; border: none; }
        .ilove-btn:hover { transform: translateY(-2px); }
        .ilove-btn-primary { background: var(--i-primary); color: var(--i-primary-foreground); }
        .ilove-btn-glass { background: var(--i-glass); border: 1px solid var(--i-glass-border); color: var(--i-foreground); backdrop-filter: blur(20px); }
        .ilove-btn-inverse { background: var(--i-primary-foreground); color: var(--i-primary); }
        .ilove-btn-outline { background: transparent; border: 1px solid color-mix(in oklab, var(--i-primary-foreground) 40%, transparent); color: var(--i-primary-foreground); }
        .ilove-btn-ghost { background: transparent; color: var(--i-foreground); }
        .ilove-btn-ghost:hover { background: var(--i-blush); }
        .ilove-btn-sm { padding: 0.5rem 1rem; font-size: 0.85rem; }
        .ilove-float-a { animation: ilove-float-a 7s ease-in-out infinite; }
        .ilove-float-b { animation: ilove-float-b 9s ease-in-out infinite; }
        @keyframes ilove-float-a { 0%, 100% { transform: translateY(0) rotate(-1.5deg); } 50% { transform: translateY(-10px) rotate(1deg); } }
        @keyframes ilove-float-b { 0%, 100% { transform: translateY(0) rotate(1.5deg); } 50% { transform: translateY(-7px) rotate(-1deg); } }
        @media (prefers-reduced-motion: reduce) {
          .ilove-float-a, .ilove-float-b { animation: none; }
        }
      `}</style>

      <div className="ilove-wash absolute inset-0 -z-10" aria-hidden="true" />

      {/* ---------- Nav ---------- */}
      <header className="relative z-30 mx-auto max-w-7xl px-4 pt-4 sm:px-6 sm:pt-6">
        <nav className="ilove-glass flex items-center justify-between rounded-xl px-3 py-3 sm:px-5" aria-label="Main navigation">
          <Link to="/" className="flex items-center gap-2" aria-label="iLove home">
            <span className="ilove-font-serif grid place-items-center rounded-full text-lg" style={{ width: 32, height: 32, background: 'var(--i-primary)', color: 'var(--i-primary-foreground)' }}>i</span>
            <span className="ilove-font-serif text-xl font-semibold">iLove</span>
          </Link>
          <a href="#tour" className="hidden text-sm font-medium md:block" style={{ color: 'var(--i-muted-foreground)' }}>Inside the app</a>
          <div className="flex items-center gap-1 sm:gap-3">
            <Link to="/login" className="ilove-btn ilove-btn-ghost ilove-btn-sm">Log in</Link>
            <Link to="/signup" className="ilove-btn ilove-btn-primary ilove-btn-sm">Get started</Link>
          </div>
        </nav>
      </header>

      {/* ---------- Hero ---------- */}
      <section className="relative z-20 mx-auto max-w-7xl px-6 pb-24 pt-16 sm:pt-20 lg:pb-28">
        <div className="grid items-center gap-16 lg:grid-cols-[0.9fr_1.1fr]">
          <div>
            <p className="ilove-glass inline-flex rounded-full px-3 py-1 text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--i-plum-soft)' }}>
              For two people, not a feed
            </p>
            <h1 className="ilove-font-serif mt-6 max-w-[19ch] text-5xl font-medium leading-[0.98] sm:text-6xl">
              A soft place to keep <em style={{ color: 'var(--i-primary)', fontStyle: 'italic' }}>everything</em> you build together.
            </h1>
            <p className="mt-6 max-w-[46ch] text-base leading-relaxed sm:text-lg" style={{ color: 'var(--i-muted-foreground)' }}>
              iLove is one calm home for the everyday — your chats, calendar, little notes, private reflections, and the plans you keep making.
            </p>
            <div className="mt-8 flex flex-wrap items-center gap-3">
              <Link to="/signup" className="ilove-btn ilove-btn-primary" style={{ padding: '0.9rem 1.75rem' }}>Get started — it is free</Link>
              <a href="#tour" className="ilove-btn ilove-btn-glass" style={{ padding: '0.9rem 1.75rem' }}>See it all inside</a>
            </div>
            <p className="mt-4 text-sm" style={{ color: 'var(--i-muted-foreground)' }}>No credit card. One invite code. Your space stays yours.</p>
          </div>

          <div className="relative pb-12 pt-4 lg:pb-8">
            <div className="ilove-glass ilove-float-b absolute -left-6 -top-8 z-10 hidden w-56 rounded-xl p-4 lg:block">
              <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--i-plum-soft)' }}>Love jar</p>
              <p className="ilove-font-serif mt-2 text-sm italic" style={{ color: 'var(--i-muted-foreground)' }}>"Thank you for the quiet Sunday."</p>
            </div>

            <div className="ilove-glass ilove-glass-shadow relative rounded-xl p-4 sm:p-5">
              <div className="flex items-center justify-between gap-4">
                <div>
                  <p className="text-xs font-medium uppercase tracking-[0.15em]" style={{ color: 'var(--i-muted-foreground)' }}>Today · shared</p>
                  <p className="ilove-font-serif text-lg font-medium">Good evening, you two</p>
                </div>
                <div className="flex shrink-0 -space-x-2">
                  <img src={avatarA} alt="Sam" className="rounded-full object-cover" style={{ width: 40, height: 40, border: '2px solid var(--i-background)' }} />
                  <img src={avatarB} alt="Alex" className="rounded-full object-cover" style={{ width: 40, height: 40, border: '2px solid var(--i-background)' }} />
                </div>
              </div>
              <div className="mt-5 grid grid-cols-3 gap-2 text-center text-xs font-semibold">
                <span className="ilove-surface-strong rounded-lg py-2" style={{ color: 'var(--i-primary)' }}>Calendar</span>
                <span className="py-2" style={{ color: 'var(--i-muted-foreground)' }}>Chat</span>
                <span className="py-2" style={{ color: 'var(--i-muted-foreground)' }}>Memories</span>
              </div>
              <div className="mt-4 space-y-2">
                {[['18', 'Dinner at the little bakery', '6:30 pm · both'], ['21', 'Quiet morning, no plans', 'All day · just us'], ['24', 'Thrift-store date', 'Saturday · ideas']].map(([day, title, meta]) => (
                  <div key={day} className="ilove-glass flex items-center gap-3 rounded-xl p-3">
                    <span className="grid shrink-0 place-items-center rounded-lg text-sm font-semibold" style={{ width: 36, height: 36, background: 'color-mix(in oklab, var(--i-primary) 10%, transparent)', color: 'var(--i-primary)' }}>{day}</span>
                    <div className="min-w-0">
                      <p className="truncate text-sm font-semibold">{title}</p>
                      <p className="text-xs" style={{ color: 'var(--i-muted-foreground)' }}>{meta}</p>
                    </div>
                    <FiChevronRight className="ml-auto" size={16} style={{ color: 'var(--i-muted-foreground)' }} />
                  </div>
                ))}
              </div>
            </div>

            <div className="ilove-surface-strong ilove-float-a absolute -bottom-1 right-0 z-10 w-64 rounded-xl p-4 sm:-right-4">
              <p className="text-xs font-semibold uppercase tracking-[0.12em]" style={{ color: 'var(--i-plum-soft)' }}>Chat</p>
              <p className="ml-auto mt-3 w-fit rounded-xl px-3 py-2 text-sm" style={{ maxWidth: '85%', borderBottomRightRadius: 4, background: 'var(--i-primary)', color: 'var(--i-primary-foreground)' }}>saved our date idea :)</p>
              <p className="mt-2 w-fit rounded-xl px-3 py-2 text-sm" style={{ maxWidth: '90%', borderBottomLeftRadius: 4, background: 'color-mix(in oklab, var(--i-background) 80%, transparent)' }}>can't wait — I'll make the thing you like</p>
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Interactive tour ---------- */}
      <section id="tour" className="ilove-glass relative z-10 border-y" style={{ borderColor: 'var(--i-glass-border)' }}>
        <div className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
          <div className="max-w-2xl">
            <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--i-plum-soft)' }}>Inside, all of it</p>
            <h2 className="ilove-font-serif mt-3 text-4xl font-medium leading-tight sm:text-5xl">One app for the whole of us</h2>
            <p className="mt-4 max-w-[58ch] leading-relaxed" style={{ color: 'var(--i-muted-foreground)' }}>
              Choose a room and look around. Everything below comes from the app you already have — gathered here so visitors can understand it before they join.
            </p>
          </div>

          <div className="ilove-glass mt-10 flex gap-2 overflow-x-auto rounded-xl p-2" role="tablist" aria-label="Explore iLove features">
            {TOUR_TABS.map((tab) => (
              <button
                key={tab.key}
                type="button"
                role="tab"
                aria-selected={activeTour === tab.key}
                onClick={() => setActiveTour(tab.key)}
                className={`ilove-btn shrink-0 ${activeTour === tab.key ? 'ilove-btn-primary' : 'ilove-btn-ghost'}`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          <div className="mt-8 grid gap-6 lg:grid-cols-[1.25fr_0.75fr]" role="tabpanel">
            <TourScene activeTour={activeTour} />
            <div className="grid content-start gap-3 sm:grid-cols-2 lg:grid-cols-1">
              {activeFeatures.map((feature) => (
                <article key={feature.title} className="ilove-glass flex items-start gap-4 rounded-xl p-4 transition-transform hover:-translate-y-0.5">
                  <span className="grid shrink-0 place-items-center rounded-lg" style={{ width: 40, height: 40, background: 'color-mix(in oklab, var(--i-primary) 10%, transparent)', color: 'var(--i-primary)' }}>
                    <feature.icon size={18} />
                  </span>
                  <div>
                    <h3 className="ilove-font-serif text-lg font-medium">{feature.title}</h3>
                    <p className="mt-1 text-sm leading-relaxed" style={{ color: 'var(--i-muted-foreground)' }}>{feature.detail}</p>
                  </div>
                </article>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="mx-auto max-w-7xl px-6 py-20 sm:py-24">
        <div className="grid items-center gap-10 lg:grid-cols-[0.8fr_1.2fr]">
          <div>
            <p className="text-xs font-semibold uppercase tracking-[0.15em]" style={{ color: 'var(--i-plum-soft)' }}>Getting started</p>
            <h2 className="ilove-font-serif mt-3 text-4xl font-medium leading-tight">Three small steps, then it's yours</h2>
            <p className="mt-4 max-w-[44ch] leading-relaxed" style={{ color: 'var(--i-muted-foreground)' }}>
              No setup checklist that runs forever. Make your space, invite your person, and drop the first note in.
            </p>
          </div>
          <ol className="ilove-glass space-y-5 rounded-xl p-6">
            {STEPS.map(([n, title, body]) => (
              <li key={n} className="flex items-start gap-4">
                <span className="grid shrink-0 place-items-center rounded-full text-sm font-semibold" style={{ width: 32, height: 32, background: 'var(--i-primary)', color: 'var(--i-primary-foreground)' }}>{n}</span>
                <div>
                  <p className="font-semibold">{title}</p>
                  <p className="text-sm" style={{ color: 'var(--i-muted-foreground)' }}>{body}</p>
                </div>
              </li>
            ))}
          </ol>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section id="start" className="mx-auto max-w-7xl px-6 pb-16 sm:pb-24">
        <div className="relative overflow-hidden rounded-xl px-8 py-16 text-center sm:px-12" style={{ background: 'var(--i-primary)', color: 'var(--i-primary-foreground)' }}>
          <h2 className="ilove-font-serif mx-auto max-w-[24ch] text-4xl font-medium leading-tight sm:text-5xl">Set up your shared home tonight</h2>
          <p className="mx-auto mt-4 max-w-[48ch]" style={{ color: 'color-mix(in oklab, var(--i-primary-foreground) 80%, transparent)' }}>
            It takes a few minutes. Start the jar, block the first date, and let iLove hold the rest.
          </p>
          <div className="mt-8 flex flex-wrap justify-center gap-3">
            <Link to="/signup" className="ilove-btn ilove-btn-inverse" style={{ padding: '0.9rem 1.75rem' }}>Get started</Link>
            <Link to="/login" className="ilove-btn ilove-btn-outline" style={{ padding: '0.9rem 1.75rem' }}>Log in</Link>
          </div>
        </div>
        <footer className="mt-10 flex flex-col items-center justify-between gap-3 border-t pt-8 text-sm sm:flex-row" style={{ borderColor: 'color-mix(in oklab, var(--i-primary) 10%, transparent)', color: 'var(--i-muted-foreground)' }}>
          <Link to="/" className="flex items-center gap-2" style={{ color: 'var(--i-foreground)' }}>
            <span className="ilove-font-serif grid place-items-center rounded-full" style={{ width: 28, height: 28, background: 'var(--i-primary)', color: 'var(--i-primary-foreground)' }}>i</span>
            <span className="ilove-font-serif text-lg font-semibold">iLove</span>
          </Link>
          <p>A quiet, warm home for two.</p>
        </footer>
      </section>
    </div>
  )
}