import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { convertFloorPlanToWorld } from '../src/utils/floorPlanConverter.js'

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

assert(existsSync(sourceImagePath), `Missing source image: ${sourceImagePath}`)
assert(analysis?.imageSize?.width > 0, 'Fixture analysis is missing image width')
assert(analysis?.imageSize?.height > 0, 'Fixture analysis is missing image height')
assert(reviewPayload.floorPlan.walls.length > 0, 'Converted fixture has no walls')
assert(reviewPayload.floorPlan.stats.wallCount === reviewPayload.floorPlan.walls.length, 'Wall stats do not match converted walls')
assert(Array.isArray(reviewPayload.analysis.walls), 'Review payload is missing raw walls')
assert(Array.isArray(reviewPayload.analysis.doors), 'Review payload is missing raw doors')
assert(Array.isArray(reviewPayload.analysis.windows), 'Review payload is missing raw windows')

console.log('Floor plan review QA passed', {
  source: reviewPayload.sourceFileName,
  walls: reviewPayload.floorPlan.stats.wallCount,
  doors: reviewPayload.floorPlan.stats.doorCount,
  windows: reviewPayload.floorPlan.stats.windowCount,
  rooms: reviewPayload.floorPlan.stats.roomCount,
  stairs: reviewPayload.floorPlan.stats.stairCount,
})
