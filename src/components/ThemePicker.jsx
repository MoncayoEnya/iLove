import { FiCheck } from 'react-icons/fi'
import { PALETTES, useTheme } from '../context/ThemeContext'

// Swatch colors are decorative previews only — the actual reskin happens
// via the [data-palette] CSS overrides in index.css.
const PALETTE_META = {
  blush: { label: 'Blush', swatch: ['#d97a6a', '#e8b978'] },
  sakura: { label: 'Sakura', swatch: ['#e88ba3', '#f3b6c9'] },
  ocean: { label: 'Ocean', swatch: ['#3d8fa6', '#6ec6c1'] },
}

export default function ThemePicker({ className = '' }) {
  const { palette, setPalette } = useTheme()

  return (
    <div className={`flex items-center gap-2.5 ${className}`}>
      {PALETTES.map((p) => {
        const meta = PALETTE_META[p]
        const active = palette === p
        return (
          <button
            key={p}
            onClick={() => setPalette(p)}
            aria-pressed={active}
            aria-label={`${meta.label} theme`}
            title={meta.label}
            className={`flex flex-col items-center gap-1.5 px-2.5 py-2 rounded-xl border transition-colors ${
              active ? 'border-peach bg-peachsoft/40' : 'border-black/10 hover:bg-black/5'
            }`}
          >
            <span
              className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0"
              style={{ background: `linear-gradient(135deg, ${meta.swatch[0]}, ${meta.swatch[1]})` }}
            >
              {active && <FiCheck size={13} className="text-white" strokeWidth={3} />}
            </span>
            <span className="text-[10.5px] font-medium text-[#7a6a7c]">{meta.label}</span>
          </button>
        )
      })}
    </div>
  )
}
