import { createContext, useContext, useEffect, useState } from 'react'

const ThemeContext = createContext(null)
const STORAGE_KEY = 'ilovee-theme'
const PALETTE_KEY = 'ilovee-palette'

// Palette is a separate dimension from light/dark: dark/light governs
// surfaces and neutrals (see index.css's html.dark block), while palette
// only reskins the accent colors (peach/gold/plum family). The two combine
// freely except that, for now, palettes are only defined for light mode —
// dark mode keeps its own established look regardless of palette choice.
export const PALETTES = ['blush', 'sakura', 'ocean']

export function ThemeProvider({ children }) {
  const [theme, setTheme] = useState(() => {
    if (typeof window === 'undefined') return 'dark'
    const saved = localStorage.getItem(STORAGE_KEY)
    // Design guide calls for dark mode "ideally as the default" — so a
    // first-time visitor with no saved preference gets dark, not their OS
    // setting. Anyone who's toggled before keeps their explicit choice.
    return saved === 'light' || saved === 'dark' ? saved : 'dark'
  })

  const [palette, setPalette] = useState(() => {
    if (typeof window === 'undefined') return 'blush'
    const saved = localStorage.getItem(PALETTE_KEY)
    return PALETTES.includes(saved) ? saved : 'blush'
  })

  useEffect(() => {
    document.documentElement.classList.toggle('dark', theme === 'dark')
    localStorage.setItem(STORAGE_KEY, theme)
  }, [theme])

  useEffect(() => {
    document.documentElement.setAttribute('data-palette', palette)
    localStorage.setItem(PALETTE_KEY, palette)
  }, [palette])

  const toggleTheme = () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))

  return (
    <ThemeContext.Provider value={{ theme, toggleTheme, setTheme, palette, setPalette }}>
      {children}
    </ThemeContext.Provider>
  )
}

export function useTheme() {
  const ctx = useContext(ThemeContext)
  if (!ctx) throw new Error('useTheme must be used within a ThemeProvider')
  return ctx
}