#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'

const ROOT = process.cwd()
const QA_DIR = path.join(ROOT, 'fixtures/floor-plan-qa')
const MANIFEST_PATH = path.join(QA_DIR, 'manifest.json')
const RESULTS_DIR = path.join(QA_DIR, 'results')
const RAW_RESULTS_DIR = path.join(RESULTS_DIR, 'raw')
const REPORT_PATH = path.join(ROOT, 'tasks/floor-plan-qa-results.md')

const DEFAULT_THRESHOLDS = {
  walls: 0.95,
  doors: 0.9,
  windows: 0.9,
  rooms: 0.8,
  stairs: 1,
}

const COUNT_KEYS = ['walls', 'doors', 'windows', 'rooms', 'stairs']

function hasEnvValue(name) {
  return typeof process.env[name] === 'string' && process.env[name].trim() !== ''
}

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function loadEnvFile(filePath) {
  if (!fs.existsSync(filePath)) return

  const lines = fs.readFileSync(filePath, 'utf8').split(/\r?\n/)
  for (const line of lines) {
    const trimmed = line.trim()
    if (!trimmed || trimmed.startsWith('#') || !trimmed.includes('=')) continue

    const [key, ...rest] = trimmed.split('=')
    if (key.startsWith('VERCEL')) continue
    if (process.env[key]) continue

    let value = rest.join('=').trim()
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1)
    }

    process.env[key] = value
  }
}

