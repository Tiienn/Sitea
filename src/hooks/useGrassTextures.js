import { useMemo } from 'react'
import * as THREE from 'three'
import { QUALITY, QUALITY_SETTINGS } from '../constants/landSceneConstants'

// Create stylized hand-painted grass texture with macro variation
export function useGrassTextures(quality = QUALITY.BEST) {
  return useMemo(() => {
    const settings = QUALITY_SETTINGS[quality]

    // Main grass color texture (detail) — painterly meadow, not noise
    const detailCanvas = document.createElement('canvas')
    detailCanvas.width = 512
    detailCanvas.height = 512
    const detailCtx = detailCanvas.getContext('2d')

    // Saturated meadow base
    detailCtx.fillStyle = '#57a23c'
    detailCtx.fillRect(0, 0, 512, 512)

    // Soft hue patches: warm sunlit yellow-greens, deep cool greens, subtle teal shade
    const patchHues = [
      { color: '168, 205, 82', count: 26, rMin: 30, rMax: 90, aMax: 0.30 },  // sunlit
      { color: '52, 128, 50', count: 30, rMin: 25, rMax: 80, aMax: 0.35 },   // deep green
      { color: '46, 118, 88', count: 14, rMin: 35, rMax: 95, aMax: 0.22 },   // cool teal shade
      { color: '142, 186, 60', count: 18, rMin: 20, rMax: 60, aMax: 0.28 },  // fresh green
    ]
    for (const hue of patchHues) {
      for (let i = 0; i < hue.count; i++) {
        const x = Math.random() * 512
        const y = Math.random() * 512
        const radius = hue.rMin + Math.random() * (hue.rMax - hue.rMin)
        const alpha = hue.aMax * (0.5 + Math.random() * 0.5)
        const gradient = detailCtx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, `rgba(${hue.color}, ${alpha})`)
        gradient.addColorStop(1, `rgba(${hue.color}, 0)`)
        detailCtx.fillStyle = gradient
        detailCtx.beginPath()
        detailCtx.arc(x, y, radius, 0, Math.PI * 2)
        detailCtx.fill()
      }
    }

    // Painterly blade strokes — clustered tufts, light and dark tones
    for (let c = 0; c < 220; c++) {
      const cx = Math.random() * 512
      const cy = Math.random() * 512
      const tuftSize = 6 + Math.random() * 10
      const light = Math.random() > 0.45
      for (let i = 0; i < 12; i++) {
        const x = cx + (Math.random() - 0.5) * tuftSize * 2
        const y = cy + (Math.random() - 0.5) * tuftSize
        const length = Math.random() * 9 + 5
        const lean = (Math.random() - 0.5) * 5
        if (light) {
          const g = 185 + Math.random() * 40
          detailCtx.strokeStyle = `rgba(${g * 0.62}, ${g}, ${g * 0.34}, 0.35)`
        } else {
          const g = 95 + Math.random() * 35
          detailCtx.strokeStyle = `rgba(${g * 0.42}, ${g}, ${g * 0.40}, 0.40)`
        }
        detailCtx.lineWidth = Math.random() * 1.4 + 0.6
        detailCtx.beginPath()
        detailCtx.moveTo(x, y)
        detailCtx.quadraticCurveTo(x + lean * 0.5, y - length * 0.6, x + lean, y - length)
        detailCtx.stroke()
      }
    }

    const detailTexture = new THREE.CanvasTexture(detailCanvas)
    detailTexture.colorSpace = THREE.SRGBColorSpace
    detailTexture.wrapS = THREE.RepeatWrapping
    detailTexture.wrapT = THREE.RepeatWrapping
    detailTexture.repeat.set(60, 60)

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

    // Large organic patches for variety — brightness and subtle warm/cool tint
    for (let i = 0; i < 26; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 256
      const radius = Math.random() * 80 + 40
      const v = 100 + Math.random() * 56
      const warm = Math.random() > 0.5
      const r = warm ? v * 1.08 : v * 0.94
      const b = warm ? v * 0.92 : v * 1.04
      const gradient = macroCtx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, `rgba(${r | 0}, ${v | 0}, ${b | 0}, 0.85)`)
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

// Simple stylized grass texture for low quality — same palette as the
// painted BEST texture, but cheap (soft patches only, no stroke pass)
export function useSimpleGrassTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')

    ctx.fillStyle = '#57a23c'
    ctx.fillRect(0, 0, 256, 256)

    const hues = [
      { color: '168, 205, 82', count: 14, aMax: 0.25 },
      { color: '52, 128, 50', count: 16, aMax: 0.30 },
      { color: '142, 186, 60', count: 10, aMax: 0.22 },
    ]
    for (const hue of hues) {
      for (let i = 0; i < hue.count; i++) {
        const x = Math.random() * 256
        const y = Math.random() * 256
        const radius = 15 + Math.random() * 45
        const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
        gradient.addColorStop(0, `rgba(${hue.color}, ${hue.aMax})`)
        gradient.addColorStop(1, `rgba(${hue.color}, 0)`)
        ctx.fillStyle = gradient
        ctx.beginPath()
        ctx.arc(x, y, radius, 0, Math.PI * 2)
        ctx.fill()
      }
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.colorSpace = THREE.SRGBColorSpace
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(80, 80)
    return texture
  }, [])
}
