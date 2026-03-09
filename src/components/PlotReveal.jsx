import { useState, useRef, useCallback, useMemo } from 'react'

// ─── Comparison library ───
const COMPARISONS = [
  { id: 'parking',    name: 'Parking space',     area: 15,    color: '#94a3b8', w: 2.5,   h: 5     },
  { id: 'house',      name: '3-bed house',       area: 120,   color: '#f59e0b', w: 10,    h: 12    },
  { id: 'tennis',     name: 'Tennis court',       area: 260,   color: '#3b82f6', w: 10.97, h: 23.77 },
  { id: 'basketball', name: 'Basketball court',   area: 420,   color: '#ef4444', w: 15,    h: 28    },
  { id: 'avghouse',   name: 'Average house',      area: 836,   color: '#8b5cf6', w: 22,    h: 38    },
  { id: 'football',   name: 'Football pitch',     area: 7140,  color: '#22c55e', w: 68,    h: 105   },
  { id: 'walmart',    name: 'Walmart',            area: 16900, color: '#2563eb', w: 130,   h: 130   },
]

function autoSelect(sizeM2) {
  const sorted = [...COMPARISONS].sort((a, b) => a.area - b.area)
  let smaller = null, larger = null
  for (let i = 0; i < sorted.length; i++) {
    if (sorted[i].area <= sizeM2) smaller = sorted[i]
    if (sorted[i].area > sizeM2 && !larger) larger = sorted[i]
  }
  if (smaller && larger) return [smaller, larger]
  if (!smaller) return [sorted[0], sorted[1]]
  return [sorted[sorted.length - 2], sorted[sorted.length - 1]]
}

function getRatioText(sizeM2, comp) {
  const ratio = sizeM2 / comp.area
  if (ratio >= 1) return `Your plot fits ${ratio.toFixed(1)} ${comp.name}s`
  const article = /^[aeiou]/i.test(comp.name) ? 'an' : 'a'
  return `Your plot is ${(ratio * 100).toFixed(0)}% of ${article} ${comp.name}`
}

function formatSize(sizeM2, unit) {
  if (unit === 'sqft') return `${Math.round(sizeM2 / 0.092903).toLocaleString()} ft²`
  if (unit === 'acres') return `${(sizeM2 / 4046.86).toFixed(2)} acres`
  return `${Math.round(sizeM2).toLocaleString()} m²`
}

// ─── Basketball court: top-down 2D ───
// Simplified but accurate: half-court, center circle, keys, free-throw arcs, 3-point lines, baskets
// All elements clipped inside the court boundary
function BasketballCourtDetail({ x, y, w, h, color }) {
  const sw = Math.max(w * 0.012, 0.1)
  const cx = x + w / 2
  const clipId = `court-clip-${Math.random().toString(36).slice(2, 8)}`

  // FIBA proportions scaled to w×h
  const keyW = w * 0.327    // 4.9/15
  const keyH = h * 0.207    // 5.8/28
  const basketDist = h * 0.056  // 1.575/28 from baseline
  const threeR = w * 0.45   // 6.75/15
  const centerR = w * 0.12  // 1.8/15
  const ftR = keyW / 2

  return (
    <g opacity="0.5" fill="none" stroke={color} strokeWidth={sw}>
      <defs>
        <clipPath id={clipId}>
          <rect x={x} y={y} width={w} height={h} />
        </clipPath>
      </defs>
      <g clipPath={`url(#${clipId})`}>
        {/* Half-court line */}
        <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} />
        {/* Center circle */}
        <circle cx={cx} cy={y + h / 2} r={centerR} />

        {/* === TOP HALF === */}
        {/* Key */}
        <rect x={cx - keyW / 2} y={y} width={keyW} height={keyH} />
        {/* Free-throw semicircle (inside key, dashed) */}
        <path d={`M ${cx - ftR} ${y + keyH} A ${ftR} ${ftR} 0 0 1 ${cx + ftR} ${y + keyH}`} strokeDasharray={`${sw * 4} ${sw * 3}`} />
        {/* Free-throw semicircle (outside key, solid) */}
        <path d={`M ${cx + ftR} ${y + keyH} A ${ftR} ${ftR} 0 0 1 ${cx - ftR} ${y + keyH}`} />
        {/* Backboard */}
        <line x1={cx - w * 0.06} y1={y + basketDist * 0.6} x2={cx + w * 0.06} y2={y + basketDist * 0.6} strokeWidth={sw * 2} />
        {/* Rim */}
        <circle cx={cx} cy={y + basketDist} r={w * 0.016} />
        {/* 3-point arc (clipped to court) */}
        <circle cx={cx} cy={y + basketDist} r={threeR} />

        {/* === BOTTOM HALF (mirrored) === */}
        <rect x={cx - keyW / 2} y={y + h - keyH} width={keyW} height={keyH} />
        <path d={`M ${cx - ftR} ${y + h - keyH} A ${ftR} ${ftR} 0 0 0 ${cx + ftR} ${y + h - keyH}`} strokeDasharray={`${sw * 4} ${sw * 3}`} />
        <path d={`M ${cx + ftR} ${y + h - keyH} A ${ftR} ${ftR} 0 0 0 ${cx - ftR} ${y + h - keyH}`} />
        <line x1={cx - w * 0.06} y1={y + h - basketDist * 0.6} x2={cx + w * 0.06} y2={y + h - basketDist * 0.6} strokeWidth={sw * 2} />
        <circle cx={cx} cy={y + h - basketDist} r={w * 0.016} />
        <circle cx={cx} cy={y + h - basketDist} r={threeR} />
      </g>
    </g>
  )
}

