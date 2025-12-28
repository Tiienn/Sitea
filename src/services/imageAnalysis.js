/**
 * Image Analysis Service
 * Detects whether an uploaded image is a site plan or floor plan
 *
 * Free users: Client-side heuristics (~70-80% accuracy)
 * Paid users: AI-powered detection (~95%+ accuracy)
 */

/**
 * Analyze uploaded image to detect if it's a site plan or floor plan
 * @param {string} imageBase64 - Base64 encoded image
 * @param {boolean} isPaidUser - Whether user has paid subscription
 * @returns {Promise<{ type: 'site-plan' | 'floor-plan', confidence: number, method: string }>}
 */
export async function analyzeImage(imageBase64, isPaidUser = false) {
  if (isPaidUser) {
    return analyzeWithAI(imageBase64)
  } else {
    return analyzeWithHeuristics(imageBase64)
  }
}

/**
 * AI-powered analysis for paid users
 * Uses vision AI model via backend API
 */
async function analyzeWithAI(imageBase64) {
  try {
    const response = await fetch('/api/analyze-plan', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        image: imageBase64.replace(/^data:image\/\w+;base64,/, '')
      }),
    })

    if (!response.ok) {
      throw new Error('AI analysis failed')
    }

    const result = await response.json()
    return {
      type: result.type,
      confidence: result.confidence,
      method: 'ai',
    }
  } catch (error) {
    console.error('AI analysis error, falling back to heuristics:', error)
    // Fallback to heuristics if AI fails
    return analyzeWithHeuristics(imageBase64)
  }
}

/**
 * Simple heuristic analysis for free users
 * Analyzes image characteristics to make a best guess
 */
async function analyzeWithHeuristics(imageBase64) {
  const img = await loadImage(imageBase64)
  const analysis = await analyzeImageCharacteristics(img)

  // Scoring system
  let floorPlanScore = 0
  let sitePlanScore = 0

  // 1. Aspect ratio
  // Floor plans tend to be more square (building footprints)
  // Site plans can be more irregular/elongated (land parcels)
  const aspectRatio = img.width / img.height
  if (aspectRatio > 0.7 && aspectRatio < 1.4) {
    floorPlanScore += 1 // Square-ish = likely floor plan
  } else {
    sitePlanScore += 1
  }

  // 2. Internal line density
  // Floor plans have many internal walls
  // Site plans usually have simpler boundaries
  if (analysis.lineDensity > 0.3) {
    floorPlanScore += 2
  } else if (analysis.lineDensity < 0.15) {
    sitePlanScore += 2
  }

  // 3. Edge complexity
  // Floor plans have many perpendicular lines (walls)
  // Site plans may have irregular polygon edges
  if (analysis.perpendicularLineRatio > 0.6) {
    floorPlanScore += 2
  } else {
    sitePlanScore += 1
  }

  // 4. Center vs edge detail
  // Floor plans have detail throughout (rooms)
  // Site plans often have detail at edges (boundary) with empty center
  if (analysis.centerDetailRatio > 0.4) {
    floorPlanScore += 1
  } else {
    sitePlanScore += 1
  }

  // 5. Room-like regions
  // Floor plans often have multiple enclosed spaces
  if (analysis.hasRoomLikeRegions) {
    floorPlanScore += 1
  }

  // Calculate result
  const totalScore = floorPlanScore + sitePlanScore
  const isFloorPlan = floorPlanScore > sitePlanScore
  const scoreDiff = Math.abs(floorPlanScore - sitePlanScore) / totalScore

  return {
    type: isFloorPlan ? 'floor-plan' : 'site-plan',
    confidence: Math.min(0.85, 0.5 + scoreDiff * 0.35), // Cap at 85% for heuristics
    method: 'heuristics',
  }
}

/**
 * Load image from base64/URL
 */
function loadImage(src) {
  return new Promise((resolve, reject) => {
    const img = new Image()
    img.crossOrigin = 'anonymous'
    img.onload = () => resolve(img)
    img.onerror = reject
    img.src = src
  })
}

/**
 * Analyze image characteristics using canvas
 */
async function analyzeImageCharacteristics(img) {
  const canvas = document.createElement('canvas')
  const ctx = canvas.getContext('2d')

  // Scale down for performance
  const maxSize = 400
  const scale = Math.min(maxSize / img.width, maxSize / img.height)
  canvas.width = img.width * scale
  canvas.height = img.height * scale

  ctx.drawImage(img, 0, 0, canvas.width, canvas.height)
  const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height)
  const data = imageData.data

  // Convert to grayscale
  const grayscale = []
  for (let i = 0; i < data.length; i += 4) {
    const gray = (data[i] + data[i + 1] + data[i + 2]) / 3
    grayscale.push(gray)
  }

  // Edge detection
  const edges = detectEdges(grayscale, canvas.width, canvas.height)

  // Calculate metrics
  const lineDensity = edges.filter(e => e > 128).length / edges.length
  const perpendicularLineRatio = estimatePerpendicularLines(edges, canvas.width, canvas.height)
  const centerDetailRatio = calculateCenterDetailRatio(edges, canvas.width, canvas.height)
  const hasRoomLikeRegions = detectRoomLikeRegions(edges, canvas.width, canvas.height)

  return {
    lineDensity,
    perpendicularLineRatio,
    centerDetailRatio,
    hasRoomLikeRegions,
  }
}

