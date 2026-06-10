function getCountValue(primary = {}, secondary = {}, key) {
  if (Number.isFinite(primary[key])) return primary[key]
  if (Number.isFinite(secondary[key])) return secondary[key]
  return 0
}

function sanitizeReadiness(readiness = null) {
  if (!readiness?.state && !readiness?.label) return null
  return {
    state: readiness.state || 'review',
    label: readiness.label || 'Needs review',
    detail: readiness.detail || '',
    action: readiness.action || '',
  }
}

function sanitizeCorrections(summary = {}) {
  return {
    hiddenCount: Number.isFinite(summary.hiddenCount) ? summary.hiddenCount : 0,
    addedCount: Number.isFinite(summary.addedCount) ? summary.addedCount : 0,
    wallEditCount: Number.isFinite(summary.wallEditCount) ? summary.wallEditCount : 0,
    openingEditCount: Number.isFinite(summary.openingEditCount) ? summary.openingEditCount : 0,
  }
}

export function buildFloorPlanSourcePlanMetadata(floorPlan = {}) {
  const existing = floorPlan.sourcePlan || {}
  const readout = floorPlan.readout || {}
  const stats = floorPlan.stats || {}
  const readoutCounts = readout.counts || existing.counts || {}
  const counts = {
    wallCount: getCountValue(stats, readoutCounts, 'wallCount'),
    doorCount: getCountValue(stats, readoutCounts, 'doorCount'),
    windowCount: getCountValue(stats, readoutCounts, 'windowCount'),
    roomCount: getCountValue(stats, readoutCounts, 'roomCount'),
    stairCount: getCountValue(stats, readoutCounts, 'stairCount'),
  }
  const readiness = sanitizeReadiness(readout.readiness || existing.readiness)
  const sourceFileName = floorPlan.sourceFileName || readout.fileName || existing.sourceFileName || null
  const corrections = sanitizeCorrections(floorPlan.correctionSummary || existing.corrections)
  const hasCounts = Object.values(counts).some(count => count > 0)
  const hasCorrections = Object.values(corrections).some(count => count > 0)

  if (!sourceFileName && !readiness && !hasCounts && !hasCorrections) return null

  return {
    type: 'reviewed_floor_plan',
    sourceFileName,
    readiness,
    counts,
    corrections,
  }
}
