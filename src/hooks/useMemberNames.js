import { useEffect, useState } from 'react'
import { doc, getDoc } from 'firebase/firestore'
import { db } from '../firebase'

// Returns a map of { uid: displayName } for the given list of uids
export function useMemberNames(uids) {
  const [names, setNames] = useState({})

  useEffect(() => {
    ;(uids || []).forEach(async (uid) => {
      if (!uid || names[uid]) return
      const snap = await getDoc(doc(db, 'users', uid))
      if (snap.exists()) setNames((n) => ({ ...n, [uid]: snap.data().displayName }))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [JSON.stringify(uids)])

  return names
}
