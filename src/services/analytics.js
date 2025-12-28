/**
 * Minimal analytics wrapper with graceful fallback
 *
 * Events fire only when VITE_ANALYTICS_ENABLED=true
 * Debug mode logs to console when VITE_ANALYTICS_DEBUG=true
 */

const ANALYTICS_ENABLED = import.meta.env.VITE_ANALYTICS_ENABLED === 'true'
const ANALYTICS_DEBUG = import.meta.env.VITE_ANALYTICS_DEBUG === 'true'

// In-memory event log for debugging (last 50 events)
const recentEvents = []
const MAX_RECENT_EVENTS = 50

// Session state for fire-once events
const sessionState = {
  hasMoved: false,
  walk5sFired: false,
  defineClicked: false,
  firstBuildingPlaced: false,
  coverage20Fired: false,
  coverage40Fired: false,
  walkMsAccumulated: 0,
}

/**
 * Get session state (for checking afterWalk5s, etc.)
 */
export function getSessionState() {
  return { ...sessionState }
}

/**
 * Update walk time accumulator (called from movement loop)
 * @param {number} deltaMs - milliseconds of movement this frame
 * @returns {boolean} - true if walk_5s_completed should fire
 */
export function accumulateWalkTime(deltaMs) {
  if (sessionState.walk5sFired) return false

  sessionState.walkMsAccumulated += deltaMs

  if (sessionState.walkMsAccumulated >= 5000) {
    sessionState.walk5sFired = true
    return true
  }
  return false
}

/**
 * Mark that define land was clicked
 */
export function markDefineClicked() {
  sessionState.defineClicked = true
}

/**
 * Track an analytics event
 * @param {string} eventName - Event name (snake_case)
 * @param {Object} props - Event properties (no PII)
 */
export function track(eventName, props = {}) {
  const timestamp = new Date().toISOString()
  const event = { eventName, props, timestamp }

  // Store in recent events
  recentEvents.push(event)
  if (recentEvents.length > MAX_RECENT_EVENTS) {
    recentEvents.shift()
  }

  // Debug logging
  if (ANALYTICS_DEBUG) {
    console.log('[analytics]', eventName, props)
  }

  // If analytics disabled, stop here
  if (!ANALYTICS_ENABLED) return

  // Future: hook into real analytics provider here
  // Examples:
  // - PostHog: posthog.capture(eventName, props)
  // - Plausible: plausible(eventName, { props })
  // - GA4: gtag('event', eventName, props)
  // - Segment: analytics.track(eventName, props)
}

/**
 * Fire-once event helpers
 */
export function trackFirstMovement(mode) {
  if (sessionState.hasMoved) return
  sessionState.hasMoved = true
  track('first_movement_started', { mode })
}

export function trackWalk5sCompleted(mode) {
  // Called when accumulateWalkTime returns true
  track('walk_5s_completed', { mode })
}

export function trackDefineClicked(mode) {
  const afterWalk5s = sessionState.walk5sFired
  markDefineClicked()
  track('define_land_clicked', { mode, afterWalk5s })
}

export function trackFirstBuildingPlaced(buildingType) {
  if (sessionState.firstBuildingPlaced) return
  sessionState.firstBuildingPlaced = true
  track('first_building_placed', { buildingType })
}

export function trackCoverageThreshold(coveragePercent) {
  const coveragePctRounded = Math.round(coveragePercent)

  if (!sessionState.coverage20Fired && coveragePercent >= 20) {
    sessionState.coverage20Fired = true
    track('coverage_exceeded_20', { coveragePctRounded })
  }

  if (!sessionState.coverage40Fired && coveragePercent >= 40) {
    sessionState.coverage40Fired = true
    track('coverage_exceeded_40', { coveragePctRounded })
  }
}

/**
 * Get recent events for debug overlay
 */
export function getRecentEvents() {
  return [...recentEvents]
}

/**
 * Detect device type
 */
export function getDeviceType() {
  return ('ontouchstart' in window || navigator.maxTouchPoints > 0) ? 'mobile' : 'desktop'
}

/**
 * Round area to nearest 10 m² to avoid fingerprinting
 */
export function roundArea(areaM2) {
  return Math.round(areaM2 / 10) * 10
}