// ─── Parking space: top-down ───
function ParkingDetail({ x, y, w, h, color }) {
  const sw = Math.max(w * 0.025, 0.1)
  const cx = x + w / 2
  const cy = y + h / 2
  return (
    <g opacity="0.5" fill="none" stroke={color} strokeWidth={sw}>
      {/* P letter */}
      <text x={cx} y={cy + h * 0.08} textAnchor="middle" fontSize={h * 0.35} fontWeight="700" fontFamily="DM Sans, sans-serif" fill={color} fillOpacity="0.25" stroke="none">P</text>
      {/* Divider lines (left and right border stripes) */}
      <line x1={x + w * 0.05} y1={y} x2={x + w * 0.05} y2={y + h} strokeWidth={sw * 1.5} />
      <line x1={x + w * 0.95} y1={y} x2={x + w * 0.95} y2={y + h} strokeWidth={sw * 1.5} />
    </g>
  )
}

// ─── Tennis court: top-down with all markings ───
function TennisCourtDetail({ x, y, w, h, color }) {
  const sw = Math.max(w * 0.012, 0.1)
  const cx = x + w / 2
  // Proportions: court 10.97m × 23.77m
  const alleyW = w * 0.137  // 1.37/10.97 doubles alley each side
  const serviceH = h * 0.279 // 6.4/23.77 service box depth from net
  return (
    <g opacity="0.5" fill="none" stroke={color} strokeWidth={sw}>
      {/* Singles sidelines */}
      <line x1={x + alleyW} y1={y} x2={x + alleyW} y2={y + h} />
      <line x1={x + w - alleyW} y1={y} x2={x + w - alleyW} y2={y + h} />
      {/* Net / halfway line */}
      <line x1={x} y1={y + h / 2} x2={x + w} y2={y + h / 2} strokeWidth={sw * 1.5} />
      {/* Service lines */}
      <line x1={x + alleyW} y1={y + h / 2 - serviceH} x2={x + w - alleyW} y2={y + h / 2 - serviceH} />
      <line x1={x + alleyW} y1={y + h / 2 + serviceH} x2={x + w - alleyW} y2={y + h / 2 + serviceH} />
      {/* Center service line */}
      <line x1={cx} y1={y + h / 2 - serviceH} x2={cx} y2={y + h / 2 + serviceH} />
      {/* Center marks on baselines */}
      <line x1={cx} y1={y} x2={cx} y2={y + h * 0.03} />
      <line x1={cx} y1={y + h} x2={cx} y2={y + h - h * 0.03} />
    </g>
  )
}

// ─── Football/soccer pitch: top-down with markings ───
function FootballPitchDetail({ x, y, w, h, color }) {
  const sw = Math.max(w * 0.008, 0.1)
  const cx = x + w / 2
  const cy = y + h / 2
  // Proportions: 68m × 105m
  const penW = w * 0.588    // 40/68 penalty area width
  const penH = h * 0.157    // 16.5/105 penalty area depth
  const goalW = w * 0.265   // 18/68 goal area width
  const goalH = h * 0.052   // 5.5/105 goal area depth
  const centerR = w * 0.135 // 9.15/68 center circle radius
  const penSpot = h * 0.105 // 11/105 penalty spot from goal line
  const cornerR = w * 0.013 // ~0.9/68
  return (
    <g opacity="0.5" fill="none" stroke={color} strokeWidth={sw}>
      {/* Halfway line */}
      <line x1={x} y1={cy} x2={x + w} y2={cy} />
      {/* Center circle + spot */}
      <circle cx={cx} cy={cy} r={centerR} />
      <circle cx={cx} cy={cy} r={sw} fill={color} />
      {/* === Top half === */}
      {/* Penalty area */}
      <rect x={cx - penW / 2} y={y} width={penW} height={penH} />
      {/* Goal area */}
      <rect x={cx - goalW / 2} y={y} width={goalW} height={goalH} />
      {/* Penalty spot */}
      <circle cx={cx} cy={y + penSpot} r={sw} fill={color} />
      {/* Penalty arc (outside penalty area) */}
      <path d={`M ${cx - centerR * 0.7} ${y + penH} A ${centerR} ${centerR} 0 0 1 ${cx + centerR * 0.7} ${y + penH}`} />
      {/* Corner arcs */}
      <path d={`M ${x + cornerR} ${y} A ${cornerR} ${cornerR} 0 0 1 ${x} ${y + cornerR}`} />
      <path d={`M ${x + w - cornerR} ${y} A ${cornerR} ${cornerR} 0 0 0 ${x + w} ${y + cornerR}`} />
      {/* === Bottom half (mirrored) === */}
      <rect x={cx - penW / 2} y={y + h - penH} width={penW} height={penH} />
      <rect x={cx - goalW / 2} y={y + h - goalH} width={goalW} height={goalH} />
      <circle cx={cx} cy={y + h - penSpot} r={sw} fill={color} />
      <path d={`M ${cx - centerR * 0.7} ${y + h - penH} A ${centerR} ${centerR} 0 0 0 ${cx + centerR * 0.7} ${y + h - penH}`} />
      <path d={`M ${x + cornerR} ${y + h} A ${cornerR} ${cornerR} 0 0 0 ${x} ${y + h - cornerR}`} />
      <path d={`M ${x + w - cornerR} ${y + h} A ${cornerR} ${cornerR} 0 0 1 ${x + w} ${y + h - cornerR}`} />
    </g>
  )
}

