/**
 * Capture a screenshot from a canvas element
 * @param {HTMLCanvasElement} canvas - The canvas to capture
 * @param {Object} options - Capture options
 * @param {string} options.format - 'png' or 'jpeg'
 * @param {number} options.quality - JPEG quality (0-1), ignored for PNG
 * @param {number} options.scale - Scale factor for higher resolution (1-4)
 * @returns {Promise<Blob>} The image blob
 */
export async function captureScreenshot(canvas, options = {}) {
  const {
    format = 'png',
    quality = 0.92,
    scale = 1,
  } = options

  if (!canvas) {
    throw new Error('No canvas provided')
  }

  // For higher resolution, we need to create a scaled copy
  if (scale > 1) {
    const scaledCanvas = document.createElement('canvas')
    const ctx = scaledCanvas.getContext('2d')

    scaledCanvas.width = canvas.width * scale
    scaledCanvas.height = canvas.height * scale

    // Draw the original canvas scaled up
    ctx.imageSmoothingEnabled = true
    ctx.imageSmoothingQuality = 'high'
    ctx.drawImage(canvas, 0, 0, scaledCanvas.width, scaledCanvas.height)

    canvas = scaledCanvas
  }

  const mimeType = format === 'jpeg' ? 'image/jpeg' : 'image/png'

  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => {
        if (blob) {
          resolve(blob)
        } else {
          reject(new Error('Failed to create blob from canvas'))
        }
      },
      mimeType,
      format === 'jpeg' ? quality : undefined
    )
  })
}

/**
 * Download a blob as a file
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename
 */
export function downloadBlob(blob, filename) {
  const url = URL.createObjectURL(blob)
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  document.body.appendChild(link)
  link.click()
  document.body.removeChild(link)
  URL.revokeObjectURL(url)
}

/**
 * Generate a timestamp-based filename
 * @param {string} prefix - Filename prefix
 * @param {string} extension - File extension
 * @returns {string} The filename
 */
export function generateFilename(prefix = 'screenshot', extension = 'png') {
  const now = new Date()
  const timestamp = now.toISOString().replace(/[:.]/g, '-').slice(0, 19)
  return `${prefix}-${timestamp}.${extension}`
}

/**
 * Capture and download a screenshot from a canvas
 * @param {HTMLCanvasElement} canvas - The canvas to capture
 * @param {Object} options - Capture and download options
 */
export async function captureAndDownload(canvas, options = {}) {
  const {
    format = 'png',
    quality = 0.92,
    scale = 1,
    filename,
  } = options

  const blob = await captureScreenshot(canvas, { format, quality, scale })
  const finalFilename = filename || generateFilename('land-view', format)
  downloadBlob(blob, finalFilename)

  return { blob, filename: finalFilename }
}
