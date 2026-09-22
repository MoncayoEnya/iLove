import { useCallback, useEffect, useRef, useState } from 'react'
import {
  addDoc,
  collection,
  doc,
  limit,
  onSnapshot,
  orderBy,
  query,
  serverTimestamp,
  updateDoc,
} from 'firebase/firestore'
import toast from 'react-hot-toast'
import { FiAward, FiCheck, FiFeather, FiRefreshCw, FiSend, FiX } from 'react-icons/fi'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { usePartner } from '../hooks/usePartner'

const GAME_WIDTH = 400
const GAME_HEIGHT = 600
const BIRD_X = 90
const BIRD_RADIUS = 14
const GRAVITY = 1400 // px/s^2
const FLAP_VELOCITY = -420 // px/s
const PIPE_WIDTH = 64
const PIPE_GAP = 165
const PIPE_SPEED = 165 // px/s
const PIPE_INTERVAL_MS = 1500
const GROUND_HEIGHT = 90

const BEST_KEY = 'ilovee_flappy_best'

function makePipe(x) {
  const margin = 70
  const top = margin + Math.random() * (GAME_HEIGHT - GROUND_HEIGHT - PIPE_GAP - margin * 2)
  return { x, top, passed: false }
}

function freshGame() {
  return {
    birdY: GAME_HEIGHT / 2,
    velocity: 0,
    pipes: [],
    score: 0,
    spawnTimer: 0,
  }
}

/** The playable canvas + physics, shared by solo practice and duel turns.
 *  Fires onGameOver(score) exactly once per attempt. When `allowReplay` is
 *  false (a duel turn), the run locks after one crash instead of letting
 *  the player tap to try again — a duel turn is one shot each. */
