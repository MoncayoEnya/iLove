import { create } from 'zustand'

// Lightweight client-only UI state — things like "which filter is selected"
// that should survive navigating between pages, but have no reason to be
// synced to Firestore. For account/couple data, keep using AuthContext.
export const useUIStore = create((set) => ({
  mobileNavOpen: false,
  setMobileNavOpen: (open) => set({ mobileNavOpen: open }),
  toggleMobileNav: () => set((s) => ({ mobileNavOpen: !s.mobileNavOpen })),

  // 'all' | 'mine' | 'partner' — persists while you move between pages.
  taskFilter: 'all',
  setTaskFilter: (taskFilter) => set({ taskFilter }),
}))
