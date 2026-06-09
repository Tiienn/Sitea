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
  countOpeningEdits,
  countVisibleDetections,
  countWallEndpointEdits,
  getManualOpeningPresetOptions,
  getManualOpeningNudgeStep,
  getReviewOpeningForDetection,
  getReviewWallForDetection,
  getReviewPixelsPerMeter,
  moveReviewOpeningToPoint,
  moveReviewWallEndpoint,
  nudgeManualOpeningAlongWall,
  retargetManualOpeningToWall,
  snapOpeningToNearestReviewWall,
  snapReviewOpeningToNearestWall,
  updateReviewOpening,
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

function getWallLengthPx(wall) {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.y - wall.start.y)
}

function getWallAngle(wall) {
  return Math.atan2(wall.end.y - wall.start.y, wall.end.x - wall.start.x)
}

function getPointAlongWall(wall, positionAlongWall) {
  const length = getWallLengthPx(wall)
  const t = Math.max(0, Math.min(1, positionAlongWall / length))
  return {
    x: wall.start.x + (wall.end.x - wall.start.x) * t,
    y: wall.start.y + (wall.end.y - wall.start.y) * t,
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
const editedDetectedWallIndex = analysis.walls.findIndex((_, index) => !hiddenDetections.walls.includes(index))
const editedDetectedSourceWall = analysis.walls[editedDetectedWallIndex] || { start: { x: 0, y: 0 }, end: { x: 20, y: 0 } }
const editedDetectedWallPoint = {
  x: editedDetectedSourceWall.start.x + 21,
  y: editedDetectedSourceWall.start.y + 9,
}
const withEditedDetectedWall = moveReviewWallEndpoint(
  addedWallsOnly,
  { type: 'walls', index: editedDetectedWallIndex },
  'start',
  editedDetectedWallPoint,
  analysis,
)
const editedDetectedWall = getReviewWallForDetection(
  analysis,
  withEditedDetectedWall,
  { type: 'walls', index: editedDetectedWallIndex },
)
const editedDetectedWallSnap = snapOpeningToNearestReviewWall(
  editedDetectedWallPoint,
  analysis,
  hiddenDetections,
  withEditedDetectedWall,
)
const editedAddedWallPoint = { x: addedWall.end.x + 42, y: addedWall.end.y + 18 }
const withEditedAddedWall = moveReviewWallEndpoint(
  addedWallsOnly,
  { type: 'addedWalls', index: 0 },
  'end',
  editedAddedWallPoint,
  analysis,
)
const editedAddedWall = getReviewWallForDetection(analysis, withEditedAddedWall, { type: 'addedWalls', index: 0 })
const invalidWallEdit = moveReviewWallEndpoint(addedWallsOnly, { type: 'doors', index: 0 }, 'start', { x: 1, y: 1 }, analysis)
const preferredDetectedDoorIndex = 3
const editedDetectedDoorIndex = analysis.doors[preferredDetectedDoorIndex] && !hiddenDetections.doors.includes(preferredDetectedDoorIndex)
  ? preferredDetectedDoorIndex
  : analysis.doors.findIndex((_, index) => !hiddenDetections.doors.includes(index))
const editedDetectedWindowIndex = analysis.windows.findIndex((_, index) => !hiddenDetections.windows.includes(index))
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
const snappedDetectedDoor = snapReviewOpeningToNearestWall(
  getReviewOpeningForDetection(analysis, addedWallsOnly, { type: 'doors', index: editedDetectedDoorIndex }),
  analysis,
  hiddenDetections,
  withEditedDetectedWall,
)
const detectedDoorWithPreset = applyManualOpeningPreset(snappedDetectedDoor, 'door', 'double', analysis)
const withEditedDetectedDoor = updateReviewOpening(
  withEditedDetectedWall,
  { type: 'doors', index: editedDetectedDoorIndex },
  detectedDoorWithPreset,
)
const editedDetectedDoor = getReviewOpeningForDetection(analysis, withEditedDetectedDoor, { type: 'doors', index: editedDetectedDoorIndex })
const nudgedDetectedDoor = nudgeManualOpeningAlongWall(editedDetectedDoor, 1, analysis, hiddenDetections, withEditedDetectedDoor)
const withNudgedDetectedDoor = updateReviewOpening(
  withEditedDetectedDoor,
  { type: 'doors', index: editedDetectedDoorIndex },
  nudgedDetectedDoor,
)
const detectedRetargetWallIndex = analysis.walls.findIndex((wall, index) => (
  index !== nudgedDetectedDoor.snap?.wallIndex &&
  !hiddenDetections.walls.includes(index) &&
  Math.abs(getWallAngle(wall) - nudgedDetectedDoor.rotation) > 0.1
))
const retargetedDetectedDoor = retargetManualOpeningToWall(
  nudgedDetectedDoor,
  `walls:${detectedRetargetWallIndex}`,
  analysis,
  hiddenDetections,
  withNudgedDetectedDoor,
)
const withRetargetedDetectedDoor = updateReviewOpening(
  withNudgedDetectedDoor,
  { type: 'doors', index: editedDetectedDoorIndex },
  retargetedDetectedDoor,
)
const snappedDetectedWindow = snapReviewOpeningToNearestWall(
  getReviewOpeningForDetection(analysis, addedWallsOnly, { type: 'windows', index: editedDetectedWindowIndex }),
  analysis,
  hiddenDetections,
  addedWallsOnly,
)
const withEditedDetectedOpenings = updateReviewOpening(
  withRetargetedDetectedDoor,
  { type: 'windows', index: editedDetectedWindowIndex },
  applyManualOpeningPreset(snappedDetectedWindow, 'window', 'wide', analysis),
)
const editedDetectedWindow = getReviewOpeningForDetection(analysis, withEditedDetectedOpenings, { type: 'windows', index: editedDetectedWindowIndex })
const nudgeStep = getManualOpeningNudgeStep(analysis)
const nudgedDoor = nudgeManualOpeningAlongWall(manualDoor, 1, analysis, hiddenDetections, addedWallsOnly)
const unsnappedOpening = { center: { x: 15, y: 20 }, width: 12, rotation: 0 }
const unchangedUnsnappedOpening = nudgeManualOpeningAlongWall(unsnappedOpening, 1, analysis, hiddenDetections, addedWallsOnly)
const doorWallLength = getWallLengthPx(analysis.walls[snappedDoor.snap.wallIndex])
const clampedDoor = nudgeManualOpeningAlongWall({
  ...manualDoor,
  positionAlongWall: doorWallLength + 1000,
  snap: { ...manualDoor.snap, t: 1 },
}, 1, analysis, hiddenDetections, addedWallsOnly)
const retargetWallIndex = analysis.walls.findIndex((wall, index) => (
  index !== snappedDoor.snap.wallIndex &&
  !hiddenDetections.walls.includes(index) &&
  Math.abs(getWallAngle(wall) - manualDoor.rotation) > 0.1
))
const retargetWallKey = `walls:${retargetWallIndex}`
const retargetedDoor = retargetManualOpeningToWall(manualDoor, retargetWallKey, analysis, hiddenDetections, addedWallsOnly)
const invalidRetargetedDoor = retargetManualOpeningToWall(manualDoor, 'walls:not-real', analysis, hiddenDetections, addedWallsOnly)
const addedDetections = {
  walls: [addedWall],
  doors: [manualDoor],
  windows: [manualWindow],
}
const manualDoorDragPoint = getPointAlongWall(
  analysis.walls[manualDoor.snap.wallIndex],
  manualDoor.positionAlongWall + nudgeStep * 2,
)
const withDraggedManualDoor = moveReviewOpeningToPoint(
  addedDetections,
  { type: 'addedDoors', index: 0 },
  manualDoorDragPoint,
  analysis,
  hiddenDetections,
)
const draggedManualDoor = getReviewOpeningForDetection(analysis, withDraggedManualDoor, { type: 'addedDoors', index: 0 })
const detectedDoorDragPoint = getPointAlongWall(
  analysis.walls[editedDetectedDoor.snap.wallIndex],
  editedDetectedDoor.positionAlongWall + nudgeStep * 2,
)
const withDraggedDetectedDoor = moveReviewOpeningToPoint(
  withEditedDetectedDoor,
  { type: 'doors', index: editedDetectedDoorIndex },
  detectedDoorDragPoint,
  analysis,
  hiddenDetections,
)
const draggedDetectedDoor = getReviewOpeningForDetection(analysis, withDraggedDetectedDoor, { type: 'doors', index: editedDetectedDoorIndex })
const unsnappedManualDoor = applyManualOpeningPreset({
  center: unsnappedOpening.center,
  rotation: unsnappedOpening.rotation,
  confidence: 1,
  source: 'manual_review',
}, 'door', 'single', analysis)
const withDraggedUnsnappedDoor = moveReviewOpeningToPoint(
  { walls: [], doors: [unsnappedManualDoor], windows: [] },
  { type: 'addedDoors', index: 0 },
  doorTap,
  analysis,
  hiddenDetections,
)
const draggedUnsnappedDoor = getReviewOpeningForDetection(analysis, withDraggedUnsnappedDoor, { type: 'addedDoors', index: 0 })
const hiddenOnlyFloorPlan = buildCorrectedFloorPlan(reviewPayload, hiddenDetections)
const editedDetectedWallFloorPlan = buildCorrectedFloorPlan(reviewPayload, hiddenDetections, withEditedDetectedWall)
const editedAddedWallFloorPlan = buildCorrectedFloorPlan(reviewPayload, hiddenDetections, withEditedAddedWall)
const editedDetectedOpeningFloorPlan = buildCorrectedFloorPlan(reviewPayload, hiddenDetections, withEditedDetectedOpenings)
const draggedDetectedOpeningFloorPlan = buildCorrectedFloorPlan(reviewPayload, hiddenDetections, withDraggedDetectedDoor)
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
assert(editedDetectedWallIndex >= 0, 'Fixture should have a visible wall for endpoint editing')
assert(countWallEndpointEdits(withEditedDetectedWall) === 1, 'Detected wall endpoint edit should be counted')
assert(editedDetectedWall.start.x === editedDetectedWallPoint.x && editedDetectedWall.start.y === editedDetectedWallPoint.y, 'Detected wall start endpoint was not edited')
assert(editedDetectedWall.end.x === editedDetectedSourceWall.end.x, 'Detected wall edit should preserve the opposite endpoint')
assert(editedDetectedWallSnap.snap?.wallKey === `walls:${editedDetectedWallIndex}`, 'Snapping should use edited detected wall geometry')
assert(editedDetectedWallFloorPlan.analysis.walls.some(wall => wall.start.x === editedDetectedWallPoint.x && wall.start.y === editedDetectedWallPoint.y), 'Corrected analysis should include edited detected wall geometry')
assert(editedDetectedWallFloorPlan.walls.length > 0, 'Edited detected wall should survive 3D conversion')
assert(editedAddedWall.end.x === editedAddedWallPoint.x && editedAddedWall.end.y === editedAddedWallPoint.y, 'Added wall end endpoint was not edited')
assert(editedAddedWallFloorPlan.analysis.walls.some(wall => wall.end.x === editedAddedWallPoint.x && wall.end.y === editedAddedWallPoint.y), 'Corrected analysis should include edited added wall geometry')
assert(editedAddedWallFloorPlan.stats.wallCount > hiddenOnlyFloorPlan.stats.wallCount, 'Edited added wall should survive 3D conversion')
assert(invalidWallEdit === addedWallsOnly, 'Invalid wall endpoint edit should leave additions unchanged')
assert(editedDetectedDoorIndex >= 0, 'Fixture should have a visible detected door for editing')
assert(editedDetectedWindowIndex >= 0, 'Fixture should have a visible detected window for editing')
assert(countOpeningEdits(withEditedDetectedOpenings) === 2, 'Detected opening edits should count edited door and window')
assert(editedDetectedDoor.doorType === 'double' && editedDetectedDoor.presetId === 'double', 'Detected door preset edit was not applied')
assert(editedDetectedDoor.width === doorPresets.find(preset => preset.id === 'double')?.width, 'Detected door width should use preset width')
assert(nudgedDetectedDoor.positionAlongWall > editedDetectedDoor.positionAlongWall, 'Detected door nudge should update position along wall')
assert(retargetedDetectedDoor.snap?.wallKey === `walls:${detectedRetargetWallIndex}`, 'Detected door retarget should update wall reference')
assert(retargetedDetectedDoor.snap.wallKey !== editedDetectedDoor.snap.wallKey, 'Detected door retarget should move to a different wall')
assert(editedDetectedWindow.presetId === 'wide' && editedDetectedWindow.width === windowPresets.find(preset => preset.id === 'wide')?.width, 'Detected window preset edit was not applied')
assert(editedDetectedOpeningFloorPlan.analysis.doors.some(door => door.presetId === 'double' && door.doorType === 'double'), 'Corrected analysis should include edited detected door')
assert(editedDetectedOpeningFloorPlan.analysis.windows.some(windowItem => windowItem.presetId === 'wide'), 'Corrected analysis should include edited detected window')
assert(editedDetectedOpeningFloorPlan.stats.doorCount > 0, 'Edited detected door should survive 3D conversion')
assert(editedDetectedOpeningFloorPlan.stats.windowCount > 0, 'Edited detected window should survive 3D conversion')
assert(editedDetectedOpeningFloorPlan.correctionSummary.openingEditCount === 2, 'Corrected floor plan summary is missing opening edits')
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
assert(nudgeStep === 8.42, 'Nudge step should use 0.25m from the fixture scale')
assert(nudgedDoor.snap?.wallKey === manualDoor.snap?.wallKey, 'Nudge should preserve snapped wall reference')
assert(nudgedDoor.presetId === manualDoor.presetId && nudgedDoor.doorType === manualDoor.doorType, 'Nudge should preserve preset and door type')
assert(Math.abs(nudgedDoor.positionAlongWall - manualDoor.positionAlongWall - nudgeStep) < 0.02, 'Nudge did not move by the expected step')
assert(nudgedDoor.center.x !== manualDoor.center.x || nudgedDoor.center.y !== manualDoor.center.y, 'Nudge did not update opening center')
assert(draggedManualDoor.snap?.wallKey === manualDoor.snap.wallKey, 'Direct manual opening drag should preserve snapped wall reference')
assert(draggedManualDoor.positionAlongWall > manualDoor.positionAlongWall, 'Direct manual opening drag should move along the wall')
assert(draggedManualDoor.width === manualDoor.width && draggedManualDoor.presetId === manualDoor.presetId, 'Direct manual opening drag should preserve preset sizing')
assert(draggedManualDoor.doorType === manualDoor.doorType, 'Direct manual opening drag should preserve door type')
assert(draggedDetectedDoor.snap?.wallKey === editedDetectedDoor.snap.wallKey, 'Direct detected opening drag should preserve snapped wall reference')
assert(draggedDetectedDoor.positionAlongWall > editedDetectedDoor.positionAlongWall, 'Direct detected opening drag should move along the wall')
assert(draggedDetectedDoor.width === editedDetectedDoor.width && draggedDetectedDoor.presetId === editedDetectedDoor.presetId, 'Direct detected opening drag should preserve preset sizing')
assert(draggedDetectedOpeningFloorPlan.analysis.doors.some(door => door.center?.x === draggedDetectedDoor.center.x && door.center?.y === draggedDetectedDoor.center.y), 'Direct detected opening drag should survive corrected analyzer payloads')
assert(draggedDetectedOpeningFloorPlan.stats.doorCount > 0, 'Direct detected opening drag should survive 3D conversion')
assert(draggedUnsnappedDoor.snap?.wallKey, 'Direct unsnapped opening drag should snap to the nearest visible wall')
assert(draggedUnsnappedDoor.center.x !== unsnappedManualDoor.center.x || draggedUnsnappedDoor.center.y !== unsnappedManualDoor.center.y, 'Direct unsnapped opening drag should update the opening center')
assert(unchangedUnsnappedOpening === unsnappedOpening, 'Unsnapped opening should remain unchanged when nudged')
assert(Math.abs(clampedDoor.positionAlongWall - (doorWallLength - manualDoor.width / 2)) < 0.02, 'Nudge should clamp opening within the wall bounds')
assert(clampedDoor.snap.t >= 0 && clampedDoor.snap.t <= 1, 'Clamped opening snap position should stay within the wall')
assert(retargetWallIndex >= 0, 'Fixture should have a visible wall suitable for retargeting')
assert(retargetedDoor.snap?.wallKey === retargetWallKey, 'Retarget should update snapped wall reference')
assert(retargetedDoor.snap.wallKey !== manualDoor.snap.wallKey, 'Retarget should move to a different wall')
assert(retargetedDoor.presetId === manualDoor.presetId && retargetedDoor.width === manualDoor.width, 'Retarget should preserve preset sizing')
assert(retargetedDoor.doorType === manualDoor.doorType && retargetedDoor.source === manualDoor.source, 'Retarget should preserve door metadata')
assert(Number.isFinite(retargetedDoor.positionAlongWall), 'Retarget should update position along wall')
assert(retargetedDoor.center.x !== manualDoor.center.x || retargetedDoor.center.y !== manualDoor.center.y, 'Retarget should update opening center')
assert(Math.abs(retargetedDoor.rotation - manualDoor.rotation) > 0.1, 'Retarget should update opening rotation for the new wall')
assert(invalidRetargetedDoor === manualDoor, 'Invalid retarget wall should leave the opening unchanged')
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
  nudgedDoorPosition: nudgedDoor.positionAlongWall,
  nudgeStep,
  retargetWall: retargetedDoor.snap,
  wallEdits: countWallEndpointEdits(withEditedDetectedWall),
  openingEdits: countOpeningEdits(withEditedDetectedOpenings),
  draggedOpening: draggedManualDoor.snap,
})