function loadLocalEnv() {
  for (const fileName of ['.env.qa.local', '.env.production.local', '.env.local']) {
    loadEnvFile(path.join(ROOT, fileName))
  }
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

function rawResultPathFor(id) {
  return path.join(RAW_RESULTS_DIR, `${id}.json`)
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

function imagePathForFixture(fixture) {
  const sourcePath = path.join(QA_DIR, fixture.sourceFile)
  const renderedPath = sourcePath.replace(/\.pdf$/i, '.png')
  if (fixture.imageFile) return path.join(QA_DIR, fixture.imageFile)
  if (fs.existsSync(renderedPath)) return renderedPath
  return sourcePath
}

function scoreFixture(fixture, rawResult, thresholds) {
  const expected = fixtureExpectedCounts(fixture)
  const detected = rawResult ? detectedCounts(rawResult) : normalizeCounts()
  const reviewOnly = fixture.reviewOnly === true
  const missing = []
  const categoryScores = {}

  for (const key of COUNT_KEYS) {
    const expectedCount = expected[key]
    const detectedCount = detected[key]
    const coverage = expectedCount === 0
      ? (detectedCount === 0 ? 1 : 0)
      : Math.min(detectedCount / expectedCount, 1)

    const passed = reviewOnly || coverage >= thresholds[key]
    categoryScores[key] = { expected: expectedCount, detected: detectedCount, coverage, passed }
    if (!passed) missing.push(key)
  }

  const criticalMisses = Array.isArray(rawResult?.criticalMisses) ? rawResult.criticalMisses : []
  const placementOk = rawResult?.placementOk !== false
  const sourceReady = sourceExists(fixture)
  const resultReady = Boolean(rawResult)
  const demoReady = !reviewOnly && sourceReady && resultReady && missing.length === 0 && criticalMisses.length === 0 && placementOk

  return { expected, detected, categoryScores, missing, criticalMisses, placementOk, sourceReady, resultReady, reviewOnly, demoReady }
}

function statusLabel(score) {
  if (!score.sourceReady) return 'Missing fixture'
  if (!score.resultReady) return 'Needs run'
  if (score.reviewOnly) return 'Review-only'
  if (score.demoReady) return 'Demo-ready'
  return 'Needs work'
}

function formatCoverage(value) {
  return `${Math.round(value * 100)}%`
}

function formatScaleNote(scale) {
  if (!scale) return null

  const source = scale.source || 'unknown'
  const pixelsPerMeter = Number(scale.pixelsPerMeter)
  const confidence = Number(scale.confidence)
  const details = [`scale: ${source}`]

  if (Number.isFinite(pixelsPerMeter)) details.push(`${pixelsPerMeter.toFixed(1)} px/m`)
  if (Number.isFinite(confidence)) details.push(`${Math.round(confidence * 100)}% confidence`)

  return details.join(', ')
}

function buildReport(manifest, scores) {
  const generatedAt = new Date().toISOString()
  const scoredFixtures = scores.filter(item => !item.score.reviewOnly)
  const reviewOnlyFixtures = scores.filter(item => item.score.reviewOnly)
  const demoReadyCount = scoredFixtures.filter(item => item.score.demoReady).length
  const reviewReadyCount = reviewOnlyFixtures.filter(item => item.score.sourceReady && item.score.resultReady).length
  const lines = [
    '# Floor Plan QA Results',
    '',
    `Generated: ${generatedAt}`,
    '',
    `Demo-ready fixtures: ${demoReadyCount}/${scoredFixtures.length}`,
  ]

  if (reviewOnlyFixtures.length > 0) {
    lines.push(`Review-only real fixtures with results: ${reviewReadyCount}/${reviewOnlyFixtures.length}`)
  }

  lines.push(
    '',
    '| Fixture | Source | Status | Walls | Doors | Windows | Rooms | Stairs | Notes |',
    '|---|---|---|---:|---:|---:|---:|---:|---|',
  )

  for (const { fixture, result, score } of scores) {
    const source = score.sourceReady ? fixture.sourceFile : `missing: ${fixture.sourceFile}`
    const notes = [
      ...(score.criticalMisses || []),
      ...(Array.isArray(result?.notes) ? result.notes : result?.notes ? [result.notes] : []),
      formatScaleNote(result?.scale),
      ...(score.missing.length ? [`low coverage: ${score.missing.join(', ')}`] : []),
      score.placementOk ? null : 'placement failed',
      score.reviewOnly && !score.resultReady ? 'review-only real fixture; run analyzer to capture counts' : null,
    ].filter(Boolean).join('; ')

    const cells = COUNT_KEYS.map(key => {
      const item = score.categoryScores[key]
      if (score.reviewOnly) return score.resultReady ? `${item.detected} detected` : '-'
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
  )

  if (reviewOnlyFixtures.length > 0) {
    lines.push('- Review-only real fixtures report detected counts and notes, but do not affect demo-ready scoring.')
  }

  const allScoredReady = demoReadyCount === scoredFixtures.length
  const allReviewReady = reviewReadyCount === reviewOnlyFixtures.length

  lines.push(
    '',
    '## Next Action',
    '',
    allScoredReady && allReviewReady
      ? 'All scored fixtures are demo-ready. Review real fixture raw outputs and 3D placement before analyzer changes.'
      : allScoredReady
        ? 'Synthetic baseline is demo-ready. Run pending review-only real fixtures to gather real-world evidence.'
        : 'Run missing scored fixtures, record results, then focus analyzer changes on the lowest-coverage categories.',
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

  const hasFailingScoredFixture = scores.some(({ score }) => !score.reviewOnly && !score.demoReady)
  const hasMissingReviewSource = scores.some(({ score }) => score.reviewOnly && !score.sourceReady)

  if (check && (hasFailingScoredFixture || hasMissingReviewSource)) {
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

function createMockResponse() {
  return {
    statusCode: 200,
    payload: null,
    status(code) {
      this.statusCode = code
      return this
    },
    json(payload) {
      this.payload = payload
      return payload
    },
  }
}

async function runFixture(fixture) {
  loadLocalEnv()

  if (!hasEnvValue('OPENAI_API_KEY') && !hasEnvValue('GEMINI_API_KEY')) {
    throw new Error('Missing non-empty OPENAI_API_KEY or GEMINI_API_KEY. Sensitive Vercel values may pull as empty placeholders; set a key in .env.qa.local or export it before running fixtures.')
  }

  const imagePath = imagePathForFixture(fixture)
  if (!fs.existsSync(imagePath)) {
    throw new Error(`Missing rendered fixture image for ${fixture.id}: ${path.relative(ROOT, imagePath)}`)
  }

  process.env.SITEA_QA_BYPASS_SUBSCRIPTION = '1'

  const { default: handler } = await import('../api/analyze-floor-plan.js')
  const image = fs.readFileSync(imagePath).toString('base64')
  const req = {
    method: 'POST',
    headers: { 'x-sitea-qa-bypass': 'local-fixture-runner' },
    body: {
      image,
      knownWidthMeters: fixture.knownWidthMeters,
      roomHints: fixture.roomHints,
    },
  }
  const res = createMockResponse()

  await handler(req, res)

  if (res.statusCode >= 400 || !res.payload?.success) {
    throw new Error(`${fixture.id} analyzer failed with ${res.statusCode}: ${res.payload?.error || 'unknown error'}`)
  }

  writeJson(rawResultPathFor(fixture.id), res.payload)

  const result = {
    fixtureId: fixture.id,
    capturedAt: new Date().toISOString(),
    sourceFile: fixture.sourceFile,
    imageFile: path.relative(QA_DIR, imagePath),
    analyzer: 'api/analyze-floor-plan.js',
    rawResultFile: path.relative(QA_DIR, rawResultPathFor(fixture.id)),
    detected: detectedCounts(res.payload),
    criticalMisses: [],
    notes: ['local analyzer fixture run'],
    artifacts: {},
    placementOk: true,
    scale: res.payload.scale || null,
  }

  writeJson(resultPathFor(fixture.id), result)
  return result
}

async function runAnalyzer(args) {
  const manifest = loadManifest()
  const includeReviewOnly = args.includes('--all')
  const requestedFixtureIds = args.filter(arg => arg !== '--all')
  const fixtureIds = requestedFixtureIds.length
    ? requestedFixtureIds
    : manifest.fixtures
      .filter(fixture => includeReviewOnly || !fixture.reviewOnly)
      .map(fixture => fixture.id)

  for (const fixtureId of fixtureIds) {
    const fixture = manifest.fixtures.find(item => item.id === fixtureId)
    if (!fixture) throw new Error(`Unknown fixture id: ${fixtureId}`)

    console.log(`Running analyzer fixture: ${fixture.id}`)
    const result = await runFixture(fixture)
    console.log(`Recorded ${fixture.id}: ${COUNT_KEYS.map(key => `${key}=${result.detected[key]}`).join(', ')}`)
  }

  summarize()
}

async function main() {
  const [command = 'summarize', ...args] = process.argv.slice(2)

  if (command === 'summarize') return summarize()
  if (command === 'check') return summarize({ check: true })
  if (command === 'record') return record(args)
  if (command === 'run') return runAnalyzer(args)

  throw new Error(`Unknown command: ${command}`)
}

try {
  await main()
} catch (error) {
  console.error(error.message)
  process.exit(1)
}
