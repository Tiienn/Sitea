#!/usr/bin/env node

import fs from 'node:fs'
import path from 'node:path'
import { jsPDF } from 'jspdf'
import sharp from 'sharp'

const ROOT = process.cwd()
const SAMPLE_DIR = path.join(ROOT, 'fixtures/floor-plan-qa/samples')

const plans = [
  {
    id: 'single-storey-clear-scan',
    title: 'Single-storey clear scanned plan',
    contrast: '#111827',
    rooms: ['Living', 'Kitchen', 'Bed 1', 'Bed 2', 'Bath'],
    walls: [
      [120, 110, 1080, 110], [1080, 110, 1080, 720], [1080, 720, 120, 720], [120, 720, 120, 110],
      [120, 380, 720, 380], [720, 110, 720, 720], [410, 380, 410, 720], [410, 535, 720, 535],
      [720, 300, 1080, 300], [900, 300, 900, 720], [120, 250, 410, 250], [410, 250, 720, 250],
      [260, 110, 260, 250], [540, 110, 540, 250], [900, 110, 900, 300], [260, 250, 260, 380],
      [540, 250, 540, 380], [900, 520, 1080, 520],
    ],
    doors: [[390, 380], [720, 420], [410, 600], [900, 350], [900, 565], [260, 250]],
    windows: [[260, 110], [520, 110], [850, 110], [1080, 210], [1080, 610], [620, 720], [200, 720]],
  },
  {
    id: 'low-contrast-phone-scan',
    title: 'Low-contrast phone scan',
    contrast: '#3f3f46',
    rooms: ['Entry', 'Living', 'Dining', 'Kitchen', 'Bed', 'Bath'],
    walls: [
      [145, 130, 1050, 95], [1050, 95, 1105, 700], [1105, 700, 170, 735], [170, 735, 145, 130],
      [145, 360, 620, 340], [620, 110, 640, 720], [375, 350, 385, 725], [375, 525, 640, 520],
      [640, 270, 1070, 255], [870, 260, 885, 710], [145, 245, 375, 235], [375, 235, 630, 225],
      [260, 125, 270, 240], [505, 120, 515, 230], [850, 105, 865, 255], [265, 245, 275, 360],
      [515, 230, 525, 345], [875, 520, 1090, 510], [640, 420, 875, 410], [760, 410, 770, 710],
      [250, 530, 375, 525], [250, 530, 255, 730],
    ],
    doors: [[365, 350], [640, 420], [385, 605], [875, 345], [875, 565], [270, 245], [760, 520]],
    windows: [[285, 120], [520, 115], [855, 105], [1080, 220], [1095, 620], [640, 720], [220, 730], [145, 250]],
    rotate: -1.5,
  },
  {
    id: 'dimensioned-plan-with-stairs',
    title: 'Dimensioned scanned plan with stairs',
    contrast: '#111827',
    rooms: ['Lounge', 'Kitchen', 'Office', 'Bed 1', 'Bed 2', 'Bath', 'Store', 'Stairs'],
    walls: [
      [105, 95, 1120, 95], [1120, 95, 1120, 745], [1120, 745, 105, 745], [105, 745, 105, 95],
      [105, 335, 740, 335], [740, 95, 740, 745], [395, 335, 395, 745], [395, 540, 740, 540],
      [740, 265, 1120, 265], [920, 265, 920, 745], [105, 220, 395, 220], [395, 220, 740, 220],
      [255, 95, 255, 220], [555, 95, 555, 220], [920, 95, 920, 265], [255, 220, 255, 335],
      [555, 220, 555, 335], [920, 515, 1120, 515], [740, 420, 920, 420], [830, 420, 830, 745],
      [105, 540, 395, 540], [250, 540, 250, 745], [740, 620, 920, 620], [1000, 515, 1000, 745],
      [555, 540, 555, 745], [105, 650, 250, 650], [250, 650, 395, 650], [1000, 620, 1120, 620],
    ],
    doors: [[385, 335], [740, 410], [395, 610], [920, 335], [920, 560], [255, 220], [830, 535], [555, 620], [1000, 620]],
    windows: [[260, 95], [555, 95], [900, 95], [1120, 200], [1120, 620], [650, 745], [180, 745], [105, 230], [105, 610], [500, 745]],
    stairs: [[780, 450, 900, 610]],
    dimensions: ['12.0m', '8.0m', '3.2m'],
  },
]

