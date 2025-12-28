/**
 * Land Templates - predefined lot sizes for quick start
 * All areas stored in m² internally
 */

// Conversion constants
const SQ_METERS_PER_ACRE = 4046.86

export const LAND_TEMPLATES = [
  { id: 'suburban-600', areaM2: 600, label: 'Typical suburban lot' },
  { id: 'suburban-1000', areaM2: 1000, label: 'Large suburban lot' },
  { id: 'medium-2000', areaM2: 2000, label: 'Medium lot' },
  { id: 'example-3000', areaM2: 3000, label: 'Example size' },
  { id: 'large-5000', areaM2: 5000, label: 'Large lot' },
  { id: 'quarter-acre', areaM2: Math.round(0.25 * SQ_METERS_PER_ACRE), label: '0.25 acre' },
  { id: 'half-acre', areaM2: Math.round(0.5 * SQ_METERS_PER_ACRE), label: '0.5 acre' },
  { id: 'one-acre', areaM2: Math.round(1 * SQ_METERS_PER_ACRE), label: '1 acre' },
]

/**
 * Convert area to rectangle dimensions with realistic proportions
 * @param {number} areaM2 - Area in square meters
 * @param {number} ratio - Length/width ratio (default 1.5 means length is 1.5x width)
 * @returns {{ widthM: number, lengthM: number }}
 */
export function areaToRectDims(areaM2, ratio = 1.5) {
  // width * length = area
  // length = width * ratio
  // width * (width * ratio) = area
  // width² * ratio = area
  // width = sqrt(area / ratio)
  const widthM = Math.sqrt(areaM2 / ratio)
  const lengthM = widthM * ratio

  // Round to 0.1m precision
  return {
    widthM: Math.round(widthM * 10) / 10,
    lengthM: Math.round(lengthM * 10) / 10,
  }
}

/**
 * Format template area for display based on user's unit preference
 * @param {number} areaM2 - Area in square meters
 * @param {string} lengthUnit - 'm' or 'ft'
 * @returns {string}
 */
export function formatTemplateArea(areaM2, lengthUnit) {
  if (lengthUnit === 'ft') {
    // For imperial, show acres for larger lots, ft² for smaller
    const acres = areaM2 / SQ_METERS_PER_ACRE
    if (acres >= 0.2) {
      return `${acres.toFixed(2)} acres`
    }
    const sqFt = areaM2 * 10.7639
    return `${Math.round(sqFt).toLocaleString()} ft²`
  }
  return `${Math.round(areaM2).toLocaleString()} m²`
}

/**
 * Format dimensions for display
 * @param {number} widthM - Width in meters
 * @param {number} lengthM - Length in meters
 * @param {string} lengthUnit - 'm' or 'ft'
 * @returns {string}
 */
export function formatTemplateDims(widthM, lengthM, lengthUnit) {
  if (lengthUnit === 'ft') {
    const widthFt = Math.round(widthM * 3.28084)
    const lengthFt = Math.round(lengthM * 3.28084)
    return `${widthFt}ft × ${lengthFt}ft`
  }
  return `${widthM.toFixed(0)}m × ${lengthM.toFixed(0)}m`
}
