import { FiMoon, FiSun } from 'react-icons/fi'
import { useTheme } from '../context/ThemeContext'

// `light` = true when it's sitting on a white sidebar/topbar (the "basic"
// theme) instead of the dark plumdeep chrome, so its border/icon colors
// need to flip to stay visible. Purely a rendering hint — it doesn't
// affect what toggleTheme() actually does.
export default function ThemeToggle({ className = '', light = false }) {
  const { theme, toggleTheme } = useTheme()

  return (
    <button
      onClick={toggleTheme}
      aria-label={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      title={theme === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}
      className={`w-9 h-9 rounded-lg border flex items-center justify-center flex-shrink-0 ${
        light ? 'border-black/10 text-plumdeep' : 'border-white/15'
      } ${className}`}
    >
      {theme === 'dark' ? <FiSun size={16} /> : <FiMoon size={16} />}
    </button>
  )
}