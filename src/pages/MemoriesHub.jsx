import { useSearchParams } from 'react-router-dom'
import { FiBookOpen, FiClock, FiGift, FiHeart } from 'react-icons/fi'
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

  return (
    <div>
      <div className="mb-5">
        <h1 className="text-2xl font-semibold mb-1">❤️ Memories</h1>
        <p className="text-sm text-[#7a6a7c]">Everything you're building together, in one place.</p>
      </div>

      <div
        className="flex items-center gap-1 mb-6 border-b border-black/10 overflow-x-auto"
        role="tablist"
        aria-label="Memories sections"
      >
        {TABS.map(({ key, label, icon: Icon }) => (
          <button
            key={key}
            role="tab"
            aria-selected={activeKey === key}
            onClick={() => setSearchParams(key === 'timeline' ? {} : { tab: key })}
            className={`flex items-center gap-1.5 px-3.5 py-2.5 text-sm font-medium whitespace-nowrap border-b-2 -mb-px transition-colors ${
              activeKey === key
                ? 'border-peach text-plum font-semibold'
                : 'border-transparent text-[#9a8a9c] hover:text-plum'
            }`}
          >
            <Icon size={14} /> {label}
          </button>
        ))}
      </div>

      <ActiveComponent embedded />
    </div>
  )
}
