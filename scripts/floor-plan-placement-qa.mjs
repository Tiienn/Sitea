#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { convertFloorPlanToWorld } from '../src/utils/floorPlanConverter.js'

const ROOT = process.cwd()
const QA_DIR = path.join(ROOT, 'fixtures/floor-plan-qa')
const PLACEMENT_DIR = path.join(QA_DIR, 'placement')
const REPORT_PATH = path.join(ROOT, 'tasks/floor-plan-placement-qa.md')
const SCENE_PATH = path.join(PLACEMENT_DIR, 'real-floor-plan-scene.json')

const REAL_FIXTURES = [
  {
    id: 'real-wide-40x30',
    title: 'Real wide residential floor plan, 40 by 30 feet',
    rawResultFile: 'results/raw/real-wide-40x30.json',
    position: { x: -24, z: -7 },
    expectedBounds: { width: 12.19, depth: 9.14 },
  },
  {
    id: 'real-site-ground-floor',
    title: 'Real dimensioned site plan ground floor',
    rawResultFile: 'results/raw/real-site-ground-floor.json',
    position: { x: 0, z: 7 },
  },
  {
    id: 'real-site-upper-floor',
    title: 'Real dimensioned site plan upper floor',
    rawResultFile: 'results/raw/real-site-upper-floor.json',
    position: { x: 24, z: -7 },
  },
]

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, 'utf8'))
}

function writeJson(filePath, data) {
  fs.mkdirSync(path.dirname(filePath), { recursive: true })
  fs.writeFileSync(filePath, `${JSON.stringify(data, null, 2)}\n`)
}

function wallLength(wall) {
  return Math.hypot(wall.end.x - wall.start.x, wall.end.z - wall.start.z)
}

function summarizeBuilding(fixture, rawResult, converted) {
  const points = converted.walls.flatMap(wall => [wall.start, wall.end])
  const minX = Math.min(...points.map(point => point.x))
  const maxX = Math.max(...points.map(point => point.x))
  const minZ = Math.min(...points.map(point => point.z))
  const maxZ = Math.max(...points.map(point => point.z))
  const width = maxX - minX
  const depth = maxZ - minZ
  const rawWallCount = Array.isArray(rawResult.walls) ? rawResult.walls.length : 0
  const convertedWallCount = converted.walls.length
  const filteredWallCount = Math.max(0, rawWallCount - convertedWallCount)
  const openingCount = converted.walls.reduce((sum, wall) => sum + (wall.openings?.length || 0), 0)
  const lengths = converted.walls.map(wallLength)
  const shortestWall = lengths.length ? Math.min(...lengths) : 0
  const longestWall = lengths.length ? Math.max(...lengths) : 0
  const issues = []

  if (convertedWallCount === 0) issues.push('no converted walls')
  if (openingCount === 0 && ((rawResult.doors?.length || 0) + (rawResult.windows?.length || 0)) > 0) {
    issues.push('detected openings did not attach to converted walls')
  }
  if (rawWallCount > 0 && filteredWallCount / rawWallCount > 0.35) {
    issues.push(`converter filtered ${filteredWallCount}/${rawWallCount} detected walls`)
  }
  if (fixture.expectedBounds) {
    const widthRatio = width / fixture.expectedBounds.width
    const depthRatio = depth / fixture.expectedBounds.depth
    if (widthRatio < 0.8 || depthRatio < 0.8) {
      issues.push(`converted bounds are smaller than printed dimensions (${Math.round(widthRatio * 100)}% wide, ${Math.round(depthRatio * 100)}% deep)`)
    }
  }

  return {
    id: fixture.id,
    title: fixture.title,
    rawWallCount,
    convertedWallCount,
    filteredWallCount,
    doorCount: converted.stats.doorCount,
    windowCount: converted.stats.windowCount,
    roomCount: converted.stats.roomCount,
    stairCount: converted.stats.stairCount,
    openingCount,
    bounds: {
      width: Number(width.toFixed(2)),
      depth: Number(depth.toFixed(2)),
      minX: Number(minX.toFixed(2)),
      maxX: Number(maxX.toFixed(2)),
      minZ: Number(minZ.toFixed(2)),
      maxZ: Number(maxZ.toFixed(2)),
    },
    shortestWall: Number(shortestWall.toFixed(2)),
    longestWall: Number(longestWall.toFixed(2)),
    scale: rawResult.scale || null,
    warnings: converted.warnings,
    issues,
  }
}

