import { convertFloorPlanToWorld } from './floorPlanConverter.js'

export const FLOOR_PLAN_REVIEW_TYPES = ['walls', 'doors', 'windows', 'rooms', 'stairs']
export const MANUAL_DOOR_PRESETS = [
  { id: 'single', label: 'Single', meters: 0.9, doorType: 'single' },
  { id: 'double', label: 'Double', meters: 1.6, doorType: 'double' },
]
export const MANUAL_WINDOW_PRESETS = [
  { id: 'compact', label: 'Compact', meters: 0.8 },
  { id: 'standard', label: 'Standard', meters: 1.2 },
  { id: 'wide', label: 'Wide', meters: 1.8 },
]

export function createEmptyHiddenDetections() {
  return FLOOR_PLAN_REVIEW_TYPES.reduce((acc, type) => {
    acc[type] = []
    return acc
  }, {})
}

export function createEmptyAddedDetections() {
  return {
    walls: [],
    doors: [],
    windows: [],
  }
}

function normalizeHiddenDetections(hidden = {}) {
  return FLOOR_PLAN_REVIEW_TYPES.reduce((acc, type) => {
    acc[type] = new Set(hidden[type] || [])
    return acc
  }, {})
}

function roundReviewNumber(value, digits = 2) {
  return Number(Number(value).toFixed(digits))
}

function formatReviewPoint(point) {
  return {
    x: roundReviewNumber(point?.x || 0),
    y: roundReviewNumber(point?.y || 0),
  }
}

export function getReviewPixelsPerMeter(analysis = {}) {
  const pixelsPerMeter = analysis.scale?.pixelsPerMeter
  if (Number.isFinite(pixelsPerMeter) && pixelsPerMeter > 0) return pixelsPerMeter

  const metersPerPixel = analysis.scale?.estimatedMetersPerPixel
  if (Number.isFinite(metersPerPixel) && metersPerPixel > 0) return 1 / metersPerPixel

  return null
}

function getOpeningPresets(kind) {
  return kind === 'door' ? MANUAL_DOOR_PRESETS : MANUAL_WINDOW_PRESETS
}

export function getManualOpeningPresetOptions(kind, analysis = {}) {
  const pixelsPerMeter = getReviewPixelsPerMeter(analysis)
  return getOpeningPresets(kind).map(preset => ({
    ...preset,
    width: pixelsPerMeter
      ? roundReviewNumber(preset.meters * pixelsPerMeter)
      : roundReviewNumber(kind === 'door' ? preset.meters * 36 : preset.meters * 40),
  }))
}

export function applyManualOpeningPreset(opening = {}, kind = 'door', presetId, analysis = {}) {
  const options = getManualOpeningPresetOptions(kind, analysis)
  const preset = options.find(option => option.id === presetId) || options[0]

  return {
    ...opening,
    width: preset.width,
    presetId: preset.id,
    presetLabel: preset.label,
    presetMeters: preset.meters,
    ...(kind === 'door' ? { doorType: preset.doorType || 'single' } : {}),
  }
}

function getWallLengthPx(wall) {
  if (!wall?.start || !wall?.end) return 0
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y)
}

function projectPointToWall(point, wall) {
  if (!point || !wall?.start || !wall?.end) return null
  const dx = wall.end.x - wall.start.x
  const dy = wall.end.y - wall.start.y
  const lengthSquared = dx * dx + dy * dy
  if (lengthSquared === 0) return null

  const t = Math.max(0, Math.min(1, ((point.x - wall.start.x) * dx + (point.y - wall.start.y) * dy) / lengthSquared))
  const center = {
    x: wall.start.x + dx * t,
    y: wall.start.y + dy * t,
  }

  return {
    center,
    t,
    distance: Math.hypot(point.x - center.x, point.y - center.y),
    rotation: Math.atan2(dy, dx),
  }
}

export function isDetectionHidden(hidden, type, index) {
  return normalizeHiddenDetections(hidden)[type]?.has(index) || false
}

