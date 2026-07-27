// Takes an object URL and a react-easy-crop `croppedAreaPixels` rect and
// returns a new File containing just that cropped region, as a JPEG.
export function getCroppedImageFile(imageSrc, cropPixels, fileName = 'cropped.jpg') {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onerror = () => reject(new Error("Couldn't load that image for cropping."))
    img.onload = () => {
      const canvas = document.createElement('canvas')
      canvas.width = cropPixels.width
      canvas.height = cropPixels.height
      const ctx = canvas.getContext('2d')

      ctx.drawImage(
        img,
        cropPixels.x,
        cropPixels.y,
        cropPixels.width,
        cropPixels.height,
        0,
        0,
        cropPixels.width,
        cropPixels.height
      )

      canvas.toBlob(
        (blob) => {
          if (!blob) {
            reject(new Error('Cropping failed — try again.'))
            return
          }
          resolve(new File([blob], fileName, { type: 'image/jpeg' }))
        },
        'image/jpeg',
        0.92
      )
    }
    img.src = imageSrc
  })
}