// ─── Walmart: top-down building footprint ───
function WalmartDetail({ x, y, w, h, color }) {
  const sw = Math.max(w * 0.008, 0.1)
  return (
    <g opacity="0.5" fill="none" stroke={color} strokeWidth={sw}>
      {/* Entrance vestibule (front center) */}
      <rect x={x + w * 0.35} y={y + h * 0.88} width={w * 0.3} height={h * 0.12} fill={color} fillOpacity="0.08" />
      {/* Internal grid lines (aisles) */}
      {[0.2, 0.35, 0.5, 0.65, 0.8].map((pct, i) => (
        <line key={i} x1={x + w * pct} y1={y + h * 0.05} x2={x + w * pct} y2={y + h * 0.82} opacity="0.4" />
      ))}
      {/* Back wall / loading dock */}
      <line x1={x + w * 0.6} y1={y} x2={x + w * 0.85} y2={y} strokeWidth={sw * 2.5} opacity="0.3" />
      {/* Walmart spark */}
      <text x={x + w / 2} y={y + h * 0.55} textAnchor="middle" fontSize={h * 0.12} fontWeight="700" fontFamily="DM Sans, sans-serif" fill={color} fillOpacity="0.2" stroke="none">✱</text>
    </g>
  )
}

// ─── House floor plan: realistic residential layout ───
// Top-down: living room, kitchen, 3 bedrooms, bathroom, hallway, front door
function HouseDetail({ x, y, w, h, color }) {
  const sw = Math.max(w * 0.012, 0.1)
  return (
    <g opacity="0.45" fill="none" stroke={color} strokeWidth={sw}>
      {/* === Ground floor (bottom 55%) === */}
      {/* Horizontal split: ground / upper */}
      <line x1={x} y1={y + h * 0.45} x2={x + w} y2={y + h * 0.45} />

      {/* Hallway (center corridor, ground floor) */}
      <line x1={x + w * 0.4} y1={y + h * 0.45} x2={x + w * 0.4} y2={y + h} />
      <line x1={x + w * 0.6} y1={y + h * 0.45} x2={x + w * 0.6} y2={y + h * 0.75} />

      {/* Living room (left, ground floor) */}
      {/* Window on left wall */}
      <line x1={x} y1={y + h * 0.55} x2={x} y2={y + h * 0.7} strokeWidth={sw * 2.5} opacity="0.3" />
      {/* Sofa indication */}
      <rect x={x + w * 0.04} y={y + h * 0.6} width={w * 0.12} height={h * 0.12} rx={sw * 2} strokeDasharray={`${sw * 3} ${sw * 3}`} />

      {/* Kitchen (right, ground floor bottom) */}
      <line x1={x + w * 0.6} y1={y + h * 0.75} x2={x + w} y2={y + h * 0.75} />
      {/* Counter along right wall */}
      <line x1={x + w * 0.92} y1={y + h * 0.76} x2={x + w * 0.92} y2={y + h * 0.98} />
      {/* Sink circle */}
      <circle cx={x + w * 0.78} cy={y + h * 0.93} r={w * 0.025} />

      {/* Front door (bottom center) */}
      <rect x={x + w * 0.44} y={y + h * 0.95} width={w * 0.12} height={h * 0.05} fill={color} fillOpacity="0.15" />
      {/* Door swing */}
      <path d={`M ${x + w * 0.44} ${y + h * 0.95} A ${w * 0.12} ${w * 0.12} 0 0 0 ${x + w * 0.44 + w * 0.12} ${y + h * 0.95}`} strokeDasharray={`${sw * 3} ${sw * 2}`} />

      {/* === Upper floor (top 45%) === */}
      {/* Bedroom 1 (master, top-left) */}
      <line x1={x + w * 0.55} y1={y} x2={x + w * 0.55} y2={y + h * 0.25} />
      {/* Bed */}
      <rect x={x + w * 0.06} y={y + h * 0.04} width={w * 0.2} height={h * 0.12} rx={sw} strokeDasharray={`${sw * 3} ${sw * 3}`} />
      {/* Window top */}
      <line x1={x + w * 0.15} y1={y} x2={x + w * 0.35} y2={y} strokeWidth={sw * 2.5} opacity="0.3" />

      {/* Bedroom 2 (top-right) */}
      {/* Bed */}
      <rect x={x + w * 0.62} y={y + h * 0.04} width={w * 0.18} height={h * 0.1} rx={sw} strokeDasharray={`${sw * 3} ${sw * 3}`} />
      {/* Window top */}
      <line x1={x + w * 0.65} y1={y} x2={x + w * 0.85} y2={y} strokeWidth={sw * 2.5} opacity="0.3" />

      {/* Horizontal split for bedroom 3 + bathroom */}
      <line x1={x + w * 0.55} y1={y + h * 0.25} x2={x + w} y2={y + h * 0.25} />

      {/* Bedroom 3 (mid-right) */}
      <line x1={x + w * 0.55} y1={y + h * 0.25} x2={x + w * 0.55} y2={y + h * 0.45} />
      <rect x={x + w * 0.62} y={y + h * 0.28} width={w * 0.16} height={h * 0.08} rx={sw} strokeDasharray={`${sw * 3} ${sw * 3}`} />

      {/* Bathroom (mid-left small room) */}
      <line x1={x} y1={y + h * 0.3} x2={x + w * 0.25} y2={y + h * 0.3} />
      <line x1={x + w * 0.25} y1={y + h * 0.25} x2={x + w * 0.25} y2={y + h * 0.45} />
      {/* Tub */}
      <rect x={x + w * 0.03} y={y + h * 0.32} width={w * 0.08} height={h * 0.1} rx={sw * 3} />
      {/* Toilet */}
      <circle cx={x + w * 0.18} cy={y + h * 0.38} r={w * 0.02} />

      {/* Stairs indication (center) */}
      {[0, 1, 2, 3].map(i => (
        <line key={i} x1={x + w * 0.3} y1={y + h * (0.26 + i * 0.04)} x2={x + w * 0.5} y2={y + h * (0.26 + i * 0.04)} opacity="0.4" />
      ))}
    </g>
  )
}

