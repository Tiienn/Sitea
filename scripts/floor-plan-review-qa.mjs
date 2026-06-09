import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertFloorPlanToWorld } from '../src/utils/floorPlanConverter.js'
import {
  applyManualOpeningPreset,
  applyReviewCorrections,
  buildCorrectedFloorPlan,
  countAddedDetections,
  countHiddenDetections,
  countVisibleDetections,
  getManualOpeningPresetOptions,
  getReviewPixelsPerMeter,
  snapOpeningToNearestReviewWall,
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
const addedWall = {
  start: { x: 300, y: 700 },
  end: { x: 650, y: 700 },
  thickness: 12,
  isExterior: false,
  confidence: 1,
  source: 'manual_review',
}
const addedWallsOnly = { walls: [addedWall], doors: [], windows: [] }
const doorTap = { x: 340, y: 332 }
const windowTap = { x: 530, y: 636 }
const snappedDoor = snapOpeningToNearestReviewWall(doorTap, analysis, hiddenDetections, addedWallsOnly)
const snappedWindow = snapOpeningToNearestReviewWall(windowTap, analysis, hiddenDetections, addedWallsOnly)
const fallbackOpening = snapOpeningToNearestReviewWall({ x: 12.345, y: 67.891 }, { walls: [] }, hiddenDetections, { walls: [] })
const pixelsPerMeter = getReviewPixelsPerMeter(analysis)
const doorPresets = getManualOpeningPresetOptions('door', analysis)
const windowPresets = getManualOpeningPresetOptions('window', analysis)
const manualDoor = applyManualOpeningPreset({
  center: snappedDoor.center,
  rotation: snappedDoor.rotation,
  positionAlongWall: snappedDoor.positionAlongWall,
  snap: snappedDoor.snap,
  confidence: 1,
  source: 'manual_review',
}, 'door', 'double', analysis)
const manualWindow = applyManualOpeningPreset({
  center: snappedWindow.center,
  rotation: snappedWindow.rotation,
  positionAlongWall: snappedWindow.positionAlongWall,
  snap: snappedWindow.snap,
  confidence: 1,
  source: 'manual_review',
}, 'window', 'wide', analysis)
const addedDetections = {
  walls: [addedWall],
  doors: [manualDoor],
  windows: [manualWindow],
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
assert(countAddedDetections(addedDetections) === 3, 'Added detection count should include the manual wall, door, and window')
assert(snappedDoor.snap?.wallKey, 'Manual door did not snap to a review wall')
assert(snappedWindow.snap?.wallKey, 'Manual window did not snap to a review wall')
assert(Number.isFinite(snappedDoor.rotation), 'Manual door is missing snapped wall rotation')
assert(Number.isFinite(snappedWindow.rotation), 'Manual window is missing snapped wall rotation')
assert(Number.isFinite(snappedDoor.positionAlongWall), 'Manual door is missing snapped wall position')
assert(Number.isFinite(snappedWindow.positionAlongWall), 'Manual window is missing snapped wall position')
assert(Number.isFinite(pixelsPerMeter) && pixelsPerMeter > 0, 'Fixture should expose review pixels-per-meter')
assert(doorPresets.find(preset => preset.id === 'double')?.width === manualDoor.width, 'Double door preset width was not applied')
assert(windowPresets.find(preset => preset.id === 'wide')?.width === manualWindow.width, 'Wide window preset width was not applied')
assert(manualDoor.doorType === 'double', 'Double door preset should update door type')
assert(manualDoor.presetMeters === 1.6 && manualWindow.presetMeters === 1.8, 'Manual opening preset meter sizes are wrong')
assert(manualDoor.snap?.wallKey === snappedDoor.snap?.wallKey, 'Door preset should preserve snapped wall metadata')
assert(manualWindow.snap?.wallKey === snappedWindow.snap?.wallKey, 'Window preset should preserve snapped wall metadata')
assert(fallbackOpening.snap === null, 'No-wall fallback should not claim a snapped wall')
assert(fallbackOpening.center.x === 12.35 && fallbackOpening.center.y === 67.89, 'No-wall fallback should preserve the tapped point')
assert(fallbackOpening.rotation === 0, 'No-wall fallback should keep the v24 default rotation')
assert(correctedAnalysis.walls.length === analysis.walls.length, 'Corrected analysis should hide one wall and add one wall')
assert(correctedAnalysis.doors.length === analysis.doors.length, 'Corrected analysis should hide one door and add one door')
assert(correctedAnalysis.windows.length === analysis.windows.length, 'Corrected analysis should hide one window and add one window')
assert(visibleCounts.walls === correctedAnalysis.walls.length, 'Visible wall count does not match corrected analysis')
assert(visibleCounts.doors === correctedAnalysis.doors.length, 'Visible door count does not match corrected analysis')
assert(visibleCounts.windows === correctedAnalysis.windows.length, 'Visible window count does not match corrected analysis')
assert(correctedFloorPlan.walls.length > 0, 'Corrected floor plan has no walls')
assert(correctedFloorPlan.stats.wallCount > hiddenOnlyFloorPlan.stats.wallCount, 'Added wall did not survive conversion')
assert(correctedFloorPlan.stats.doorCount > hiddenOnlyFloorPlan.stats.doorCount, 'Added door did not survive conversion')
assert(correctedFloorPlan.stats.windowCount > hiddenOnlyFloorPlan.stats.windowCount, 'Added window did not survive conversion')
assert(correctedFloorPlan.correctionSummary.hiddenCount === 3, 'Corrected floor plan summary is missing hidden detections')
assert(correctedFloorPlan.correctionSummary.addedCount === 3, 'Corrected floor plan summary is missing added detections')

console.log('Floor plan review QA passed', {
  source: reviewPayload.sourceFileName,
  walls: reviewPayload.floorPlan.stats.wallCount,
  doors: reviewPayload.floorPlan.stats.doorCount,
  windows: reviewPayload.floorPlan.stats.windowCount,
  rooms: reviewPayload.floorPlan.stats.roomCount,
  stairs: reviewPayload.floorPlan.stats.stairCount,
  correctedWalls: correctedFloorPlan.stats.wallCount,
  correctedDoors: correctedFloorPlan.stats.doorCount,
  correctedWindows: correctedFloorPlan.stats.windowCount,
  hidden: correctedFloorPlan.correctionSummary.hiddenCount,
  added: correctedFloorPlan.correctionSummary.addedCount,
  doorSnap: snappedDoor.snap,
  windowSnap: snappedWindow.snap,
  doorWidthPx: manualDoor.width,
  windowWidthPx: manualWindow.width,
})