function GameCanvas({ allowReplay, onGameOver }) {
  const canvasRef = useRef(null)
  const rafRef = useRef(null)
  const lastTsRef = useRef(null)
  const gameRef = useRef(freshGame())
  const statusRef = useRef('ready')
  const submittedRef = useRef(false)

  const [status, setStatus] = useState('ready')
  const [finalScore, setFinalScore] = useState(0)

  const changeStatus = useCallback((next) => {
    statusRef.current = next
    setStatus(next)
  }, [])

  const flap = useCallback(() => {
    if (statusRef.current === 'over') {
      if (allowReplay) {
        gameRef.current = freshGame()
        submittedRef.current = false
        changeStatus('ready')
      }
      return
    }
    if (statusRef.current === 'ready') changeStatus('playing')
    gameRef.current.velocity = FLAP_VELOCITY
  }, [allowReplay, changeStatus])

  useEffect(() => {
    function onKey(e) {
      if (e.code === 'Space') {
        e.preventDefault()
        flap()
      }
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [flap])

  useEffect(() => {
    const ctx = canvasRef.current.getContext('2d')

    function step(ts) {
      if (lastTsRef.current == null) lastTsRef.current = ts
      const dt = Math.min((ts - lastTsRef.current) / 1000, 0.033)
      lastTsRef.current = ts

      const g = gameRef.current

      if (statusRef.current === 'playing') {
        g.velocity += GRAVITY * dt
        g.birdY += g.velocity * dt

        g.spawnTimer += dt * 1000
        if (g.spawnTimer >= PIPE_INTERVAL_MS) {
          g.spawnTimer = 0
          g.pipes.push(makePipe(GAME_WIDTH + PIPE_WIDTH))
        }

        g.pipes.forEach((p) => {
          p.x -= PIPE_SPEED * dt
        })
        g.pipes = g.pipes.filter((p) => p.x > -PIPE_WIDTH)

        g.pipes.forEach((p) => {
          if (!p.passed && p.x + PIPE_WIDTH < BIRD_X - BIRD_RADIUS) {
            p.passed = true
            g.score += 1
          }
        })

        const groundY = GAME_HEIGHT - GROUND_HEIGHT
        let crashed = g.birdY + BIRD_RADIUS >= groundY || g.birdY - BIRD_RADIUS <= 0
        if (!crashed) {
          for (const p of g.pipes) {
            const inX = BIRD_X + BIRD_RADIUS > p.x && BIRD_X - BIRD_RADIUS < p.x + PIPE_WIDTH
            if (inX) {
              const inGap = g.birdY - BIRD_RADIUS > p.top && g.birdY + BIRD_RADIUS < p.top + PIPE_GAP
              if (!inGap) crashed = true
            }
          }
        }
        if (crashed) {
          g.birdY = Math.min(g.birdY, groundY - BIRD_RADIUS)
          setFinalScore(g.score)
          changeStatus('over')
          if (!submittedRef.current) {
            submittedRef.current = true
            onGameOver?.(g.score)
          }
        }
      }

      draw(ctx, g, statusRef.current)
      rafRef.current = requestAnimationFrame(step)
    }

    rafRef.current = requestAnimationFrame(step)
    return () => {
      cancelAnimationFrame(rafRef.current)
      lastTsRef.current = null
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [changeStatus])

  function draw(ctx, g, currentStatus) {
    const sky = ctx.createLinearGradient(0, 0, 0, GAME_HEIGHT)
    sky.addColorStop(0, '#fff5ea')
    sky.addColorStop(1, '#fbe1c9')
    ctx.fillStyle = sky
    ctx.fillRect(0, 0, GAME_WIDTH, GAME_HEIGHT)

    g.pipes.forEach((p) => drawPipe(ctx, p))

    const groundY = GAME_HEIGHT - GROUND_HEIGHT
    ctx.fillStyle = '#e8c9a0'
    ctx.fillRect(0, groundY, GAME_WIDTH, GROUND_HEIGHT)
    ctx.fillStyle = '#d9a441'
    ctx.fillRect(0, groundY, GAME_WIDTH, 6)

    ctx.save()
    ctx.translate(BIRD_X, g.birdY)
    const angle = Math.max(-0.5, Math.min(0.9, g.velocity / 600))
    ctx.rotate(angle)
    const birdGrad = ctx.createLinearGradient(-BIRD_RADIUS, -BIRD_RADIUS, BIRD_RADIUS, BIRD_RADIUS)
    birdGrad.addColorStop(0, '#e07a52')
    birdGrad.addColorStop(1, '#d9a441')
    ctx.beginPath()
    ctx.arc(0, 0, BIRD_RADIUS, 0, Math.PI * 2)
    ctx.fillStyle = birdGrad
    ctx.fill()
    ctx.beginPath()
    ctx.ellipse(-2, 3, 7, 4, 0.4, 0, Math.PI * 2)
    ctx.fillStyle = 'rgba(61,35,64,0.18)'
    ctx.fill()
    ctx.beginPath()
    ctx.arc(6, -4, 2.2, 0, Math.PI * 2)
    ctx.fillStyle = '#3d2340'
    ctx.fill()
    ctx.beginPath()
    ctx.moveTo(BIRD_RADIUS - 2, -2)
    ctx.lineTo(BIRD_RADIUS + 7, 1)
    ctx.lineTo(BIRD_RADIUS - 2, 5)
    ctx.closePath()
    ctx.fillStyle = '#c0473c'
    ctx.fill()
    ctx.restore()

    if (currentStatus === 'playing') {
      ctx.font = '700 34px Georgia, serif'
      ctx.fillStyle = '#3d2340'
      ctx.textAlign = 'center'
      ctx.fillText(String(g.score), GAME_WIDTH / 2, 60)
    }
  }

  function drawPipe(ctx, p) {
    const groundY = GAME_HEIGHT - GROUND_HEIGHT
    ctx.fillStyle = '#6b3a52'
    ctx.fillRect(p.x, 0, PIPE_WIDTH, p.top)
    ctx.fillRect(p.x - 4, p.top - 18, PIPE_WIDTH + 8, 18)
    const bottomY = p.top + PIPE_GAP
    ctx.fillRect(p.x, bottomY, PIPE_WIDTH, groundY - bottomY)
    ctx.fillRect(p.x - 4, bottomY, PIPE_WIDTH + 8, 18)
  }

  return (
    <div
      className="relative rounded-2xl overflow-hidden border border-black/10 shadow-sm mx-auto select-none"
      style={{ width: '100%', maxWidth: GAME_WIDTH, aspectRatio: `${GAME_WIDTH} / ${GAME_HEIGHT}` }}
      onMouseDown={flap}
      onTouchStart={(e) => {
        e.preventDefault()
        flap()
      }}
    >
      <canvas
        ref={canvasRef}
        width={GAME_WIDTH}
        height={GAME_HEIGHT}
        className="w-full h-full block cursor-pointer"
      />

      {status !== 'playing' && (
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-3 bg-plumdeep/45 backdrop-blur-[2px] text-center px-6">
          {status === 'ready' ? (
            <>
              <p className="font-serif italic text-2xl text-white">Ready?</p>
              <p className="text-sm text-white/85">Tap, click, or press space to flap</p>
            </>
          ) : (
            <>
              <p className="font-serif italic text-2xl text-white">
                {allowReplay ? 'Game over' : 'Run complete'}
              </p>
              <p className="text-sm text-white/85">Score {finalScore}</p>
              {allowReplay && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation()
                    flap()
                  }}
                  className="mt-1 flex items-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold text-plumdeep hover:opacity-90 transition-opacity"
                  style={{ background: 'linear-gradient(135deg, #e07a52, #d9a441)' }}
                >
                  <FiRefreshCw size={14} />
                  Play again
                </button>
              )}
            </>
          )}
        </div>
      )}
    </div>
  )
}

function TabButton({ active, onClick, children }) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`text-sm font-semibold px-4 py-1.5 rounded-lg transition-colors ${
        active ? 'bg-white shadow-sm text-plumdeep' : 'text-[#9a8a9c]'
      }`}
    >
      {children}
    </button>
  )
}

