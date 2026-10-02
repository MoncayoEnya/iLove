import { useEffect, useRef, useState } from 'react'

// Counts a number up from 0 when it first appears (or from the previous
// value when it changes), with an ease-out so it settles gently.
export default function CountUp({ value, duration = 900 }) {
  const [n, setN] = useState(0)
  const fromRef = useRef(0)
  useEffect(() => {
    const target = Number(value) || 0
    const from = fromRef.current
    if (from === target) {
      setN(target)
      return undefined
    }
    const start = performance.now()
    let raf = 0
    const tick = (t) => {
      const p = Math.min(1, (t - start) / duration)
      setN(Math.round(from + (target - from) * (1 - Math.pow(1 - p, 3))))
      if (p < 1) raf = requestAnimationFrame(tick)
      else fromRef.current = target
    }
    raf = requestAnimationFrame(tick)
    return () => cancelAnimationFrame(raf)
  }, [value, duration])
  return <>{n}</>
}
