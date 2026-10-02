// Celebrations: confetti and floating hearts, drawn on a temporary
// full-screen canvas. No dependencies, cleans itself up when done, and
// does nothing for people who ask their OS for reduced motion (they still
// get the haptic tap and whatever toast the caller shows).
//
//   celebrate()                   // default confetti burst from the centre
//   celebrate({ kind: 'hearts' }) // hearts floating up
//   celebrate({ kind: 'big' })    // two side cannons, for big milestones
//   celebrate({ origin: { x, y } }) // burst from a point (0..1 of the screen)

import { haptic } from './haptics'

const COLORS = ['#e8a87c', '#e8b978', '#f3b6c9', '#c2447a', '#ffcf9e', '#7a3f8c', '#6ec6c1']

function reducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches
}

function makeCanvas() {
  const canvas = document.createElement('canvas')
  const dpr = Math.min(window.devicePixelRatio || 1, 2)
  canvas.width = window.innerWidth * dpr
  canvas.height = window.innerHeight * dpr
  Object.assign(canvas.style, {
    position: 'fixed',
    inset: '0',
    width: '100vw',
    height: '100vh',
    pointerEvents: 'none',
    zIndex: '9999',
  })
  document.body.appendChild(canvas)
  const ctx = canvas.getContext('2d')
  ctx.scale(dpr, dpr)
  return { canvas, ctx }
}

function drawHeart(ctx, size) {
  const s = size / 2
  ctx.beginPath()
  ctx.moveTo(0, s * 0.6)
  ctx.bezierCurveTo(-s * 1.4, -s * 0.4, -s * 0.5, -s * 1.5, 0, -s * 0.55)
  ctx.bezierCurveTo(s * 0.5, -s * 1.5, s * 1.4, -s * 0.4, 0, s * 0.6)
  ctx.fill()
}

function confettiPiece(x, y, angle, speed) {
  return {
    x,
    y,
    vx: Math.cos(angle) * speed,
    vy: Math.sin(angle) * speed,
    rot: Math.random() * Math.PI,
    vr: (Math.random() - 0.5) * 0.3,
    w: 6 + Math.random() * 6,
    h: 4 + Math.random() * 4,
    color: COLORS[(Math.random() * COLORS.length) | 0],
    shape: Math.random() < 0.18 ? 'heart' : Math.random() < 0.5 ? 'rect' : 'circle',
    life: 0,
    maxLife: 110 + Math.random() * 60,
  }
}

function heartPiece(W, H) {
  return {
    x: W * (0.15 + Math.random() * 0.7),
    y: H + 20,
    vx: (Math.random() - 0.5) * 0.6,
    vy: -(2.2 + Math.random() * 2.2),
    rot: (Math.random() - 0.5) * 0.4,
    vr: 0,
    sway: Math.random() * Math.PI * 2,
    w: 14 + Math.random() * 18,
    color: COLORS[(Math.random() * 4) | 0],
    shape: 'float-heart',
    life: 0,
    maxLife: 160 + Math.random() * 60,
  }
}

export function celebrate({ kind = 'confetti', origin, intensity = 1 } = {}) {
  if (typeof window === 'undefined') return
  haptic(kind === 'big' ? 'success' : 'light')
  if (reducedMotion()) return

  const W = window.innerWidth
  const H = window.innerHeight
  const { canvas, ctx } = makeCanvas()
  const parts = []

  if (kind === 'hearts') {
    const n = Math.round(26 * intensity)
    for (let i = 0; i < n; i++) {
      const p = heartPiece(W, H)
      p.delay = i * 4
      parts.push(p)
    }
  } else if (kind === 'big') {
    const n = Math.round(90 * intensity)
    for (let i = 0; i < n; i++) {
      parts.push(confettiPiece(0, H * 0.75, -Math.PI / 3 + (Math.random() - 0.5) * 0.7, 11 + Math.random() * 9))
      parts.push(confettiPiece(W, H * 0.75, (-2 * Math.PI) / 3 + (Math.random() - 0.5) * 0.7, 11 + Math.random() * 9))
    }
  } else {
    const ox = (origin?.x ?? 0.5) * W
    const oy = (origin?.y ?? 0.45) * H
    const n = Math.round(80 * intensity)
    for (let i = 0; i < n; i++) {
      parts.push(confettiPiece(ox, oy, Math.random() * Math.PI * 2, 4 + Math.random() * 9))
    }
  }

  let frame = 0
  function tick() {
    frame += 1
    ctx.clearRect(0, 0, W, H)
    let alive = 0
    for (const p of parts) {
      if (p.delay && frame < p.delay) {
        alive++
        continue
      }
      p.life += 1
      if (p.life > p.maxLife) continue
      alive++
      if (p.shape === 'float-heart') {
        p.sway += 0.05
        p.x += p.vx + Math.sin(p.sway) * 0.8
        p.y += p.vy
      } else {
        p.vy += 0.25 // gravity
        p.vx *= 0.985
        p.vy *= 0.985
        p.x += p.vx
        p.y += p.vy
        p.rot += p.vr
      }
      const fade = Math.min(1, (p.maxLife - p.life) / 30)
      ctx.save()
      ctx.globalAlpha = fade
      ctx.translate(p.x, p.y)
      ctx.rotate(p.rot)
      ctx.fillStyle = p.color
      if (p.shape === 'heart' || p.shape === 'float-heart') drawHeart(ctx, p.w)
      else if (p.shape === 'circle') {
        ctx.beginPath()
        ctx.arc(0, 0, p.w / 2.4, 0, Math.PI * 2)
        ctx.fill()
      } else ctx.fillRect(-p.w / 2, -p.h / 2, p.w, p.h)
      ctx.restore()
    }
    if (alive > 0 && frame < 600) requestAnimationFrame(tick)
    else canvas.remove()
  }
  requestAnimationFrame(tick)
}

// Burst from the element that was clicked (e.g. a task's checkbox).
export function celebrateFrom(el, opts = {}) {
  if (!el?.getBoundingClientRect) return celebrate(opts)
  const r = el.getBoundingClientRect()
  return celebrate({
    intensity: 0.35,
    ...opts,
    origin: { x: (r.left + r.width / 2) / window.innerWidth, y: (r.top + r.height / 2) / window.innerHeight },
  })
}

// Streak lengths worth a big party.
export const STREAK_MILESTONES = [3, 7, 14, 30, 50, 100, 200, 365]
