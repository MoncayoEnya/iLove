import { Route, Routes, useLocation } from 'react-router-dom'
import { AnimatePresence } from 'framer-motion'
import { Toaster } from 'react-hot-toast'
import ProtectedRoute from './components/ProtectedRoute'
import Sidebar from './components/Sidebar'
import BottomNav from './components/BottomNav'
import PageTransition from './components/PageTransition'
import Landing from './pages/Landing'
import Login from './pages/Login'
import Signup from './pages/Signup'
import LinkPartner from './pages/LinkPartner'
import Dashboard from './pages/Dashboard'
import CheckIns from './pages/CheckIns'
import Chat from './pages/Chat'
import Tasks from './pages/Tasks'
import CalendarPage from './pages/CalendarPage'
import LoveJar from './pages/LoveJar'
import Memories from './pages/Memories'
import Goals from './pages/Goals'
import Profile from './pages/Profile'
import Settings from './pages/Settings'
import { useLocalReminders } from './hooks/useLocalReminders'

function AppLayout({ children }) {
  // Fires browser notifications for upcoming calendar reminders while the
  // app is open, on whichever page the person happens to be on.
  useLocalReminders()

  return (
    <div className="flex flex-col md:flex-row min-h-screen">
      <Sidebar />
      <div className="flex-1 p-4 sm:p-6 md:p-9 pb-24 md:pb-9 max-w-full md:max-w-[980px] overflow-y-auto">
        <PageTransition>{children}</PageTransition>
      </div>
      <BottomNav />
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
        path="/checkins"
        element={
          <ProtectedRoute>
            <AppLayout>
              <CheckIns />
            </AppLayout>
          </ProtectedRoute>
        }
      />
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
      <Route
        path="/jar"
        element={
          <ProtectedRoute>
            <AppLayout>
              <LoveJar />
            </AppLayout>
          </ProtectedRoute>
        }
      />
      <Route
        path="/memories"
        element={
          <ProtectedRoute>
            <AppLayout>
              <Memories />
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