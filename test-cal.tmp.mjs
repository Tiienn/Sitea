import fs from 'node:fs'
import { __qaInternals } from './api/analyze-floor-plan.js'
const { resizeForGemini, preprocessImage, extractWallsFromCleanImage, splitWallsAtJunctions, calibrateScaleFromDimensionChains } = __qaInternals
const cap = JSON.parse(fs.readFileSync('/tmp/sitea-qa-debug/ocr-capture.json', 'utf8'))
const image = fs.readFileSync('fixtures/floor-plan-qa/samples/real/real-lot-127sqm.png').toString('base64')
const { base64: resized, width: W, height: H } = await resizeForGemini(image)
const processed = await preprocessImage(resized)
const ocrTextBoxes = [
  ...cap.dimensions.filter(d => d.bbox && d.bbox.w > 0 && d.bbox.h > 0).map(d => d.bbox),
  ...cap.textBoxes,
]
const trace = await extractWallsFromCleanImage(processed, ocrTextBoxes, cap.actualWidth, cap.actualHeight)
const walls = splitWallsAtJunctions(trace.walls)
const cal = calibrateScaleFromDimensionChains(walls, cap.dimensions, W / cap.actualWidth, H / cap.actualHeight, W, H)
console.log('calibration:', cal)
if (cal) {
  const xs = walls.flatMap(w => [w.start.x, w.end.x])
  const ys = walls.flatMap(w => [w.start.y, w.end.y])
  console.log('bounds:', ((Math.max(...xs)-Math.min(...xs))/cal.pixelsPerMeter).toFixed(2), 'x',
    ((Math.max(...ys)-Math.min(...ys))/cal.pixelsPerMeter).toFixed(2), 'm (target ~12.5 x ~10.4)')
}