// ─── Average house floor plan: simple single-floor layout ───
// Living/dining open plan, kitchen, master bed + ensuite, 2 bedrooms, 1 bathroom, doors
function AvgHouseDetail({ x, y, w, h, color }) {
  const sw = Math.max(w * 0.01, 0.1)
  const dr = w * 0.08 // door swing radius
  return (
    <g opacity="0.45" fill="none" stroke={color} strokeWidth={sw}>
      {/* === Horizontal split: top bedrooms (40%) | bottom living (60%) === */}
      <line x1={x} y1={y + h * 0.4} x2={x + w} y2={y + h * 0.4} />

      {/* === TOP: Bedrooms === */}
      {/* Master bedroom (top-left, 55% width) */}
      <line x1={x + w * 0.55} y1={y} x2={x + w * 0.55} y2={y + h * 0.4} />
      {/* Bed */}
      <rect x={x + w * 0.05} y={y + h * 0.05} width={w * 0.22} height={h * 0.13} rx={sw} strokeDasharray={`${sw * 3} ${sw * 3}`} />
      {/* En-suite (bottom-left corner of master) */}
      <line x1={x} y1={y + h * 0.24} x2={x + w * 0.22} y2={y + h * 0.24} />
      <line x1={x + w * 0.22} y1={y + h * 0.24} x2={x + w * 0.22} y2={y + h * 0.4} />
      {/* Toilet */}
      <circle cx={x + w * 0.08} cy={y + h * 0.32} r={w * 0.018} />
      {/* Shower tray */}
      <rect x={x + w * 0.14} y={y + h * 0.28} width={w * 0.06} height={h * 0.08} rx={sw * 2} />
      {/* En-suite door */}
      <path d={`M ${x + w * 0.22} ${y + h * 0.24} A ${dr} ${dr} 0 0 1 ${x + w * 0.22 + dr} ${y + h * 0.24 + dr}`} strokeDasharray={`${sw * 2} ${sw * 2}`} />
      {/* Master door */}
      <path d={`M ${x + w * 0.38} ${y + h * 0.4} A ${dr} ${dr} 0 0 0 ${x + w * 0.38 + dr} ${y + h * 0.4 - dr}`} strokeDasharray={`${sw * 2} ${sw * 2}`} />

      {/* Bedroom 2 (top-right upper) */}
      <line x1={x + w * 0.55} y1={y + h * 0.2} x2={x + w} y2={y + h * 0.2} />
      <rect x={x + w * 0.62} y={y + h * 0.04} width={w * 0.16} height={h * 0.1} rx={sw} strokeDasharray={`${sw * 3} ${sw * 3}`} />
      {/* Door */}
      <path d={`M ${x + w * 0.55} ${y + h * 0.14} A ${dr} ${dr} 0 0 1 ${x + w * 0.55 + dr} ${y + h * 0.14 + dr}`} strokeDasharray={`${sw * 2} ${sw * 2}`} />

      {/* Bedroom 3 (top-right lower) */}
      <rect x={x + w * 0.62} y={y + h * 0.24} width={w * 0.16} height={h * 0.1} rx={sw} strokeDasharray={`${sw * 3} ${sw * 3}`} />
      {/* Door */}
      <path d={`M ${x + w * 0.55} ${y + h * 0.34} A ${dr} ${dr} 0 0 1 ${x + w * 0.55 + dr} ${y + h * 0.34 + dr}`} strokeDasharray={`${sw * 2} ${sw * 2}`} />

      {/* Bathroom (between bed 2 & 3, right wall) */}
      <line x1={x + w * 0.82} y1={y + h * 0.2} x2={x + w * 0.82} y2={y + h * 0.4} />
      <rect x={x + w * 0.85} y={y + h * 0.22} width={w * 0.06} height={h * 0.06} rx={sw * 3} />
      <circle cx={x + w * 0.88} cy={y + h * 0.34} r={w * 0.018} />

      {/* === BOTTOM: Living area === */}
      {/* Kitchen (bottom-right) */}
      <line x1={x + w * 0.6} y1={y + h * 0.4} x2={x + w * 0.6} y2={y + h} />
      {/* Counter along right + bottom walls */}
      <line x1={x + w * 0.94} y1={y + h * 0.44} x2={x + w * 0.94} y2={y + h * 0.94} />
      <line x1={x + w * 0.64} y1={y + h * 0.94} x2={x + w * 0.94} y2={y + h * 0.94} />
      {/* Sink */}
      <circle cx={x + w * 0.78} cy={y + h * 0.94} r={w * 0.018} />

      {/* Living + dining (bottom-left, open plan) */}
      {/* Sofa */}
      <rect x={x + w * 0.05} y={y + h * 0.7} width={w * 0.25} height={h * 0.08} rx={sw * 2} strokeDasharray={`${sw * 3} ${sw * 3}`} />
      {/* Dining table */}
      <rect x={x + w * 0.28} y={y + h * 0.48} width={w * 0.16} height={h * 0.1} rx={sw} strokeDasharray={`${sw * 3} ${sw * 3}`} />

      {/* Front door (bottom-left wall) */}
      <rect x={x + w * 0.18} y={y + h * 0.94} width={w * 0.1} height={h * 0.05} fill={color} fillOpacity="0.15" />
      <path d={`M ${x + w * 0.18} ${y + h * 0.94} A ${dr} ${dr} 0 0 0 ${x + w * 0.18 + dr} ${y + h * 0.94 - dr}`} strokeDasharray={`${sw * 2} ${sw * 2}`} />
    </g>
  )
}

