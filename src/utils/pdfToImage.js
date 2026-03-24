import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

/**
 * Converts the first page of a PDF file to a PNG data URL.
 * Uses high scale for floor plan detail (wall lines, door arcs, dimensions).
 * Caps at 4096px on longest side to avoid memory issues.
 * @param {File} file - A PDF File object
 * @param {number} scale - Render scale (default 4 for floor plan detail)
 * @returns {Promise<string>} - PNG data URL
 */
export async function pdfToImage(file, scale = 4) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const page = await pdf.getPage(1)

  let viewport = page.getViewport({ scale })

  // Cap at 4096px on longest side to avoid memory issues
  const maxDim = 4096
  const longest = Math.max(viewport.width, viewport.height)
  if (longest > maxDim) {
    const cappedScale = scale * (maxDim / longest)
    viewport = page.getViewport({ scale: cappedScale })
  }

  const canvas = document.createElement('canvas')
  canvas.width = viewport.width
  canvas.height = viewport.height

  await page.render({
    canvasContext: canvas.getContext('2d'),
    viewport,
  }).promise

  return canvas.toDataURL('image/png')
}
