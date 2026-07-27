import { useCallback, useState } from 'react'
import Cropper from 'react-easy-crop'
import { FiCheck, FiX } from 'react-icons/fi'
import { getCroppedImageFile } from '../utils/cropImage'

/**
 * Full-screen crop dialog. Renders nothing until `imageSrc` is set.
 * Calls onCancel() to dismiss, or onCropped(file) with the cropped result.
 */
export default function CropModal({ imageSrc, aspect = 1, onCancel, onCropped }) {
  const [crop, setCrop] = useState({ x: 0, y: 0 })
  const [zoom, setZoom] = useState(1)
  const [croppedAreaPixels, setCroppedAreaPixels] = useState(null)
  const [working, setWorking] = useState(false)

  const onCropComplete = useCallback((_, pixels) => setCroppedAreaPixels(pixels), [])

  if (!imageSrc) return null

  async function confirm() {
    if (!croppedAreaPixels) return
    setWorking(true)
    try {
      const file = await getCroppedImageFile(imageSrc, croppedAreaPixels)
      onCropped(file)
    } finally {
      setWorking(false)
    }
  }

  return (
    <div className="fixed inset-0 bg-black/70 z-[60] flex items-center justify-center p-4">
      <div className="bg-white rounded-2xl overflow-hidden w-full max-w-md flex flex-col">
        <div className="relative h-80 bg-black">
          <Cropper
            image={imageSrc}
            crop={crop}
            zoom={zoom}
            aspect={aspect}
            cropShape={aspect === 1 ? 'round' : 'rect'}
            showGrid={aspect !== 1}
            onCropChange={setCrop}
            onZoomChange={setZoom}
            onCropComplete={onCropComplete}
          />
        </div>
        <div className="p-5">
          <label className="block text-xs font-semibold text-[#7a6a7c] mb-2">Zoom</label>
          <input
            type="range"
            min={1}
            max={3}
            step={0.05}
            value={zoom}
            onChange={(e) => setZoom(Number(e.target.value))}
            className="w-full accent-peach"
          />
          <div className="flex gap-2 mt-4">
            <button
              onClick={confirm}
              disabled={working}
              className="flex-1 flex items-center justify-center gap-1.5 py-2.5 rounded-xl font-semibold text-sm bg-gradient-to-br from-peach to-gold text-plumdeep disabled:opacity-60"
            >
              <FiCheck size={15} /> {working ? 'Cropping…' : 'Use this photo'}
            </button>
            <button
              onClick={onCancel}
              disabled={working}
              className="flex items-center justify-center gap-1.5 py-2.5 px-4 rounded-xl text-sm border border-black/10"
            >
              <FiX size={15} /> Cancel
            </button>
          </div>
        </div>
      </div>
    </div>
  )
}
