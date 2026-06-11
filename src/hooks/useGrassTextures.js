import { useMemo } from 'react'
import * as THREE from 'three'
import { QUALITY, QUALITY_SETTINGS } from '../constants/landSceneConstants'

// Create stylized hand-painted grass texture with macro variation
export function useGrassTextures(quality = QUALITY.BEST) {
  return useMemo(() => {
    const settings = QUALITY_SETTINGS[quality]

    // Main grass color texture (detail) — dense fine blades, like real turf
    const SIZE = 1024
    const detailCanvas = document.createElement('canvas')
    detailCanvas.width = SIZE
    detailCanvas.height = SIZE
    const detailCtx = detailCanvas.getContext('2d')

    // Meadow base with a soft vertical tone drift
    detailCtx.fillStyle = '#5d8248'
    detailCtx.fillRect(0, 0, SIZE, SIZE)

    // Very soft, sparse hue variation (subtle — no blotches)
    const patchHues = [
      { color: '125, 158, 88', count: 10, rMin: 90, rMax: 220, aMax: 0.12 },
      { color: '64, 102, 56', count: 12, rMin: 80, rMax: 200, aMax: 0.14 },
    ]
    for (const hue of patchHues) {
      for (let i = 0; i < hue.count; i++) {
        const x = Math.random() * SIZE
        const y = Math.random() * SIZE
        const radius = hue.rMin + Math.random() * (hue.rMax - hue.rMin)
        const gradient = detailCtx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, `rgba(${hue.color}, ${hue.aMax})`)
        gradient.addColorStop(1, `rgba(${hue.color}, 0)`)
        detailCtx.fillStyle = gradient
        detailCtx.beginPath()
        detailCtx.arc(x, y, radius, 0, Math.PI * 2)
        detailCtx.fill()
      }
    }

    // Dense fine blade pass — this is what makes it read as grass
    for (let i = 0; i < 15000; i++) {
      const x = Math.random() * SIZE
      const y = Math.random() * SIZE
      const length = Math.random() * 9 + 5
      const lean = (Math.random() - 0.5) * 6
      // tone distribution: mostly mid greens, some dark shadow blades, few bright
      const pick = Math.random()
      let r, g, b
      if (pick < 0.30) { g = 95 + Math.random() * 30; r = g * 0.58; b = g * 0.50 }       // shadow
      else if (pick < 0.85) { g = 135 + Math.random() * 35; r = g * 0.62; b = g * 0.46 }  // mid
      else { g = 180 + Math.random() * 30; r = g * 0.70; b = g * 0.46 }                   // lit
      detailCtx.strokeStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, 0.55)`
      detailCtx.lineWidth = Math.random() * 1.2 + 0.5
      detailCtx.beginPath()
      detailCtx.moveTo(x, y)
      detailCtx.quadraticCurveTo(x + lean * 0.5, y - length * 0.6, x + lean, y - length)
      detailCtx.stroke()
    }

    const detailTexture = new THREE.CanvasTexture(detailCanvas)
    detailTexture.colorSpace = THREE.SRGBColorSpace
    detailTexture.wrapS = THREE.RepeatWrapping
    detailTexture.wrapT = THREE.RepeatWrapping
    detailTexture.anisotropy = 4
    detailTexture.repeat.set(50, 50)

    // Macro variation texture — multiplied over the tiled detail map in the
    // ground shader at a much larger scale to break visible tiling.
    // Values hover around neutral gray (128 ≙ 1.0 after the shader's ×2).
    const macroCanvas = document.createElement('canvas')
    macroCanvas.width = 256
    macroCanvas.height = 256
    const macroCtx = macroCanvas.getContext('2d')

    // Neutral base
    macroCtx.fillStyle = 'rgb(128, 128, 128)'
    macroCtx.fillRect(0, 0, 256, 256)

    // Large organic patches — gentle brightness drift with subtle warm/cool tint
    for (let i = 0; i < 22; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 256
      const radius = Math.random() * 90 + 50
      const v = 112 + Math.random() * 32
      const warm = Math.random() > 0.5
      const r = warm ? v * 1.05 : v * 0.96
      const b = warm ? v * 0.95 : v * 1.03
      const gradient = macroCtx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, `rgba(${r | 0}, ${v | 0}, ${b | 0}, 0.6)`)
      gradient.addColorStop(1, 'rgba(128, 128, 128, 0)')
      macroCtx.fillStyle = gradient
      macroCtx.beginPath()
      macroCtx.arc(x, y, radius, 0, Math.PI * 2)
      macroCtx.fill()
    }

    const macroTexture = new THREE.CanvasTexture(macroCanvas)
    macroTexture.wrapS = THREE.RepeatWrapping
    macroTexture.wrapT = THREE.RepeatWrapping
    macroTexture.repeat.set(8, 8)

    // Roughness map (subtle variation)
    const roughCanvas = document.createElement('canvas')
    roughCanvas.width = 256
    roughCanvas.height = 256
    const roughCtx = roughCanvas.getContext('2d')

    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const noise = Math.random() * 40 + 180
        roughCtx.fillStyle = `rgb(${noise}, ${noise}, ${noise})`
        roughCtx.fillRect(x, y, 1, 1)
      }
    }

    const roughnessTexture = new THREE.CanvasTexture(roughCanvas)
    roughnessTexture.wrapS = THREE.RepeatWrapping
    roughnessTexture.wrapT = THREE.RepeatWrapping
    roughnessTexture.repeat.set(60, 60)

    return { detailTexture, macroTexture, roughnessTexture }
  }, [quality])
}

// Dirt/earth texture for land plot (construction site feel)
export function useLandTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')

    // Base green color matching original #4a7c59 with variation
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const noise = (Math.random() - 0.5) * 25
        const r = Math.min(255, Math.max(0, 74 + noise * 0.4))
        const g = Math.min(255, Math.max(0, 124 + noise))
        const b = Math.min(255, Math.max(0, 89 + noise * 0.5))
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(x, y, 1, 1)
      }
    }

    // Darker patches
    for (let i = 0; i < 60; i++) {
      const x = Math.random() * 512
      const y = Math.random() * 512
      const radius = Math.random() * 40 + 15
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, 'rgba(40, 80, 45, 0.3)')
      gradient.addColorStop(1, 'rgba(40, 80, 45, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // Lighter patches
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * 512
      const y = Math.random() * 512
      const radius = Math.random() * 35 + 10
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, 'rgba(100, 160, 100, 0.25)')
      gradient.addColorStop(1, 'rgba(100, 160, 100, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(8, 8)
    return texture
  }, [])
}

// Simple grass texture for low quality — same fine-blade look as BEST,
// at lower resolution and stroke count
export function useSimpleGrassTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#5d8248'
    ctx.fillRect(0, 0, 512, 512)

    for (let i = 0; i < 5000; i++) {
      const x = Math.random() * 512
      const y = Math.random() * 512
      const length = Math.random() * 7 + 4
      const lean = (Math.random() - 0.5) * 5
      const pick = Math.random()
      let r, g, b
      if (pick < 0.30) { g = 95 + Math.random() * 30; r = g * 0.58; b = g * 0.50 }
      else if (pick < 0.85) { g = 135 + Math.random() * 35; r = g * 0.62; b = g * 0.46 }
      else { g = 180 + Math.random() * 30; r = g * 0.70; b = g * 0.46 }
      ctx.strokeStyle = `rgba(${r | 0}, ${g | 0}, ${b | 0}, 0.5)`
      ctx.lineWidth = Math.random() * 1.1 + 0.5
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + lean * 0.5, y - length * 0.6, x + lean, y - length)
      ctx.stroke()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(60, 60)
    return texture
  }, [])
}
