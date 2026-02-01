import * as THREE from 'three'

// Floor texture cache - prevents recreating textures on every render
const floorTextureCache = {}

// Generate procedural floor textures using canvas
export function createFloorTexture(patternType) {
  if (floorTextureCache[patternType]) {
    return floorTextureCache[patternType]
  }

  const size = 256 // Texture size
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  switch (patternType) {
    case 'wood': {
      // Wood plank pattern with grain lines
      ctx.fillStyle = '#8B5A2B'
      ctx.fillRect(0, 0, size, size)

      const plankHeight = size / 4
      for (let i = 0; i < 4; i++) {
        const y = i * plankHeight
        // Plank base color variation
        const shade = 0.9 + Math.random() * 0.2
        ctx.fillStyle = `rgb(${Math.floor(139 * shade)}, ${Math.floor(90 * shade)}, ${Math.floor(43 * shade)})`
        ctx.fillRect(0, y + 2, size, plankHeight - 4)

        // Wood grain lines
        ctx.strokeStyle = `rgba(60, 30, 10, ${0.2 + Math.random() * 0.15})`
        ctx.lineWidth = 1
        for (let g = 0; g < 8; g++) {
          const gy = y + 4 + Math.random() * (plankHeight - 8)
          ctx.beginPath()
          ctx.moveTo(0, gy)
          // Wavy grain line
          for (let x = 0; x < size; x += 10) {
            ctx.lineTo(x, gy + Math.sin(x * 0.05) * 2)
          }
          ctx.stroke()
        }

        // Plank separator (dark line)
        ctx.fillStyle = 'rgba(40, 20, 5, 0.5)'
        ctx.fillRect(0, y, size, 2)
      }
      break
    }

    case 'tile': {
      // Tile grid pattern with grout lines
      const tileSize = size / 4
      const groutWidth = 4

      // Grout background
      ctx.fillStyle = '#A0A0A0'
      ctx.fillRect(0, 0, size, size)

      // Individual tiles
      for (let row = 0; row < 4; row++) {
        for (let col = 0; col < 4; col++) {
          const x = col * tileSize + groutWidth / 2
          const y = row * tileSize + groutWidth / 2
          const tileW = tileSize - groutWidth

          // Slight color variation per tile
          const shade = 0.95 + Math.random() * 0.1
          ctx.fillStyle = `rgb(${Math.floor(212 * shade)}, ${Math.floor(212 * shade)}, ${Math.floor(212 * shade)})`
          ctx.fillRect(x, y, tileW, tileW)

          // Subtle tile texture/reflection
          ctx.fillStyle = 'rgba(255, 255, 255, 0.1)'
          ctx.fillRect(x + 2, y + 2, tileW / 2, tileW / 2)
        }
      }
      break
    }

    case 'carpet': {
      // Carpet with fibrous texture
      ctx.fillStyle = '#4A5568'
      ctx.fillRect(0, 0, size, size)

      // Create fiber-like noise pattern
      for (let i = 0; i < 3000; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const shade = 0.8 + Math.random() * 0.4
        ctx.fillStyle = `rgba(${Math.floor(74 * shade)}, ${Math.floor(85 * shade)}, ${Math.floor(104 * shade)}, 0.5)`
        ctx.fillRect(x, y, 2, 2)
      }

      // Add some darker spots for depth
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        ctx.fillStyle = 'rgba(30, 40, 50, 0.3)'
        ctx.fillRect(x, y, 3, 3)
      }
      break
    }

    case 'concrete': {
      // Concrete with subtle speckles
      ctx.fillStyle = '#9CA3AF'
      ctx.fillRect(0, 0, size, size)

      // Add aggregate speckles
      for (let i = 0; i < 1500; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const shade = 0.7 + Math.random() * 0.5
        const speckleSize = 1 + Math.random() * 3
        ctx.fillStyle = `rgba(${Math.floor(130 * shade)}, ${Math.floor(135 * shade)}, ${Math.floor(140 * shade)}, 0.6)`
        ctx.beginPath()
        ctx.arc(x, y, speckleSize, 0, Math.PI * 2)
        ctx.fill()
      }

      // Add hairline cracks
      ctx.strokeStyle = 'rgba(80, 80, 85, 0.3)'
      ctx.lineWidth = 0.5
      for (let i = 0; i < 3; i++) {
        ctx.beginPath()
        let x = Math.random() * size
        let y = Math.random() * size
        ctx.moveTo(x, y)
        for (let j = 0; j < 5; j++) {
          x += (Math.random() - 0.5) * 50
          y += (Math.random() - 0.5) * 50
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      break
    }

    case 'marble': {
      // Marble with veining pattern
      ctx.fillStyle = '#F5F5F4'
      ctx.fillRect(0, 0, size, size)

      // Base variation
      for (let i = 0; i < 500; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const shade = 0.95 + Math.random() * 0.05
        ctx.fillStyle = `rgba(${Math.floor(245 * shade)}, ${Math.floor(245 * shade)}, ${Math.floor(244 * shade)}, 0.5)`
        ctx.fillRect(x, y, 8, 8)
      }

      // Marble veins
      ctx.strokeStyle = 'rgba(180, 175, 170, 0.4)'
      ctx.lineWidth = 2
      for (let v = 0; v < 4; v++) {
        ctx.beginPath()
        let x = Math.random() * size
        let y = 0
        ctx.moveTo(x, y)

        while (y < size) {
          x += (Math.random() - 0.5) * 40
          y += 20 + Math.random() * 30
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      }

      // Thinner secondary veins
      ctx.strokeStyle = 'rgba(200, 195, 190, 0.3)'
      ctx.lineWidth = 1
      for (let v = 0; v < 6; v++) {
        ctx.beginPath()
        let x = Math.random() * size
        let y = 0
        ctx.moveTo(x, y)

        while (y < size) {
          x += (Math.random() - 0.5) * 25
          y += 15 + Math.random() * 20
          ctx.lineTo(x, y)
        }
        ctx.stroke()
      }
      break
    }

    default:
      return null
  }

  // Create THREE.js texture from canvas
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2) // Repeat texture for larger rooms

  floorTextureCache[patternType] = texture
  return texture
}

// Wall texture cache - prevents recreating textures on every render
const wallTextureCache = {}

// Generate procedural wall textures using canvas
export function createWallTexture(patternType) {
  if (wallTextureCache[patternType]) {
    return wallTextureCache[patternType]
  }

  const size = 256 // Texture size
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  switch (patternType) {
    case 'brick': {
      // Brick wall pattern with mortar lines
      const brickHeight = 40
      const brickWidth = 80
      const mortarWidth = 6
      const mortarColor = '#C0B090'
      const brickColors = ['#B84513', '#C65524', '#A43B10', '#D05A30']

      // Fill with mortar background
      ctx.fillStyle = mortarColor
      ctx.fillRect(0, 0, size, size)

      // Draw bricks in staggered pattern
      for (let row = 0; row < size / brickHeight + 1; row++) {
        const offsetX = (row % 2) * (brickWidth / 2)
        for (let col = -1; col < size / brickWidth + 1; col++) {
          const x = col * brickWidth + offsetX
          const y = row * brickHeight

          // Random brick color variation
          ctx.fillStyle = brickColors[Math.floor(Math.random() * brickColors.length)]
          ctx.fillRect(x + mortarWidth / 2, y + mortarWidth / 2, brickWidth - mortarWidth, brickHeight - mortarWidth)

          // Add subtle texture to each brick
          for (let i = 0; i < 3; i++) {
            const tx = x + mortarWidth + Math.random() * (brickWidth - mortarWidth * 2)
            const ty = y + mortarWidth + Math.random() * (brickHeight - mortarWidth * 2)
            ctx.fillStyle = `rgba(0, 0, 0, ${0.08 + Math.random() * 0.1})`
            ctx.fillRect(tx, ty, 4, 3)
          }
        }
      }
      break
    }

    case 'stone': {
      // Irregular stone wall pattern
      ctx.fillStyle = '#808080'
      ctx.fillRect(0, 0, size, size)

      // Draw irregular stones
      const stones = []
      for (let i = 0; i < 20; i++) {
        stones.push({
          x: Math.random() * size,
          y: Math.random() * size,
          w: 30 + Math.random() * 50,
          h: 25 + Math.random() * 40,
          color: `rgb(${130 + Math.floor(Math.random() * 40)}, ${130 + Math.floor(Math.random() * 40)}, ${130 + Math.floor(Math.random() * 40)})`
        })
      }

      // Draw mortar gaps
      ctx.strokeStyle = '#606060'
      ctx.lineWidth = 3

      stones.forEach(stone => {
        ctx.fillStyle = stone.color
        ctx.beginPath()
        // Irregular polygon shape
        const points = []
        for (let i = 0; i < 6; i++) {
          const angle = (i / 6) * Math.PI * 2
          const r = (stone.w / 2) * (0.7 + Math.random() * 0.3)
          points.push({
            x: stone.x + Math.cos(angle) * r,
            y: stone.y + Math.sin(angle) * r * (stone.h / stone.w)
          })
        }
        ctx.moveTo(points[0].x, points[0].y)
        for (let i = 1; i < points.length; i++) {
          ctx.lineTo(points[i].x, points[i].y)
        }
        ctx.closePath()
        ctx.fill()
        ctx.stroke()

        // Add texture spots
        for (let i = 0; i < 3; i++) {
          const sx = stone.x - stone.w / 4 + Math.random() * stone.w / 2
          const sy = stone.y - stone.h / 4 + Math.random() * stone.h / 2
          ctx.fillStyle = `rgba(50, 50, 50, ${0.1 + Math.random() * 0.15})`
          ctx.beginPath()
          ctx.arc(sx, sy, 2 + Math.random() * 4, 0, Math.PI * 2)
          ctx.fill()
        }
      })
      break
    }

    case 'woodPanels': {
      // Vertical wood panel pattern
      const panelWidth = 64
      const grooveWidth = 4

      ctx.fillStyle = '#8B5A2B'
      ctx.fillRect(0, 0, size, size)

      for (let i = 0; i < size / panelWidth + 1; i++) {
        const x = i * panelWidth

        // Panel base with slight color variation
        const shade = 0.9 + Math.random() * 0.2
        ctx.fillStyle = `rgb(${Math.floor(139 * shade)}, ${Math.floor(90 * shade)}, ${Math.floor(43 * shade)})`
        ctx.fillRect(x + grooveWidth / 2, 0, panelWidth - grooveWidth, size)

        // Vertical wood grain
        ctx.strokeStyle = `rgba(60, 30, 10, ${0.15 + Math.random() * 0.1})`
        ctx.lineWidth = 1
        for (let g = 0; g < 4; g++) {
          const gx = x + grooveWidth + Math.random() * (panelWidth - grooveWidth * 2)
          ctx.beginPath()
          ctx.moveTo(gx, 0)
          for (let y = 0; y < size; y += 20) {
            ctx.lineTo(gx + (Math.random() - 0.5) * 3, y)
          }
          ctx.stroke()
        }

        // Panel groove (dark line)
        ctx.fillStyle = 'rgba(40, 20, 5, 0.6)'
        ctx.fillRect(x, 0, grooveWidth / 2, size)
        ctx.fillRect(x + panelWidth - grooveWidth / 2, 0, grooveWidth / 2, size)
      }
      break
    }

    default:
      return null
  }

  // Create THREE.js texture from canvas
  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 1) // 1:1 repeat, texture will tile naturally
  texture.needsUpdate = true
  texture.colorSpace = THREE.SRGBColorSpace // Ensure proper color display

  wallTextureCache[patternType] = texture
  return texture
}

