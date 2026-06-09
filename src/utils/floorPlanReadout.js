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

export function buildFloorPlanReadout({ stats = {}, analysis = {}, fileName = 'your plan' } = {}) {
  const wallCount = getCount(stats, analysis, 'wallCount', 'walls')
  const doorCount = getCount(stats, analysis, 'doorCount', 'doors')
  const windowCount = getCount(stats, analysis, 'windowCount', 'windows')
  const roomCount = getCount(stats, analysis, 'roomCount', 'rooms')
  const stairCount = getCount(stats, analysis, 'stairCount', 'stairs')
  const scaleCopy = getScaleCopy(analysis)

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
    counts: {
      wallCount,
      doorCount,
      windowCount,
      roomCount,
      stairCount,
    },
  }
}
