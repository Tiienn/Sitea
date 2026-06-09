import { convertFloorPlanToWorld } from './floorPlanConverter.js'

export const FLOOR_PLAN_REVIEW_TYPES = ['walls', 'doors', 'windows', 'rooms', 'stairs']

export function createEmptyHiddenDetections() {
  return FLOOR_PLAN_REVIEW_TYPES.reduce((acc, type) => {
    acc[type] = []
    return acc
  }, {})
}

function normalizeHiddenDetections(hidden = {}) {
  return FLOOR_PLAN_REVIEW_TYPES.reduce((acc, type) => {
    acc[type] = new Set(hidden[type] || [])
    return acc
  }, {})
}

export function isDetectionHidden(hidden, type, index) {
  return normalizeHiddenDetections(hidden)[type]?.has(index) || false
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

export function countVisibleDetections(analysis = {}, hidden = {}) {
  const corrected = applyHiddenDetections(analysis, hidden)
  return FLOOR_PLAN_REVIEW_TYPES.reduce((acc, type) => {
    acc[type] = corrected[type]?.length || 0
    return acc
  }, {})
}

export function buildCorrectedFloorPlan(review = {}, hidden = {}) {
  const correctedAnalysis = applyHiddenDetections(review.analysis || {}, hidden)
  const converted = convertFloorPlanToWorld(correctedAnalysis)

  return {
    ...converted,
    analysis: correctedAnalysis,
    sourceFileName: review.sourceFileName || null,
    correctionSummary: {
      hiddenCount: countHiddenDetections(hidden),
      hiddenDetections: hidden,
    },
  }
}
