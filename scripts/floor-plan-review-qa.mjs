import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertFloorPlanToWorld } from '../src/utils/floorPlanConverter.js'
import {
  applyReviewCorrections,
  buildCorrectedFloorPlan,
  countAddedDetections,
  countHiddenDetections,
  countVisibleDetections,
} from '../src/utils/floorPlanReviewCorrections.js'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const repoRoot = path.resolve(__dirname, '..')
const rawFixturePath = path.join(repoRoot, 'fixtures/floor-plan-qa/results/raw/real-site-ground-floor.json')
const sourceImagePath = path.join(repoRoot, 'fixtures/floor-plan-qa/samples/real/real-site-ground-floor.png')

function assert(condition, message) {
  if (!condition) {
    throw new Error(message)
  }
}

const analysis = JSON.parse(readFileSync(rawFixturePath, 'utf8'))
const converted = convertFloorPlanToWorld(analysis)
const reviewPayload = {
  floorPlan: converted,
  analysis,
  sourceImagePath,
  sourceFileName: path.basename(sourceImagePath),
}
const hiddenDetections = {
  walls: [0],
  doors: [0],
  windows: [0],
  rooms: [],
  stairs: [],
}
const addedDetections = {
  walls: [{
    start: { x: 300, y: 700 },
    end: { x: 650, y: 700 },
    thickness: 12,
    isExterior: false,
    confidence: 1,
    source: 'manual_review',
  }],
}
const hiddenOnlyFloorPlan = buildCorrectedFloorPlan(reviewPayload, hiddenDetections)
const correctedAnalysis = applyReviewCorrections(analysis, hiddenDetections, addedDetections)
const correctedFloorPlan = buildCorrectedFloorPlan(reviewPayload, hiddenDetections, addedDetections)
const visibleCounts = countVisibleDetections(analysis, hiddenDetections, addedDetections)

assert(existsSync(sourceImagePath), `Missing source image: ${sourceImagePath}`)
assert(analysis?.imageSize?.width > 0, 'Fixture analysis is missing image width')
assert(analysis?.imageSize?.height > 0, 'Fixture analysis is missing image height')
assert(reviewPayload.floorPlan.walls.length > 0, 'Converted fixture has no walls')
assert(reviewPayload.floorPlan.stats.wallCount === reviewPayload.floorPlan.walls.length, 'Wall stats do not match converted walls')
assert(Array.isArray(reviewPayload.analysis.walls), 'Review payload is missing raw walls')
assert(Array.isArray(reviewPayload.analysis.doors), 'Review payload is missing raw doors')
assert(Array.isArray(reviewPayload.analysis.windows), 'Review payload is missing raw windows')
assert(countHiddenDetections(hiddenDetections) === 3, 'Hidden detection count should include wall, door, and window')
assert(countAddedDetections(addedDetections) === 1, 'Added detection count should include the manual wall')
assert(correctedAnalysis.walls.length === analysis.walls.length, 'Corrected analysis should hide one wall and add one wall')
assert(correctedAnalysis.doors.length === analysis.doors.length - 1, 'Corrected analysis did not hide the door')
assert(correctedAnalysis.windows.length === analysis.windows.length - 1, 'Corrected analysis did not hide the window')
assert(visibleCounts.walls === correctedAnalysis.walls.length, 'Visible wall count does not match corrected analysis')
assert(correctedFloorPlan.walls.length > 0, 'Corrected floor plan has no walls')
assert(correctedFloorPlan.stats.wallCount > hiddenOnlyFloorPlan.stats.wallCount, 'Added wall did not survive conversion')
assert(correctedFloorPlan.correctionSummary.hiddenCount === 3, 'Corrected floor plan summary is missing hidden detections')
assert(correctedFloorPlan.correctionSummary.addedCount === 1, 'Corrected floor plan summary is missing added detections')

console.log('Floor plan review QA passed', {
  source: reviewPayload.sourceFileName,
  walls: reviewPayload.floorPlan.stats.wallCount,
  doors: reviewPayload.floorPlan.stats.doorCount,
  windows: reviewPayload.floorPlan.stats.windowCount,
  rooms: reviewPayload.floorPlan.stats.roomCount,
  stairs: reviewPayload.floorPlan.stats.stairCount,
  correctedWalls: correctedFloorPlan.stats.wallCount,
  hidden: correctedFloorPlan.correctionSummary.hiddenCount,
  added: correctedFloorPlan.correctionSummary.addedCount,
})