// ─── Share image via Canvas API — crops to content bounds ───
async function generateShareImage(sizeM2, unit, ratioStr, svgEl, contentBounds) {
  const canvasW = 1080
  const headerH = 150  // title + ratio text
  const footerH = 64   // branding
  const sidePad = 50

  // Crop SVG to just the 3 elements
  const svgPad = 5 // SVG-unit padding around content
  const cropX = contentBounds.x - svgPad
  const cropY = contentBounds.y - svgPad
  const cropW = contentBounds.w + svgPad * 2
  const cropH = contentBounds.h + svgPad * 2
  const svgAspect = cropW / cropH

  // Fit SVG into available width, derive height
  const availW = canvasW - sidePad * 2
  let svgDrawW = availW
  let svgDrawH = svgDrawW / svgAspect

  // Enforce max 1.5:1 aspect ratio (w:h) for chat thumbnail previews
  const minCanvasH = canvasW / 1.5
  const maxCanvasH = canvasW * 1.5
  let canvasH = headerH + svgDrawH + footerH
  if (canvasH < minCanvasH) canvasH = minCanvasH
  if (canvasH > maxCanvasH) {
    canvasH = maxCanvasH
    // Shrink SVG to fit within the capped height
    svgDrawH = canvasH - headerH - footerH
    svgDrawW = svgDrawH * svgAspect
  }
  const canvas = document.createElement('canvas')
  canvas.width = canvasW
  canvas.height = canvasH
  const ctx = canvas.getContext('2d')

  // Background
  ctx.fillStyle = '#FAFAF8'
  ctx.fillRect(0, 0, canvasW, canvasH)

  // Header: size label + ratio
  ctx.fillStyle = '#1e293b'
  ctx.font = 'bold 52px Outfit, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText(formatSize(sizeM2, unit), canvasW / 2, 76)
  ctx.fillStyle = '#64748b'
  ctx.font = '26px DM Sans, sans-serif'
  ctx.fillText(`≈ ${ratioStr}`, canvasW / 2, 120)

  // Render cropped SVG
  if (svgEl) {
    const clone = svgEl.cloneNode(true)
    clone.setAttribute('xmlns', 'http://www.w3.org/2000/svg')
    clone.querySelectorAll('*').forEach(el => {
      if (el.style?.animation) el.style.animation = 'none'
    })
    clone.querySelectorAll('text').forEach(t => {
      if (t.textContent?.trim() === 'Drag to compare') t.remove()
    })

    // Set viewBox to content bounds only
    clone.setAttribute('viewBox', `${cropX} ${cropY} ${cropW} ${cropH}`)
    clone.setAttribute('width', svgDrawW)
    clone.setAttribute('height', svgDrawH)
    clone.removeAttribute('class')

    const svgData = new XMLSerializer().serializeToString(clone)
    const dataUrl = `data:image/svg+xml;base64,${btoa(unescape(encodeURIComponent(svgData)))}`

    try {
      const img = new Image()
      await new Promise((resolve, reject) => {
        img.onload = resolve
        img.onerror = reject
        img.src = dataUrl
      })
      ctx.drawImage(img, (canvasW - svgDrawW) / 2, headerH, svgDrawW, svgDrawH)
    } catch { /* SVG render failed — text-only fallback */ }
  }

  // Branding
  ctx.fillStyle = '#94a3b8'
  ctx.font = '22px DM Sans, sans-serif'
  ctx.textAlign = 'center'
  ctx.fillText('sitea.live', canvasW / 2, canvasH - 24)

  return new Promise(resolve => canvas.toBlob(resolve, 'image/png'))
}

