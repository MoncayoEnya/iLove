import { create } from 'zustand'
import { DEFAULT_FAVORITE_PATHS } from '../navConfig'

const FAVORITES_KEY = 'ilove:favoriteNav'

// Favorites are per-device, so plain localStorage is enough — no need to
// sync them to Firestore. Falls back to the sensible defaults if nothing's
// been saved yet, or if storage isn't available (e.g. private browsing).
function loadFavorites() {
  try {
    const raw = window.localStorage.getItem(FAVORITES_KEY)
    if (!raw) return DEFAULT_FAVORITE_PATHS
    const parsed = JSON.parse(raw)
    return Array.isArray(parsed) && parsed.length > 0 ? parsed : DEFAULT_FAVORITE_PATHS
  } catch {
    return DEFAULT_FAVORITE_PATHS
  }
}

function saveFavorites(paths) {
  try {
    window.localStorage.setItem(FAVORITES_KEY, JSON.stringify(paths))
  } catch {
    // Storage unavailable — favorites just won't persist across reloads.
  }
}

// Lightweight client-only UI state — things like "which filter is selected"
// that should survive navigating between pages, but have no reason to be
// synced to Firestore. For account/couple data, keep using AuthContext.
export const useUIStore = create((set, get) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),

  // 'all' | 'mine' | 'partner' — persists while you move between pages.
  taskFilter: 'all',
  setTaskFilter: (taskFilter) => set({ taskFilter }),

  // Which routes show up as icons in the quick-access favorites rail.
  favoriteNav: loadFavorites(),
  setFavoriteNav: (favoriteNav) => {
    saveFavorites(favoriteNav)
    set({ favoriteNav })
  },
  toggleFavoriteNav: (to) => {
    const current = get().favoriteNav
    const next = current.includes(to) ? current.filter((p) => p !== to) : [...current, to]
    saveFavorites(next)
    set({ favoriteNav: next })
  },
}))