export function getVisibleReviewWalls(analysis = {}, hidden = {}, additions = {}) {
  const hiddenSets = normalizeHiddenDetections(hidden)
  const visibleWalls = []

  ;(analysis.walls || []).forEach((wall, index) => {
    if (hiddenSets.walls.has(index) || getWallLengthPx(wall) === 0) return
    visibleWalls.push({
      wall,
      type: 'walls',
      index,
      key: `walls:${index}`,
    })
  })
  ;(additions.walls || []).forEach((wall, index) => {
    if (getWallLengthPx(wall) === 0) return
    visibleWalls.push({
      wall,
      type: 'addedWalls',
      index,
      key: `addedWalls:${index}`,
    })
  })

  return visibleWalls
}

export function snapOpeningToNearestReviewWall(point, analysis = {}, hidden = {}, additions = {}) {
  let bestSnap = null

  getVisibleReviewWalls(analysis, hidden, additions).forEach(entry => {
    const snap = projectPointToWall(point, entry.wall)
    if (!snap) return
    if (!bestSnap || snap.distance < bestSnap.distance) {
      bestSnap = { ...snap, entry }
    }
  })

  if (!bestSnap) {
    return {
      center: formatReviewPoint(point),
      rotation: 0,
      snap: null,
    }
  }

  return {
    center: formatReviewPoint(bestSnap.center),
    rotation: roundReviewNumber(bestSnap.rotation, 6),
    positionAlongWall: roundReviewNumber(bestSnap.t * getWallLengthPx(bestSnap.entry.wall)),
    snap: {
      wallType: bestSnap.entry.type,
      wallIndex: bestSnap.entry.index,
      wallKey: bestSnap.entry.key,
      distancePx: roundReviewNumber(bestSnap.distance),
      t: roundReviewNumber(bestSnap.t, 4),
    },
  }
}

export function countHiddenDetections(hidden = {}) {
  return FLOOR_PLAN_REVIEW_TYPES.reduce((sum, type) => sum + (hidden[type]?.length || 0), 0)
}

export function toggleHiddenDetection(hidden = {}, detection) {
  if (!detection?.type || !Number.isInteger(detection.index)) return hidden

  const next = {
    ...createEmptyHiddenDetections(),
    ...hidden,
    [detection.type]: [...(hidden[detection.type] || [])],
  }
  const itemIndex = next[detection.type].indexOf(detection.index)
  if (itemIndex >= 0) {
    next[detection.type].splice(itemIndex, 1)
  } else {
    next[detection.type].push(detection.index)
  }
  return next
}

export function applyHiddenDetections(analysis = {}, hidden = {}) {
  const hiddenSets = normalizeHiddenDetections(hidden)
  const corrected = { ...analysis }

  FLOOR_PLAN_REVIEW_TYPES.forEach(type => {
    corrected[type] = (analysis[type] || []).filter((_, index) => !hiddenSets[type].has(index))
  })

  return corrected
}

export function applyReviewCorrections(analysis = {}, hidden = {}, additions = {}) {
  const corrected = applyHiddenDetections(analysis, hidden)
  const addedWalls = additions.walls || []
  const addedDoors = additions.doors || []
  const addedWindows = additions.windows || []
  return {
    ...corrected,
    walls: [...(corrected.walls || []), ...addedWalls],
    doors: [...(corrected.doors || []), ...addedDoors],
    windows: [...(corrected.windows || []), ...addedWindows],
  }
}

export function countAddedDetections(additions = {}) {
  return (additions.walls?.length || 0) + (additions.doors?.length || 0) + (additions.windows?.length || 0)
}

export function countVisibleDetections(analysis = {}, hidden = {}, additions = {}) {
  const corrected = applyReviewCorrections(analysis, hidden, additions)
  return FLOOR_PLAN_REVIEW_TYPES.reduce((acc, type) => {
    acc[type] = corrected[type]?.length || 0
    return acc
  }, {})
}

export function buildCorrectedFloorPlan(review = {}, hidden = {}, additions = {}) {
  const correctedAnalysis = applyReviewCorrections(review.analysis || {}, hidden, additions)
  const converted = convertFloorPlanToWorld(correctedAnalysis)

  return {
    ...converted,
    analysis: correctedAnalysis,
    sourceFileName: review.sourceFileName || null,
    correctionSummary: {
      hiddenCount: countHiddenDetections(hidden),
      hiddenDetections: hidden,
      addedCount: countAddedDetections(additions),
      addedDetections: additions,
    },
  }
}