function buildReport(summaries) {
  const generatedAt = new Date().toISOString()
  const lines = [
    '# Floor Plan Placement QA',
    '',
    `Generated: ${generatedAt}`,
    '',
    `Local scene: \`${path.relative(ROOT, SCENE_PATH)}\``,
    '',
    '| Fixture | Status | Raw Walls | 3D Walls | Doors | Windows | Rooms | Stairs | Bounds | Scale | Notes |',
    '|---|---|---:|---:|---:|---:|---:|---:|---:|---|---|',
  ]

  for (const summary of summaries) {
    const status = summary.issues.length ? 'Needs visual fix' : 'Visual QA candidate'
    const bounds = `${summary.bounds.width}m x ${summary.bounds.depth}m`
    const scale = summary.scale
      ? `${summary.scale.source || 'unknown'}, ${Number(summary.scale.pixelsPerMeter || 0).toFixed(1)} px/m, ${Math.round(Number(summary.scale.confidence || 0) * 100)}%`
      : '-'
    const notes = [
      ...summary.issues,
      ...summary.warnings,
      `shortest wall ${summary.shortestWall}m`,
      `longest wall ${summary.longestWall}m`,
    ].join('; ')

    lines.push([
      summary.id,
      status,
      summary.rawWallCount,
      summary.convertedWallCount,
      summary.doorCount,
      summary.windowCount,
      summary.roomCount,
      summary.stairCount,
      bounds,
      scale,
      notes || '-',
    ].join(' | ').replace(/^/, '| ').replace(/$/, ' |'))
  }

  lines.push(
    '',
    '## Browser QA Steps',
    '',
    '1. Start the local app.',
    '2. Load `fixtures/floor-plan-qa/placement/real-floor-plan-scene.json` into `localStorage.landVisualizer`.',
    '3. Open 3D orbit view and 2D view.',
    '4. Confirm the canvas is nonblank, all three buildings appear on the land, walls are not wildly fragmented, openings attach to walls, and scale looks plausible.',
    '',
  )

  return `${lines.join('\n')}\n`
}

function main() {
  const summaries = []
  const generatedBuildings = []

  for (const fixture of REAL_FIXTURES) {
    const rawResult = readJson(path.join(QA_DIR, fixture.rawResultFile))
    const converted = convertFloorPlanToWorld(rawResult)
    summaries.push(summarizeBuilding(fixture, rawResult, converted))
    generatedBuildings.push({
      id: `qa-${fixture.id}`,
      qaSource: fixture.id,
      title: fixture.title,
      position: fixture.position,
      rotation: 0,
      walls: converted.walls,
      rooms: converted.rooms,
      stairs: converted.stairs,
      stats: converted.stats,
    })
  }

  const scene = {
    dimensions: { length: 50, width: 70 },
    shapeMode: 'rectangle',
    polygonPoints: [],
    confirmedPolygon: null,
    placedBuildings: [],
    generatedBuildings,
    activeComparisons: {},
    walls: [],
  }

  writeJson(SCENE_PATH, scene)
  fs.writeFileSync(REPORT_PATH, buildReport(summaries))
  console.log(`Wrote ${path.relative(ROOT, SCENE_PATH)}`)
  console.log(`Wrote ${path.relative(ROOT, REPORT_PATH)}`)
}

main()