function wallLines(walls, color) {
  return walls.map(([x1, y1, x2, y2]) => (
    `<line x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}" stroke="${color}" stroke-width="13" stroke-linecap="square"/>`
  )).join('\n')
}

function doorMarks(doors, color) {
  return doors.map(([x, y]) => (
    `<path d="M ${x - 34} ${y} A 34 34 0 0 1 ${x} ${y + 34}" fill="none" stroke="${color}" stroke-width="4"/>`
  )).join('\n')
}

function windowMarks(windows) {
  return windows.map(([x, y]) => (
    `<line x1="${x - 34}" y1="${y}" x2="${x + 34}" y2="${y}" stroke="#2563eb" stroke-width="5"/>`
  )).join('\n')
}

function stairMarks(stairs = []) {
  return stairs.map(([x1, y1, x2, y2]) => {
    const steps = []
    for (let i = 0; i < 7; i += 1) {
      const y = y1 + i * ((y2 - y1) / 7)
      steps.push(`<line x1="${x1}" y1="${y}" x2="${x2}" y2="${y}" stroke="#111827" stroke-width="3"/>`)
    }
    return `<g>${steps.join('\n')}</g>`
  }).join('\n')
}

function roomLabels(plan) {
  const positions = [
    [250, 300], [560, 300], [850, 190], [260, 620], [545, 635], [1010, 380], [1010, 610], [830, 545],
  ]
  return plan.rooms.map((room, index) => {
    const [x, y] = positions[index]
    return `<text x="${x}" y="${y}" font-family="Arial" font-size="27" fill="#52525b" text-anchor="middle">${room}</text>`
  }).join('\n')
}

function dimensionLabels(plan) {
  return (plan.dimensions || []).map((label, index) => (
    `<text x="${210 + index * 260}" y="825" font-family="Arial" font-size="24" fill="#71717a">${label}</text>`
  )).join('\n')
}

function svgFor(plan) {
  const rotation = plan.rotate
    ? `transform="rotate(${plan.rotate} 612 420)"`
    : ''

  return `<svg xmlns="http://www.w3.org/2000/svg" width="1224" height="864" viewBox="0 0 1224 864">
  <rect width="1224" height="864" fill="#f8f7f2"/>
  <rect x="28" y="28" width="1168" height="808" fill="none" stroke="#d4d4d8" stroke-width="2"/>
  <g opacity="0.18">
    <path d="M45 165 C260 120, 380 210, 600 165 S920 110, 1155 175" stroke="#a1a1aa" stroke-width="2" fill="none"/>
    <path d="M70 790 C260 730, 420 810, 610 760 S890 730, 1130 790" stroke="#a1a1aa" stroke-width="2" fill="none"/>
  </g>
  <g ${rotation}>
    ${wallLines(plan.walls, plan.contrast)}
    ${doorMarks(plan.doors, plan.contrast)}
    ${windowMarks(plan.windows)}
    ${stairMarks(plan.stairs)}
    ${roomLabels(plan)}
    ${dimensionLabels(plan)}
  </g>
  <text x="612" y="56" font-family="Arial" font-size="30" fill="#3f3f46" text-anchor="middle">${plan.title}</text>
</svg>`
}

async function writePlan(plan) {
  fs.mkdirSync(SAMPLE_DIR, { recursive: true })
  const pngPath = path.join(SAMPLE_DIR, `${plan.id}.png`)
  const pdfPath = path.join(SAMPLE_DIR, `${plan.id}.pdf`)

  const pngBuffer = await sharp(Buffer.from(svgFor(plan)))
    .png()
    .toBuffer()
  const jpegBuffer = await sharp(Buffer.from(svgFor(plan)))
    .jpeg({ quality: 82 })
    .toBuffer()

  fs.writeFileSync(pngPath, pngBuffer)

  const pdf = new jsPDF({ orientation: 'landscape', unit: 'pt', format: [864, 1224] })
  pdf.addImage(jpegBuffer.toString('base64'), 'JPEG', 0, 0, 1224, 864)
  fs.writeFileSync(pdfPath, Buffer.from(pdf.output('arraybuffer')))

  console.log(`Wrote ${path.relative(ROOT, pdfPath)}`)
}

for (const plan of plans) {
  await writePlan(plan)
}
