import { useMemo } from 'react'
import * as THREE from 'three'
import { QUALITY, QUALITY_SETTINGS } from '../constants/landSceneConstants'

// Create realistic grass texture with macro variation
export function useGrassTextures(quality = QUALITY.BEST) {
  return useMemo(() => {
    const settings = QUALITY_SETTINGS[quality]

    // Main grass color texture (detail)
    const detailCanvas = document.createElement('canvas')
    detailCanvas.width = 512
    detailCanvas.height = 512
    const detailCtx = detailCanvas.getContext('2d')

    // Base with natural color variation
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const noise = (Math.random() - 0.5) * 25
        const r = Math.min(255, Math.max(0, 55 + noise * 0.4))
        const g = Math.min(255, Math.max(0, 135 + noise))
        const b = Math.min(255, Math.max(0, 45 + noise * 0.3))
        detailCtx.fillStyle = `rgb(${r},${g},${b})`
        detailCtx.fillRect(x, y, 1, 1)
      }
    }

    // Darker patches (shadows/clumps)
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * 512
      const y = Math.random() * 512
      const radius = Math.random() * 35 + 15
      const gradient = detailCtx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, 'rgba(40, 95, 35, 0.3)')
      gradient.addColorStop(1, 'rgba(40, 95, 35, 0)')
      detailCtx.fillStyle = gradient
      detailCtx.beginPath()
      detailCtx.arc(x, y, radius, 0, Math.PI * 2)
      detailCtx.fill()
    }

    // Lighter sun patches
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 512
      const y = Math.random() * 512
      const radius = Math.random() * 45 + 20
      const gradient = detailCtx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, 'rgba(120, 175, 60, 0.35)')
      gradient.addColorStop(1, 'rgba(120, 175, 60, 0)')
      detailCtx.fillStyle = gradient
      detailCtx.beginPath()
      detailCtx.arc(x, y, radius, 0, Math.PI * 2)
      detailCtx.fill()
    }

    // Grass blade strokes
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512
      const y = Math.random() * 512
      const length = Math.random() * 10 + 4
      const shade = Math.random() * 35 - 15
      detailCtx.strokeStyle = `rgba(${55 + shade}, ${120 + shade}, ${38 + shade}, 0.5)`
      detailCtx.lineWidth = Math.random() * 1.5 + 0.5
      detailCtx.beginPath()
      detailCtx.moveTo(x, y)
      detailCtx.quadraticCurveTo(x + (Math.random() - 0.5) * 4, y - length / 2, x + (Math.random() - 0.5) * 5, y - length)
      detailCtx.stroke()
    }

    const detailTexture = new THREE.CanvasTexture(detailCanvas)
    detailTexture.wrapS = THREE.RepeatWrapping
    detailTexture.wrapT = THREE.RepeatWrapping
    detailTexture.repeat.set(60, 60)

    // Macro variation texture (large-scale color variation to break tiling)
    const macroCanvas = document.createElement('canvas')
    macroCanvas.width = 256
    macroCanvas.height = 256
    const macroCtx = macroCanvas.getContext('2d')

    // Neutral base
    macroCtx.fillStyle = 'rgb(128, 128, 128)'
    macroCtx.fillRect(0, 0, 256, 256)

    // Large organic patches for variety
    for (let i = 0; i < 30; i++) {
      const x = Math.random() * 256
      const y = Math.random() * 256
      const radius = Math.random() * 80 + 40
      const brightness = Math.random() * 60 + 98
      const gradient = macroCtx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, `rgb(${brightness}, ${brightness}, ${brightness})`)
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

// Simple grass texture for low quality
export function useSimpleGrassTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 256
    const ctx = canvas.getContext('2d')

    // Simple noise-based grass
    for (let y = 0; y < 256; y++) {
      for (let x = 0; x < 256; x++) {
        const noise = (Math.random() - 0.5) * 20
        const r = Math.min(255, Math.max(0, 55 + noise * 0.4))
        const g = Math.min(255, Math.max(0, 130 + noise))
        const b = Math.min(255, Math.max(0, 45 + noise * 0.3))
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(x, y, 1, 1)
      }
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(80, 80)
    return texture
  }, [])
}
