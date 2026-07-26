// Resizes + compresses an image File into a base64 data URL small enough
// to store directly on a Firestore message doc (no Cloud Storage needed,
// so this works on the free Spark plan).
export function compressImage(
  file,
  { maxWidth = 900, maxHeight = 900, quality = 0.7, maxBytes = 700_000 } = {}
) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onerror = () => reject(new Error('Could not read that file.'))
    reader.onload = () => {
      const img = new Image()
      img.onerror = () => reject(new Error("That doesn't look like a valid image."))
      img.onload = () => {
        let { width, height } = img
        if (width > maxWidth || height > maxHeight) {
          const ratio = Math.min(maxWidth / width, maxHeight / height)
          width = Math.round(width * ratio)
          height = Math.round(height * ratio)
        }

        const canvas = document.createElement('canvas')
        canvas.width = width
        canvas.height = height
        const ctx = canvas.getContext('2d')
        ctx.drawImage(img, 0, 0, width, height)

        // Step quality down until it fits, or give up gracefully.
        let q = quality
        let dataUrl = canvas.toDataURL('image/jpeg', q)
        while (dataUrl.length > maxBytes && q > 0.3) {
          q -= 0.1
          dataUrl = canvas.toDataURL('image/jpeg', q)
        }

        if (dataUrl.length > maxBytes) {
          reject(new Error('That image is too large even after compression — try a smaller photo.'))
          return
        }
        resolve(dataUrl)
      }
      img.src = reader.result
    }
    reader.readAsDataURL(file)
  })
}