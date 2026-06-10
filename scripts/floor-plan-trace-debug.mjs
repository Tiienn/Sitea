#!/usr/bin/env node
// Free local CV-trace debugger — no API keys, no model calls.
// Runs the analyzer's deterministic pipeline (resize → preprocess → run-link
// trace → junction split) on a sample image and writes a wall-overlay PNG
// plus bounds/connectivity stats, so trace quality can be inspected before
// touching analyzer logic.
//
// Usage: node scripts/floor-plan-trace-debug.mjs <image-path> [pixelsPerMeter]

import fs from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import sharp from 'sharp'
import { __qaInternals } from '../api/analyze-floor-plan.js'

const { resizeForGemini, preprocessImage, extractWallsFromCleanImage, splitWallsAtJunctions } = __qaInternals

const imagePath = process.argv[2]
const pixelsPerMeter = Number(process.argv[3]) || null

if (!imagePath || !fs.existsSync(imagePath)) {
  console.error('Usage: node scripts/floor-plan-trace-debug.mjs <image-path> [pixelsPerMeter]')
  process.exit(1)
}

const image = fs.readFileSync(imagePath).toString('base64')
const meta = await sharp(Buffer.from(image, 'base64')).metadata()
console.log(`Input: ${imagePath} (${meta.width}x${meta.height})`)

const { base64: resized, width: W, height: H } = await resizeForGemini(image)
const processed = await preprocessImage(resized)

// No OCR text boxes in the free path — prod additionally shields label areas.
const trace = await extractWallsFromCleanImage(processed, [], meta.width, meta.height)
console.log(`Raw trace: ${trace.walls.length} walls (trace space ${trace.imageWidth}x${trace.imageHeight})`)

const walls = splitWallsAtJunctions(trace.walls)
console.log(`After junction split: ${walls.length} walls`)

// Bounds + connectivity
const xs = walls.flatMap(w => [w.start.x, w.end.x])
const ys = walls.flatMap(w => [w.start.y, w.end.y])
const boundsPx = {
  minX: Math.min(...xs), maxX: Math.max(...xs),
  minY: Math.min(...ys), maxY: Math.max(...ys),
}
const widthPx = boundsPx.maxX - boundsPx.minX
const depthPx = boundsPx.maxY - boundsPx.minY
console.log(`Wall bounds: ${widthPx.toFixed(0)}px x ${depthPx.toFixed(0)}px ` +
  `(x ${boundsPx.minX.toFixed(0)}–${boundsPx.maxX.toFixed(0)}, y ${boundsPx.minY.toFixed(0)}–${boundsPx.maxY.toFixed(0)})`)
if (pixelsPerMeter) {
  console.log(`At ${pixelsPerMeter} px/m: ${(widthPx / pixelsPerMeter).toFixed(2)}m x ${(depthPx / pixelsPerMeter).toFixed(2)}m`)
}

const CONNECT_PX = 12
const endpoints = walls.flatMap((w, i) => [
  { x: w.start.x, y: w.start.y, wall: i },
  { x: w.end.x, y: w.end.y, wall: i },
])
let connected = 0
for (const ep of endpoints) {
  const hasNeighbor = endpoints.some(other =>
    other.wall !== ep.wall &&
    Math.abs(other.x - ep.x) <= CONNECT_PX &&
    Math.abs(other.y - ep.y) <= CONNECT_PX
  )
  if (hasNeighbor) connected++
}
console.log(`Endpoint connectivity: ${connected}/${endpoints.length} (${Math.round(connected / endpoints.length * 100)}%)`)

// Overlay PNG: walls drawn over the resized original
const lines = walls.map((w, i) =>
  `<line x1="${w.start.x}" y1="${w.start.y}" x2="${w.end.x}" y2="${w.end.y}" ` +
  `stroke="red" stroke-width="3" stroke-opacity="0.75"/>` +
  `<circle cx="${w.start.x}" cy="${w.start.y}" r="4" fill="lime"/>` +
  `<circle cx="${w.end.x}" cy="${w.end.y}" r="4" fill="lime"/>` +
  `<text x="${(w.start.x + w.end.x) / 2}" y="${(w.start.y + w.end.y) / 2 - 4}" ` +
  `font-size="11" fill="blue" text-anchor="middle">${i}</text>`
).join('\n')
const svg = `<svg width="${W}" height="${H}" xmlns="http://www.w3.org/2000/svg">${lines}</svg>`

const outPath = path.join('/tmp', `trace-debug-${path.basename(imagePath).replace(/\.[^.]+$/, '')}.png`)
await sharp(Buffer.from(resized, 'base64'))
  .composite([{ input: Buffer.from(svg), top: 0, left: 0 }])
  .png()
  .toFile(outPath)
console.log(`Overlay written: ${outPath}`)
