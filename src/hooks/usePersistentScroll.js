import { useLayoutEffect, useRef } from 'react'

// Each page renders its own copy of the app layout, so the sidebar is
// rebuilt on every navigation and its scroll position would jump back to
// the top. This remembers the scroll position (per `key`) in memory for the
// whole session and puts it back before the browser paints, so the list
// stays exactly where you left it.
const positions = new Map()

export function usePersistentScroll(key) {
  const ref = useRef(null)

  useLayoutEffect(() => {
    const el = ref.current
    if (!el) return undefined
    const saved = positions.get(key)
    if (saved) el.scrollTop = saved
    const onScroll = () => positions.set(key, el.scrollTop)
    el.addEventListener('scroll', onScroll, { passive: true })
    return () => {
      positions.set(key, el.scrollTop)
      el.removeEventListener('scroll', onScroll)
    }
  }, [key])

  return ref
}