// ─── Component ───
export default function PlotReveal({ sizeM2, unit = 'sqm', onDesign3D, onBack }) {
  const [copied, setCopied] = useState(false)
  const [focusedComp, setFocusedComp] = useState(null) // index of last-dragged comparison
  const svgRef = useRef(null)
  const dragState = useRef(null)

  const selected = useMemo(() => autoSelect(sizeM2), [sizeM2])
  const displaySize = useMemo(() => formatSize(sizeM2, unit), [sizeM2, unit])

  // Ratio text — changes based on which comparison is focused
  const ratioComp = focusedComp !== null ? selected[focusedComp] : (
    selected.reduce((a, b) => Math.abs(a.area - sizeM2) < Math.abs(b.area - sizeM2) ? a : b)
  )
  const ratio = getRatioText(sizeM2, ratioComp)

  // SVG layout
  const plotSide = Math.sqrt(sizeM2)
  const svgW = 100
  const plotDisplaySize = svgW * 0.6
  const plotScale = plotDisplaySize / plotSide
  const plotX = (svgW - plotDisplaySize) / 2
  const plotY = 6
  const compY = plotY + plotDisplaySize + 10
  const compGap = 4
  const comp0W = selected[0].w * plotScale
  const comp0H = selected[0].h * plotScale
  const comp1W = selected[1].w * plotScale
  const comp1H = selected[1].h * plotScale
  const totalCompW = comp0W + compGap + comp1W
  const compStartX = (svgW - totalCompW) / 2
  const maxCompH = Math.max(comp0H, comp1H)
  const labelH = 9
  const svgH = compY + maxCompH + labelH + 4

  // Positions: [comp0, comp1, plot]
  const [positions, setPositions] = useState([
    { x: compStartX, y: compY + (maxCompH - comp0H) },
    { x: compStartX + comp0W + compGap, y: compY + (maxCompH - comp1H) },
    { x: plotX, y: plotY },
  ])

  const getSvgPoint = useCallback((e) => {
    const svg = svgRef.current?.querySelector('svg')
    if (!svg) return null
    const pt = svg.createSVGPoint()
    pt.x = e.clientX
    pt.y = e.clientY
    return pt.matrixTransform(svg.getScreenCTM().inverse())
  }, [])

  const onPointerDown = useCallback((e, index) => {
    const svgPt = getSvgPoint(e)
    if (!svgPt) return
    dragState.current = { index, offsetX: svgPt.x - positions[index].x, offsetY: svgPt.y - positions[index].y }
    e.currentTarget.setPointerCapture(e.pointerId)
    // Update focused comparison when dragging a comparison (index 0 or 1)
    if (index < 2) setFocusedComp(index)
  }, [positions, getSvgPoint])

  const onPointerMove = useCallback((e) => {
    if (!dragState.current) return
    const svgPt = getSvgPoint(e)
    if (!svgPt) return
    const { index, offsetX, offsetY } = dragState.current
    setPositions(prev => {
      const next = [...prev]
      next[index] = { x: svgPt.x - offsetX, y: svgPt.y - offsetY }
      return next
    })
  }, [getSvgPoint])

  const onPointerUp = useCallback(() => {
    dragState.current = null
  }, [])

  const handleShare = useCallback(async () => {
    const shareUrl = `${window.location.origin}?size=${Math.round(sizeM2)}`
    const svgEl = svgRef.current?.querySelector('svg')

    // Compute bounding box of all 3 elements (plot + 2 comparisons) + labels
    const labelSpace = 8 // SVG units for name + dimensions below each element
    const elems = [
      { x: positions[0].x, y: positions[0].y, w: comp0W, h: comp0H + labelSpace },
      { x: positions[1].x, y: positions[1].y, w: comp1W, h: comp1H + labelSpace },
      { x: positions[2].x, y: positions[2].y, w: plotDisplaySize, h: plotDisplaySize + labelSpace },
    ]
    const minX = Math.min(...elems.map(e => e.x))
    const minY = Math.min(...elems.map(e => e.y))
    const maxX = Math.max(...elems.map(e => e.x + e.w))
    const maxY = Math.max(...elems.map(e => e.y + e.h))
    const contentBounds = { x: minX, y: minY, w: maxX - minX, h: maxY - minY }

    const blob = await generateShareImage(sizeM2, unit, ratio, svgEl, contentBounds)

    if (navigator.share && /Mobi|Android/i.test(navigator.userAgent)) {
      try {
        const file = new File([blob], 'my-land.png', { type: 'image/png' })
        await navigator.share({ title: `My land — ${displaySize}`, text: ratio, url: shareUrl, files: [file] })
        return
      } catch (e) { if (e.name === 'AbortError') return }
    }

    try {
      await navigator.clipboard.writeText(shareUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch { /* ignore */ }

    const url = URL.createObjectURL(blob)
    const a = document.createElement('a')
    a.href = url
    a.download = 'my-land.png'
    a.click()
    URL.revokeObjectURL(url)
  }, [sizeM2, unit, ratio, displaySize, positions, comp0W, comp0H, comp1W, comp1H, plotDisplaySize])

  return (
    <div className="fixed inset-0 z-[200] flex flex-col" style={{ background: '#FAFAF8', paddingTop: 'env(safe-area-inset-top)', paddingBottom: 'env(safe-area-inset-bottom)' }}>
      {/* Grain */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      {/* Back button */}
      <button
        onClick={onBack}
        className="absolute left-5 z-10 flex items-center gap-2 text-slate-400 hover:text-slate-600 transition-all py-2 px-4 rounded-lg"
        style={{ animation: 'revealFade 0.5s 0.1s both', top: '12px' }}
      >
        <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M10.5 19.5L3 12m0 0l7.5-7.5M3 12h18" />
        </svg>
        <span className="text-sm font-medium">Back</span>
      </button>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-start px-6 overflow-y-auto min-h-0 pt-16 pb-8">
        <div className="w-full max-w-lg flex flex-col items-center">

          {/* Size label */}
          <div
            className="font-display font-bold text-slate-800 tracking-tight text-center"
            style={{ fontSize: 'clamp(1.5rem, 5vw, 2.25rem)', marginBottom: '8px', animation: 'revealFade 0.5s 0.15s both' }}
          >
            {displaySize}
          </div>

          {/* Ratio text — updates on drag */}
          <p className="text-slate-500 text-sm text-center transition-all" style={{ marginBottom: '24px', animation: 'revealFade 0.5s 0.25s both' }}>
            {ratio}
          </p>

          {/* SVG Visualization */}
          <div
            ref={svgRef}
            className="w-full"
            style={{
              maxWidth: '400px',
              marginBottom: '32px',
              animation: 'revealScale 0.6s 0.1s cubic-bezier(0.16, 1, 0.3, 1) both',
            }}
          >
            <svg
              viewBox={`0 0 ${svgW} ${svgH}`}
              className="w-full"
              style={{ overflow: 'visible', touchAction: 'none' }}
              onPointerMove={onPointerMove}
              onPointerUp={onPointerUp}
              onPointerLeave={onPointerUp}
            >
              {/* ─── Plot (draggable) ─── */}
              <g
                style={{ cursor: 'grab', animation: 'revealFade 0.4s 0.2s both' }}
                onPointerDown={(e) => onPointerDown(e, 2)}
              >
                {/* Grid lines */}
                {Array.from({ length: 5 }).map((_, i) => {
                  const frac = i / 4
                  const px = positions[2].x
                  const py = positions[2].y
                  return (
                    <g key={i} opacity="0.12">
                      <line x1={px + plotDisplaySize * frac} y1={py} x2={px + plotDisplaySize * frac} y2={py + plotDisplaySize} stroke="#94a3b8" strokeWidth={0.15} strokeDasharray="0.8 0.8" />
                      <line x1={px} y1={py + plotDisplaySize * frac} x2={px + plotDisplaySize} y2={py + plotDisplaySize * frac} stroke="#94a3b8" strokeWidth={0.15} strokeDasharray="0.8 0.8" />
                    </g>
                  )
                })}
                <rect
                  x={positions[2].x} y={positions[2].y}
                  width={plotDisplaySize} height={plotDisplaySize}
                  fill="#14b8a6" fillOpacity="0.08"
                  stroke="#14b8a6" strokeWidth={0.5}
                  rx={0.8}
                />
                <text
                  x={positions[2].x + plotDisplaySize / 2}
                  y={positions[2].y + plotDisplaySize / 2}
                  textAnchor="middle" dominantBaseline="middle"
                  fill="#14b8a6" fontSize={3.2} fontWeight="600"
                  fontFamily="Outfit, sans-serif" opacity="0.6"
                >
                  Your plot
                </text>
                <text
                  x={positions[2].x + plotDisplaySize / 2}
                  y={positions[2].y + plotDisplaySize + 3.5}
                  textAnchor="middle"
                  fill="#94a3b8" fontSize={2.4}
                  fontFamily="DM Sans, sans-serif"
                >
                  {Math.round(plotSide)}m × {Math.round(plotSide)}m
                </text>
              </g>

              {/* ─── Comparison objects (draggable) ─── */}
              {selected.map((comp, i) => {
                const cw = i === 0 ? comp0W : comp1W
                const ch = i === 0 ? comp0H : comp1H
                const cx = positions[i].x
                const cy = positions[i].y

                return (
                  <g
                    key={comp.id}
                    style={{ cursor: 'grab', animation: `revealFade 0.4s ${0.4 + i * 0.15}s both` }}
                    onPointerDown={(e) => onPointerDown(e, i)}
                  >
                    {/* Fill */}
                    <rect
                      x={cx} y={cy} width={cw} height={ch}
                      fill={comp.color} fillOpacity="0.12"
                      stroke={comp.color} strokeWidth={0.35}
                      rx={0.5}
                    />
                    {/* Detail overlays */}
                    {comp.id === 'parking' && <ParkingDetail x={cx} y={cy} w={cw} h={ch} color={comp.color} />}
                    {comp.id === 'basketball' && <BasketballCourtDetail x={cx} y={cy} w={cw} h={ch} color={comp.color} />}
                    {comp.id === 'tennis' && <TennisCourtDetail x={cx} y={cy} w={cw} h={ch} color={comp.color} />}
                    {comp.id === 'football' && <FootballPitchDetail x={cx} y={cy} w={cw} h={ch} color={comp.color} />}
                    {comp.id === 'walmart' && <WalmartDetail x={cx} y={cy} w={cw} h={ch} color={comp.color} />}
                    {/* Name */}
                    <text
                      x={cx + cw / 2} y={cy + ch + 3}
                      textAnchor="middle" fill={comp.color}
                      fontSize={2.2} fontWeight="600"
                      fontFamily="DM Sans, sans-serif"
                    >
                      {comp.name}
                    </text>
                    {/* Dimensions */}
                    <text
                      x={cx + cw / 2} y={cy + ch + 5.8}
                      textAnchor="middle" fill={comp.color}
                      fontSize={1.8} fontWeight="400"
                      fontFamily="DM Sans, sans-serif" opacity="0.7"
                    >
                      {Math.round(comp.w)}m × {Math.round(comp.h)}m
                    </text>
                  </g>
                )
              })}

              {/* Drag hint */}
              <text
                x={svgW / 2} y={svgH - 1}
                textAnchor="middle" fill="#cbd5e1"
                fontSize={1.8} fontFamily="DM Sans, sans-serif"
              >
                Drag to compare
              </text>
            </svg>
          </div>

          {/* Action buttons */}
          <div className="w-full flex flex-col gap-3" style={{ maxWidth: '340px' }}>
            <button
              onClick={handleShare}
              className="w-full rounded-xl text-sm font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: '#fff', border: '2px solid #e2e8f0', color: '#475569', padding: '14px 24px', animation: 'revealFade 0.5s 0.5s both' }}
              onMouseEnter={e => { e.currentTarget.style.borderColor = '#14b8a6'; e.currentTarget.style.color = '#14b8a6' }}
              onMouseLeave={e => { e.currentTarget.style.borderColor = '#e2e8f0'; e.currentTarget.style.color = '#475569' }}
            >
              {copied ? (
                <>
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 12.75l6 6 9-13.5" />
                  </svg>
                  Link copied &amp; image saved
                </>
              ) : (
                <>
                  Share this
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                  </svg>
                </>
              )}
            </button>

            <button
              onClick={onDesign3D}
              className="w-full rounded-xl text-base font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
              style={{ background: '#14b8a6', padding: '16px 24px', animation: 'revealFade 0.5s 0.6s both' }}
              onMouseEnter={e => e.currentTarget.style.background = '#2dd4bf'}
              onMouseLeave={e => e.currentTarget.style.background = '#14b8a6'}
            >
              Start designing in 3D
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
              </svg>
            </button>
          </div>

          <p className="text-slate-400 text-xs text-center mt-5" style={{ animation: 'revealFade 0.5s 0.7s both' }}>
            Want to see what a house on this land could look like?
          </p>
        </div>
      </div>

      <style>{`
        @keyframes revealFade {
          from { opacity: 0; transform: translateY(10px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes revealScale {
          from { opacity: 0; transform: scale(0.92); }
          to { opacity: 1; transform: scale(1); }
        }
        svg g[style*="cursor: grab"]:active { cursor: grabbing; }
      `}</style>
    </div>
  )
}
