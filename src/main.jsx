import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import App from './App.jsx'
import { AuthProvider } from './context/AuthContext.jsx'
import { ThemeProvider } from './context/ThemeContext.jsx'
import { PinLockProvider } from './context/PinLockContext.jsx'
import './index.css'
import './styles/lively.css'

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <BrowserRouter>
      <ThemeProvider>
        <AuthProvider>
          <PinLockProvider>
            <App />
          </PinLockProvider>
        </AuthProvider>
      </ThemeProvider>
    </BrowserRouter>
  </React.StrictMode>
)

// Registers public/sw.js so the app is installable and the last-loaded
// screen is available offline. See public/sw.js for what it does and
// doesn't cover (no push notifications — that needs a backend).
//
// Only in the built/deployed site. During `npm run dev` a service worker
// would keep serving an old cached copy of the app, so code changes seem
// to "do nothing" — in dev we remove any worker left over from before.
if ('serviceWorker' in navigator) {
  if (import.meta.env.PROD) {
    window.addEventListener('load', () => {
      navigator.serviceWorker.register('/sw.js').catch(() => {})
    })
  } else {
    navigator.serviceWorker.getRegistrations().then((regs) => regs.forEach((r) => r.unregister()))
    if (window.caches) caches.keys().then((keys) => keys.forEach((k) => caches.delete(k)))
  }
}