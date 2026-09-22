import { useRef, useState } from 'react'
import { Navigate, Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import ProtectedRoute from './components/ProtectedRoute'
import IconRail from './components/IconRail'
import Sidebar from './components/Sidebar'
import Topbar from './components/Topbar'
import BottomNav from './components/BottomNav'
import FloatingActionButton from './components/FloatingActionButton'
import PageTransition from './components/PageTransition'
import ConnectionView from './components/ConnectionView'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import LinkPartner from './pages/LinkPartner'
import Dashboard from './pages/Dashboard'
import Insights from './pages/Insights'
import CheckIns from './pages/CheckIns'
import Chat from './pages/Chat'
import Tasks from './pages/Tasks'
import CalendarPage from './pages/CalendarPage'
import MemoriesHub from './pages/MemoriesHub'
import Goals from './pages/Goals'
import BucketList from './pages/BucketList'
import Achievements from './pages/Achievements'
import DateIdeas from './pages/DateIdeas'
import SharedPlaces from './pages/SharedPlaces'
import SharedPlaylist from './pages/SharedPlaylist'
import SharedSavings from './pages/SharedSavings'
import ConflictRecovery from './pages/ConflictRecovery'
import FlappyBird from './pages/FlappyBird'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import { useLocalReminders } from './hooks/useLocalReminders'
import { usePushSubscription } from './hooks/usePushSubscription'

function AppLayout({ children }) {
  // Fires browser notifications for upcoming calendar reminders while the
  // app is open, on whichever page the person happens to be on.
  useLocalReminders()
  usePushSubscription()
  const { pathname } = useLocation()

  // The connection view (you & partner, side by side) is reachable from
  // every page: tap the couple cluster / heart icon in the Topbar, or
  // swipe left anywhere in the main content area. It renders as a
  // full-screen overlay above whatever page is open, and closes back to
  // that same page — it's a layer, not a route.
  const [connectionOpen, setConnectionOpen] = useState(false)
  const touchXRef = useRef(null)
  const touchYRef = useRef(null)

  function onContentTouchStart(e) {
    touchXRef.current = e.touches[0].clientX
    touchYRef.current = e.touches[0].clientY
  }
  function onContentTouchEnd(e) {
    if (touchXRef.current == null) return
    const dx = e.changedTouches[0].clientX - touchXRef.current
    const dy = e.changedTouches[0].clientY - (touchYRef.current ?? 0)
    touchXRef.current = null
    touchYRef.current = null
    if (dx < -70 && Math.abs(dx) > Math.abs(dy) * 1.5) setConnectionOpen(true)
  }

  return (
    <div className="flex flex-col lg:flex-row min-h-screen lg:h-screen lg:overflow-hidden">
      <IconRail />
      <Sidebar />
      <div className="flex-1 flex flex-col min-w-0 min-h-0">
        <Topbar onOpenConnection={() => setConnectionOpen(true)} />
        <div
          className="flex-1 p-4 sm:p-6 lg:p-9 pb-24 lg:pb-9 max-w-full lg:max-w-[900px] xl:max-w-[1200px] overflow-y-auto"
          onTouchStart={onContentTouchStart}
          onTouchEnd={onContentTouchEnd}
        >
          <PageTransition>{children}</PageTransition>
        </div>
      </div>
      {!pathname.startsWith('/chat') && <FloatingActionButton />}
      <BottomNav />
      <ConnectionView open={connectionOpen} onClose={() => setConnectionOpen(false)} />
    </div>
  )
}

export default function App() {
  const location = useLocation()

  return (
    <>
      <Toaster
        position="top-center"
        toastOptions={{
          duration: 3200,
          style: {
            background: '#3d2340',
            color: '#f3e6e8',
            fontSize: '13.5px',
            borderRadius: '12px',
            padding: '10px 14px',
          },
          success: { iconTheme: { primary: '#e8b978', secondary: '#3d2340' } },
          error: { iconTheme: { primary: '#d97a6a', secondary: '#3d2340' } },
        }}
      />
      <AnimatePresence mode="wait">
      <Routes location={location} key={location.pathname}>
      <Route path="/" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/signup" element={<Signup />} />
      <Route
        path="/link"
        element={
          <ProtectedRoute requireCouple={false}>
            <LinkPartner />
          </ProtectedRoute>
        }
      />
      <Route
        path="/dashboard"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Dashboard />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/insights"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Insights />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/checkins"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CheckIns />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/journal" element={<Navigate to="/memories?tab=journal" replace />} />
      <Route
        path="/chat"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Chat />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/tasks"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Tasks />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/calendar"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CalendarPage />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/jar" element={<Navigate to="/memories?tab=jar" replace />} />
      <Route
        path="/memories"
        element={
          <ProtectedRoute>
            <AppLayout>
              <MemoriesHub />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/goals"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Goals />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/bucket-list"
        element={
          <ProtectedRoute>
            <AppLayout>
              <BucketList />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/achievements"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Achievements />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route path="/time-capsule" element={<Navigate to="/memories?tab=capsule" replace />} />
      <Route
        path="/date-ideas"
        element={
          <ProtectedRoute>
            <AppLayout>
              <DateIdeas />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/places"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SharedPlaces />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/playlist"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SharedPlaylist />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/savings"
        element={
          <ProtectedRoute>
            <AppLayout>
              <SharedSavings />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/conflict"
        element={
          <ProtectedRoute>
            <AppLayout>
              <ConflictRecovery />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/play"
        element={
          <ProtectedRoute>
            <AppLayout>
              <FlappyBird />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/profile"
        element={
          <ProtectedRoute requireCouple="any">
            <AppLayout>
              <Profile />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/settings"
        element={
          <ProtectedRoute requireCouple="any">
            <AppLayout>
              <Settings />
            </AppLayout>
          </ProtectedRoute>
        }
      />
    </Routes>
      </AnimatePresence>
    </>
  )
}