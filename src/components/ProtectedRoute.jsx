import { Navigate } from 'react-router-dom'
import { useAuth } from '../context/AuthContext'

// requireCouple: true = must already be linked to a partner (most pages)
//                false = must NOT be linked yet (only the LinkPartner page itself)
//                'any' = no couple requirement either way (Profile, Settings)
export default function ProtectedRoute({ children, requireCouple = true }) {
  const { firebaseUser, profile, loading, authError } = useAuth()

  if (authError) {
    return (
      <div className="min-h-screen flex items-center justify-center p-6">
        <div className="max-w-md text-center">
          <div className="text-2xl mb-2">Something went wrong</div>
          <div className="text-sm text-[#9b3b3b] bg-[#fbe4e4] rounded-lg px-4 py-3 mb-3">
            {authError}
          </div>
          <div className="text-sm text-[#7a6a7c]">
            This is usually a Firestore setup issue — check that Firestore is created and
            the security rules are deployed, then refresh.
          </div>
        </div>
      </div>
    )
  }
  if (loading || firebaseUser === undefined) {
    return <div className="min-h-screen flex items-center justify-center text-plum">Loading…</div>
  }
  if (!firebaseUser) return <Navigate to="/login" replace />
  if (!profile) {
    return <div className="min-h-screen flex items-center justify-center text-plum">Setting things up…</div>
  }
  if (requireCouple === true && !profile.coupleId) return <Navigate to="/link" replace />
  if (requireCouple === false && profile.coupleId) return <Navigate to="/" replace />

  return children
}