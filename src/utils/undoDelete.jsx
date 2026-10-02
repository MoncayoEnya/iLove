import toast from 'react-hot-toast'
import { deleteDoc, setDoc } from 'firebase/firestore'
import { haptic } from './haptics'
import { FiTrash2 } from 'react-icons/fi'

// Delete now, offer "Undo" for a few seconds. Undo writes the exact same
// document back under the same id, so anything that pointed at it (links,
// pins, reactions) keeps working.
//
//   await undoableDelete(doc(db, 'couples', id, 'tasks', task.id), task, 'Task deleted')
//
// `data` is the item as the page already holds it; its `id` field (added
// by the page when reading the snapshot) is stripped before restoring.
export async function undoableDelete(ref, data, label = 'Deleted') {
  const { id: _ignored, ...restore } = data || {}
  await deleteDoc(ref)
  haptic('medium')

  toast(
    (t) => (
      <span className="flex items-center gap-3">
        <span>{label}</span>
        <button
          onClick={async () => {
            toast.dismiss(t.id)
            try {
              await setDoc(ref, restore)
              haptic('light')
              toast.success('Restored')
            } catch {
              toast.error("Couldn't restore it — sorry.")
            }
          }}
          className="font-semibold text-[#e8b978] underline underline-offset-2"
        >
          Undo
        </button>
      </span>
    ),
    { duration: 5000, icon: <FiTrash2 className="text-[#e8b978]" /> }
  )
}