// Deck texture cache - prevents recreating textures on every render
const deckTextureCache = {}

// Generate procedural deck textures for pool coping
export function createDeckTexture(materialType) {
  if (deckTextureCache[materialType]) {
    return deckTextureCache[materialType]
  }

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  switch (materialType) {
    case 'wood': {
      // Weathered outdoor wood deck planks
      ctx.fillStyle = '#8B7355'
      ctx.fillRect(0, 0, size, size)

      const plankWidth = size / 3
      for (let i = 0; i < 3; i++) {
        const x = i * plankWidth
        // Plank color variation (weathered look)
        const shade = 0.85 + Math.random() * 0.3
        ctx.fillStyle = `rgb(${Math.floor(139 * shade)}, ${Math.floor(115 * shade)}, ${Math.floor(85 * shade)})`
        ctx.fillRect(x + 2, 0, plankWidth - 4, size)

        // Wood grain lines (horizontal for deck boards)
        ctx.strokeStyle = `rgba(60, 40, 20, ${0.15 + Math.random() * 0.1})`
        ctx.lineWidth = 1
        for (let g = 0; g < 12; g++) {
          const gy = Math.random() * size
          ctx.beginPath()
          ctx.moveTo(x + 4, gy)
          ctx.lineTo(x + plankWidth - 4, gy + (Math.random() - 0.5) * 4)
          ctx.stroke()
        }

        // Plank gap (dark line)
        ctx.fillStyle = 'rgba(30, 20, 10, 0.6)'
        ctx.fillRect(x, 0, 2, size)
      }
      break
    }

    case 'stone': {
      // Natural flagstone / slate pattern
      ctx.fillStyle = '#708090'
      ctx.fillRect(0, 0, size, size)

      // Draw irregular stone shapes
      const stones = [
        { x: 10, y: 10, w: 100, h: 80 },
        { x: 120, y: 5, w: 120, h: 90 },
        { x: 5, y: 100, w: 90, h: 70 },
        { x: 105, y: 95, w: 80, h: 85 },
        { x: 195, y: 100, w: 55, h: 75 },
        { x: 15, y: 180, w: 110, h: 70 },
        { x: 135, y: 185, w: 115, h: 65 },
      ]

      stones.forEach(stone => {
        // Stone base color with variation
        const shade = 0.85 + Math.random() * 0.3
        const r = Math.floor(112 * shade)
        const g = Math.floor(128 * shade)
        const b = Math.floor(144 * shade)
        ctx.fillStyle = `rgb(${r}, ${g}, ${b})`

        // Draw rounded stone shape
        ctx.beginPath()
        ctx.roundRect(stone.x, stone.y, stone.w, stone.h, 8)
        ctx.fill()

        // Add surface texture spots
        for (let s = 0; s < 15; s++) {
          const sx = stone.x + 5 + Math.random() * (stone.w - 10)
          const sy = stone.y + 5 + Math.random() * (stone.h - 10)
          ctx.fillStyle = `rgba(60, 70, 80, ${0.1 + Math.random() * 0.15})`
          ctx.beginPath()
          ctx.arc(sx, sy, 2 + Math.random() * 3, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // Grout/mortar lines (gaps between stones)
      ctx.strokeStyle = 'rgba(80, 80, 90, 0.5)'
      ctx.lineWidth = 3
      stones.forEach(stone => {
        ctx.beginPath()
        ctx.roundRect(stone.x, stone.y, stone.w, stone.h, 8)
        ctx.stroke()
      })
      break
    }

    case 'tile': {
      // Outdoor patio tiles with anti-slip texture
      const tileSize = size / 2
      const groutWidth = 6

      // Grout background
      ctx.fillStyle = '#808080'
      ctx.fillRect(0, 0, size, size)

      // Individual tiles
      for (let row = 0; row < 2; row++) {
        for (let col = 0; col < 2; col++) {
          const x = col * tileSize + groutWidth / 2
          const y = row * tileSize + groutWidth / 2
          const tileW = tileSize - groutWidth

          // Terracotta-like tile color with variation
          const shade = 0.9 + Math.random() * 0.2
          ctx.fillStyle = `rgb(${Math.floor(205 * shade)}, ${Math.floor(133 * shade)}, ${Math.floor(63 * shade)})`
          ctx.fillRect(x, y, tileW, tileW)

          // Anti-slip texture (small bumps)
          for (let b = 0; b < 30; b++) {
            const bx = x + 5 + Math.random() * (tileW - 10)
            const by = y + 5 + Math.random() * (tileW - 10)
            ctx.fillStyle = `rgba(180, 110, 50, ${0.2 + Math.random() * 0.15})`
            ctx.beginPath()
            ctx.arc(bx, by, 1.5, 0, Math.PI * 2)
            ctx.fill()
          }

          // Subtle highlight on tile edge
          ctx.fillStyle = 'rgba(255, 255, 255, 0.08)'
          ctx.fillRect(x, y, tileW, 3)
          ctx.fillRect(x, y, 3, tileW)
        }
      }
      break
    }

    case 'concrete':
    default: {
      // Brushed concrete with expansion joints
      ctx.fillStyle = '#A9A9A9'
      ctx.fillRect(0, 0, size, size)

      // Brushed texture lines (horizontal)
      ctx.strokeStyle = 'rgba(140, 140, 145, 0.3)'
      ctx.lineWidth = 1
      for (let y = 0; y < size; y += 3) {
        ctx.beginPath()
        ctx.moveTo(0, y + Math.random() * 0.5)
        ctx.lineTo(size, y + Math.random() * 0.5)
        ctx.stroke()
      }

      // Aggregate speckles
      for (let i = 0; i < 800; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const shade = 0.7 + Math.random() * 0.5
        ctx.fillStyle = `rgba(${Math.floor(150 * shade)}, ${Math.floor(150 * shade)}, ${Math.floor(155 * shade)}, 0.4)`
        ctx.beginPath()
        ctx.arc(x, y, 1 + Math.random() * 2, 0, Math.PI * 2)
        ctx.fill()
      }

      // Expansion joint (control joint line)
      ctx.strokeStyle = 'rgba(80, 80, 85, 0.4)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(size / 2, 0)
      ctx.lineTo(size / 2, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, size / 2)
      ctx.lineTo(size, size / 2)
      ctx.stroke()
      break
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 1)
  texture.needsUpdate = true
  texture.colorSpace = THREE.SRGBColorSpace

  deckTextureCache[materialType] = texture
  return texture
}

// Foundation texture cache
const foundationTextureCache = {}

// Generate procedural textures for foundations/platforms
export function createFoundationTexture(materialType) {
  if (foundationTextureCache[materialType]) {
    return foundationTextureCache[materialType]
  }

  const size = 256
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  switch (materialType) {
    case 'wood': {
      // Wooden deck planks
      ctx.fillStyle = '#8B7355'
      ctx.fillRect(0, 0, size, size)

      const plankWidth = size / 4
      for (let i = 0; i < 4; i++) {
        const x = i * plankWidth
        const shade = 0.85 + Math.random() * 0.3
        ctx.fillStyle = `rgb(${Math.floor(139 * shade)}, ${Math.floor(115 * shade)}, ${Math.floor(85 * shade)})`
        ctx.fillRect(x + 2, 0, plankWidth - 4, size)

        // Wood grain
        ctx.strokeStyle = `rgba(60, 40, 20, ${0.15 + Math.random() * 0.1})`
        ctx.lineWidth = 1
        for (let g = 0; g < 10; g++) {
          const gy = Math.random() * size
          ctx.beginPath()
          ctx.moveTo(x + 4, gy)
          ctx.lineTo(x + plankWidth - 4, gy + (Math.random() - 0.5) * 4)
          ctx.stroke()
        }

        // Gap between planks
        ctx.fillStyle = 'rgba(30, 20, 10, 0.6)'
        ctx.fillRect(x, 0, 2, size)
      }
      break
    }

    case 'brick': {
      // Brick pattern
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(0, 0, size, size)

      const brickW = size / 4
      const brickH = size / 8
      const mortarW = 4

      for (let row = 0; row < 8; row++) {
        const offsetX = (row % 2) * (brickW / 2)
        for (let col = -1; col < 5; col++) {
          const x = col * brickW + offsetX
          const y = row * brickH

          // Brick color variation
          const shade = 0.85 + Math.random() * 0.3
          ctx.fillStyle = `rgb(${Math.floor(139 * shade)}, ${Math.floor(69 * shade)}, ${Math.floor(19 * shade)})`
          ctx.fillRect(x + mortarW/2, y + mortarW/2, brickW - mortarW, brickH - mortarW)

          // Slight texture on brick
          for (let s = 0; s < 5; s++) {
            const sx = x + mortarW + Math.random() * (brickW - mortarW * 2)
            const sy = y + mortarW + Math.random() * (brickH - mortarW * 2)
            ctx.fillStyle = `rgba(100, 50, 20, ${0.1 + Math.random() * 0.1})`
            ctx.beginPath()
            ctx.arc(sx, sy, 2, 0, Math.PI * 2)
            ctx.fill()
          }
        }
      }

      // Mortar lines
      ctx.fillStyle = '#808080'
      for (let row = 0; row <= 8; row++) {
        ctx.fillRect(0, row * brickH, size, mortarW/2)
      }
      break
    }

    case 'stone': {
      // Flagstone pattern
      ctx.fillStyle = '#708090'
      ctx.fillRect(0, 0, size, size)

      const stones = [
        { x: 5, y: 5, w: 90, h: 70 },
        { x: 105, y: 5, w: 85, h: 80 },
        { x: 200, y: 5, w: 50, h: 75 },
        { x: 5, y: 85, w: 70, h: 80 },
        { x: 85, y: 95, w: 95, h: 70 },
        { x: 190, y: 90, w: 60, h: 80 },
        { x: 5, y: 175, w: 100, h: 75 },
        { x: 115, y: 175, w: 80, h: 75 },
        { x: 205, y: 180, w: 45, h: 70 },
      ]

      stones.forEach(stone => {
        const shade = 0.8 + Math.random() * 0.4
        ctx.fillStyle = `rgb(${Math.floor(112 * shade)}, ${Math.floor(128 * shade)}, ${Math.floor(144 * shade)})`
        ctx.beginPath()
        ctx.roundRect(stone.x, stone.y, stone.w, stone.h, 6)
        ctx.fill()

        // Stone texture
        for (let s = 0; s < 10; s++) {
          const sx = stone.x + 5 + Math.random() * (stone.w - 10)
          const sy = stone.y + 5 + Math.random() * (stone.h - 10)
          ctx.fillStyle = `rgba(60, 70, 80, ${0.1 + Math.random() * 0.15})`
          ctx.beginPath()
          ctx.arc(sx, sy, 2 + Math.random() * 2, 0, Math.PI * 2)
          ctx.fill()
        }
      })

      // Grout lines
      ctx.strokeStyle = 'rgba(60, 60, 70, 0.5)'
      ctx.lineWidth = 3
      stones.forEach(stone => {
        ctx.beginPath()
        ctx.roundRect(stone.x, stone.y, stone.w, stone.h, 6)
        ctx.stroke()
      })
      break
    }

    case 'concrete':
    default: {
      // Brushed concrete
      ctx.fillStyle = '#A9A9A9'
      ctx.fillRect(0, 0, size, size)

      // Brush texture
      ctx.strokeStyle = 'rgba(140, 140, 145, 0.25)'
      ctx.lineWidth = 1
      for (let y = 0; y < size; y += 3) {
        ctx.beginPath()
        ctx.moveTo(0, y + Math.random() * 0.5)
        ctx.lineTo(size, y + Math.random() * 0.5)
        ctx.stroke()
      }

      // Aggregate speckles
      for (let i = 0; i < 600; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const shade = 0.7 + Math.random() * 0.5
        ctx.fillStyle = `rgba(${Math.floor(150 * shade)}, ${Math.floor(150 * shade)}, ${Math.floor(155 * shade)}, 0.35)`
        ctx.beginPath()
        ctx.arc(x, y, 1 + Math.random() * 1.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Control joints
      ctx.strokeStyle = 'rgba(80, 80, 85, 0.35)'
      ctx.lineWidth = 2
      ctx.beginPath()
      ctx.moveTo(size / 2, 0)
      ctx.lineTo(size / 2, size)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(0, size / 2)
      ctx.lineTo(size, size / 2)
      ctx.stroke()
      break
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 1)
  texture.needsUpdate = true
  texture.colorSpace = THREE.SRGBColorSpace

  foundationTextureCache[materialType] = texture
  return texture
}

// Stairs texture cache
const stairsTextureCache = {}

// Generate procedural textures for stairs
export function createStairsTexture(materialType) {
  if (stairsTextureCache[materialType]) {
    return stairsTextureCache[materialType]
  }

  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  switch (materialType) {
    case 'wood': {
      // Wood plank texture for stairs - brighter
      ctx.fillStyle = '#C4956A'
      ctx.fillRect(0, 0, size, size)

      // Wood grain lines
      ctx.strokeStyle = 'rgba(120, 80, 40, 0.25)'
      ctx.lineWidth = 1
      for (let i = 0; i < 15; i++) {
        const y = Math.random() * size
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(size, y + (Math.random() - 0.5) * 8)
        ctx.stroke()
      }

      // Color variation - lighter
      for (let i = 0; i < 80; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const shade = 0.95 + Math.random() * 0.1
        ctx.fillStyle = `rgba(180, 140, 100, ${0.15 + Math.random() * 0.1})`
        ctx.fillRect(x, y, 4, 4)
      }
      break
    }

    case 'concrete': {
      // Concrete texture - brighter
      ctx.fillStyle = '#B8B8B8'
      ctx.fillRect(0, 0, size, size)

      // Aggregate speckles
      for (let i = 0; i < 150; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const shade = 0.85 + Math.random() * 0.3
        ctx.fillStyle = `rgba(${Math.floor(160 * shade)}, ${Math.floor(160 * shade)}, ${Math.floor(165 * shade)}, 0.3)`
        ctx.beginPath()
        ctx.arc(x, y, 1 + Math.random() * 1.5, 0, Math.PI * 2)
        ctx.fill()
      }

      // Subtle brush texture
      ctx.strokeStyle = 'rgba(140, 140, 145, 0.15)'
      ctx.lineWidth = 1
      for (let y = 0; y < size; y += 4) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(size, y)
        ctx.stroke()
      }
      break
    }

    case 'metal': {
      // Brushed metal texture - brighter
      ctx.fillStyle = '#7A7A7A'
      ctx.fillRect(0, 0, size, size)

      // Brushed lines
      ctx.strokeStyle = 'rgba(100, 100, 105, 0.3)'
      ctx.lineWidth = 1
      for (let y = 0; y < size; y += 2) {
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(size, y)
        ctx.stroke()
      }

      // Metallic highlights
      for (let i = 0; i < 60; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        ctx.fillStyle = `rgba(200, 200, 210, ${0.15 + Math.random() * 0.2})`
        ctx.fillRect(x, y, 3, 1)
      }
      break
    }

    case 'stone': {
      // Stone/slate texture - brighter
      ctx.fillStyle = '#909090'
      ctx.fillRect(0, 0, size, size)

      // Stone surface variation
      for (let i = 0; i < 120; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const shade = 0.9 + Math.random() * 0.2
        ctx.fillStyle = `rgba(${Math.floor(140 * shade)}, ${Math.floor(140 * shade)}, ${Math.floor(145 * shade)}, 0.25)`
        ctx.beginPath()
        ctx.arc(x, y, 2 + Math.random() * 3, 0, Math.PI * 2)
        ctx.fill()
      }

      // Natural cracks/veins - lighter
      ctx.strokeStyle = 'rgba(70, 70, 75, 0.2)'
      ctx.lineWidth = 1
      for (let i = 0; i < 5; i++) {
        ctx.beginPath()
        ctx.moveTo(Math.random() * size, Math.random() * size)
        ctx.lineTo(Math.random() * size, Math.random() * size)
        ctx.stroke()
      }
      break
    }

    default: {
      ctx.fillStyle = '#C4956A'
      ctx.fillRect(0, 0, size, size)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(1, 1)
  texture.needsUpdate = true
  texture.colorSpace = THREE.SRGBColorSpace

  stairsTextureCache[materialType] = texture
  return texture
}

// Roof texture cache
const roofTextureCache = {}

// Generate procedural textures for roofs
export function createRoofTexture(materialType) {
  if (roofTextureCache[materialType]) {
    return roofTextureCache[materialType]
  }

  const size = 128
  const canvas = document.createElement('canvas')
  canvas.width = size
  canvas.height = size
  const ctx = canvas.getContext('2d')

  switch (materialType) {
    case 'shingle': {
      // Asphalt shingle texture
      ctx.fillStyle = '#4A4A4A'
      ctx.fillRect(0, 0, size, size)

      // Shingle rows
      const shingleHeight = 16
      for (let row = 0; row < size / shingleHeight; row++) {
        const y = row * shingleHeight
        const offset = (row % 2) * 20

        // Draw shingle pattern
        for (let x = -20 + offset; x < size; x += 40) {
          const shade = 0.9 + Math.random() * 0.2
          ctx.fillStyle = `rgb(${Math.floor(70 * shade)}, ${Math.floor(70 * shade)}, ${Math.floor(75 * shade)})`
          ctx.fillRect(x, y, 38, shingleHeight - 1)
        }
      }

      // Granular texture
      for (let i = 0; i < 200; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        ctx.fillStyle = `rgba(80, 80, 85, ${0.3 + Math.random() * 0.3})`
        ctx.fillRect(x, y, 1, 1)
      }
      break
    }

    case 'tile': {
      // Clay/terracotta tile texture
      ctx.fillStyle = '#B5651D'
      ctx.fillRect(0, 0, size, size)

      // Tile rows
      const tileHeight = 20
      for (let row = 0; row < size / tileHeight; row++) {
        const y = row * tileHeight
        const offset = (row % 2) * 16

        // Draw curved tiles
        for (let x = -16 + offset; x < size; x += 32) {
          const shade = 0.85 + Math.random() * 0.3
          ctx.fillStyle = `rgb(${Math.floor(180 * shade)}, ${Math.floor(100 * shade)}, ${Math.floor(30 * shade)})`

          // Tile body
          ctx.beginPath()
          ctx.arc(x + 16, y + tileHeight, 16, Math.PI, 0, false)
          ctx.fill()
        }

        // Shadow lines
        ctx.strokeStyle = 'rgba(80, 40, 10, 0.3)'
        ctx.lineWidth = 1
        ctx.beginPath()
        ctx.moveTo(0, y)
        ctx.lineTo(size, y)
        ctx.stroke()
      }
      break
    }

    case 'metal': {
      // Standing seam metal roof
      ctx.fillStyle = '#5A6A7A'
      ctx.fillRect(0, 0, size, size)

      // Vertical seams
      const seamSpacing = 24
      for (let x = 0; x < size; x += seamSpacing) {
        // Seam highlight
        ctx.fillStyle = 'rgba(100, 115, 130, 0.8)'
        ctx.fillRect(x, 0, 3, size)

        // Seam shadow
        ctx.fillStyle = 'rgba(40, 50, 60, 0.5)'
        ctx.fillRect(x + 3, 0, 1, size)
      }

      // Metallic sheen variation
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        ctx.fillStyle = `rgba(130, 145, 160, ${0.1 + Math.random() * 0.15})`
        ctx.fillRect(x, y, 8, 2)
      }
      break
    }

    case 'slate': {
      // Natural slate texture
      ctx.fillStyle = '#3A4A4A'
      ctx.fillRect(0, 0, size, size)

      // Slate tiles
      const slateHeight = 16
      for (let row = 0; row < size / slateHeight; row++) {
        const y = row * slateHeight
        const offset = (row % 2) * 12

        for (let x = -12 + offset; x < size; x += 24) {
          const shade = 0.85 + Math.random() * 0.3
          ctx.fillStyle = `rgb(${Math.floor(55 * shade)}, ${Math.floor(70 * shade)}, ${Math.floor(70 * shade)})`
          ctx.fillRect(x, y, 22, slateHeight - 1)
        }
      }

      // Natural texture variation
      for (let i = 0; i < 150; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        ctx.fillStyle = `rgba(70, 85, 85, ${0.2 + Math.random() * 0.2})`
        ctx.fillRect(x, y, 2, 2)
      }
      break
    }

    case 'concrete': {
      // Concrete roof tiles
      ctx.fillStyle = '#808080'
      ctx.fillRect(0, 0, size, size)

      // Tile pattern
      const tileSize = 20
      for (let row = 0; row < size / tileSize; row++) {
        for (let col = 0; col < size / tileSize; col++) {
          const x = col * tileSize
          const y = row * tileSize
          const shade = 0.9 + Math.random() * 0.2
          ctx.fillStyle = `rgb(${Math.floor(125 * shade)}, ${Math.floor(125 * shade)}, ${Math.floor(130 * shade)})`
          ctx.fillRect(x + 1, y + 1, tileSize - 2, tileSize - 2)
        }
      }

      // Surface texture
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        ctx.fillStyle = `rgba(100, 100, 105, ${0.2 + Math.random() * 0.2})`
        ctx.beginPath()
        ctx.arc(x, y, 1, 0, Math.PI * 2)
        ctx.fill()
      }
      break
    }

    case 'thatch': {
      // Thatch roof texture
      ctx.fillStyle = '#C4A676'
      ctx.fillRect(0, 0, size, size)

      // Straw strands
      ctx.strokeStyle = 'rgba(180, 150, 100, 0.6)'
      ctx.lineWidth = 2
      for (let i = 0; i < 100; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        ctx.beginPath()
        ctx.moveTo(x, y)
        ctx.lineTo(x + 10 + Math.random() * 20, y + 5 + Math.random() * 10)
        ctx.stroke()
      }

      // Color variation
      for (let i = 0; i < 150; i++) {
        const x = Math.random() * size
        const y = Math.random() * size
        const shade = 0.85 + Math.random() * 0.3
        ctx.fillStyle = `rgba(${Math.floor(200 * shade)}, ${Math.floor(170 * shade)}, ${Math.floor(120 * shade)}, 0.3)`
        ctx.fillRect(x, y, 3, 6)
      }
      break
    }

    default: {
      ctx.fillStyle = '#8B4513'
      ctx.fillRect(0, 0, size, size)
    }
  }

  const texture = new THREE.CanvasTexture(canvas)
  texture.wrapS = THREE.RepeatWrapping
  texture.wrapT = THREE.RepeatWrapping
  texture.repeat.set(2, 2)
  texture.needsUpdate = true
  texture.colorSpace = THREE.SRGBColorSpace

  roofTextureCache[materialType] = texture
  return texture
}
