function pluralize(count, singular, plural = `${singular}s`) {
  return `${count} ${count === 1 ? singular : plural}`
}

function getCount(stats = {}, analysis = {}, statKey, collection) {
  if (Number.isFinite(stats[statKey])) return stats[statKey]
  return Array.isArray(analysis[collection]) ? analysis[collection].length : 0
}

function getScaleCopy(analysis = {}) {
  const scale = analysis.scale || {}
  const confidence = Number.isFinite(scale.confidence) ? Math.round(scale.confidence * 100) : null

  if (scale.pixelsPerMeter || scale.estimatedMetersPerPixel) {
    return {
      label: confidence ? `Scale detected (${confidence}%)` : 'Scale detected',
      detail: 'Dimensions should be close, but still check the overlay against printed measurements.',
      state: confidence && confidence < 75 ? 'review' : 'good',
    }
  }

  return {
    label: 'Scale needs review',
    detail: 'I did not see a reliable printed scale, so exact size should be checked before trusting 3D dimensions.',
    state: 'review',
  }
}

function getAnalyzerWarnings(analysis = {}, warnings = []) {
  if (Array.isArray(warnings)) return warnings.filter(Boolean)
  if (Array.isArray(analysis.warnings)) return analysis.warnings.filter(Boolean)
  return []
}

function buildReadiness({ counts, scaleCopy, analyzerWarnings }) {
  const reasons = []
  const checklist = ['Compare the overlay with the original plan.']
  let state = 'ready'

  if (counts.wallCount < 8) {
    state = 'needs_corrections'
    reasons.push('Wall detection is too sparse for a trustworthy 3D pass.')
    checklist.push('Add or redraw the missing exterior and divider walls.')
  } else if (counts.wallCount > 45) {
    state = 'review'
    reasons.push('Many wall segments were detected, which can mean duplicates or broken lines.')
    checklist.push('Remove duplicate wall fragments or drag endpoints where lines are broken.')
  } else {
    reasons.push('Wall coverage looks usable for a first 3D pass.')
  }

  if (counts.doorCount === 0) {
    state = 'needs_corrections'
    reasons.push('No doors were detected, so the 3D layout would miss key openings.')
    checklist.push('Add the main doors before placing the plan in 3D.')
  } else {
    checklist.push('Check that doors sit on the correct walls.')
  }

  if (counts.windowCount === 0) {
    if (state === 'ready') state = 'review'
    reasons.push('No windows were detected, so exterior openings may need a quick pass.')
    checklist.push('Add important windows if the 3D preview needs exterior accuracy.')
  } else {
    checklist.push('Check exterior window positions.')
  }

  if (scaleCopy.state !== 'good') {
    if (state === 'ready') state = 'review'
    reasons.push('Scale needs review before exact dimensions are trusted.')
    checklist.push('Compare one printed measurement with the overlay scale.')
  }

  if (analyzerWarnings.length > 0) {
    if (state === 'ready') state = 'review'
    reasons.push(analyzerWarnings[0])
  }

  const meta = {
    ready: {
      label: 'Ready for 3D',
      title: 'Ready for a first 3D pass',
      detail: 'The detected plan has enough walls, openings, and scale information to place after a quick overlay check.',
      action: 'Check the overlay, then place in 3D.',
    },
    review: {
      label: 'Needs quick review',
      title: 'Review the overlay first',
      detail: 'The plan is usable, but one or two signals need a look before trusting the 3D result.',
      action: 'Review the highlighted checks, then place in 3D.',
    },
    needs_corrections: {
      label: 'Needs corrections first',
      title: 'Fix the overlay before 3D',
      detail: 'The detection is missing important geometry, so correct the overlay before placing it on the land.',
      action: 'Fix the checklist items, then place in 3D.',
    },
  }

  return {
    state,
    ...meta[state],
    reasons,
    checklist: checklist.slice(0, 4),
  }
}

export function buildFloorPlanReadout({ stats = {}, analysis = {}, warnings = [], fileName = 'your plan' } = {}) {
  const wallCount = getCount(stats, analysis, 'wallCount', 'walls')
  const doorCount = getCount(stats, analysis, 'doorCount', 'doors')
  const windowCount = getCount(stats, analysis, 'windowCount', 'windows')
  const roomCount = getCount(stats, analysis, 'roomCount', 'rooms')
  const stairCount = getCount(stats, analysis, 'stairCount', 'stairs')
  const scaleCopy = getScaleCopy(analysis)
  const analyzerWarnings = getAnalyzerWarnings(analysis, warnings)
  const counts = {
    wallCount,
    doorCount,
    windowCount,
    roomCount,
    stairCount,
  }
  const readiness = buildReadiness({
    counts,
    scaleCopy,
    analyzerWarnings,
  })

  const countLine = [
    pluralize(wallCount, 'wall'),
    pluralize(doorCount, 'door'),
    pluralize(windowCount, 'window'),
    pluralize(roomCount, 'room'),
    stairCount ? pluralize(stairCount, 'stair') : null,
  ].filter(Boolean).join(', ')

  const findings = [
    `I found ${countLine}.`,
    scaleCopy.label,
  ]

  if (roomCount > 0) {
    findings.push('Rooms are labeled enough to preview the layout as a building.')
  } else {
    findings.push('Rooms are not clearly labeled, so wall and opening placement matter most.')
  }

  const reviewNotes = []
  if (wallCount < 8) {
    reviewNotes.push('Wall detection looks sparse. Check for missing exterior or divider walls.')
  } else if (wallCount > 45) {
    reviewNotes.push('Many wall segments were detected. Check for duplicate or broken wall lines.')
  } else {
    reviewNotes.push('Wall count looks usable for a first 3D pass.')
  }

  if (doorCount === 0) {
    reviewNotes.push('No doors were detected. Add missing doors before placing in 3D.')
  } else {
    reviewNotes.push('Check that doors sit on the correct wall and swing/opening positions look right.')
  }

  if (windowCount === 0) {
    reviewNotes.push('No windows were detected. Add key windows if the 3D preview needs them.')
  } else {
    reviewNotes.push('Check window positions, especially on exterior walls.')
  }

  reviewNotes.push(scaleCopy.detail)

  const checks = [
    'Compare the overlay with the original plan.',
    'Drag or add any walls, doors, or windows that look wrong.',
    'Place in 3D after the overlay matches the plan well enough.',
  ]

  const summary = `I read ${fileName} as a floor plan and found ${countLine}.`
  const caveat = 'This is a visual extraction, so review the detected overlay before trusting exact geometry.'

  return {
    fileName,
    summary,
    caveat,
    findings,
    reviewNotes,
    checks,
    scaleState: scaleCopy.state,
    readiness,
    counts,
  }
}
