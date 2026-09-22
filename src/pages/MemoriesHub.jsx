import { useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { FiBookOpen, FiClock, FiGift, FiGrid, FiHeart, FiImage, FiList, FiPlus } from 'react-icons/fi'
// (FiHeart is also reused for the small "Good people / Brighter days" corner note below)
import Memories from './Memories'
import Journal from './Journal'
import LoveJar from './LoveJar'
import TimeCapsule from './TimeCapsule'

// Rule #4: things that belong together get tabs inside one page instead of
// their own routes. Memories / Journal / Love jar / Time capsule are all
// "emotional history" — this is the single ❤️ Memories page from the
// design guide, with each of those as a tab rather than a standalone page.
const TABS = [
  { key: 'timeline', label: 'Timeline', icon: FiClock, Component: Memories },
  { key: 'journal', label: 'Journal', icon: FiBookOpen, Component: Journal },
  { key: 'jar', label: 'Love jar', icon: FiHeart, Component: LoveJar },
  { key: 'capsule', label: 'Capsule', icon: FiGift, Component: TimeCapsule },
]

export default function MemoriesHub() {
  const [searchParams, setSearchParams] = useSearchParams()
  const activeKey = TABS.some((t) => t.key === searchParams.get('tab'))
    ? searchParams.get('tab')
    : 'timeline'
  const ActiveComponent = TABS.find((t) => t.key === activeKey).Component

  // The Timeline tab's "Add a photo" / "Log a milestone" / Timeline-Grid
  // toggle live up here, rather than inside Memories itself, so they can
  // sit on the same row as the tabs (next to them, right-aligned) instead
  // of on their own row underneath.
  const [layout, setLayout] = useState('timeline')
  const [entryMode, setEntryMode] = useState('photo')
  const [showAddModal, setShowAddModal] = useState(false)

  return (
    <div>
      <div className="mb-6 flex items-start justify-between gap-4 flex-wrap">
        <div>
          <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
            Photos, places, and a love story
          </div>
          <h1 className="font-serif text-3xl font-semibold mb-1 leading-tight">Memories</h1>
          <p className="text-sm text-[#7a6a7c]">Everything you're building together, in one place.</p>
        </div>
        <div className="hidden sm:flex items-start gap-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-[#c2a6a3] leading-relaxed">
          <div>
            <div>Good people</div>
            <div>Brighter days</div>
          </div>
          <FiHeart size={12} className="mt-0.5 text-peach flex-shrink-0" fill="currentColor" />
        </div>
      </div>

      <div className="flex items-end justify-between gap-4 flex-wrap mb-6 border-b border-black/10">
        <div
          className="flex items-center gap-5 overflow-x-auto"
          role="tablist"
          aria-label="Memories sections"
        >
          {TABS.map(({ key, label, icon: Icon }) => (
            <button
              key={key}
              role="tab"
              aria-selected={activeKey === key}
              onClick={() => setSearchParams(key === 'timeline' ? {} : { tab: key })}
              className={`flex items-center gap-1.5 py-3 text-sm whitespace-nowrap border-b-2 -mb-px transition-colors ${
                activeKey === key
                  ? 'border-peach text-plum font-semibold'
                  : 'border-transparent text-[#9a8a9c] font-medium hover:text-plum'
              }`}
            >
              <Icon size={14} /> {label}
            </button>
          ))}
        </div>

        {activeKey === 'timeline' && (
          <div className="flex items-center gap-3 flex-wrap pb-3">
            <div className="flex items-center gap-2">
              <button
                onClick={() => {
                  setEntryMode('photo')
                  setShowAddModal(true)
                }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl border border-black/10 bg-white hover:bg-black/[0.02] transition-colors"
              >
                <FiImage size={13} /> Add a photo
              </button>
              <button
                onClick={() => {
                  setEntryMode('milestone')
                  setShowAddModal(true)
                }}
                className="flex items-center gap-1.5 text-xs font-semibold px-3.5 py-2 rounded-xl bg-peach text-white hover:brightness-95 transition"
              >
                <FiPlus size={13} /> Log a milestone
              </button>
            </div>
            <div className="hidden sm:block w-px h-6 bg-black/10" />
            <div className="flex items-center gap-1.5">
              <button
                onClick={() => setLayout('timeline')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  layout === 'timeline' ? 'bg-plum text-white' : 'bg-white border border-black/10 text-[#7a6a7c]'
                }`}
              >
                <FiList size={13} /> Timeline
              </button>
              <button
                onClick={() => setLayout('grid')}
                className={`flex items-center gap-1.5 px-3.5 py-1.5 rounded-full text-xs font-semibold transition-colors ${
                  layout === 'grid' ? 'bg-plum text-white' : 'bg-white border border-black/10 text-[#7a6a7c]'
                }`}
              >
                <FiGrid size={13} /> Grid
              </button>
            </div>
          </div>
        )}
      </div>

      <ActiveComponent
        embedded
        layout={layout}
        setLayout={setLayout}
        entryMode={entryMode}
        setEntryMode={setEntryMode}
        showAddModal={showAddModal}
        setShowAddModal={setShowAddModal}
      />
    </div>
  )
}