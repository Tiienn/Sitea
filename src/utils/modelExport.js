import { GLTFExporter } from 'three/examples/jsm/exporters/GLTFExporter.js'
import { OBJExporter } from 'three/examples/jsm/exporters/OBJExporter.js'

/**
 * Export a Three.js scene to GLTF/GLB format
 * @param {THREE.Scene} scene - The scene to export
 * @param {Object} options - Export options
 * @param {boolean} options.binary - Export as GLB (binary) instead of GLTF
 * @param {string} options.filename - Custom filename
 * @returns {Promise<void>}
 */
export async function exportToGLTF(scene, options = {}) {
  const {
    binary = true,
    filename = 'land-design',
  } = options

  const exporter = new GLTFExporter()

  return new Promise((resolve, reject) => {
    exporter.parse(
      scene,
      (result) => {
        let blob
        let extension

        if (binary) {
          // GLB (binary)
          blob = new Blob([result], { type: 'application/octet-stream' })
          extension = 'glb'
        } else {
          // GLTF (JSON)
          const json = JSON.stringify(result, null, 2)
          blob = new Blob([json], { type: 'application/json' })
          extension = 'gltf'
        }

        downloadBlob(blob, `${filename}.${extension}`)
        resolve({ blob, filename: `${filename}.${extension}` })
      },
      (error) => {
        console.error('GLTF export error:', error)
        reject(error)
      },
      {
        binary,
        onlyVisible: true,
        includeCustomExtensions: false,
      }
    )
  })
}

/**
 * Export a Three.js scene to OBJ format
 * @param {THREE.Scene} scene - The scene to export
 * @param {Object} options - Export options
 * @param {string} options.filename - Custom filename
 * @returns {Promise<void>}
 */
export async function exportToOBJ(scene, options = {}) {
  const {
    filename = 'land-design',
  } = options

  const exporter = new OBJExporter()

  try {
    const result = exporter.parse(scene)
    const blob = new Blob([result], { type: 'text/plain' })
    downloadBlob(blob, `${filename}.obj`)
    return { blob, filename: `${filename}.obj` }
  } catch (error) {
    console.error('OBJ export error:', error)
    throw error
  }
}

/**
 * Export scene to specified format
 * @param {THREE.Scene} scene - The scene to export
 * @param {string} format - 'gltf', 'glb', or 'obj'
 * @param {Object} options - Export options
 */
export async function exportModel(scene, format = 'glb', options = {}) {
  if (!scene) {
    throw new Error('No scene provided for export')
  }

  const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19)
  const filename = options.filename || `land-design-${timestamp}`

  switch (format.toLowerCase()) {
    case 'gltf':
      return exportToGLTF(scene, { ...options, binary: false, filename })
    case 'glb':
      return exportToGLTF(scene, { ...options, binary: true, filename })
    case 'obj':
      return exportToOBJ(scene, { ...options, filename })
    default:
      throw new Error(`Unsupported export format: ${format}`)
  }
}

/**
 * Download a blob as a file
 * @param {Blob} blob - The blob to download
 * @param {string} filename - The filename
 */
function downloadBlob(blob, filename) {
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
 * Get info about export formats
 */
export const EXPORT_FORMATS = {
  glb: {
    id: 'glb',
    label: 'GLB',
    description: 'Binary GLTF - Best for most uses',
    extension: '.glb',
    mimeType: 'application/octet-stream',
  },
  gltf: {
    id: 'gltf',
    label: 'GLTF',
    description: 'JSON format - Editable',
    extension: '.gltf',
    mimeType: 'application/json',
  },
  obj: {
    id: 'obj',
    label: 'OBJ',
    description: 'Universal compatibility',
    extension: '.obj',
    mimeType: 'text/plain',
  },
}
