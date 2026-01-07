import * as THREE from 'three'

// Quality preset constants
export const QUALITY = {
  LOW: 'low',
  MEDIUM: 'medium',
  HIGH: 'high'
}

// Quality-dependent settings
export const QUALITY_SETTINGS = {
  [QUALITY.LOW]: {
    dpr: 1,
    shadowsEnabled: false,
    shadowMapSize: 512,
    shadowType: false,
    bloom: false,
    ssao: false,
    envMapIntensity: 0,
    grassDetail: false,
    fogDensity: 0.008
  },
  [QUALITY.MEDIUM]: {
    dpr: 1.5,
    shadowsEnabled: true,
    shadowMapSize: 1024,
    shadowType: THREE.PCFSoftShadowMap,
    bloom: false,
    ssao: false,
    envMapIntensity: 0.3,
    grassDetail: true,
    fogDensity: 0.006
  },
  [QUALITY.HIGH]: {
    dpr: 2,
    shadowsEnabled: true,
    shadowMapSize: 2048,
    shadowType: THREE.PCFSoftShadowMap,
    bloom: true,
    bloomIntensity: 0.2,
    ssao: true,
    ssaoIntensity: 0.5,
    envMapIntensity: 0.5,
    grassDetail: true,
    fogDensity: 0.005
  }
}

// Camera mode constants
export const CAMERA_MODE = {
  FIRST_PERSON: 'first_person',
  THIRD_PERSON: 'third_person',
  ORBIT: 'orbit'
}

// Camera distance thresholds (meters)
export const MIN_DISTANCE = 0
export const SWITCH_OUT_DISTANCE = 1.8
export const SWITCH_IN_DISTANCE = 1.0
export const MAX_DISTANCE = 500.0
export const DEFAULT_TP_DISTANCE = 5.0
export const ORBIT_START_DISTANCE = 10.0

// Camera smoothing
export const FOLLOW_SMOOTH = 0.1
export const YAW_SMOOTH = 0.08

// Movement speed constants
export const WALK_SPEED = 3.0
export const RUN_SPEED = 6.0
export const ZOOM_SPEED = 0.002
export const PINCH_SPEED = 0.01

// Camera bob constants
export const CAMERA_BOB_WALK = 0.012
export const CAMERA_BOB_RUN = 0.018
export const CAMERA_BOB_SPEED = 10

// Unit conversion
export const FEET_PER_METER = 3.28084

// Preview colors
export const PREVIEW_COLOR_VALID = '#14B8A6'
export const PREVIEW_COLOR_INVALID = '#EF4444'
export const PREVIEW_OPACITY = 0.4

// Sun position for lighting - directly overhead for accurate shadows
export const SUN_POSITION = [0.1, 150, 0.1]

// Animation constants
export const IDLE_BOB_AMPLITUDE = 0.015
export const IDLE_BOB_SPEED = 1.5
export const WALK_LEG_SWING = 0.4
export const WALK_ARM_SWING = 0.3
export const WALK_BOB_AMPLITUDE = 0.03
export const WALK_CYCLE_SPEED = 8
export const RUN_LEG_SWING = 0.6
export const RUN_ARM_SWING = 0.5
export const RUN_BOB_AMPLITUDE = 0.05
export const RUN_CYCLE_SPEED = 12
export const RUN_LEAN = 0.1

// NPC color presets
export const NPC_COLORS = {
  guide1: { body: '#cc6633', pants: '#4a4a4a' },
  guide2: { body: '#339966', pants: '#3a3a3a' },
}

// Format dimension with unit
export const formatDimension = (meters, unit) => {
  if (unit === 'ft') {
    return `${(meters * FEET_PER_METER).toFixed(1)}ft`
  }
  return `${meters.toFixed(1)}m`
}

export const formatDimensions = (width, length, unit) => {
  if (unit === 'ft') {
    return `${(width * FEET_PER_METER).toFixed(0)}ft × ${(length * FEET_PER_METER).toFixed(0)}ft`
  }
  return `${width}m × ${length}m`
}

// Wall geometry helpers
export const getWallLength = (wall) => {
  const dx = wall.end.x - wall.start.x
  const dz = wall.end.z - wall.start.z
  return Math.sqrt(dx * dx + dz * dz)
}

export const getWallAngle = (wall) => {
  const dx = wall.end.x - wall.start.x
  const dz = wall.end.z - wall.start.z
  return Math.atan2(dx, dz)
}

export const getWorldPositionOnWall = (wall, distanceAlongWall) => {
  const wallLen = getWallLength(wall)
  if (wallLen < 0.001) return { x: wall.start.x, z: wall.start.z }
  const dx = wall.end.x - wall.start.x
  const dz = wall.end.z - wall.start.z
  const t = distanceAlongWall / wallLen
  return {
    x: wall.start.x + dx * t,
    z: wall.start.z + dz * t
  }
}

// Check if opening placement is valid
export const isValidOpeningPlacement = (wall, positionOnWall, openingWidth, existingOpenings = []) => {
  const wallLen = getWallLength(wall)
  const halfWidth = openingWidth / 2
  const MIN_EDGE_DIST = 0.3

  if (positionOnWall - halfWidth < MIN_EDGE_DIST) {
    return { valid: false, reason: 'too_close_to_start' }
  }
  if (positionOnWall + halfWidth > wallLen - MIN_EDGE_DIST) {
    return { valid: false, reason: 'too_close_to_end' }
  }
  for (const existing of existingOpenings) {
    const existingStart = existing.position - existing.width / 2
    const existingEnd = existing.position + existing.width / 2
    const newStart = positionOnWall - halfWidth
    const newEnd = positionOnWall + halfWidth
    if (!(newEnd < existingStart || newStart > existingEnd)) {
      return { valid: false, reason: 'overlapping' }
    }
  }
  return { valid: true, reason: null }
}
