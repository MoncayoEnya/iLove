import { useEffect } from 'react'

/*
  useLivelyUI — mount once (in App.jsx) and every page gets:

  • cards and list rows tagged so styles/lively.css can lift them on hover,
    paint a cursor-following spotlight, and tilt clickable/photo cards in 3D
  • staggered fade-and-rise as cards scroll into view
  • a ripple from the exact spot you tap on any button / link / tile
  • photos inside cards that zoom gently on hover

  Nothing on the pages needs to change: it recognises the app's existing
  Tailwind patterns (rounded-2xl/3xl surfaces, bordered rounded-xl rows)
  and watches for new ones as React renders them. It only ever adds
  data-lv-* attributes and CSS variables, which React leaves alone, so it
  never fights React over className.
*/

const CARD_RE = /\brounded-(2xl|3xl)\b/
const ROW_RE = /\brounded-xl\b/
const SURFACE_RE = /\b(border|bg-white|bg-\[#|bg-gradient-to-|bg-blush|bg-plumdeep|bg-peach|bg-gold|shadow)/
// Big rounded blocks with real padding are cards even without a border or
// background class (some get their colour from an inline style).
const PADDED_RE = /(^|\s)p-([4-9]|1[0-2])(\s|$)/
const POSITIONED_RE = /(^|\s)(fixed|absolute|sticky)(\s|$)/
const HAS_TRANSFORM_CLASS_RE = /(^|\s)-?(rotate|scale|translate|skew)-/
const PRESSABLE = 'button, a[class*="rounded"], [role="button"], [class*="cursor-pointer"]'

const reduceMotion = () =>
  typeof window !== 'undefined' &&
  window.matchMedia?.('(prefers-reduced-motion: reduce)').matches

function classOf(el) {
  return typeof el.className === 'string' ? el.className : el.getAttribute?.('class') || ''
}

// React stores the current props on the DOM node under a private key; that's
// the only reliable way to tell "this div has an onClick" from the outside.
function hasReactClick(el) {
  for (const k in el) {
    if (k.startsWith('__reactProps$')) return typeof el[k]?.onClick === 'function'
  }
  return false
}

// Overlays (modals, sheets) and anything wrapped in data-lv-off (e.g. the
// places map, whose tiles are images) are left alone — except full-screen
// layers that opt back in with data-lv-on (the Connection view is a whole
// page that happens to slide over the app, so it gets the effects too).
function isOverlay(el) {
  if (el.closest('[data-lv-off]')) return true
  const overlay = el.closest('[role="dialog"], .fixed, [aria-modal="true"]')
  if (!overlay) return false
  const optIn = el.closest('[data-lv-on]')
  // Allowed only if the nearest overlay is the opted-in layer itself (or
  // wraps it) — a popup opened *inside* that layer stays excluded.
  return !(optIn && overlay.contains(optIn))
}

function classify(el) {
  if (!(el instanceof HTMLElement)) return null
  const tag = el.tagName
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || tag === 'IMG' || tag === 'VIDEO') return null
  const cls = classOf(el)
  if (POSITIONED_RE.test(cls)) return null
  if (CARD_RE.test(cls) && (SURFACE_RE.test(cls) || PADDED_RE.test(cls) || el.style.background)) return 'card'
  if (!SURFACE_RE.test(cls)) return null
  // Bordered rounded-xl blocks with some padding are list rows (tasks,
  // goals, settings rows…). Buttons with that shape are handled as buttons.
  if (ROW_RE.test(cls) && /\bborder\b/.test(cls) && /\bp[xy]?-[3-9]/.test(cls) && tag !== 'BUTTON' && tag !== 'A') {
    return 'row'
  }
  return null
}

export function useLivelyUI() {
  useEffect(() => {
    if (typeof window === 'undefined') return undefined
    const reduced = reduceMotion()

    // ---------- scroll reveal ----------
    let staggerIndex = 0
    let staggerReset = 0
    const io =
      !reduced && 'IntersectionObserver' in window
        ? new IntersectionObserver(
            (entries) => {
              const visible = entries
                .filter((e) => e.isIntersecting)
                .sort((a, b) =>
                  a.target.compareDocumentPosition(b.target) & Node.DOCUMENT_POSITION_FOLLOWING ? -1 : 1
                )
              const now = performance.now()
              if (now - staggerReset > 250) staggerIndex = 0
              staggerReset = now
              for (const entry of visible) {
                const el = entry.target
                el.style.setProperty('--lv-delay', `${Math.min(staggerIndex, 8) * 60}ms`)
                el.setAttribute('data-lv-reveal', '1')
                staggerIndex += 1
                io.unobserve(el)
                // Drop the attribute once the animation has played so the
                // element's normal hover transitions take over cleanly.
                setTimeout(() => {
                  el.removeAttribute('data-lv-reveal')
                  el.style.removeProperty('--lv-delay')
                }, 1300)
              }
            },
            { threshold: 0.06, rootMargin: '0px 0px -30px 0px' }
          )
        : null

    function setupCard(el, kind) {
      el.setAttribute('data-lv-card', kind)

      const cs = getComputedStyle(el)
      if (cs.backgroundImage === 'none') el.setAttribute('data-lv-glow', '')

      if (kind === 'card') {
        const clickable =
          el.tagName === 'A' ||
          el.tagName === 'BUTTON' ||
          el.getAttribute('role') === 'button' ||
          /\bcursor-pointer\b/.test(classOf(el)) ||
          hasReactClick(el)
        const hasPhoto = !!el.querySelector('img')
        const safeToTransform = !el.style.transform && !HAS_TRANSFORM_CLASS_RE.test(classOf(el))
        if ((clickable || hasPhoto) && safeToTransform) el.setAttribute('data-lv-tilt', '')
      }

      // Reveal only outermost cards, so nested ones don't double-animate,
      // and skip framer-motion elements that animate themselves.
      if (
        io &&
        !el.style.opacity &&
        !el.style.transform &&
        !el.parentElement?.closest('[data-lv-card]')
      ) {
        el.setAttribute('data-lv-reveal', '0')
        io.observe(el)
      }
    }

    function clipsContent(el) {
      const ov = el && getComputedStyle(el).overflow
      return ov === 'hidden' || ov === 'clip'
    }

    function setupImages(root) {
      const imgs = root.tagName === 'IMG' ? [root] : root.querySelectorAll('img')
      imgs.forEach((img) => {
        if (img.hasAttribute('data-lv-zoom') || img.hasAttribute('data-lv-photo') || isOverlay(img)) return
        const parent = img.parentElement
        if (!parent) return
        const card = img.closest('[data-lv-card]')
        // Zoom inside a frame: the direct parent clips, or the card it sits
        // in clips (memory cards: card > button > img).
        if ((clipsContent(parent) && parent.offsetWidth >= 80) || (card && clipsContent(card))) {
          img.setAttribute('data-lv-zoom', '')
          return
        }
        // Free-standing rounded photos (photo grids): pop the photo itself.
        if (/\brounded/.test(classOf(img)) && /\bobject-cover\b/.test(classOf(img)) && img.offsetWidth >= 60) {
          img.setAttribute('data-lv-photo', '')
        }
      })
    }

    function setupPressables(root) {
      const list = root.matches?.(PRESSABLE) ? [root, ...root.querySelectorAll(PRESSABLE)] : root.querySelectorAll(PRESSABLE)
      list.forEach((el) => {
        if (el.hasAttribute('data-lv-rel') || el.hasAttribute('data-lv-pos')) return
        if (getComputedStyle(el).position === 'static') el.setAttribute('data-lv-rel', '')
        else el.setAttribute('data-lv-pos', '')
      })
    }

    function scan(root) {
      if (!(root instanceof HTMLElement)) return
      const candidates = [root, ...root.querySelectorAll('[class*="rounded-"]')]
      for (const el of candidates) {
        if (el.hasAttribute('data-lv-card')) continue
        const kind = classify(el)
        if (!kind || isOverlay(el)) continue
        if (el.offsetWidth && el.offsetWidth < 90) continue
        setupCard(el, kind)
      }
      setupImages(root)
      setupPressables(root)
    }

    scan(document.body)

    // Safety net: never leave anything invisible if the observer misses it.
    const failsafe = setInterval(() => {
      document.querySelectorAll('[data-lv-reveal="0"]').forEach((el) => {
        const r = el.getBoundingClientRect()
        if (r.top < window.innerHeight && r.bottom > 0 && r.width > 0) {
          el.setAttribute('data-lv-reveal', '1')
          io?.unobserve(el)
        }
      })
    }, 1500)

    // ---------- watch for new content ----------
    const pending = new Set()
    let frame = 0
    const mo = new MutationObserver((mutations) => {
      for (const m of mutations) {
        m.addedNodes.forEach((n) => {
          if (n.nodeType === 1) pending.add(n)
        })
      }
      if (pending.size && !frame) {
        frame = requestAnimationFrame(() => {
          frame = 0
          const nodes = [...pending]
          pending.clear()
          nodes.forEach((n) => n.isConnected && scan(n))
        })
      }
    })
    mo.observe(document.body, { childList: true, subtree: true })

    // ---------- spotlight + tilt follow the mouse ----------
    let active = null
    function resetCard(el) {
      el.style.removeProperty('--lv-x')
      el.style.removeProperty('--lv-y')
      el.style.removeProperty('--lv-rx')
      el.style.removeProperty('--lv-ry')
    }
    function onPointerMove(e) {
      if (e.pointerType && e.pointerType !== 'mouse') return
      const card = e.target.closest?.('[data-lv-card]') || null
      if (card !== active) {
        if (active) resetCard(active)
        active = card
      }
      if (!card) return
      const r = card.getBoundingClientRect()
      const x = e.clientX - r.left
      const y = e.clientY - r.top
      card.style.setProperty('--lv-x', `${x}px`)
      card.style.setProperty('--lv-y', `${y}px`)
      if (!reduced && card.hasAttribute('data-lv-tilt')) {
        const max = 5
        card.style.setProperty('--lv-rx', `${((y / r.height) - 0.5) * -max}deg`)
        card.style.setProperty('--lv-ry', `${((x / r.width) - 0.5) * max}deg`)
      }
    }
    function onPointerLeaveWindow() {
      if (active) resetCard(active)
      active = null
    }

    // ---------- ripple from the tap point ----------
    function onPointerDown(e) {
      if (reduced) return
      const el = e.target.closest?.(`${PRESSABLE}, [data-lv-tilt]`)
      if (!el || el.disabled || el.getAttribute('aria-disabled') === 'true') return
      if (!el.hasAttribute('data-lv-rel') && !el.hasAttribute('data-lv-pos')) {
        if (getComputedStyle(el).position === 'static') el.setAttribute('data-lv-rel', '')
        else el.setAttribute('data-lv-pos', '')
      }
      const r = el.getBoundingClientRect()
      el.style.setProperty('--lv-px', `${e.clientX - r.left}px`)
      el.style.setProperty('--lv-py', `${e.clientY - r.top}px`)
      el.removeAttribute('data-lv-ripple')
      void el.offsetWidth // restart the animation on rapid taps
      el.setAttribute('data-lv-ripple', '')
      clearTimeout(el.__lvRippleTimer)
      el.__lvRippleTimer = setTimeout(() => el.removeAttribute('data-lv-ripple'), 650)
    }

    document.addEventListener('pointermove', onPointerMove, { passive: true })
    document.addEventListener('pointerdown', onPointerDown, { passive: true })
    document.documentElement.addEventListener('mouseleave', onPointerLeaveWindow)

    return () => {
      mo.disconnect()
      io?.disconnect()
      clearInterval(failsafe)
      if (frame) cancelAnimationFrame(frame)
      document.removeEventListener('pointermove', onPointerMove)
      document.removeEventListener('pointerdown', onPointerDown)
      document.documentElement.removeEventListener('mouseleave', onPointerLeaveWindow)
      document.querySelectorAll('[data-lv-reveal]').forEach((el) => el.removeAttribute('data-lv-reveal'))
    }
  }, [])
}
