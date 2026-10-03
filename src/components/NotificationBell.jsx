import { useCallback, useEffect, useRef, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { AnimatePresence, motion } from 'framer-motion'
import dayjs from 'dayjs'
import relativeTime from 'dayjs/plugin/relativeTime'
import {
  FiBell,
  FiCalendar,
  FiCheck,
  FiCheckSquare,
  FiCompass,
  FiFeather,
  FiHeart,
  FiImage,
  FiList,
  FiLock,
  FiMail,
  FiMapPin,
  FiMessageCircle,
  FiMessageSquare,
  FiMusic,
  FiSmile,
  FiTarget,
  FiX,
  FiZap,
} from 'react-icons/fi'
import { usePartner } from '../hooks/usePartner'
import { useAuth } from '../context/AuthContext'
import { enablePush, pushIsOn, pushSupported } from '../utils/push'
import { useBackgroundAlerts, useNotifications } from '../hooks/useNotifications'

dayjs.extend(relativeTime)

const TYPE_ICON = {
  message: [FiMessageCircle, '#7a8fb8'],
  nudge: [FiZap, '#d9a35a'],
  heart: [FiHeart, '#e8a87c'],
  checkin: [FiSmile, '#3fa37a'],
  jar: [FiMail, '#e8a87c'],
  memory: [FiImage, '#b07ab8'],
  task: [FiCheckSquare, '#3fa37a'],
  event: [FiCalendar, '#7a8fb8'],
  song: [FiMusic, '#b07ab8'],
  place: [FiMapPin, '#c0473c'],
  bucket: [FiList, '#d9a35a'],
  goal: [FiTarget, '#3fa37a'],
  idea: [FiCompass, '#e8a87c'],
  capsule: [FiLock, '#9a8a9c'],
  duel: [FiFeather, '#d9a35a'],
  question: [FiMessageSquare, '#e8a87c'],
}

const canNotify = () => typeof window !== 'undefined' && 'Notification' in window

// The bell in the Topbar: unread badge + a dropdown of what your partner has
// been up to. Opening it marks everything read (on all your devices).
export default function NotificationBell({ light }) {
  const navigate = useNavigate()
  const { partner } = usePartner()
  const partnerName = partner?.displayName || 'Your partner'
  const { items, unreadCount, seenAt, markAllSeen } = useNotifications()
  const [open, setOpen] = useState(false)
  const [dotsSince, setDotsSince] = useState(null) // unread dots stay while the panel is open
  const { firebaseUser, couple } = useAuth()
  const [permission, setPermission] = useState(canNotify() ? Notification.permission : 'unsupported')
  const [pushOn, setPushOn] = useState(pushIsOn())
  const [enabling, setEnabling] = useState(false)
  // iPhone/iPad only allow web alerts once the site is added to the Home Screen.
  const iosNeedsInstall =
    typeof navigator !== 'undefined' &&
    /iPhone|iPad/i.test(navigator.userAgent) &&
    !window.matchMedia?.('(display-mode: standalone)').matches
  const wrapRef = useRef(null)

  const go = useCallback(
    (n) => {
      setOpen(false)
      const [path, hash] = n.link.split('#')
      navigate(path)
      if (hash) setTimeout(() => document.getElementById(hash)?.scrollIntoView({ behavior: 'smooth', block: 'center' }), 350)
    },
    [navigate]
  )

  useBackgroundAlerts(items, partnerName, go)

  // Tapping a push alert while iLove is already open: the service worker
  // (public/push-sw.js) asks the open app to go to that page.
  useEffect(() => {
    if (!('serviceWorker' in navigator)) return undefined
    const onMsg = (e) => {
      if (e.data?.type !== 'ilove-open') return
      const u = new URL(e.data.url, window.location.origin)
      go({ link: `${u.pathname}${u.search}${u.hash}` })
    }
    navigator.serviceWorker.addEventListener('message', onMsg)
    return () => navigator.serviceWorker.removeEventListener('message', onMsg)
  }, [go])

  function toggle() {
    if (open) return setOpen(false)
    setDotsSince(seenAt)
    setOpen(true)
    if (unreadCount) markAllSeen()
  }

  // Close on outside click / Esc.
  useEffect(() => {
    if (!open) return undefined
    const onDown = (e) => {
      if (!wrapRef.current?.contains(e.target)) setOpen(false)
    }
    const onKey = (e) => e.key === 'Escape' && setOpen(false)
    document.addEventListener('pointerdown', onDown)
    document.addEventListener('keydown', onKey)
    return () => {
      document.removeEventListener('pointerdown', onDown)
      document.removeEventListener('keydown', onKey)
    }
  }, [open])

  async function enableAlerts() {
    setEnabling(true)
    try {
      const perm = Notification.permission === 'granted' ? 'granted' : await Notification.requestPermission()
      setPermission(perm)
      if (perm === 'granted') setPushOn(await enablePush(couple?.id, firebaseUser?.uid))
    } catch (e) {
      console.warn('Could not turn on push:', e?.message || e)
    } finally {
      setEnabling(false)
    }
  }

  const isUnread = (n) => !dotsSince || n.at > dotsSince
  const muted = light ? 'text-[#9a8a9c]' : 'text-[#c9b6cb]'

  return (
    <div ref={wrapRef} className="relative flex-shrink-0">
      <button
        onClick={toggle}
        aria-label={unreadCount ? `Notifications, ${unreadCount} new` : 'Notifications'}
        aria-expanded={open}
        className={`relative w-9 h-9 rounded-lg border flex items-center justify-center ${
          light ? 'border-black/10 text-plumdeep' : 'border-white/15 text-[#f3e6e8]'
        }`}
      >
        <motion.span
          key={unreadCount}
          animate={unreadCount ? { rotate: [0, -16, 14, -10, 6, 0] } : {}}
          transition={{ duration: 0.7 }}
          className="flex"
        >
          <FiBell size={16} />
        </motion.span>
        <AnimatePresence>
          {unreadCount > 0 && (
            <motion.span
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              exit={{ scale: 0 }}
              className={`absolute -top-1.5 -right-1.5 min-w-[18px] h-[18px] px-1 rounded-full bg-peach text-plumdeep text-[10px] font-bold flex items-center justify-center border-2 ${
                light ? 'border-white' : 'border-plumdeep'
              }`}
            >
              {unreadCount > 9 ? '9+' : unreadCount}
            </motion.span>
          )}
        </AnimatePresence>
      </button>

      <AnimatePresence>
        {open && (
          <motion.div
            data-lv-off
            role="dialog"
            aria-label="Notifications"
            initial={{ opacity: 0, y: -6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
            className={`fixed sm:absolute left-3 right-3 sm:left-auto sm:right-0 top-[68px] sm:top-[calc(100%+8px)] sm:w-[360px] z-50 rounded-2xl border shadow-xl overflow-hidden ${
              light ? 'bg-white border-black/10 text-plumdeep' : 'bg-plumdeep border-white/15 text-[#f3e6e8]'
            }`}
          >
            <div className={`flex items-center justify-between px-4 py-3 border-b ${light ? 'border-black/5' : 'border-white/10'}`}>
              <span className="font-semibold text-sm">Notifications</span>
              <button onClick={() => setOpen(false)} aria-label="Close" className={`p-1 rounded-md ${muted} hover:text-peach`}>
                <FiX size={15} />
              </button>
            </div>

            <div className="max-h-[60vh] overflow-y-auto">
              {items.length === 0 ? (
                <div className="px-6 py-10 text-center">
                  <div className="w-11 h-11 mx-auto mb-3 rounded-full bg-blush/70 text-peach flex items-center justify-center">
                    <FiBell size={18} />
                  </div>
                  <p className="text-sm font-medium">Nothing new from {partnerName} yet</p>
                  <p className={`text-xs mt-1 ${muted}`}>When they leave you something, it'll be waiting here.</p>
                </div>
              ) : (
                items.map((n, i) => {
                  const [Icon, color] = TYPE_ICON[n.type] || [FiBell, '#9a8a9c']
                  const unread = isUnread(n)
                  return (
                    <motion.button
                      key={n.id}
                      initial={{ opacity: 0, x: 6 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: Math.min(i, 8) * 0.025 }}
                      onClick={() => go(n)}
                      className={`w-full text-left flex gap-3 px-4 py-3 transition-colors ${
                        light ? 'hover:bg-black/[0.03]' : 'hover:bg-white/5'
                      } ${unread ? (light ? 'bg-blush/30' : 'bg-white/[0.04]') : ''}`}
                    >
                      <span
                        className="w-9 h-9 rounded-full flex items-center justify-center flex-shrink-0"
                        style={{ background: `${color}22`, color }}
                      >
                        <Icon size={15} />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block text-sm leading-snug">
                          <span className="font-semibold">{partnerName}</span> {n.action}
                        </span>
                        {n.detail && <span className={`block text-xs truncate mt-0.5 ${muted}`}>{n.detail}</span>}
                        <span className={`block text-[11px] mt-0.5 ${muted}`}>{dayjs(n.at).fromNow()}</span>
                      </span>
                      {unread && <span className="w-2 h-2 rounded-full bg-peach mt-2 flex-shrink-0" />}
                    </motion.button>
                  )
                })
              )}
            </div>

            {(permission !== 'unsupported' || iosNeedsInstall) && (
              <div className={`px-4 py-2.5 border-t text-xs ${light ? 'border-black/5' : 'border-white/10'} ${muted}`}>
                {iosNeedsInstall && permission === 'unsupported' ? (
                  <span>On iPhone, tap Share, then "Add to Home Screen", and open iLove from there to get alerts.</span>
                ) : permission === 'denied' ? (
                  <span>Alerts are blocked. Allow notifications for this site in your browser settings.</span>
                ) : permission === 'granted' && (pushOn || !pushSupported()) ? (
                  <span className="flex items-center gap-1.5">
                    <FiCheck size={12} className="text-[#3fa37a]" />
                    {pushOn ? 'Alerts on, even when iLove is closed' : 'Alerts on while iLove is open'}
                  </span>
                ) : (
                  <button
                    onClick={enableAlerts}
                    disabled={enabling}
                    className="font-semibold text-peach hover:underline disabled:opacity-60"
                  >
                    {enabling
                      ? 'Turning on…'
                      : permission === 'granted'
                      ? 'Get alerts even when iLove is closed'
                      : 'Turn on alerts on this device'}
                  </button>
                )}
              </div>
            )}
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  )
}