export default function FlappyBird() {
  const { firebaseUser, couple } = useAuth()
  const { partner, partnerUid, hasPartner } = usePartner()
  const coupleId = couple?.id
  const myUid = firebaseUser?.uid
  const partnerName = partner?.displayName || 'your partner'

  const [uiMode, setUiMode] = useState('solo') // 'solo' | 'duel'
  const [duel, setDuel] = useState(null)
  const [prizeText, setPrizeText] = useState('')
  const [best, setBest] = useState(() => Number(localStorage.getItem(BEST_KEY)) || 0)

  // Watch the couple's most recent duel in real time.
  useEffect(() => {
    if (!coupleId) return
    const q = query(collection(db, 'couples', coupleId, 'flappyDuels'), orderBy('createdAt', 'desc'), limit(1))
    const unsub = onSnapshot(q, (snap) => {
      const d = snap.docs[0]
      setDuel(d ? { id: d.id, ...d.data() } : null)
    })
    return unsub
  }, [coupleId])

  // Jump to the Duel tab automatically when a fresh challenge comes in.
  useEffect(() => {
    if (duel?.status === 'pending' && duel.opponentId === myUid) {
      setUiMode('duel')
    }
  }, [duel, myUid])

  const iAmChallenger = duel?.challengerId === myUid
  const myScoreField = iAmChallenger ? 'challengerScore' : 'opponentScore'

  const duelRef = duel ? doc(db, 'couples', coupleId, 'flappyDuels', duel.id) : null

  async function startChallenge() {
    if (!coupleId || !partnerUid) return
    try {
      await addDoc(collection(db, 'couples', coupleId, 'flappyDuels'), {
        challengerId: myUid,
        opponentId: partnerUid,
        status: 'pending',
        challengerScore: null,
        opponentScore: null,
        winnerId: null,
        prize: null,
        createdAt: serverTimestamp(),
      })
    } catch (e) {
      toast.error("Couldn't send the challenge — try again.")
    }
  }

  async function respondToChallenge(accept) {
    if (!duelRef) return
    try {
      await updateDoc(duelRef, { status: accept ? 'accepted' : 'declined' })
    } catch (e) {
      toast.error("Couldn't update the challenge — try again.")
    }
  }

  async function cancelChallenge() {
    if (!duelRef) return
    try {
      await updateDoc(duelRef, { status: 'cancelled' })
    } catch (e) {
      toast.error("Couldn't cancel — try again.")
    }
  }

  async function submitDuelScore(score) {
    if (!duelRef) return
    try {
      await updateDoc(duelRef, { [myScoreField]: score })
    } catch (e) {
      toast.error("Couldn't save your score — try again.")
    }
  }

  // Once both scores are in, resolve the winner. Whichever client's
  // listener notices this first writes it — harmless if both do, since
  // they'll compute the same result.
  useEffect(() => {
    if (!duel || !duelRef || duel.status !== 'accepted') return
    if (duel.challengerScore == null || duel.opponentScore == null) return
    const winnerId =
      duel.challengerScore === duel.opponentScore
        ? null
        : duel.challengerScore > duel.opponentScore
        ? duel.challengerId
        : duel.opponentId
    updateDoc(duelRef, { status: 'complete', winnerId, resolvedAt: serverTimestamp() }).catch(() => {})
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [duel?.challengerScore, duel?.opponentScore, duel?.status])

  async function lockInPrize() {
    const p = prizeText.trim()
    if (!p || !duelRef) return
    try {
      await updateDoc(duelRef, { prize: p })
      setPrizeText('')
    } catch (e) {
      toast.error("Couldn't save that — try again.")
    }
  }

  function updateBest(score) {
    setBest((b) => {
      const nb = Math.max(b, score)
      localStorage.setItem(BEST_KEY, String(nb))
      return nb
    })
  }

  async function rematch() {
    await startChallenge()
  }

  function renderDuel() {
    if (!hasPartner) {
      return (
        <p className="text-sm text-[#7a6a7c] text-center py-10">
          Invite your partner to your space first, then you can challenge them.
        </p>
      )
    }

    const status = duel?.status

    if (!duel || status === 'declined' || status === 'cancelled') {
      return (
        <div className="flex flex-col items-center text-center gap-4 py-6">
          {status === 'declined' && (
            <p className="text-sm text-[#7a6a7c]">
              {iAmChallenger ? `${partnerName} sat this one out.` : 'You declined that round.'}
            </p>
          )}
          {status === 'cancelled' && <p className="text-sm text-[#7a6a7c]">That challenge was called off.</p>}
          <p className="text-sm text-[#7a6a7c] max-w-xs">
            Whoever flies furthest picks what you two do for your next date.
          </p>
          <button
            type="button"
            onClick={startChallenge}
            className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-plumdeep hover:opacity-90 transition-opacity"
            style={{ background: 'linear-gradient(135deg, #e07a52, #d9a441)' }}
          >
            <FiSend size={14} />
            Challenge {partnerName}
          </button>
        </div>
      )
    }

    if (status === 'pending') {
      if (iAmChallenger) {
        return (
          <div className="flex flex-col items-center text-center gap-3 py-10">
            <p className="font-serif italic text-xl text-plumdeep">Waiting on {partnerName}...</p>
            <p className="text-sm text-[#7a6a7c]">They'll get a nudge to accept your challenge.</p>
            <button
              type="button"
              onClick={cancelChallenge}
              className="flex items-center gap-1.5 text-sm font-semibold text-[#9a8a9c] hover:text-plumdeep transition-colors mt-1"
            >
              <FiX size={14} />
              Cancel challenge
            </button>
          </div>
        )
      }
      return (
        <div className="flex flex-col items-center text-center gap-3 py-8 px-4">
          <FiFeather className="text-peach" size={22} />
          <p className="font-serif italic text-xl text-plumdeep">
            {partnerName} challenged you to Flappy Date
          </p>
          <p className="text-sm text-[#7a6a7c] max-w-xs">
            One run each. Whoever scores higher picks what you do for your next date.
          </p>
          <div className="flex items-center gap-3 mt-1">
            <button
              type="button"
              onClick={() => respondToChallenge(true)}
              className="flex items-center gap-2 rounded-xl px-5 py-2.5 text-sm font-semibold text-plumdeep hover:opacity-90 transition-opacity"
              style={{ background: 'linear-gradient(135deg, #e07a52, #d9a441)' }}
            >
              <FiCheck size={14} />
              Accept
            </button>
            <button
              type="button"
              onClick={() => respondToChallenge(false)}
              className="flex items-center gap-2 border border-black/10 rounded-xl px-5 py-2.5 text-sm font-semibold hover:bg-black/[0.03] transition-colors"
            >
              <FiX size={14} />
              Decline
            </button>
          </div>
        </div>
      )
    }

    if (status === 'accepted') {
      const myScore = duel[myScoreField]
      if (myScore == null) {
        return (
          <div className="flex flex-col items-center gap-4">
            <p className="text-sm text-[#7a6a7c] text-center">Your turn — one shot, make it count.</p>
            <GameCanvas allowReplay={false} onGameOver={submitDuelScore} />
          </div>
        )
      }
      return (
        <div className="flex flex-col items-center text-center gap-3 py-10">
          <p className="font-serif italic text-xl text-plumdeep">Nice run — you scored {myScore}</p>
          <p className="text-sm text-[#7a6a7c]">Waiting for {partnerName} to take their turn...</p>
        </div>
      )
    }

    if (status === 'complete') {
      const isTie = duel.winnerId === null
      const amIWinner = duel.winnerId === myUid
      const myScore = duel[myScoreField]
      const partnerScore = iAmChallenger ? duel.opponentScore : duel.challengerScore

      return (
        <div className="flex flex-col items-center text-center gap-4 py-6 px-4">
          <div className="flex items-center gap-8">
            <div>
              <div className="text-2xl font-serif font-semibold text-plumdeep">{myScore}</div>
              <div className="text-[11px] uppercase tracking-wide text-[#9a8a9c] mt-1">You</div>
            </div>
            <div className="text-[#c9b9c9] text-sm">vs</div>
            <div>
              <div className="text-2xl font-serif font-semibold text-plumdeep">{partnerScore}</div>
              <div className="text-[11px] uppercase tracking-wide text-[#9a8a9c] mt-1">{partnerName}</div>
            </div>
          </div>

          {isTie ? (
            <p className="text-sm text-[#7a6a7c]">A tie — nobody has to choose this time.</p>
          ) : amIWinner ? (
            <div className="w-full max-w-sm flex flex-col items-center gap-3">
              <p className="flex items-center gap-1.5 text-sm font-semibold text-plumdeep">
                <FiAward size={16} className="text-peach" />
                You won — you pick the date
              </p>
              {duel.prize ? (
                <p className="text-sm text-[#7a6a7c]">
                  Locked in: <span className="font-semibold text-plumdeep">{duel.prize}</span>
                </p>
              ) : (
                <div className="flex items-center gap-2 w-full">
                  <input
                    value={prizeText}
                    onChange={(e) => setPrizeText(e.target.value)}
                    onKeyDown={(e) => e.key === 'Enter' && lockInPrize()}
                    placeholder="What are you two doing?"
                    className="flex-1 bg-black/[0.03] border border-black/10 rounded-xl px-3.5 py-2.5 text-sm text-plumdeep placeholder-[#b6a5b8] focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={lockInPrize}
                    className="rounded-xl px-4 py-2.5 text-sm font-semibold text-plumdeep hover:opacity-90 transition-opacity flex-shrink-0"
                    style={{ background: 'linear-gradient(135deg, #e07a52, #d9a441)' }}
                  >
                    Lock it in
                  </button>
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-[#7a6a7c]">
              {partnerName} won this round.{' '}
              {duel.prize ? (
                <>
                  Their pick: <span className="font-semibold text-plumdeep">{duel.prize}</span>
                </>
              ) : (
                "Waiting for them to decide what you're doing."
              )}
            </p>
          )}

          <button
            type="button"
            onClick={rematch}
            className="flex items-center gap-1.5 text-sm font-semibold text-[#9a8a9c] hover:text-plumdeep transition-colors mt-1"
          >
            <FiRefreshCw size={13} />
            Rematch
          </button>
        </div>
      )
    }

    return null
  }

  return (
    <div>
      <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-4 mb-6">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c] mb-1.5">
            just for the two of you
          </p>
          <h1 className="text-2xl sm:text-3xl font-semibold mb-1.5 flex items-center gap-2">
            <FiFeather className="text-peach" />
            Flappy Date
          </h1>
          <p className="text-sm text-[#7a6a7c] max-w-md">
            {uiMode === 'solo'
              ? 'Tap, click, or press space to flap.'
              : 'Winner picks what you do for your next date.'}
          </p>
        </div>

        <div className="flex items-center gap-4">
          <div className="text-right">
            <div className="text-[11px] font-semibold uppercase tracking-wide text-[#9a8a9c]">Best</div>
            <div className="text-2xl font-serif font-semibold text-plumdeep">{best}</div>
          </div>
          <div className="flex gap-1 bg-black/[0.04] rounded-xl p-1 w-fit h-fit">
            <TabButton active={uiMode === 'solo'} onClick={() => setUiMode('solo')}>
              Solo
            </TabButton>
            <TabButton active={uiMode === 'duel'} onClick={() => setUiMode('duel')}>
              Duel
              {duel?.status === 'pending' && duel.opponentId === myUid && (
                <span className="ml-1.5 inline-block w-1.5 h-1.5 rounded-full bg-[#e8635a] align-middle" />
              )}
            </TabButton>
          </div>
        </div>
      </div>

      <div className="bg-white border border-black/10 rounded-3xl p-4 sm:p-6 flex flex-col items-center">
        {uiMode === 'solo' ? (
          <GameCanvas allowReplay onGameOver={updateBest} />
        ) : (
          <div className="w-full">{renderDuel()}</div>
        )}

        <p className="text-center text-[11px] text-[#9a8a9c] uppercase tracking-wide mt-5">
          Private to you two · nothing is shared
        </p>
      </div>
    </div>
  )
}