/**
 * Simple edge detection using Sobel operator
 */
function detectEdges(grayscale, width, height) {
  const edges = new Array(grayscale.length).fill(0)

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x

      // Sobel operator
      const gx =
        -grayscale[idx - width - 1] + grayscale[idx - width + 1] +
        -2 * grayscale[idx - 1] + 2 * grayscale[idx + 1] +
        -grayscale[idx + width - 1] + grayscale[idx + width + 1]

      const gy =
        -grayscale[idx - width - 1] - 2 * grayscale[idx - width] - grayscale[idx - width + 1] +
        grayscale[idx + width - 1] + 2 * grayscale[idx + width] + grayscale[idx + width + 1]

      edges[idx] = Math.min(255, Math.sqrt(gx * gx + gy * gy))
    }
  }

  return edges
}

/**
 * Estimate ratio of perpendicular (horizontal/vertical) lines
 * Floor plans have many 90° angles
 */
function estimatePerpendicularLines(edges, width, height) {
  let horizontalEdges = 0
  let verticalEdges = 0
  let totalEdges = 0

  const threshold = 100

  for (let y = 1; y < height - 1; y++) {
    for (let x = 1; x < width - 1; x++) {
      const idx = y * width + x
      if (edges[idx] > threshold) {
        totalEdges++

        // Check if horizontal edge (strong vertical gradient)
        const vertDiff = Math.abs(edges[idx - width] - edges[idx + width])
        // Check if vertical edge (strong horizontal gradient)
        const horzDiff = Math.abs(edges[idx - 1] - edges[idx + 1])

        if (vertDiff > horzDiff * 1.5) {
          horizontalEdges++
        } else if (horzDiff > vertDiff * 1.5) {
          verticalEdges++
        }
      }
    }
  }

  if (totalEdges === 0) return 0
  return (horizontalEdges + verticalEdges) / totalEdges
}

/**
 * Calculate how much detail is in the center vs edges
 * Floor plans have rooms throughout, site plans often have empty centers
 */
function calculateCenterDetailRatio(edges, width, height) {
  const centerX = width / 2
  const centerY = height / 2
  const centerRadius = Math.min(width, height) / 4

  let centerEdges = 0
  let centerTotal = 0
  let edgeEdges = 0
  let edgeTotal = 0

  const threshold = 80

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const idx = y * width + x
      const distFromCenter = Math.sqrt((x - centerX) ** 2 + (y - centerY) ** 2)

      if (distFromCenter < centerRadius) {
        centerTotal++
        if (edges[idx] > threshold) centerEdges++
      } else {
        edgeTotal++
        if (edges[idx] > threshold) edgeEdges++
      }
    }
  }

  const centerDensity = centerTotal > 0 ? centerEdges / centerTotal : 0
  const edgeDensity = edgeTotal > 0 ? edgeEdges / edgeTotal : 0

  if (edgeDensity === 0) return 0.5
  return centerDensity / (centerDensity + edgeDensity)
}

/**
 * Detect enclosed room-like regions
 * Floor plans have multiple enclosed spaces
 */
function detectRoomLikeRegions(edges, width, height) {
  const threshold = 100
  const visited = new Array(edges.length).fill(false)
  let regionCount = 0

  for (let y = 10; y < height - 10; y += 20) {
    for (let x = 10; x < width - 10; x += 20) {
      const idx = y * width + x
      if (!visited[idx] && edges[idx] < threshold) {
        // Found a non-edge pixel, flood fill to find region
        const regionSize = floodFill(edges, visited, x, y, width, height, threshold)
        if (regionSize > 100 && regionSize < (width * height) / 4) {
          regionCount++
        }
      }
    }
  }

  // Floor plans typically have 3+ room-like regions
  return regionCount >= 3
}

/**
 * Simple flood fill to measure region size
 */
function floodFill(edges, visited, startX, startY, width, height, threshold) {
  const stack = [[startX, startY]]
  let size = 0
  const maxSize = 5000 // Limit to prevent long processing

  while (stack.length > 0 && size < maxSize) {
    const [x, y] = stack.pop()
    const idx = y * width + x

    if (x < 0 || x >= width || y < 0 || y >= height) continue
    if (visited[idx]) continue
    if (edges[idx] > threshold) continue

    visited[idx] = true
    size++

    stack.push([x + 1, y])
    stack.push([x - 1, y])
    stack.push([x, y + 1])
    stack.push([x, y - 1])
  }

  return size
}
