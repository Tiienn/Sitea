#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const QA_DIR = path.join(ROOT, 'fixtures/floor-plan-qa')
const MANIFEST_PATH = path.join(QA_DIR, 'manifest.json')
const RESULTS_DIR = path.join(QA_DIR, 'results')
const REPORT_PATH = path.join(ROOT, 'tasks/floor-plan-qa-results.md')

const DEFAULT_THRESHOLDS = {
  walls: 0.95,
  doors: 0.9,
  windows: 0.9,
  rooms: 0.8,
  stairs: 1,
}

const COUNT_KEYS = ['walls', 'doors', 'windows', 'rooms', 'stairs']

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function loadManifest() {
  if (!fs.existsSync(MANIFEST_PATH)) {
    throw new Error(`Missing floor-plan QA manifest: ${MANIFEST_PATH}`)
  }

  const manifest = readJson(MANIFEST_PATH)
  if (!Array.isArray(manifest.fixtures) || manifest.fixtures.length < 3) {
    throw new Error('Floor-plan QA manifest must define at least 3 fixtures')
  }

  return {
    ...manifest,
    thresholds: { ...DEFAULT_THRESHOLDS, ...(manifest.thresholds || {}) },
  }
}

function resultPathFor(id) {
  return path.join(RESULTS_DIR, `${id}.json`)
}

function countArray(value) {
  return Array.isArray(value) ? value.length : 0
}

function countOpenings(walls, type) {
  if (!Array.isArray(walls)) return 0
  return walls.reduce((sum, wall) => {
    const openings = Array.isArray(wall.openings) ? wall.openings : []
    return sum + openings.filter(opening => opening?.type === type).length
  }, 0)
}

function detectedCounts(rawResult) {
  if (rawResult.detected) return normalizeCounts(rawResult.detected)

  return normalizeCounts({
    walls: countArray(rawResult.walls),
    doors: countArray(rawResult.doors) || countOpenings(rawResult.walls, 'door'),
    windows: countArray(rawResult.windows) || countOpenings(rawResult.walls, 'window'),
    rooms: countArray(rawResult.rooms),
    stairs: countArray(rawResult.stairs),
  })
}

function normalizeCounts(counts = {}) {
  return Object.fromEntries(COUNT_KEYS.map(key => [key, Number(counts[key] || 0)]))
}

function fixtureExpectedCounts(fixture) {
  return normalizeCounts(fixture.expected || {})
}

function sourceExists(fixture) {
  return Boolean(fixture.sourceFile && fs.existsSync(path.join(QA_DIR, fixture.sourceFile)))
}

function loadFixtureResult(fixture) {
  const filePath = resultPathFor(fixture.id)
  if (!fs.existsSync(filePath)) return null
  return readJson(filePath)
}

function scoreFixture(fixture, rawResult, thresholds) {
  const expected = fixtureExpectedCounts(fixture)
  const detected = rawResult ? detectedCounts(rawResult) : normalizeCounts()
  const missing = []
  const categoryScores = {}

  for (const key of COUNT_KEYS) {
    const expectedCount = expected[key]
    const detectedCount = detected[key]
    const coverage = expectedCount === 0
      ? (detectedCount === 0 ? 1 : 0)
      : Math.min(detectedCount / expectedCount, 1)

    const passed = coverage >= thresholds[key]
    categoryScores[key] = { expected: expectedCount, detected: detectedCount, coverage, passed }
    if (!passed) missing.push(key)
  }

  const criticalMisses = Array.isArray(rawResult?.criticalMisses) ? rawResult.criticalMisses : []
  const placementOk = rawResult?.placementOk !== false
  const sourceReady = sourceExists(fixture)
  const resultReady = Boolean(rawResult)
  const demoReady = sourceReady && resultReady && missing.length === 0 && criticalMisses.length === 0 && placementOk

  return { expected, detected, categoryScores, missing, criticalMisses, placementOk, sourceReady, resultReady, demoReady }
}

function statusLabel(score) {
  if (!score.sourceReady) return 'Missing fixture'
  if (!score.resultReady) return 'Needs run'
  if (score.demoReady) return 'Demo-ready'
  return 'Needs work'
}

function formatCoverage(value) {
  return `${Math.round(value * 100)}%`
}

