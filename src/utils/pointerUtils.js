/**
 * Get drag threshold based on pointer type.
 * Touch needs higher threshold because fingers are imprecise.
 * @param {string} pointerType - 'mouse' | 'touch' | 'pen'
 * @returns {number} - threshold in pixels
 */
export const getDragThreshold = (pointerType) => {
  return pointerType === 'touch' ? 20 : 8
}
