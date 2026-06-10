import * as pdfjsLib from 'pdfjs-dist'

pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString()

/**
 * Renders one PDF page to a PNG data URL.
 * Uses high scale for floor plan detail (wall lines, door arcs, dimensions).
 * Caps at 4096px on longest side to avoid memory issues.
 * @param {File} file - A PDF File object
 * @param {{ pageNumber?: number, scale?: number }} options
 * @returns {Promise<{ imageData: string, pageCount: number, pageNumber: number }>}
 */
export async function renderPdfPageToImage(file, { pageNumber = 1, scale = 4 } = {}) {
  const arrayBuffer = await file.arrayBuffer()
  const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise
  const safePageNumber = Math.min(Math.max(pageNumber, 1), pdf.numPages)
  const page = await pdf.getPage(safePageNumber)

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

  return {
    imageData: canvas.toDataURL('image/png'),
    pageCount: pdf.numPages,
    pageNumber: safePageNumber,
  }
}

/**
 * Backward-compatible helper for callers that only need page 1 as an image.
 * @param {File} file
 * @param {number} scale
 * @returns {Promise<string>}
 */
export async function pdfToImage(file, scale = 4) {
  const { imageData } = await renderPdfPageToImage(file, { scale })
  return imageData
}

/**
 * Converts an image or PDF file into an image data URL.
 * @param {File} file
 * @param {{ pageNumber?: number, scale?: number }} options
 * @returns {Promise<{ imageData: string, isPdf: boolean, pageCount: number, pageNumber: number }>}
 */
export async function fileToImageData(file, options = {}) {
  if (file.type === 'application/pdf') {
    const result = await renderPdfPageToImage(file, options)
    return { ...result, isPdf: true }
  }

  return new Promise((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = (event) => {
      resolve({
        imageData: event.target.result,
        isPdf: false,
        pageCount: 1,
        pageNumber: 1,
      })
    }
    reader.onerror = () => reject(new Error('Could not read file'))
    reader.readAsDataURL(file)
  })
}