function buildReport(manifest, scores) {
  const generatedAt = new Date().toISOString()
  const demoReadyCount = scores.filter(item => item.score.demoReady).length
  const lines = [
    '# Floor Plan QA Results',
    '',
    `Generated: ${generatedAt}`,
    '',
    `Demo-ready fixtures: ${demoReadyCount}/${scores.length}`,
    '',
    '| Fixture | Source | Status | Walls | Doors | Windows | Rooms | Stairs | Notes |',
    '|---|---|---|---:|---:|---:|---:|---:|---|',
  ]

  for (const { fixture, result, score } of scores) {
    const source = score.sourceReady ? fixture.sourceFile : `missing: ${fixture.sourceFile}`
    const notes = [
      ...(score.criticalMisses || []),
      ...(Array.isArray(result?.notes) ? result.notes : result?.notes ? [result.notes] : []),
      ...(score.missing.length ? [`low coverage: ${score.missing.join(', ')}`] : []),
      score.placementOk ? null : 'placement failed',
    ].filter(Boolean).join('; ')

    const cells = COUNT_KEYS.map(key => {
      const item = score.categoryScores[key]
      return `${item.detected}/${item.expected} (${formatCoverage(item.coverage)})`
    })

    lines.push([
      fixture.id,
      source,
      statusLabel(score),
      ...cells,
      notes || '-',
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push(
    '',
    '## Demo Readiness Rules',
    '',
    `- Walls: ${Math.round(manifest.thresholds.walls * 100)}% or better.`,
    `- Doors: ${Math.round(manifest.thresholds.doors * 100)}% or better.`,
    `- Windows: ${Math.round(manifest.thresholds.windows * 100)}% or better.`,
    `- Rooms: ${Math.round(manifest.thresholds.rooms * 100)}% or better.`,
    `- Stairs: ${Math.round(manifest.thresholds.stairs * 100)}% or better.`,
    '- No critical misses.',
    '- The generated building must be placeable in the 3D scene.',
    '',
    '## Next Action',
    '',
    demoReadyCount === scores.length
      ? 'All fixtures are demo-ready. Use this report as the baseline before analyzer changes.'
      : 'Run missing fixtures, record results, then focus analyzer changes on the lowest-coverage categories.',
    ''
  )

  return `${lines.join('\n')}\n`
}

function summarize({ check = false } = {}) {
  const manifest = loadManifest()
  const scores = manifest.fixtures.map(fixture => {
    const result = loadFixtureResult(fixture)
    return { fixture, result, score: scoreFixture(fixture, result, manifest.thresholds) }
  })

  fs.writeFileSync(REPORT_PATH, buildReport(manifest, scores))
  console.log(`Wrote ${path.relative(ROOT, REPORT_PATH)}`)

  if (check && scores.some(({ score }) => !score.demoReady)) {
    process.exitCode = 1
  }
}

function parseRecordArgs(args) {
  const [fixtureId, ...rest] = args
  if (!fixtureId) throw new Error('Usage: floor-plan-qa record <fixture-id> --walls N --doors N --windows N --rooms N --stairs N')

  const result = {
    fixtureId,
    capturedAt: new Date().toISOString(),
    detected: normalizeCounts(),
    criticalMisses: [],
    notes: [],
    artifacts: {},
    placementOk: true,
  }

  for (let i = 0; i < rest.length; i += 1) {
    const flag = rest[i]
    const value = rest[i + 1]

    if (COUNT_KEYS.some(key => flag === `--${key}`)) {
      result.detected[flag.slice(2)] = Number(value || 0)
      i += 1
    } else if (flag === '--miss') {
      result.criticalMisses.push(value || '')
      i += 1
    } else if (flag === '--note') {
      result.notes.push(value || '')
      i += 1
    } else if (flag === '--artifact') {
      const [name, artifactPath] = String(value || '').split('=')
      if (name && artifactPath) result.artifacts[name] = artifactPath
      i += 1
    } else if (flag === '--placement-ok') {
      result.placementOk = value !== 'false'
      i += 1
    } else {
      throw new Error(`Unknown argument: ${flag}`)
    }
  }

  return result
}

function record(args) {
  const manifest = loadManifest()
  const result = parseRecordArgs(args)
  const fixture = manifest.fixtures.find(item => item.id === result.fixtureId)
  if (!fixture) throw new Error(`Unknown fixture id: ${result.fixtureId}`)

  writeJson(resultPathFor(result.fixtureId), result)
  console.log(`Recorded ${path.relative(ROOT, resultPathFor(result.fixtureId))}`)
  summarize()
}

function main() {
  const [command = 'summarize', ...args] = process.argv.slice(2)

  if (command === 'summarize') return summarize()
  if (command === 'check') return summarize({ check: true })
  if (command === 'record') return record(args)

  throw new Error(`Unknown command: ${command}`)
}

try {
  main()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
