import { Link, Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

const FEATURES = [
  {
    icon: '✉',
    title: 'Chat',
    body: "A thread that's just yours — for the things that don't fit in a text.",
  },
  {
    icon: '✓',
    title: 'Shared tasks',
    body: 'Split the errands and the chores so nothing quietly lands on one person.',
  },
  {
    icon: '▤',
    title: 'Calendar',
    body: 'Date nights, appointments, anniversaries — one calendar, both names on it.',
  },
  {
    icon: '❤',
    title: 'Love jar',
    body: 'Drop in a note whenever something they did stuck with you. Read them back later.',
  },
  {
    icon: '🖼',
    title: 'Memories',
    body: 'The photo from that trip. The one from the bad apartment. All in one place.',
  },
  {
    icon: '★',
    title: 'Goals',
    body: 'The things you keep saying "we should really do that" about. Write them down.',
  },
]

const STEPS = [
  {
    n: '1',
    title: 'Create your account',
    body: 'Takes about a minute. Just an email and a password.',
  },
  {
    n: '2',
    title: 'Invite your partner',
    body: 'Send them a 6-character code. They enter it, you\u2019re linked.',
  },
  {
    n: '3',
    title: 'Start your shared space',
    body: 'Chat, plan, and check in — daily, if you keep the streak going.',
  },
]

export default function Landing() {
  const { firebaseUser, profile, loading } = useAuth()

  // Signed-in visitors don't need the pitch — send them straight to their space.
  if (!loading && firebaseUser && profile) {
    return <Navigate to={profile.coupleId ? '/dashboard' : '/link'} replace />
  }

  return (
    <div className="bg-paper text-ink font-sans">
      <style>{`
        @keyframes ilove-float-1 { 0%, 100% { transform: rotate(-6deg) translateY(0px); } 50% { transform: rotate(-6deg) translateY(-10px); } }
        @keyframes ilove-float-2 { 0%, 100% { transform: rotate(3deg) translateY(0px); } 50% { transform: rotate(3deg) translateY(-14px); } }
        @keyframes ilove-float-3 { 0%, 100% { transform: rotate(-2deg) translateY(0px); } 50% { transform: rotate(-2deg) translateY(-8px); } }
        .ilove-note-1 { animation: ilove-float-1 7s ease-in-out infinite; }
        .ilove-note-2 { animation: ilove-float-2 8.5s ease-in-out infinite; }
        .ilove-note-3 { animation: ilove-float-3 6.2s ease-in-out infinite; }
        @media (prefers-reduced-motion: reduce) {
          .ilove-note-1, .ilove-note-2, .ilove-note-3 { animation: none; }
        }
      `}</style>

      {/* ---------- Nav ---------- */}
      <header className="max-w-[1100px] mx-auto flex items-center justify-between px-6 py-6">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-full bg-gradient-to-br from-peach to-gold flex items-center justify-center text-plumdeep text-sm flex-shrink-0">
            ❤
          </div>
          <span className="font-serif text-xl font-semibold">iLove</span>
        </div>
        <div className="flex items-center gap-3">
          <Link to="/login" className="text-sm font-semibold text-plum hover:text-peach px-2">
            Log in
          </Link>
          <Link
            to="/signup"
            className="text-sm font-semibold bg-gradient-to-br from-peach to-gold text-plumdeep px-4 py-2 rounded-xl"
          >
            Get started
          </Link>
        </div>
      </header>

      {/* ---------- Hero ---------- */}
      <section
        className="relative overflow-hidden"
        style={{
          background:
            'radial-gradient(ellipse at 20% 0%, #4a2b4f 0%, #3d2340 45%, #26152a 100%)',
        }}
      >
        <div className="max-w-[1100px] mx-auto px-6 pt-16 pb-28 md:pt-20 md:pb-36 grid md:grid-cols-2 gap-14 items-center">
          <div className="text-[#f3e6e8]">
            <div className="text-[11px] tracking-[2px] uppercase text-peach/90 mb-5">
              a companion for two
            </div>
            <h1 className="font-serif text-4xl md:text-[3.2rem] leading-[1.08] font-semibold">
              The relationship stuff, in one place instead of six apps.
            </h1>
            <p className="text-[#d9c6da] text-base md:text-lg mt-6 max-w-[440px]">
              One shared space for the two of you — chat, tasks, calendar, and the small
              appreciation notes that usually get lost in a text thread.
            </p>
            <div className="flex flex-wrap items-center gap-3 mt-9">
              <Link
                to="/signup"
                className="py-3 px-6 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
              >
                Start your space
              </Link>
              <Link
                to="/login"
                className="py-3 px-6 rounded-xl font-semibold text-sm border border-white/15 text-[#f3e6e8]"
              >
                I already have an account
              </Link>
            </div>
          </div>

          {/* Signature: a fanned stack of real love-jar notes, plus a streak chip —
              both lifted straight from features that already exist in the product. */}
          <div className="relative h-[280px] md:h-[340px] hidden sm:block" aria-hidden="true">
            <div className="jar-note ilove-note-1 absolute top-2 left-2 md:left-8 w-[230px] shadow-xl">
              "thank you for making coffee before you left, i didn't even ask"
            </div>
            <div className="jar-note ilove-note-2 absolute top-24 right-0 md:right-4 w-[210px] shadow-xl bg-white">
              "you were really patient with my mom today. noticed that."
            </div>
            <div className="jar-note ilove-note-3 absolute bottom-4 left-10 md:left-16 w-[220px] shadow-xl">
              "i still think about that terrible motel we stayed in lol"
            </div>
            <div className="absolute -bottom-2 right-2 md:right-10 flex items-center gap-1.5 bg-peach/15 border border-peach/30 rounded-full px-3.5 py-2 text-sm text-peachsoft font-semibold">
              🔥 14 day streak
            </div>
          </div>
        </div>
      </section>

      {/* ---------- Features ---------- */}
      <section className="max-w-[1100px] mx-auto px-6 py-20 md:py-24">
        <h2 className="font-serif text-2xl md:text-3xl font-semibold text-center">
          Everything a couple actually reaches for
        </h2>
        <p className="text-[#7a6a7c] text-center mt-3 max-w-[480px] mx-auto">
          Not a project management tool wearing a heart emoji. Built around the parts of
          being together that are worth keeping track of.
        </p>

        <div className="grid sm:grid-cols-2 lg:grid-cols-3 gap-5 mt-12">
          {FEATURES.map((f) => (
            <div
              key={f.title}
              className="bg-white rounded-2xl p-6 border border-black/5 hover:-translate-y-1 hover:shadow-lg transition-all"
            >
              <div className="w-10 h-10 rounded-full bg-blush flex items-center justify-center text-plumdeep text-base mb-4">
                {f.icon}
              </div>
              <div className="font-serif text-lg font-semibold">{f.title}</div>
              <p className="text-sm text-[#7a6a7c] mt-1.5 leading-relaxed">{f.body}</p>
            </div>
          ))}
        </div>
      </section>

      {/* ---------- How it works ---------- */}
      <section className="bg-blush/40">
        <div className="max-w-[1100px] mx-auto px-6 py-20 md:py-24">
          <h2 className="font-serif text-2xl md:text-3xl font-semibold text-center">
            Linked up in three steps
          </h2>
          <div className="grid md:grid-cols-3 gap-8 mt-14">
            {STEPS.map((s) => (
              <div key={s.n} className="text-center md:text-left">
                <div className="w-9 h-9 rounded-full bg-gradient-to-br from-peach to-gold text-plumdeep font-serif font-semibold flex items-center justify-center mx-auto md:mx-0">
                  {s.n}
                </div>
                <div className="font-serif text-lg font-semibold mt-4">{s.title}</div>
                <p className="text-sm text-[#7a6a7c] mt-1.5 leading-relaxed">{s.body}</p>
              </div>
            ))}
          </div>
        </div>
      </section>

      {/* ---------- Final CTA ---------- */}
      <section
        className="text-center py-20 md:py-24 px-6"
        style={{
          background:
            'radial-gradient(ellipse at 80% 100%, #4a2b4f 0%, #3d2340 45%, #26152a 100%)',
        }}
      >
        <h2 className="font-serif text-2xl md:text-3xl font-semibold text-[#f3e6e8] max-w-[480px] mx-auto">
          Your shared space is one invite code away.
        </h2>
        <Link
          to="/signup"
          className="inline-block mt-8 py-3 px-7 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
        >
          Start your space
        </Link>
      </section>

      {/* ---------- Footer ---------- */}
      <footer className="max-w-[1100px] mx-auto px-6 py-8 flex flex-col sm:flex-row items-center justify-between gap-3 text-sm text-[#9a8a9c]">
        <div className="flex items-center gap-2">
          <div className="w-6 h-6 rounded-full bg-gradient-to-br from-peach to-gold flex items-center justify-center text-plumdeep text-xs flex-shrink-0">
            ❤
          </div>
          <span className="font-serif font-semibold text-ink">iLove</span>
        </div>
        <div>Made for two people at a time.</div>
      </footer>
    </div>
  )
}