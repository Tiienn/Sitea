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
    wallEdits: {
      walls: {},
    },
    openingEdits: {
      doors: {},
      windows: {},
    },
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

function normalizeAdditions(additions = {}) {
  return {
    walls: additions.walls || [],
    doors: additions.doors || [],
    windows: additions.windows || [],
    wallEdits: {
      ...(additions.wallEdits || {}),
      walls: {
        ...(additions.wallEdits?.walls || {}),
      },
    },
    openingEdits: {
      ...(additions.openingEdits || {}),
      doors: {
        ...(additions.openingEdits?.doors || {}),
      },
      windows: {
        ...(additions.openingEdits?.windows || {}),
      },
    },
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

function getEditedDetectedWall(wall, additions = {}, index) {
  const edit = additions.wallEdits?.walls?.[index]
  if (!edit) return wall

  return {
    ...wall,
    start: edit.start ? formatReviewPoint(edit.start) : wall.start,
    end: edit.end ? formatReviewPoint(edit.end) : wall.end,
    source: wall.source || 'detected_review',
  }
}

function formatReviewOpening(opening = {}) {
  const next = { ...opening }
  if (opening.center) next.center = formatReviewPoint(opening.center)
  if (Number.isFinite(opening.rotation)) next.rotation = roundReviewNumber(opening.rotation, 6)
  if (Number.isFinite(opening.width)) next.width = roundReviewNumber(opening.width)
  if (Number.isFinite(opening.positionAlongWall)) next.positionAlongWall = roundReviewNumber(opening.positionAlongWall)
  if (opening.snap) {
    next.snap = {
      ...opening.snap,
      ...(Number.isFinite(opening.snap.distancePx) ? { distancePx: roundReviewNumber(opening.snap.distancePx) } : {}),
      ...(Number.isFinite(opening.snap.t) ? { t: roundReviewNumber(opening.snap.t, 4) } : {}),
    }
  }
  return next
}

function getEditedDetectedOpening(opening, additions = {}, collection, index) {
  const edit = additions.openingEdits?.[collection]?.[index]
  if (!edit) return opening
  return formatReviewOpening({
    ...opening,
    ...edit,
    source: opening.source || 'detected_review',
  })
}

function getPointAlongWall(wall, positionAlongWall) {
  const length = getWallLengthPx(wall)
  if (!length) return null
  const t = Math.max(0, Math.min(1, positionAlongWall / length))
  return {
    x: wall.start.x + (wall.end.x - wall.start.x) * t,
    y: wall.start.y + (wall.end.y - wall.start.y) * t,
    t,
  }
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
    const editedWall = getEditedDetectedWall(wall, additions, index)
    if (hiddenSets.walls.has(index) || getWallLengthPx(editedWall) === 0) return
    visibleWalls.push({
      wall: editedWall,
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

export function getReviewWallForDetection(analysis = {}, additions = {}, detection) {
  if (!detection || !Number.isInteger(detection.index)) return null

  if (detection.type === 'walls') {
    const wall = analysis.walls?.[detection.index]
    return wall ? getEditedDetectedWall(wall, additions, detection.index) : null
  }

  if (detection.type === 'addedWalls') {
    return additions.walls?.[detection.index] || null
  }

  return null
}

function getOpeningCollectionForDetection(detection) {
  if (detection?.type === 'doors' || detection?.type === 'addedDoors') return 'doors'
  if (detection?.type === 'windows' || detection?.type === 'addedWindows') return 'windows'
  return null
}

export function getReviewOpeningForDetection(analysis = {}, additions = {}, detection) {
  const collection = getOpeningCollectionForDetection(detection)
  if (!collection || !Number.isInteger(detection.index)) return null

  if (detection.type === 'addedDoors' || detection.type === 'addedWindows') {
    return additions[collection]?.[detection.index] || null
  }

  const opening = analysis[collection]?.[detection.index]
  return opening ? getEditedDetectedOpening(opening, additions, collection, detection.index) : null
}

export function updateReviewOpening(additions = {}, detection, nextOpening) {
  const collection = getOpeningCollectionForDetection(detection)
  if (!collection || !nextOpening || !Number.isInteger(detection?.index)) return additions
  const normalized = normalizeAdditions(additions)
  const formattedOpening = formatReviewOpening(nextOpening)

  if (detection.type === 'addedDoors' || detection.type === 'addedWindows') {
    const currentList = normalized[collection] || []
    if (!currentList[detection.index]) return additions
    return {
      ...normalized,
      [collection]: currentList.map((opening, index) => (index === detection.index ? formattedOpening : opening)),
    }
  }

  if (detection.type !== 'doors' && detection.type !== 'windows') return additions

  return {
    ...normalized,
    openingEdits: {
      ...normalized.openingEdits,
      [collection]: {
        ...normalized.openingEdits[collection],
        [detection.index]: formattedOpening,
      },
    },
  }
}

export function moveReviewWallEndpoint(additions = {}, detection, endpoint, point, analysis = {}) {
  if ((endpoint !== 'start' && endpoint !== 'end') || !point || !detection || !Number.isInteger(detection.index)) {
    return additions
  }

  const nextPoint = formatReviewPoint(point)
  const normalized = normalizeAdditions(additions)

  if (detection.type === 'addedWalls') {
    const wall = normalized.walls[detection.index]
    if (!wall) return additions
    const nextWall = {
      ...wall,
      [endpoint]: nextPoint,
      source: wall.source || 'manual_review',
    }
    if (getWallLengthPx(nextWall) < 1) return additions

    return {
      ...normalized,
      walls: normalized.walls.map((item, index) => (index === detection.index ? nextWall : item)),
    }
  }

  if (detection.type !== 'walls') return additions

  const wall = getReviewWallForDetection(analysis, normalized, detection)
  if (!wall) return additions
  const nextWall = {
    ...wall,
    [endpoint]: nextPoint,
  }
  if (getWallLengthPx(nextWall) < 1) return additions

  return {
    ...normalized,
    wallEdits: {
      ...normalized.wallEdits,
      walls: {
        ...normalized.wallEdits.walls,
        [detection.index]: {
          start: formatReviewPoint(nextWall.start),
          end: formatReviewPoint(nextWall.end),
        },
      },
    },
  }
}

export function getManualOpeningNudgeStep(analysis = {}) {
  const pixelsPerMeter = getReviewPixelsPerMeter(analysis)
  return pixelsPerMeter ? roundReviewNumber(pixelsPerMeter * 0.25) : 12
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

export function snapReviewOpeningToNearestWall(opening = {}, analysis = {}, hidden = {}, additions = {}) {
  if (!opening || opening.snap?.wallKey || !opening.center) return opening || {}
  const snappedOpening = snapOpeningToNearestReviewWall(opening.center, analysis, hidden, additions)
  if (!snappedOpening.snap) return opening

  return {
    ...opening,
    center: snappedOpening.center,
    rotation: snappedOpening.rotation,
    positionAlongWall: snappedOpening.positionAlongWall,
    snap: snappedOpening.snap,
  }
}

export function nudgeManualOpeningAlongWall(opening = {}, direction = 0, analysis = {}, hidden = {}, additions = {}) {
  const wallKey = opening.snap?.wallKey
  const wallEntry = wallKey
    ? getVisibleReviewWalls(analysis, hidden, additions).find(entry => entry.key === wallKey)
    : null
  const stepDirection = Math.sign(direction)
  if (!wallEntry || !stepDirection) return opening

  const wallLength = getWallLengthPx(wallEntry.wall)
  if (!wallLength) return opening

  const currentPosition = Number.isFinite(opening.positionAlongWall)
    ? opening.positionAlongWall
    : (opening.snap?.t || 0) * wallLength
  const halfWidth = Math.max(0, (opening.width || 0) / 2)
  const minPosition = Math.min(wallLength / 2, halfWidth)
  const maxPosition = Math.max(minPosition, wallLength - minPosition)
  const nextPosition = Math.max(minPosition, Math.min(maxPosition, currentPosition + stepDirection * getManualOpeningNudgeStep(analysis)))
  const point = getPointAlongWall(wallEntry.wall, nextPosition)
  if (!point) return opening

  return {
    ...opening,
    center: formatReviewPoint(point),
    rotation: roundReviewNumber(Math.atan2(wallEntry.wall.end.y - wallEntry.wall.start.y, wallEntry.wall.end.x - wallEntry.wall.start.x), 6),
    positionAlongWall: roundReviewNumber(nextPosition),
    snap: {
      ...opening.snap,
      wallType: wallEntry.type,
      wallIndex: wallEntry.index,
      wallKey: wallEntry.key,
      distancePx: 0,
      t: roundReviewNumber(point.t, 4),
    },
  }
}

export function retargetManualOpeningToWall(opening = {}, targetWallKey, analysis = {}, hidden = {}, additions = {}) {
  if (!opening?.center || !targetWallKey) return opening
  const wallEntry = getVisibleReviewWalls(analysis, hidden, additions).find(entry => entry.key === targetWallKey)
  if (!wallEntry) return opening

  const wallLength = getWallLengthPx(wallEntry.wall)
  const projected = projectPointToWall(opening.center, wallEntry.wall)
  if (!wallLength || !projected) return opening

  const halfWidth = Math.max(0, (opening.width || 0) / 2)
  const minPosition = Math.min(wallLength / 2, halfWidth)
  const maxPosition = Math.max(minPosition, wallLength - minPosition)
  const positionAlongWall = Math.max(minPosition, Math.min(maxPosition, projected.t * wallLength))
  const point = getPointAlongWall(wallEntry.wall, positionAlongWall)
  if (!point) return opening

  return {
    ...opening,
    center: formatReviewPoint(point),
    rotation: roundReviewNumber(Math.atan2(wallEntry.wall.end.y - wallEntry.wall.start.y, wallEntry.wall.end.x - wallEntry.wall.start.x), 6),
    positionAlongWall: roundReviewNumber(positionAlongWall),
    snap: {
      ...opening.snap,
      wallType: wallEntry.type,
      wallIndex: wallEntry.index,
      wallKey: wallEntry.key,
      distancePx: roundReviewNumber(projected.distance),
      t: roundReviewNumber(point.t, 4),
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
  const editedAnalysis = {
    ...analysis,
    walls: (analysis.walls || []).map((wall, index) => getEditedDetectedWall(wall, additions, index)),
    doors: (analysis.doors || []).map((door, index) => getEditedDetectedOpening(door, additions, 'doors', index)),
    windows: (analysis.windows || []).map((windowItem, index) => getEditedDetectedOpening(windowItem, additions, 'windows', index)),
  }
  const corrected = applyHiddenDetections(editedAnalysis, hidden)
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

export function countWallEndpointEdits(additions = {}) {
  return Object.keys(additions.wallEdits?.walls || {}).length
}

export function countOpeningEdits(additions = {}) {
  return Object.keys(additions.openingEdits?.doors || {}).length + Object.keys(additions.openingEdits?.windows || {}).length
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
      wallEditCount: countWallEndpointEdits(additions),
      openingEditCount: countOpeningEdits(additions),
    },
  }
}
