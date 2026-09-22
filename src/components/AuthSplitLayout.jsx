import { FiLock } from 'react-icons/fi'
import Logo from './Logo'

/**
 * Split-screen layout for Login / Signup: a brand panel on the left
 * (reuses the app's existing plum gradient — the same one AuthCard uses
 * full-bleed) and the form on a plain paper panel on the right.
 * On small screens the brand panel is hidden and the form fills the page.
 */
export default function AuthSplitLayout({ headline, subline = 'A private space for two', children }) {
  return (
    <div className="min-h-screen lg:grid lg:grid-cols-2">
      {/* ---------- Left: brand panel ---------- */}
      <div
        className="hidden lg:flex flex-col justify-between p-12 xl:p-16 text-[#f3e6e8]"
        style={{
          background: 'radial-gradient(ellipse at 20% 0%, #4a2b4f 0%, #3d2340 45%, #26152a 100%)',
        }}
      >
        <div className="flex items-center gap-2.5">
          <Logo size="lg" />
          <span className="font-serif text-xl font-semibold">iLove</span>
        </div>

        <div>
          <h1 className="font-serif text-5xl xl:text-[3.4rem] font-semibold leading-[1.05] max-w-[13ch]">
            {headline}
          </h1>
          <p className="mt-5 text-xs tracking-[2px] uppercase text-peach/90">{subline}</p>
        </div>

        <div className="flex items-start gap-2.5 text-[#d9c6da] text-xs max-w-[320px] leading-relaxed">
          <FiLock size={14} className="mt-0.5 flex-shrink-0" />
          <p>
            Your notes, chats, and reflections are private to the two of you — nothing here is
            ever sold or shared.
          </p>
        </div>
      </div>

      {/* ---------- Right: form panel ---------- */}
      <div className="flex items-center justify-center bg-paper min-h-screen p-6 sm:p-10">
        <div className="w-full max-w-[400px]">
          <div className="flex items-center gap-2.5 mb-2">
            <Logo size="lg" />
            <span className="font-serif text-2xl font-semibold">iLove</span>
          </div>
          <div className="text-[11px] tracking-[2px] uppercase text-peach/90 ml-[46px] mb-7">
            a companion for two
          </div>
          {children}
        </div>
      </div>
    </div>
  )
}
