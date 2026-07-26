import { useEffect, useState } from 'react'
import { addDoc, collection, onSnapshot } from 'firebase/firestore'
import { db } from '../firebase'
import { useAuth } from '../context/AuthContext'
import { useMemberNames } from '../hooks/useMemberNames'

export default function LoveJar() {
  const { firebaseUser, couple } = useAuth()
  const [notes, setNotes] = useState([])
  const names = useMemberNames(couple?.members)
  const [text, setText] = useState('')
  const [revealed, setRevealed] = useState(null)

  useEffect(() => {
    if (!couple?.id) return
    const unsub = onSnapshot(collection(db, 'couples', couple.id, 'jar'), (snap) =>
      setNotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })))
    )
    return unsub
  }, [couple?.id])

  async function addNote() {
    if (!text.trim()) return
    await addDoc(collection(db, 'couples', couple.id, 'jar'), {
      text: text.trim(),
      from: firebaseUser.uid,
      createdAt: new Date(),
    })
    setText('')
  }

  function openJar() {
    if (notes.length === 0) return
    setRevealed(notes[Math.floor(Math.random() * notes.length)])
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="text-2xl font-semibold mb-1">Love jar</h1>
        <p className="text-sm text-[#7a6a7c]">Drop in appreciation notes. Open the jar whenever you need a lift.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Add a note</h3>
          <textarea
            rows={3}
            className="w-full px-3.5 py-2.5 rounded-xl border border-black/10 text-sm"
            placeholder="Thank you for... / I loved when you... / I appreciate..."
            value={text}
            onChange={(e) => setText(e.target.value)}
          />
          <button
            onClick={addNote}
            className="w-full mt-3 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            Drop it in the jar
          </button>
        </div>

        <div className="bg-white border border-black/10 rounded-2xl p-5">
          <h3 className="font-semibold mb-3">Open the jar</h3>
          <div className="text-center py-6">
            {revealed ? (
              <>
                <div className="jar-note">"{revealed.text}"</div>
                <div className="text-sm text-[#9a8a9c] mt-2.5">— {names[revealed.from] || '...'}</div>
              </>
            ) : (
              <div className="text-sm text-[#9a8a9c]">
                {notes.length} note{notes.length === 1 ? '' : 's'} saved so far
              </div>
            )}
          </div>
          <button
            onClick={openJar}
            className="w-full py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep"
          >
            Open Love Jar ❤️
          </button>
        </div>
      </div>
    </div>
  )
}