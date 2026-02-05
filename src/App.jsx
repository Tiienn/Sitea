import { useState, useEffect, useRef, useCallback, useMemo, lazy, Suspense } from 'react'
import { useBuildHistory } from './hooks/useBuildHistory'
import { useIsMobile, useIsLandscape } from './hooks/useIsMobile'
import { useParams, useNavigate, Routes, Route } from 'react-router-dom'
import nipplejs from 'nipplejs'

// Lazy load heavy components for better initial bundle size
const LandScene = lazy(() => import('./components/LandScene'))
const FloorPlanGeneratorModal = lazy(() => import('./components/FloorPlanGeneratorModal'))
const UploadImageModal = lazy(() => import('./components/UploadImageModal'))
const PricingModal = lazy(() => import('./components/PricingModal'))
const AuthModal = lazy(() => import('./components/AuthModal'))

// Named export from PolygonEditor (used for area calculation)
import { calculatePolygonArea } from './components/PolygonEditor'

// Loading fallback for Suspense boundaries
const LoadingFallback = () => (
  <div className="flex items-center justify-center w-full h-full min-h-[200px] bg-[#1a1a1a]">
    <div className="flex flex-col items-center gap-3">
      <div className="w-8 h-8 border-2 border-teal-500 border-t-transparent rounded-full animate-spin" />
      <span className="text-sm text-gray-400">Loading...</span>
    </div>
  </div>
)

// These are lighter, load normally
import Minimap from './components/Minimap'
import Onboarding from './components/Onboarding'
import BuildPanel from './components/BuildPanel'
import ComparePanel from './components/ComparePanel'
import LandPanel from './components/LandPanel'
import ExportPanel from './components/ExportPanel'
import RoomPropertiesPanel from './components/RoomPropertiesPanel'
import WallPropertiesPanel from './components/WallPropertiesPanel'
import FencePropertiesPanel from './components/FencePropertiesPanel'
import PoolPropertiesPanel from './components/PoolPropertiesPanel'
import FoundationPropertiesPanel from './components/FoundationPropertiesPanel'
import StairsPropertiesPanel from './components/StairsPropertiesPanel'
import RoofPropertiesPanel from './components/RoofPropertiesPanel'

// Import constants from LandScene (these are re-exported)
import { CAMERA_MODE, DEFAULT_TP_DISTANCE, ORBIT_START_DISTANCE, QUALITY } from './constants/landSceneConstants'
import { useUser } from './hooks/useUser'
import { exportFloorPlanAsPNG } from './utils/exportFloorPlan'
import { captureAndDownload } from './utils/screenshotCapture'
import { exportModel } from './utils/modelExport'
import { exportToPDF } from './utils/pdfExport'
import { computeOverlappingIds, checkPreviewOverlap } from './utils/collision2d'
import { computeCompassRotation } from './utils/labels'
import { detectRooms, findWallsForRoom } from './utils/roomDetection'
import { buildScenePayload, createSharedScene, fetchSharedScene } from './services/shareScene'
import { isSupabaseConfigured } from './lib/supabaseClient'
import {
  track,
  trackDefineClicked,
  trackFirstBuildingPlaced,
  trackCoverageThreshold,
  getDeviceType,
  roundArea,
} from './services/analytics'

// Unit conversion constants
const FEET_PER_METER = 3.28084
const MM_PER_METER = 1000
const SQ_FEET_PER_SQ_METER = 10.7639
const SQ_METERS_PER_ACRE = 4046.86
const SQ_METERS_PER_HECTARE = 10000

// Conversion utilities
const convertLength = (meters, unit) => {
  switch (unit) {
    case 'ft': return meters * FEET_PER_METER
    case 'mm': return meters * MM_PER_METER
    default: return meters
  }
}

const convertLengthToMeters = (value, unit) => {
  switch (unit) {
    case 'ft': return value / FEET_PER_METER
    case 'mm': return value / MM_PER_METER
    default: return value
  }
}

const convertArea = (sqMeters, unit) => {
  switch (unit) {
    case 'ft²': return sqMeters * SQ_FEET_PER_SQ_METER
    case 'acres': return sqMeters / SQ_METERS_PER_ACRE
    case 'hectares': return sqMeters / SQ_METERS_PER_HECTARE
    default: return sqMeters
  }
}

const formatLength = (meters, unit) => {
  const value = convertLength(meters, unit)
  return `${value.toFixed(1)}${unit}`
}

const formatArea = (sqMeters, areaUnit) => {
  const value = convertArea(sqMeters, areaUnit)
  if (areaUnit === 'acres' || areaUnit === 'hectares') {
    return `${value.toFixed(2)} ${areaUnit}`
  }
  return `${value.toFixed(0)} ${areaUnit}`
}

const COMPARISON_OBJECTS = [
  // Sports
  { id: 'soccerField', name: 'Soccer Field', width: 68, length: 105, color: '#228B22' },
  { id: 'basketballCourt', name: 'Basketball Court', width: 15, length: 28, color: '#CD853F' },
  { id: 'tennisCourt', name: 'Tennis Court', width: 10.97, length: 23.77, color: '#4169E1' },
  // Buildings
  { id: 'house', name: 'House (10m×10m)', width: 10, length: 10, color: '#8B4513' },
  { id: 'studioApartment', name: 'Studio Apartment', width: 6, length: 7, color: '#9CA3AF' },
  // Vehicles
  { id: 'carSedan', name: 'Car (Sedan)', width: 1.8, length: 4.5, color: '#8C8C8C' },
  { id: 'shippingContainer', name: 'Shipping Container', width: 2.44, length: 6.06, color: '#C75B39' },
  { id: 'schoolBus', name: 'School Bus', width: 2.6, length: 12, color: '#F7B500' },
  // Other
  { id: 'parkingSpace', name: 'Parking Space', width: 2.5, length: 5, color: '#696969' },
  { id: 'swimmingPool', name: 'Olympic Pool', width: 25, length: 50, color: '#00CED1' },
  { id: 'kingSizeBed', name: 'King Size Bed', width: 2, length: 2.1, color: '#E8DCC8' },
  // Landmarks
  { id: 'eiffelTower', name: 'Eiffel Tower', width: 125, length: 125, color: '#8B7355' },
  { id: 'statueOfLiberty', name: 'Statue of Liberty', width: 47, length: 47, color: '#4A7C59' },
  { id: 'greatPyramid', name: 'Great Pyramid', width: 230, length: 230, color: '#D4A84B' },
  { id: 'tajMahal', name: 'Taj Mahal', width: 57, length: 57, color: '#F5F5F5' },
  { id: 'colosseum', name: 'Colosseum', width: 156, length: 189, color: '#C9B896' },
  { id: 'bigBen', name: 'Big Ben', width: 12, length: 12, color: '#8B7355' },
  // Commercial
  { id: 'sevenEleven', name: '7-Eleven', width: 15, length: 17, color: '#FF7E00' },
  { id: 'mcdonalds', name: "McDonald's", width: 19, length: 21, color: '#FFC72C' },
  { id: 'gasStation', name: 'Gas Station', width: 50, length: 56, color: '#4A4A4A' },
  { id: 'supermarket', name: 'Supermarket', width: 60, length: 62, color: '#2E8B57' },
  { id: 'starbucks', name: 'Starbucks', width: 13, length: 14, color: '#00704A' },
  { id: 'walmart', name: 'Walmart', width: 130, length: 130, color: '#0071CE' },
  // Gaming
  { id: 'pokemonCenter', name: 'Pokémon Center', width: 20, length: 25, color: '#EE1515' },
  { id: 'minecraftHouse', name: 'Minecraft House', width: 7, length: 7, color: '#8B6914' },
  { id: 'acHouse', name: 'AC Villager House', width: 5, length: 4, color: '#90EE90' },
  { id: 'fortnite1x1', name: 'Fortnite 1×1', width: 5, length: 5, color: '#5B7FDE' },
  { id: 'zeldaHouse', name: "Link's House", width: 8, length: 10, color: '#228B22' },
  { id: 'simsHouse', name: 'Sims Starter Home', width: 10, length: 12, color: '#32CD32' },
]

const BUILDING_TYPES = [
  // Houses
  { id: 'smallHouse', name: 'Small House', width: 8, length: 10, height: 5, color: '#D2691E', icon: 'smallHouse' },
  { id: 'mediumHouse', name: 'Medium House', width: 12, length: 15, height: 6, color: '#CD853F', icon: 'mediumHouse' },
  { id: 'largeHouse', name: 'Large House', width: 15, length: 20, height: 7, color: '#8B4513', icon: 'largeHouse' },
  // Outbuildings
  { id: 'shed', name: 'Shed', width: 3, length: 4, height: 2.5, color: '#A0522D', icon: 'shed' },
  { id: 'garage', name: 'Garage', width: 6, length: 6, height: 3, color: '#808080', icon: 'garage' },
  { id: 'barn', name: 'Barn', width: 10, length: 14, height: 6, color: '#8B0000', icon: 'barn' },
  { id: 'workshop', name: 'Workshop', width: 6, length: 8, height: 3.5, color: '#556B2F', icon: 'workshop' },
  // Garden structures
  { id: 'greenhouse', name: 'Greenhouse', width: 4, length: 6, height: 3, color: '#98FB98', icon: 'greenhouse' },
  { id: 'gazebo', name: 'Gazebo', width: 4, length: 4, height: 3, color: '#DEB887', icon: 'gazebo' },
  { id: 'carport', name: 'Carport', width: 3, length: 6, height: 2.5, color: '#696969', icon: 'carport' },
  // Other
  { id: 'pool', name: 'Swimming Pool', width: 5, length: 10, height: -1.5, color: '#00CED1', icon: 'poolStructure' },
]

// Build tool constants
const BUILD_TOOLS = {
  NONE: 'none',
  ROOM: 'room',             // Click-click rectangular room
  POLYGON_ROOM: 'polygon',  // Multi-click polygon room
  WALL: 'wall',             // Click-click wall segments
  HALF_WALL: 'halfWall',    // Shorter walls (railings, dividers)
  FENCE: 'fence',           // Low decorative fences
  DOOR: 'door',             // Click on wall to place door
  WINDOW: 'window',         // Click on wall to place window
  SELECT: 'select',         // Click to select elements
  DELETE: 'delete',         // Click to delete elements
  // Sims 4-style features
  POOL: 'pool',             // Polygon pool tool
  FOUNDATION: 'foundation', // Elevated platform tool
  STAIRS: 'stairs',         // Stairs placement tool
  ROOF: 'roof',             // Click room to add roof
  ADD_FLOORS: 'addFloors',  // Click room to add multiple floors
}

// Snap constants (tunable)
const SNAP_DIST_M = 2.0     // meters - snap threshold distance
const GRID_SIZE_M = 1.0     // meters - grid cell size
const ROT_SNAP_DEG = 15     // degrees - rotation snap increment

// Snap utility: get closest point on line segment (XZ plane)
const getClosestPointOnSegment = (p, a, b) => {
  const ax = a.x, az = a.y ?? a.z
  const bx = b.x, bz = b.y ?? b.z
  const px = p.x, pz = p.y ?? p.z

  const abx = bx - ax, abz = bz - az
  const apx = px - ax, apz = pz - az
  const ab2 = abx * abx + abz * abz
  if (ab2 === 0) return { x: ax, z: az, dist: Math.sqrt(apx * apx + apz * apz) }

  let t = (apx * abx + apz * abz) / ab2
  t = Math.max(0, Math.min(1, t))

  const closestX = ax + t * abx
  const closestZ = az + t * abz
  const dx = px - closestX, dz = pz - closestZ
  return { x: closestX, z: closestZ, dist: Math.sqrt(dx * dx + dz * dz) }
}

// Snap to nearest vertex
const snapToVertices = (p, vertices, threshold) => {
  let closest = null, minDist = Infinity
  for (const v of vertices) {
    const vx = v.x, vz = v.y ?? v.z
    const dx = p.x - vx, dz = p.z - vz
    const dist = Math.sqrt(dx * dx + dz * dz)
    if (dist < minDist && dist <= threshold) {
      minDist = dist
      closest = { x: vx, z: vz }
    }
  }
  return closest ? { point: closest, dist: minDist } : null
}

// Snap to nearest edge
const snapToEdges = (p, vertices, threshold) => {
  let closest = null, minDist = Infinity
  for (let i = 0; i < vertices.length; i++) {
    const a = vertices[i]
    const b = vertices[(i + 1) % vertices.length]
    const result = getClosestPointOnSegment(p, a, b)
    if (result.dist < minDist && result.dist <= threshold) {
      minDist = result.dist
      closest = { x: result.x, z: result.z }
    }
  }
  return closest ? { point: closest, dist: minDist } : null
}

// Snap to grid
const snapToGrid = (p, gridSize, threshold) => {
  const snappedX = Math.round(p.x / gridSize) * gridSize
  const snappedZ = Math.round(p.z / gridSize) * gridSize
  const dx = p.x - snappedX, dz = p.z - snappedZ
  const dist = Math.sqrt(dx * dx + dz * dz)
  if (dist <= threshold) {
    return { point: { x: snappedX, z: snappedZ }, dist }
  }
  return null
}

// Apply position snapping with priority: vertex > edge > grid
const applyPositionSnapping = (p, polygon, options = {}) => {
  const { positionSnap = true, gridSnap = false } = options
  const threshold = SNAP_DIST_M

  if (!positionSnap || !polygon || polygon.length < 3) {
    return { snappedPos: p, snapType: 'none', snapPoint: null }
  }

  // Priority 1: Vertex snap
  const vertexSnap = snapToVertices(p, polygon, threshold)
  if (vertexSnap) {
    return { snappedPos: vertexSnap.point, snapType: 'vertex', snapPoint: vertexSnap.point }
  }

  // Priority 2: Edge snap
  const edgeSnap = snapToEdges(p, polygon, threshold)
  if (edgeSnap) {
    return { snappedPos: edgeSnap.point, snapType: 'edge', snapPoint: edgeSnap.point }
  }

  // Priority 3: Grid snap (if enabled)
  if (gridSnap) {
    const gridSnapResult = snapToGrid(p, GRID_SIZE_M, threshold)
    if (gridSnapResult) {
      return { snappedPos: gridSnapResult.point, snapType: 'grid', snapPoint: gridSnapResult.point }
    }
  }

  return { snappedPos: p, snapType: 'none', snapPoint: null }
}

// Snap rotation to nearest increment
const snapRotation = (degrees, increment = ROT_SNAP_DEG) => {
  return Math.round(degrees / increment) * increment
}

// Compute building footprint coverage
const computeCoverage = (buildings, landAreaM2) => {
  if (!buildings || buildings.length === 0 || landAreaM2 <= 0) {
    return { coverageAreaM2: 0, coveragePercent: 0 }
  }
  const coverageAreaM2 = buildings.reduce((sum, b) => {
    const footprint = b.type?.width * b.type?.length || 0
    return sum + footprint
  }, 0)
  const coveragePercent = (coverageAreaM2 / landAreaM2) * 100
  return { coverageAreaM2, coveragePercent }
}


// ============ SETBACK GEOMETRY UTILITIES ============

// Point-in-polygon test (ray casting algorithm)
const pointInPolygon = (point, polygon) => {
  if (!polygon || polygon.length < 3) return false
  const px = point.x, pz = point.z ?? point.y
  let inside = false
  for (let i = 0, j = polygon.length - 1; i < polygon.length; j = i++) {
    const xi = polygon[i].x, zi = polygon[i].y ?? polygon[i].z
    const xj = polygon[j].x, zj = polygon[j].y ?? polygon[j].z
    if (((zi > pz) !== (zj > pz)) && (px < (xj - xi) * (pz - zi) / (zj - zi) + xi)) {
      inside = !inside
    }
  }
  return inside
}

// Distance from point to line segment (reuses getClosestPointOnSegment)
const distancePointToSegment = (point, a, b) => {
  return getClosestPointOnSegment(point, a, b).dist
}

// Minimum distance from point to any edge of polygon
const minDistanceToPolygonEdges = (point, polygon) => {
  if (!polygon || polygon.length < 3) return 0
  let minDist = Infinity
  for (let i = 0; i < polygon.length; i++) {
    const a = polygon[i]
    const b = polygon[(i + 1) % polygon.length]
    const dist = distancePointToSegment(point, a, b)
    if (dist < minDist) minDist = dist
  }
  return minDist
}

// Get 8 test points for building footprint (4 corners + 4 edge midpoints)
const getFootprintTestPoints = (position, buildingType, rotationDeg = 0) => {
  const hw = buildingType.width / 2
  const hl = buildingType.length / 2
  const rad = (rotationDeg * Math.PI) / 180
  const cos = Math.cos(rad), sin = Math.sin(rad)

  // Local corners (before rotation)
  const localCorners = [
    { x: -hw, z: -hl },
    { x: hw, z: -hl },
    { x: hw, z: hl },
    { x: -hw, z: hl }
  ]

  // Transform to world coordinates
  const transform = (p) => ({
    x: position.x + p.x * cos - p.z * sin,
    z: position.z + p.x * sin + p.z * cos
  })

  const corners = localCorners.map(transform)

  // Midpoints of edges
  const midpoints = corners.map((c, i) => {
    const next = corners[(i + 1) % 4]
    return { x: (c.x + next.x) / 2, z: (c.z + next.z) / 2 }
  })

  return [...corners, ...midpoints]
}

// Check if building placement is valid (all test points inside and respecting setback)
const isPlacementValid = (position, buildingType, rotationDeg, polygon, setbackDistanceM) => {
  if (!polygon || polygon.length < 3) return true // No polygon = always valid
  if (setbackDistanceM <= 0) {
    // No setback, just check if inside polygon
    const testPoints = getFootprintTestPoints(position, buildingType, rotationDeg)
    return testPoints.every(p => pointInPolygon(p, polygon))
  }

  const testPoints = getFootprintTestPoints(position, buildingType, rotationDeg)
  for (const p of testPoints) {
    // Must be inside polygon
    if (!pointInPolygon(p, polygon)) return false
    // Must be at least setbackDistanceM from any edge
    if (minDistanceToPolygonEdges(p, polygon) < setbackDistanceM) return false
  }
  return true
}

// Example land polygon (~2750 m², irregular shape)
// Roughly 60m x 50m with some irregularity
const EXAMPLE_LAND_POLYGON = [
  { x: -25, y: -22 },
  { x: 28, y: -20 },
  { x: 32, y: -5 },
  { x: 30, y: 25 },
  { x: -5, y: 28 },
  { x: -28, y: 20 },
  { x: -30, y: -8 },
]

const SOCCER_FIELD_AREA = 68 * 105 // 7140 m²

// Virtual Joystick component for mobile
function VirtualJoystick({ joystickInput, isRunning, setIsRunning, onJump, onTalk, onUse, nearbyNPC, nearbyBuilding, isLandscape }) {
  const joystickRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const manager = nipplejs.create({
      zone: containerRef.current,
      mode: 'static',
      position: { left: '70px', top: '50%' },
      color: 'white',
      size: 120,
      restOpacity: 0.5,
    })

    joystickRef.current = manager

    manager.on('move', (_, data) => {
      if (data.vector && joystickInput.current) {
        joystickInput.current.x = data.vector.x
        joystickInput.current.y = data.vector.y
      }
    })

    manager.on('end', () => {
      if (joystickInput.current) {
        joystickInput.current.x = 0
        joystickInput.current.y = 0
      }
    })

    return () => {
      manager.destroy()
    }
  }, [joystickInput])

  const btnBase = "rounded-full font-bold text-xs uppercase tracking-wide transition-all active:scale-90"
  const btnOff = "bg-white/15 text-white border border-white/25 backdrop-blur-sm"

  return (
    <>
      {/* Left side: joystick + run */}
      <div
        ref={containerRef}
        className="joystick-zone fixed w-40 h-40 z-50"
        style={{ touchAction: 'none', bottom: isLandscape ? '12px' : '68px', left: isLandscape ? '56px' : '12px' }}
      />
      <button
        onTouchStart={(e) => { e.preventDefault(); setIsRunning(r => !r) }}
        onClick={() => setIsRunning(r => !r)}
        className={`fixed z-50 w-12 h-12 ${btnBase} ${
          isRunning
            ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] border-2 border-[var(--color-accent)]'
            : btnOff
        }`}
        style={{ left: isLandscape ? '200px' : '150px', bottom: isLandscape ? '52px' : '108px', touchAction: 'none' }}
      >
        Run
      </button>

      {/* Right side: 3 buttons in triangle like Genshin Impact */}
      {/* Center - Jump */}
      <button
        onTouchStart={(e) => { e.preventDefault(); onJump?.() }}
        onClick={() => onJump?.()}
        className={`fixed z-50 w-12 h-12 ${btnBase} ${btnOff} active:bg-white/30`}
        style={{ right: '24px', bottom: isLandscape ? '24px' : '86px', touchAction: 'none' }}
      >
        Jump
      </button>
      {/* Top-right - Talk */}
      <button
        onTouchStart={(e) => { e.preventDefault(); onTalk?.() }}
        onClick={() => onTalk?.()}
        className={`fixed z-50 w-12 h-12 ${btnBase} ${
          nearbyNPC
            ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] border-2 border-[var(--color-accent)]'
            : btnOff
        } active:bg-white/30`}
        style={{ right: '16px', bottom: isLandscape ? '86px' : '148px', touchAction: 'none' }}
      >
        Talk
      </button>
      {/* Top-left - Use */}
      <button
        onTouchStart={(e) => { e.preventDefault(); onUse?.() }}
        onClick={() => onUse?.()}
        className={`fixed z-50 w-12 h-12 ${btnBase} ${
          nearbyBuilding
            ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] border-2 border-[var(--color-accent)]'
            : btnOff
        } active:bg-white/30`}
        style={{ right: '76px', bottom: isLandscape ? '66px' : '128px', touchAction: 'none' }}
      >
        Use
      </button>
    </>
  )
}

function App() {
  // User context for paid features
  const { user, isPaidUser, showPricingModal, setShowPricingModal, onPaymentSuccess, requirePaid, signOut, showAuthModal, setShowAuthModal, planType, theme, setTheme } = useUser()
  const isMobile = useIsMobile()
  const isLandscape = useIsLandscape()
  const [showOverflow, setShowOverflow] = useState(false)
  const [showUserMenu, setShowUserMenu] = useState(false)
  const [showHelp, setShowHelp] = useState(false)
  const [helpTab, setHelpTab] = useState('guide') // 'guide' or 'shortcuts'
  const [helpShortcutSection, setHelpShortcutSection] = useState('movement') // sub-tab within shortcuts
  const [helpGuideSection, setHelpGuideSection] = useState('start') // sub-tab within guide
  const [showMobileViewControls, setShowMobileViewControls] = useState(false)
  const [mobileCtaExpanded, setMobileCtaExpanded] = useState(false)

  // Floor plan generator modal state
  const [showFloorPlanGenerator, setShowFloorPlanGenerator] = useState(false)
  const [floorPlanImageForGenerator, setFloorPlanImageForGenerator] = useState(null)

  const [dimensions, setDimensions] = useState({ length: 20, width: 15 })
  const [isExploring, setIsExploring] = useState(true)
  const [inputValues, setInputValues] = useState({ length: '20', width: '15' })
  const [activeComparisons, setActiveComparisons] = useState({})
  const [comparisonPositions, setComparisonPositions] = useState({}) // {objectId: {x, z}}
  const [shapeMode, setShapeMode] = useState('rectangle') // 'rectangle', 'polygon', or 'upload'
  const [uploadedImage, setUploadedImage] = useState(null)
  const [polygonPoints, setPolygonPoints] = useState([])
  const [confirmedPolygon, setConfirmedPolygon] = useState(null)
  const [selectedBuilding, setSelectedBuilding] = useState(null)
  const [placedBuildings, setPlacedBuildings] = useState([])
  const [saveStatus, setSaveStatus] = useState(null)
  const [isTouchDevice, setIsTouchDevice] = useState(false)
  const [activePanel, setActivePanel] = useState(null) // 'land', 'compare', 'build', or null
  const [panelExpanded, setPanelExpanded] = useState(true) // Whether the panel's expanded section is open
  const [lengthUnit, setLengthUnit] = useState('m') // 'm' or 'ft'
  const [areaUnit, setAreaUnit] = useState('m²') // 'm²', 'ft²', 'acres', 'hectares'
  const [cameraState, setCameraState] = useState({ position: { x: 0, y: 1.7, z: 10 }, rotation: 0 })
  const [userHasLand, setUserHasLand] = useState(false) // Will be set true when user defines their land
  const [isDefiningLand, setIsDefiningLand] = useState(false) // Shows land definition flow
  const [hasSeenIntro, setHasSeenIntro] = useState(() => {
    return localStorage.getItem('landVisualizerIntroSeen') === 'true'
  })
  // Walkthrough states (non-blocking)
  const [walkthroughStep, setWalkthroughStep] = useState(0) // 0=movement, 1=scale, 2=ownership, 3=done
  const [walkthroughVisible, setWalkthroughVisible] = useState(true)
  const walkthroughTimerRef = useRef(null)
  const joystickInput = useRef({ x: 0, y: 0 })
  const [isMobileRunning, setIsMobileRunning] = useState(false)
  const [mobileJumpTrigger, setMobileJumpTrigger] = useState(0)
  const [nearbyNPC, setNearbyNPC] = useState(false)
  const [nearbyBuilding, setNearbyBuilding] = useState(false)
  const [helpTextVisible, setHelpTextVisible] = useState(true)
  const helpTextTimerRef = useRef(null)

  // Snap settings - always enabled (no toggle exposed)
  const snapEnabled = true
  const [gridSnapEnabled, setGridSnapEnabled] = useState(() => {
    const saved = localStorage.getItem('landVisualizerGridSnap')
    return saved === 'true'
  })
  const [gridSize, setGridSize] = useState(() => {
    const saved = localStorage.getItem('landVisualizerGridSize')
    return saved ? parseFloat(saved) : 1 // default 1m
  })
  const [comparisonRotations, setComparisonRotations] = useState({}) // {objectId: degrees}
  const [buildingRotation, setBuildingRotation] = useState(0) // Current placement rotation
  const [snapIndicator, setSnapIndicator] = useState(null) // { x, z, type } for visual feedback

  // Setback settings (load from localStorage)
  const [setbacksEnabled, setSetbacksEnabled] = useState(() => {
    const saved = localStorage.getItem('landVisualizerSetbacksEnabled')
    return saved === 'true'
  })
  const [setbackDistanceM, setSetbackDistanceM] = useState(() => {
    const saved = localStorage.getItem('landVisualizerSetbackDistance')
    return saved ? parseFloat(saved) : 2.0
  })
  const [placementValid, setPlacementValid] = useState(true) // Track if current preview is valid

  // Overlap detection state
  const [overlappingBuildingIds, setOverlappingBuildingIds] = useState(new Set())
  const [dragOverlapping, setDragOverlapping] = useState(false)

  // Wall builder state with undo/redo history
  const {
    currentState: walls,
    pushState: pushWallsState,
    replaceCurrentState: replaceWallsState,
    undo: undoWalls,
    redo: redoWalls,
    canUndo,
    canRedo,
    clearHistory: clearWallsHistory,
  } = useBuildHistory([])

  // Toast state for undo/redo feedback
  const [undoRedoToast, setUndoRedoToast] = useState(null)
  const [wallDrawingMode, setWallDrawingMode] = useState(false)
  const [wallDrawingPoints, setWallDrawingPoints] = useState([]) // Points being drawn
  const [openingPlacementMode, setOpeningPlacementMode] = useState('none') // 'none' | 'door' | 'window'

  // Buildings state (floor plans as movable/rotatable groups)
  const [buildings, setBuildings] = useState([])
  const [floorPlanPlacementMode, setFloorPlanPlacementMode] = useState(false)
  const [pendingFloorPlan, setPendingFloorPlan] = useState(null) // { walls, rooms, stats }
  const [selectedBuildingId, setSelectedBuildingId] = useState(null)
  const [selectedComparisonId, setSelectedComparisonId] = useState(null)
  const [selectedRoomId, setSelectedRoomId] = useState(null)
  const [roomLabels, setRoomLabels] = useState({}) // { [roomId]: string } for Phase 2
  const [roomStyles, setRoomStyles] = useState({}) // { [roomId]: { floorColor, floorOpacity } }
  const [roomPropertiesOpen, setRoomPropertiesOpen] = useState(false) // Room properties panel
  const [wallPropertiesOpen, setWallPropertiesOpen] = useState(false) // Wall properties panel
  const [fencePropertiesOpen, setFencePropertiesOpen] = useState(false) // Fence properties panel
  const [buildingPreviewPosition, setBuildingPreviewPosition] = useState({ x: 0, z: 0 })
  const [buildingPreviewRotation, setBuildingPreviewRotation] = useState(0)

  // Build tools state (Sims 4-style)
  const [activeBuildTool, setActiveBuildTool] = useState(BUILD_TOOLS.NONE)
  const [selectedElement, setSelectedElement] = useState(null) // {type: 'wall'|'door'|'window'|'room', id, parentId?}

  // Door/Window size state
  const [doorWidth, setDoorWidth] = useState(0.9)
  const [doorHeight, setDoorHeight] = useState(2.1)
  const [doorType, setDoorType] = useState('single') // 'single', 'double', 'sliding', 'garage'
  const [fenceType, setFenceType] = useState('picket') // 'picket', 'privacy', 'chainLink', 'iron', 'ranch'
  const [windowWidth, setWindowWidth] = useState(1.2)
  const [windowHeight, setWindowHeight] = useState(1.2)
  const [windowSillHeight, setWindowSillHeight] = useState(0.9)

  // Half wall height state
  const [halfWallHeight, setHalfWallHeight] = useState(1.2) // Default 1.2m (counter height)

  // Sims 4-style features state
  const [pools, setPools] = useState([])
  const [foundations, setFoundations] = useState([])
  const [stairs, setStairs] = useState([])
  const [roofs, setRoofs] = useState([])

  // Tool-specific drawing state
  const [poolPolygonPoints, setPoolPolygonPoints] = useState([])
  const [foundationPolygonPoints, setFoundationPolygonPoints] = useState([])
  const [stairsStartPoint, setStairsStartPoint] = useState(null)

  // Selection state for new features
  const [selectedPoolId, setSelectedPoolId] = useState(null)
  const [selectedFoundationId, setSelectedFoundationId] = useState(null)
  const [selectedStairsId, setSelectedStairsId] = useState(null)
  const [selectedRoofId, setSelectedRoofId] = useState(null)
  const [selectedPlacedBuildingId, setSelectedPlacedBuildingId] = useState(null)

  // Properties panels state
  const [poolPropertiesOpen, setPoolPropertiesOpen] = useState(false)
  const [foundationPropertiesOpen, setFoundationPropertiesOpen] = useState(false)
  const [stairsPropertiesOpen, setStairsPropertiesOpen] = useState(false)
  const [roofPropertiesOpen, setRoofPropertiesOpen] = useState(false)

  // Tool options state
  const [poolDepth, setPoolDepth] = useState(1.5)
  const [poolDeckMaterial, setPoolDeckMaterial] = useState('concrete')
  const [foundationHeight, setFoundationHeight] = useState(0.6)
  const [foundationMaterial, setFoundationMaterial] = useState('concrete')
  const [stairsWidth, setStairsWidth] = useState(1.0)
  const [stairsStyle, setStairsStyle] = useState('straight')
  const [stairsTopY, setStairsTopY] = useState(2.7)
  const [roofType, setRoofType] = useState('gable')
  const [roofPitch, setRoofPitch] = useState(30)
  const [roofOverhang, setRoofOverhang] = useState(0.5)
  const [roofThickness, setRoofThickness] = useState(0.15)

  // Multi-story building state
  const [currentFloor, setCurrentFloor] = useState(0) // 0 = ground floor
  const [floorHeight, setFloorHeight] = useState(2.7) // Height per floor in meters
  const [floorCountToAdd, setFloorCountToAdd] = useState(2) // Number of floors to add when clicking room
  const totalFloors = useMemo(() => {
    if (walls.length === 0) return 1
    const maxFloor = Math.max(...walls.map(w => w.floorLevel ?? 0))
    return maxFloor + 1
  }, [walls])

  // Room detection (auto-detect enclosed areas from walls per floor)
  const rooms = useMemo(() => {
    // Group walls by floor level
    const wallsByFloor = {}
    for (const wall of walls) {
      const floor = wall.floorLevel ?? 0
      if (!wallsByFloor[floor]) wallsByFloor[floor] = []
      wallsByFloor[floor].push(wall)
    }
    // Detect rooms for each floor and add floorLevel
    const allRooms = []
    for (const [floor, floorWalls] of Object.entries(wallsByFloor)) {
      const floorRooms = detectRooms(floorWalls)
      for (const room of floorRooms) {
        allRooms.push({ ...room, floorLevel: parseInt(floor, 10) })
      }
    }
    return allRooms
  }, [walls])

  // Ref to track pending room re-selection after rotation (rooms regenerate with new IDs)
  const pendingRoomSelectionRef = useRef(null)

  // Re-select room after changes (rooms regenerate with new IDs, so we match by center)
  useEffect(() => {
    if (pendingRoomSelectionRef.current && rooms.length > 0) {
      const { x: cx, z: cz } = pendingRoomSelectionRef.current
      // Use 2m tolerance to handle center shift from wall resizing
      const matchingRoom = rooms.find(r =>
        Math.abs(r.center.x - cx) < 2 && Math.abs(r.center.z - cz) < 2
      )
      if (matchingRoom) {
        setSelectedRoomId(matchingRoom.id)
      }
      pendingRoomSelectionRef.current = null
    }
  }, [rooms])

  // Update roof roomIds when rooms regenerate (rooms get new IDs after wall moves)
  useEffect(() => {
    if (roofs.length === 0 || rooms.length === 0) return

    // Check if any roof's roomId no longer exists
    const orphanedRoofs = roofs.filter(roof => !rooms.find(r => r.id === roof.roomId))

    if (orphanedRoofs.length > 0) {
      // For each orphaned roof, find matching room by wall IDs
      const updates = []
      orphanedRoofs.forEach(roof => {
        // If roof has stored wallIds, find room with same walls
        if (roof.wallIds && roof.wallIds.length > 0) {
          const newRoom = rooms.find(r => {
            const roomWallIds = findWallsForRoom(r, walls)
            // Check if same walls (order may differ)
            return roof.wallIds.length === roomWallIds.length &&
              roof.wallIds.every(id => roomWallIds.includes(id))
          })
          if (newRoom) {
            updates.push({ roofId: roof.id, newRoomId: newRoom.id })
          }
        }
      })

      // Apply updates
      if (updates.length > 0) {
        setRoofs(prev => prev.map(roof => {
          const update = updates.find(u => u.roofId === roof.id)
          if (update) {
            return { ...roof, roomId: update.newRoomId }
          }
          return roof
        }))
      }
    }
  }, [rooms, roofs, walls])

  // Floor plan background state (for tracing walls over uploaded image)
  const [floorPlanImage, setFloorPlanImage] = useState(null) // Base64 image data
  const [floorPlanSettings, setFloorPlanSettings] = useState({
    opacity: 0.5,
    visible: true,
    scale: 1, // meters per unit (will be calculated from reference)
    offsetX: 0, // meters offset from center
    offsetZ: 0,
  })
  const [showUploadModal, setShowUploadModal] = useState(false)

  // Labels state (load from localStorage) - land labels default ON
  const [labels, setLabels] = useState(() => {
    const saved = localStorage.getItem('landVisualizerLabels')
    if (saved) {
      try { return JSON.parse(saved) } catch (e) { /* ignore */ }
    }
    return { land: true, buildings: false, buildingDimensions: false, orientation: false }
  })

  // Shared scene state
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState(null)
  const [shareStatus, setShareStatus] = useState(null) // 'copied' | 'error' | null
  const [isExporting, setIsExporting] = useState(false)
  const [isCapturing, setIsCapturing] = useState(false)
  const [isExportingModel, setIsExportingModel] = useState(false)
  const [isExportingPdf, setIsExportingPdf] = useState(false)
  const canvasRef = useRef(null)
  const sceneRef = useRef(null)

  // Centralized edit permission - gates all editing actions
  const canEdit = !isReadOnly

  // Camera mode state (persisted)
  const [cameraMode, setCameraMode] = useState(() => {
    const saved = localStorage.getItem('landVisualizerCameraMode')
    return saved || CAMERA_MODE.FIRST_PERSON
  })
  const [followDistance, setFollowDistance] = useState(() => {
    const saved = localStorage.getItem('landVisualizerFollowDistance')
    return saved ? parseFloat(saved) : 0
  })
  // View mode: 'firstPerson' | 'orbit' | '2d'
  const [viewMode, setViewMode] = useState('firstPerson')
  const orbitEnabled = viewMode === 'orbit' // Derived for backward compatibility
  const setOrbitEnabled = (val) => setViewMode(val ? 'orbit' : 'firstPerson') // Compat setter
  const [fitToLandTrigger, setFitToLandTrigger] = useState(0) // Increment to trigger fit-to-land

  // Graphics quality state (default based on device)
  const [graphicsQuality, setGraphicsQuality] = useState(() => {
    const saved = localStorage.getItem('landVisualizerQuality')
    if (saved && Object.values(QUALITY).includes(saved)) return saved
    // Default: FAST on mobile, BEST on desktop
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    return isMobile ? QUALITY.FAST : QUALITY.BEST
  })

  // Camera update callback (memoized to prevent re-renders)
  const handleCameraUpdate = useCallback((state) => {
    setCameraState(state)
  }, [])

  // Detect touch device
  useEffect(() => {
    setIsTouchDevice('ontouchstart' in window || navigator.maxTouchPoints > 0)
  }, [])

  // Auto-fade help text after 5 seconds
  useEffect(() => {
    if (helpTextVisible && !isDefiningLand) {
      helpTextTimerRef.current = setTimeout(() => {
        setHelpTextVisible(false)
      }, 5000)
    }
    return () => {
      if (helpTextTimerRef.current) clearTimeout(helpTextTimerRef.current)
    }
  }, [helpTextVisible, isDefiningLand])

  // Example mode: when user hasn't defined their own land
  const isExampleMode = !userHasLand

  // Initialize walkthrough for first-time visitors
  useEffect(() => {
    if (!hasSeenIntro && isExampleMode) {
      // Start walkthrough step 0 (movement prompt)
      setWalkthroughStep(0)
      setWalkthroughVisible(true)

      // Auto-advance after 3 seconds if no movement
      walkthroughTimerRef.current = setTimeout(() => {
        advanceWalkthrough()
      }, 3000)
    }
    return () => {
      if (walkthroughTimerRef.current) clearTimeout(walkthroughTimerRef.current)
    }
  }, [hasSeenIntro, isExampleMode])

  // Listen for movement to advance walkthrough
  useEffect(() => {
    if (hasSeenIntro || walkthroughStep >= 3) return

    const handleKeyDown = (e) => {
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        advanceWalkthrough()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [hasSeenIntro, walkthroughStep])

  const advanceWalkthrough = () => {
    if (walkthroughTimerRef.current) clearTimeout(walkthroughTimerRef.current)

    setWalkthroughStep(prev => {
      const next = prev + 1
      if (next >= 3) {
        // Walkthrough complete
        setHasSeenIntro(true)
        localStorage.setItem('landVisualizerIntroSeen', 'true')
        return 3
      }
      // Set timer for next step
      walkthroughTimerRef.current = setTimeout(() => {
        advanceWalkthrough()
      }, 3000)
      return next
    })
  }

  // Set example land with soccer field comparison on mount (if no user land)
  useEffect(() => {
    if (isExampleMode) {
      setConfirmedPolygon(EXAMPLE_LAND_POLYGON)
      setShapeMode('polygon')
      setActiveComparisons({}) // No default comparison objects
    }
  }, [isExampleMode])

  // Load unit preferences from localStorage
  useEffect(() => {
    const savedUnits = localStorage.getItem('landVisualizerUnits')
    if (savedUnits) {
      try {
        const { lengthUnit: lu, areaUnit: au } = JSON.parse(savedUnits)
        if (lu) setLengthUnit(lu)
        if (au) setAreaUnit(au)
      } catch (e) {
        console.error('Failed to load unit preferences:', e)
      }
    }
  }, [])

  // Save unit preferences when they change
  useEffect(() => {
    localStorage.setItem('landVisualizerUnits', JSON.stringify({ lengthUnit, areaUnit }))
  }, [lengthUnit, areaUnit])

  // Save grid snap preferences when they change
  useEffect(() => {
    localStorage.setItem('landVisualizerGridSnap', String(gridSnapEnabled))
  }, [gridSnapEnabled])
  useEffect(() => {
    localStorage.setItem('landVisualizerGridSize', String(gridSize))
  }, [gridSize])

  // Save setback preferences when they change
  useEffect(() => {
    localStorage.setItem('landVisualizerSetbacksEnabled', String(setbacksEnabled))
  }, [setbacksEnabled])
  useEffect(() => {
    localStorage.setItem('landVisualizerSetbackDistance', String(setbackDistanceM))
  }, [setbackDistanceM])

  // Save labels preferences
  useEffect(() => {
    localStorage.setItem('landVisualizerLabels', JSON.stringify(labels))
  }, [labels])

  // Save camera mode and distance (not orbit - always starts OFF)
  useEffect(() => {
    localStorage.setItem('landVisualizerCameraMode', cameraMode)
  }, [cameraMode])
  useEffect(() => {
    localStorage.setItem('landVisualizerFollowDistance', String(followDistance))
  }, [followDistance])

  // Handle orbit toggle - set sensible starting distance when enabled
  // View mode keyboard shortcuts (1=FP, 2=Orbit, 3=2D)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      // Ignore if land panel is open (user may be typing dimensions)
      if (activePanel === 'land') return
      // Ignore if drawing tool is active (user may be typing dimensions)
      if (activeBuildTool === BUILD_TOOLS.WALL || activeBuildTool === BUILD_TOOLS.HALF_WALL || activeBuildTool === BUILD_TOOLS.FENCE || activeBuildTool === BUILD_TOOLS.POOL || activeBuildTool === BUILD_TOOLS.FOUNDATION || activeBuildTool === BUILD_TOOLS.POLYGON_ROOM) return
      if (e.key === '1') setViewMode('firstPerson')
      else if (e.key === '2') setViewMode('orbit')
      else if (e.key === '3') setViewMode('2d')
      else if (e.key === 'f' || e.key === 'F') {
        if (viewMode === 'orbit' || viewMode === '2d') {
          setFitToLandTrigger(t => t + 1)
        }
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePanel, activeBuildTool, viewMode])

  // Build tool keyboard shortcuts (only when Build panel is open)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      if (activePanel !== 'build') return
      if (e.ctrlKey || e.metaKey || e.altKey) return
      const key = e.key.toLowerCase()
      const toolMap = {
        q: BUILD_TOOLS.ROOM,
        t: BUILD_TOOLS.WALL,
        g: BUILD_TOOLS.FENCE,
        c: BUILD_TOOLS.DOOR,
        v: BUILD_TOOLS.WINDOW,
        b: BUILD_TOOLS.POOL,
        n: BUILD_TOOLS.FOUNDATION,
        h: BUILD_TOOLS.STAIRS,
        j: BUILD_TOOLS.ROOF,
        x: BUILD_TOOLS.DELETE,
      }
      if (toolMap[key]) {
        e.preventDefault()
        setActiveBuildTool(prev => prev === toolMap[key] ? BUILD_TOOLS.NONE : toolMap[key])
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activePanel])

  // Undo/Redo keyboard shortcuts (Ctrl+Z, Ctrl+Shift+Z, Ctrl+Y)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      // Undo: Ctrl+Z (or Cmd+Z on Mac)
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && !e.shiftKey) {
        e.preventDefault()
        if (canUndo) {
          undoWalls()
          setUndoRedoToast('Undone')
          setTimeout(() => setUndoRedoToast(null), 1500)
        }
      }

      // Redo: Ctrl+Shift+Z or Ctrl+Y
      if ((e.ctrlKey || e.metaKey) && e.key === 'z' && e.shiftKey) {
        e.preventDefault()
        if (canRedo) {
          redoWalls()
          setUndoRedoToast('Redone')
          setTimeout(() => setUndoRedoToast(null), 1500)
        }
      }
      if ((e.ctrlKey || e.metaKey) && e.key === 'y') {
        e.preventDefault()
        if (canRedo) {
          redoWalls()
          setUndoRedoToast('Redone')
          setTimeout(() => setUndoRedoToast(null), 1500)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [canUndo, canRedo, undoWalls, redoWalls])

  // Save quality preference
  useEffect(() => {
    localStorage.setItem('landVisualizerQuality', graphicsQuality)
  }, [graphicsQuality])

  // Toggle between quality presets
  const cycleQuality = useCallback(() => {
    setGraphicsQuality(prev => prev === QUALITY.FAST ? QUALITY.BEST : QUALITY.FAST)
  }, [])

  // Load shared scene from URL if present
  const loadSharedScene = useCallback(async (shareId) => {
    setShareLoading(true)
    setShareError(null)

    const result = await fetchSharedScene(shareId)

    if (result.error) {
      setShareError(result.error)
      setShareLoading(false)
      return
    }

    const payload = result.payload

    // Restore land
    if (payload.land) {
      setDimensions(payload.land.dimensions || { length: 20, width: 15 })
      setShapeMode(payload.land.type === 'rectangle' ? 'rectangle' : 'polygon')
      if (payload.land.vertices) {
        setConfirmedPolygon(payload.land.vertices)
        setPolygonPoints(payload.land.vertices)
      }
    }

    // Restore buildings (map typeId back to full type object)
    if (payload.buildings) {
      const restoredBuildings = payload.buildings.map(b => {
        const buildingType = BUILDING_TYPES.find(t => t.id === b.typeId)
        return buildingType ? {
          id: b.id,
          type: buildingType,
          position: { x: b.x, z: b.z },
          rotationY: b.rotationY
        } : null
      }).filter(Boolean)
      setPlacedBuildings(restoredBuildings)
    }

    // Restore settings
    if (payload.settings) {
      if (payload.settings.unitSystem) {
        setLengthUnit(payload.settings.unitSystem.lengthUnit || 'm')
        setAreaUnit(payload.settings.unitSystem.areaUnit || 'm²')
      }
      if (payload.settings.setbacksEnabled !== undefined) {
        setSetbacksEnabled(payload.settings.setbacksEnabled)
      }
      if (payload.settings.setbackDistanceM !== undefined) {
        setSetbackDistanceM(payload.settings.setbackDistanceM)
      }
      if (payload.settings.labels) {
        setLabels(payload.settings.labels)
      }
    }

    // Restore comparisons
    if (payload.comparisons) {
      const comparisons = {}
      payload.comparisons.forEach(id => { comparisons[id] = true })
      setActiveComparisons(comparisons)
    }

    // Restore walls with openings (backward compatible - old shares may not have walls)
    if (payload.walls && Array.isArray(payload.walls)) {
      const loadedWalls = payload.walls
        .filter(w => w && w.start && w.end) // Validate structure
        .map(wall => ({
          id: wall.id || `wall-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          start: { x: wall.start.x, z: wall.start.z },
          end: { x: wall.end.x, z: wall.end.z },
          height: wall.height || 2.7,
          thickness: wall.thickness || 0.15,
          openings: (wall.openings || [])
            .filter(o => o && o.type && typeof o.position === 'number')
            .map(opening => ({
              id: opening.id || `${opening.type}-${Date.now()}`,
              type: opening.type,
              position: opening.position,
              width: opening.width,
              height: opening.height,
              sillHeight: opening.sillHeight || 0
            }))
        }))
      clearWallsHistory(loadedWalls)
    } else {
      clearWallsHistory([]) // No walls in old shares
    }

    // Mark as user land (not example) and read-only
    setUserHasLand(true)
    setIsReadOnly(true)
    setShareLoading(false)

    // Analytics: shared link opened successfully
    track('share_link_opened', {})
  }, [])

  // Check URL for shared scene on mount + track landing
  useEffect(() => {
    const path = window.location.pathname
    const match = path.match(/^\/s\/([a-f0-9-]+)$/i)
    if (match) {
      // Shared mode - track after load completes (in loadSharedScene)
      track('landing_loaded', { mode: 'shared', device: getDeviceType() })
      loadSharedScene(match[1])
    } else {
      // Check if user has saved land data
      const hasSavedLand = localStorage.getItem('landVisualizer') !== null
      const mode = hasSavedLand ? 'user' : 'example'
      track('landing_loaded', { mode, device: getDeviceType() })
    }
  }, [loadSharedScene])

  // Recompute building overlaps when buildings change
  useEffect(() => {
    const overlaps = computeOverlappingIds(placedBuildings)
    setOverlappingBuildingIds(overlaps)
  }, [placedBuildings])

  // When length unit changes, update area unit to match (m→m², ft→ft², mm→m²)
  const handleLengthUnitChange = (unit) => {
    setLengthUnit(unit)
    // Auto-switch area unit to match, unless using acres/hectares
    // For mm, keep m² since mm² is too small for land areas
    if (areaUnit !== 'acres' && areaUnit !== 'hectares') {
      if (unit === 'ft') setAreaUnit('ft²')
      else setAreaUnit('m²') // m and mm both use m²
    }
  }

  // Toggle panel - close if same, open if different
  const togglePanel = useCallback((panel) => {
    setActivePanel(prev => {
      const next = prev === panel ? null : panel
      if (next !== 'build') setActiveBuildTool(BUILD_TOOLS.NONE)
      return next
    })
  }, [])

  const handlePolygonComplete = () => {
    if (polygonPoints.length >= 3) {
      setConfirmedPolygon(polygonPoints)
    }
  }

  const area = (shapeMode === 'polygon' || shapeMode === 'upload') && confirmedPolygon
    ? calculatePolygonArea(confirmedPolygon)
    : dimensions.length * dimensions.width

  const handleInputChange = (field, value) => {
    setInputValues(prev => ({ ...prev, [field]: value }))
  }

  const handleVisualize = () => {
    // Default values: 20m x 15m (65ft x 50ft, 20000mm x 15000mm)
    const defaultLength = lengthUnit === 'ft' ? 65 : lengthUnit === 'mm' ? 20000 : 20
    const defaultWidth = lengthUnit === 'ft' ? 50 : lengthUnit === 'mm' ? 15000 : 15
    const lengthInput = parseFloat(inputValues.length) || defaultLength
    const widthInput = parseFloat(inputValues.width) || defaultWidth
    // Convert from display unit to meters for internal storage
    const lengthMeters = convertLengthToMeters(lengthInput, lengthUnit)
    const widthMeters = convertLengthToMeters(widthInput, lengthUnit)
    setDimensions({ length: Math.max(0.3, lengthMeters), width: Math.max(0.3, widthMeters) })
  }

  // Get display values in current unit (for showing in inputs)
  const getDisplayLength = (meters) => convertLength(meters, lengthUnit).toFixed(1)
  const getDisplayWidth = (meters) => convertLength(meters, lengthUnit).toFixed(1)

  // Update input values when dimensions change (e.g., from localStorage load)
  useEffect(() => {
    setInputValues({
      length: getDisplayLength(dimensions.length),
      width: getDisplayWidth(dimensions.width)
    })
  }, [dimensions, lengthUnit])

  const toggleComparison = (id) => {
    setActiveComparisons(prev => ({
      ...prev,
      [id]: !prev[id]
    }))
  }

  // Update comparison object position (for drag-to-position)
  const updateComparisonPosition = useCallback((id, position) => {
    setComparisonPositions(prev => ({
      ...prev,
      [id]: position
    }))
  }, [])

  // Update comparison object rotation
  const updateComparisonRotation = useCallback((id, rotation) => {
    setComparisonRotations(prev => ({
      ...prev,
      [id]: rotation
    }))
  }, [])

  // Reset comparison object transform (position + rotation)
  const resetComparisonTransform = useCallback((id) => {
    setComparisonPositions(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
    setComparisonRotations(prev => {
      const next = { ...prev }
      delete next[id]
      return next
    })
  }, [])

  // Wall builder callbacks
  const addWallFromPoints = useCallback((points, wallHeight = 2.7, isFence = false, fenceStyle = 'picket') => {
    if (points.length < 2) return
    const newWalls = []
    for (let i = 0; i < points.length - 1; i++) {
      newWalls.push({
        id: `wall-${Date.now()}-${i}`,
        start: { x: points[i].x, z: points[i].z },
        end: { x: points[i + 1].x, z: points[i + 1].z },
        height: isFence ? 1.0 : wallHeight, // Fences are 1.0m tall by default
        thickness: isFence ? 0.08 : 0.15,   // Fences are thinner
        openings: [],
        isFence: isFence, // Mark as fence for special rendering
        fenceType: isFence ? fenceStyle : undefined, // Fence style type
        floorLevel: isFence ? 0 : currentFloor // Fences always on ground, walls on current floor
      })
    }
    pushWallsState([...walls, ...newWalls])
  }, [walls, pushWallsState, currentFloor])

  // Add opening (door/window) to a wall
  const addOpeningToWall = useCallback((wallId, opening) => {
    const newWalls = walls.map(wall => {
      if (wall.id !== wallId) return wall
      return {
        ...wall,
        openings: [...(wall.openings || []), opening]
      }
    })
    pushWallsState(newWalls)
  }, [walls, pushWallsState])

  const clearAllWalls = useCallback(() => {
    pushWallsState([])
    setWallDrawingPoints([])
  }, [pushWallsState])

  // Context-sensitive clear by tool type
  const onClearByType = useCallback((toolType) => {
    switch (toolType) {
      case BUILD_TOOLS.ROOM:
      case BUILD_TOOLS.POLYGON_ROOM: {
        // Find wall IDs that form rooms using geometry matching
        const roomWallIds = new Set()
        for (const room of rooms) {
          const ids = findWallsForRoom(room, walls)
          ids.forEach(id => roomWallIds.add(id))
        }
        if (roomWallIds.size === 0) return
        pushWallsState(walls.filter(w => !roomWallIds.has(w.id)))
        // Remove roofs tied to those rooms
        const roomIds = new Set(rooms.map(r => r.id))
        setRoofs(prev => prev.filter(r => !roomIds.has(r.roomId)))
        break
      }
      case BUILD_TOOLS.WALL:
      case BUILD_TOOLS.HALF_WALL: {
        // Remove non-fence walls that are NOT part of any room
        const roomWallIds = new Set()
        for (const room of rooms) {
          const ids = findWallsForRoom(room, walls)
          ids.forEach(id => roomWallIds.add(id))
        }
        const filtered = walls.filter(w => w.isFence || roomWallIds.has(w.id))
        if (filtered.length === walls.length) return
        pushWallsState(filtered)
        break
      }
      case BUILD_TOOLS.FENCE: {
        const filtered = walls.filter(w => !w.isFence)
        if (filtered.length === walls.length) return
        pushWallsState(filtered)
        break
      }
      case BUILD_TOOLS.DOOR: {
        // Remove all door openings from walls
        const newWalls = walls.map(w => ({
          ...w,
          openings: (w.openings || []).filter(o => o.type !== 'door')
        }))
        pushWallsState(newWalls)
        break
      }
      case BUILD_TOOLS.WINDOW: {
        // Remove all window openings from walls
        const newWalls = walls.map(w => ({
          ...w,
          openings: (w.openings || []).filter(o => o.type !== 'window')
        }))
        pushWallsState(newWalls)
        break
      }
      case BUILD_TOOLS.POOL:
        setPools([])
        break
      case BUILD_TOOLS.FOUNDATION:
        setFoundations([])
        break
      case BUILD_TOOLS.STAIRS:
        setStairs([])
        break
      case BUILD_TOOLS.ROOF:
        setRoofs([])
        break
      default:
        // Clear everything
        pushWallsState([])
        setWallDrawingPoints([])
        setPools([])
        setFoundations([])
        setStairs([])
        setRoofs([])
        break
    }
    setSelectedElement(null)
  }, [walls, rooms, pushWallsState])

  // Delete a single wall by ID
  const deleteWall = useCallback((wallId) => {
    pushWallsState(walls.filter(w => w.id !== wallId))
    // Clear selection if deleted wall was selected
    if (selectedElement?.type === 'wall' && selectedElement?.id === wallId) {
      setSelectedElement(null)
    }
  }, [walls, pushWallsState, selectedElement])

  // Resize a wall to a new length (keeps start point fixed, moves end point)
  // Also updates adjacent walls that share the moved endpoint
  // Optional roomCenter parameter for re-selecting room after regeneration
  const resizeWall = useCallback((wallId, newLength, roomCenter) => {
    const wall = walls.find(w => w.id === wallId)
    if (!wall) return

    // Calculate current direction vector
    const dx = wall.end.x - wall.start.x
    const dz = wall.end.z - wall.start.z
    const currentLength = Math.sqrt(dx * dx + dz * dz)

    if (currentLength === 0) return // Can't resize a zero-length wall

    // Store room center for re-selection after rooms regenerate
    if (roomCenter) {
      pendingRoomSelectionRef.current = { x: roomCenter.x, z: roomCenter.z }
    }

    // Normalize and scale to new length
    const scale = newLength / currentLength
    const newEnd = {
      x: wall.start.x + dx * scale,
      z: wall.start.z + dz * scale
    }

    const oldEnd = wall.end
    const SNAP_THRESHOLD = 0.01 // 1cm tolerance for finding connected walls

    const newWalls = walls.map(w => {
      if (w.id === wallId) {
        return { ...w, end: newEnd }
      }
      // Check if this wall's start connects to the old end point
      if (Math.abs(w.start.x - oldEnd.x) < SNAP_THRESHOLD && Math.abs(w.start.z - oldEnd.z) < SNAP_THRESHOLD) {
        return { ...w, start: newEnd }
      }
      // Check if this wall's end connects to the old end point
      if (Math.abs(w.end.x - oldEnd.x) < SNAP_THRESHOLD && Math.abs(w.end.z - oldEnd.z) < SNAP_THRESHOLD) {
        return { ...w, end: newEnd }
      }
      return w
    })
    pushWallsState(newWalls)
  }, [walls, pushWallsState])

  // Change wall height
  const changeWallHeight = useCallback((wallId, newHeight) => {
    const newWalls = walls.map(w => {
      if (w.id !== wallId) return w
      return { ...w, height: newHeight }
    })
    pushWallsState(newWalls)
  }, [walls, pushWallsState])

  // Change wall color
  const changeWallColor = useCallback((wallId, color) => {
    const newWalls = walls.map(w => {
      if (w.id !== wallId) return w
      return { ...w, color }
    })
    pushWallsState(newWalls)
  }, [walls, pushWallsState])

  // Change wall pattern/texture
  const changeWallPattern = useCallback((wallId, pattern) => {
    const newWalls = walls.map(w => {
      if (w.id !== wallId) return w
      return { ...w, pattern }
    })
    pushWallsState(newWalls)
  }, [walls, pushWallsState])

  // Change fence height
  const changeFenceHeight = useCallback((fenceId, newHeight) => {
    const newWalls = walls.map(w => {
      if (w.id !== fenceId) return w
      return { ...w, height: newHeight }
    })
    pushWallsState(newWalls)
  }, [walls, pushWallsState])

  // Change fence type/style
  const changeFenceType = useCallback((fenceId, newFenceType) => {
    const newWalls = walls.map(w => {
      if (w.id !== fenceId) return w
      return { ...w, fenceType: newFenceType }
    })
    pushWallsState(newWalls)
  }, [walls, pushWallsState])

  // Floor management callbacks
  const addFloor = useCallback(() => {
    const newFloorLevel = totalFloors
    setCurrentFloor(newFloorLevel)
  }, [totalFloors])

  const removeCurrentFloor = useCallback(() => {
    if (currentFloor === 0) return // Cannot remove ground floor
    // Remove walls on current floor
    const newWalls = walls.filter(w => (w.floorLevel ?? 0) !== currentFloor)
    pushWallsState(newWalls)
    // Switch to floor below
    setCurrentFloor(currentFloor - 1)
  }, [currentFloor, walls, pushWallsState])

  const switchFloor = useCallback((floorLevel) => {
    if (floorLevel >= 0 && floorLevel < totalFloors) {
      setCurrentFloor(floorLevel)
    }
  }, [totalFloors])

  // Add multiple floors to an existing room by duplicating its walls
  const addFloorsToRoom = useCallback((roomId) => {
    const room = rooms.find(r => r.id === roomId)
    if (!room) return

    const roomFloorLevel = room.floorLevel ?? 0
    const roomWallIds = room.wallIds || []
    const roomWalls = walls.filter(w => roomWallIds.includes(w.id))

    if (roomWalls.length === 0) return

    const newWalls = []
    for (let floorOffset = 1; floorOffset <= floorCountToAdd; floorOffset++) {
      const newFloorLevel = roomFloorLevel + floorOffset
      for (const wall of roomWalls) {
        // Duplicate wall with new ID and floor level
        newWalls.push({
          ...wall,
          id: `wall-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`,
          floorLevel: newFloorLevel,
          openings: [] // New floors start without doors/windows
        })
      }
    }

    pushWallsState([...walls, ...newWalls])
    setActiveBuildTool(BUILD_TOOLS.NONE)
  }, [rooms, walls, floorCountToAdd, pushWallsState, setActiveBuildTool])

  // Pool callbacks
  const addPool = useCallback((points) => {
    if (points.length < 3) return
    const xs = points.map(p => p.x)
    const zs = points.map(p => p.z)
    const newPool = {
      id: `pool-${Date.now()}`,
      points,
      depth: poolDepth,
      deckWidth: 0.8,
      waterColor: '#00CED1',
      deckMaterial: poolDeckMaterial,
      center: { x: xs.reduce((a, b) => a + b, 0) / points.length, z: zs.reduce((a, b) => a + b, 0) / points.length }
    }
    setPools(prev => [...prev, newPool])
  }, [poolDepth, poolDeckMaterial])

  const deletePool = useCallback((poolId) => {
    setPools(prev => prev.filter(p => p.id !== poolId))
    if (selectedPoolId === poolId) setSelectedPoolId(null)
  }, [selectedPoolId])

  const updatePool = useCallback((poolId, updates) => {
    setPools(prev => prev.map(p => p.id === poolId ? { ...p, ...updates } : p))
  }, [])

  // Foundation callbacks
  const addFoundation = useCallback((points) => {
    if (points.length < 3) return
    const xs = points.map(p => p.x)
    const zs = points.map(p => p.z)
    const newFoundation = {
      id: `foundation-${Date.now()}`,
      points,
      height: foundationHeight,
      hasSteps: true,
      material: foundationMaterial,
      center: { x: xs.reduce((a, b) => a + b, 0) / points.length, z: zs.reduce((a, b) => a + b, 0) / points.length }
    }
    setFoundations(prev => [...prev, newFoundation])
  }, [foundationHeight, foundationMaterial])

  const deleteFoundation = useCallback((foundationId) => {
    setFoundations(prev => prev.filter(f => f.id !== foundationId))
    if (selectedFoundationId === foundationId) setSelectedFoundationId(null)
  }, [selectedFoundationId])

  const updateFoundation = useCallback((foundationId, updates) => {
    setFoundations(prev => prev.map(f => f.id === foundationId ? { ...f, ...updates } : f))
  }, [])

  // Stairs callbacks - preset-based single-click placement
  const addStairs = useCallback((position, nearbyFoundationHeight = null) => {
    // Auto-detect height from nearby foundation or use default
    const topY = nearbyFoundationHeight || stairsTopY
    const segmentLength = 1.5 // Length of each stair segment

    // Calculate stairs based on preset style
    const start = { x: position.x, z: position.z }
    let newStairs

    if (stairsStyle === 'l-left' || stairsStyle === 'l-right') {
      // L-shaped stairs: two segments with a landing
      const turnDir = stairsStyle === 'l-left' ? -1 : 1
      const mid = { x: position.x, z: position.z - segmentLength } // Landing center (first segment ends here)
      // Second segment starts from edge of landing, not center
      const mid2 = { x: position.x + (stairsWidth / 2 * turnDir), z: position.z - segmentLength }
      const end = { x: position.x + (stairsWidth / 2 * turnDir) + (segmentLength * turnDir), z: position.z - segmentLength }

      newStairs = {
        id: `stairs-${Date.now()}`,
        start,
        mid, // Landing center (first segment ends here)
        mid2, // Edge of landing (second segment starts here)
        end,
        bottomY: 0,
        topY: topY,
        width: stairsWidth,
        style: stairsStyle,
        railings: true,
        material: 'wood'
      }
    } else {
      // Straight stairs
      const length = stairsStyle === 'wide' ? 2 : 2
      const width = stairsStyle === 'wide' ? 1.5 : stairsWidth
      const end = { x: position.x, z: position.z - length }

      newStairs = {
        id: `stairs-${Date.now()}`,
        start,
        end,
        bottomY: 0,
        topY: topY,
        width: width,
        style: stairsStyle,
        railings: true,
        material: 'wood'
      }
    }

    setStairs(prev => [...prev, newStairs])
  }, [stairsWidth, stairsStyle, stairsTopY])

  const deleteStairs = useCallback((stairsId) => {
    setStairs(prev => prev.filter(s => s.id !== stairsId))
    if (selectedStairsId === stairsId) setSelectedStairsId(null)
  }, [selectedStairsId])

  const updateStairs = useCallback((stairsId, updates) => {
    setStairs(prev => prev.map(s => s.id === stairsId ? { ...s, ...updates } : s))
  }, [])

  // Roof callbacks
  const addRoof = useCallback((roomId) => {
    // Check if roof already exists for this room
    if (roofs.some(r => r.roomId === roomId)) return
    // Find the room and its wall IDs to track the roof even when room ID changes
    const room = rooms.find(r => r.id === roomId)
    const wallIds = room ? findWallsForRoom(room, walls) : []
    const newRoof = {
      id: `roof-${Date.now()}`,
      roomId,
      wallIds, // Store wall IDs so we can find the room after it regenerates
      type: roofType,
      pitch: roofPitch,
      overhang: roofOverhang,
      thickness: roofThickness,
      material: 'shingle',
      color: '#8B4513'
    }
    setRoofs(prev => [...prev, newRoof])
  }, [roofType, roofPitch, roofOverhang, roofThickness, roofs, rooms, walls])

  const deleteRoof = useCallback((roofId) => {
    setRoofs(prev => prev.filter(r => r.id !== roofId))
    if (selectedRoofId === roofId) setSelectedRoofId(null)
  }, [selectedRoofId])

  const updateRoof = useCallback((roofId, updates) => {
    setRoofs(prev => prev.map(r => r.id === roofId ? { ...r, ...updates } : r))
  }, [])

  // Delete an opening from a wall
  const deleteOpening = useCallback((wallId, openingId) => {
    const newWalls = walls.map(w => {
      if (w.id !== wallId) return w
      return {
        ...w,
        openings: (w.openings || []).filter(o => o.id !== openingId)
      }
    })
    pushWallsState(newWalls)
  }, [walls, pushWallsState])

  // Handle generated floor plan from AI - enters placement mode
  const handleFloorPlanGenerated = useCallback((generatedData) => {
    // Store pending floor plan and enter placement mode
    setPendingFloorPlan(generatedData)
    setFloorPlanPlacementMode(true)
    setBuildingPreviewPosition({ x: 0, z: 0 })
    setBuildingPreviewRotation(0)

    // Close the generator modal and any open panels
    setShowFloorPlanGenerator(false)
    setFloorPlanImageForGenerator(null)
    setActivePanel(null)

    // Switch to 3D orbit view and reset camera to good placement angle
    setViewMode('orbit')
    setTimeout(() => setFitToLandTrigger(t => t + 1), 50)

    // Show instruction
    setUndoRedoToast('Click on land to place building • R to rotate • ESC to cancel')
  }, [])

  // Place the pending floor plan as a building
  const placeFloorPlanBuilding = useCallback((position) => {
    if (!pendingFloorPlan) return

    const newBuilding = {
      id: `building-${Date.now()}`,
      position: { x: position.x, z: position.z },
      rotation: buildingPreviewRotation,
      walls: pendingFloorPlan.walls,
      rooms: pendingFloorPlan.rooms || [],
      stats: pendingFloorPlan.stats,
    }

    setBuildings(prev => [...prev, newBuilding])
    setPendingFloorPlan(null)
    setFloorPlanPlacementMode(false)
    setUndoRedoToast(`Placed building with ${newBuilding.stats.wallCount} walls`)
    setTimeout(() => setUndoRedoToast(null), 3000)
  }, [pendingFloorPlan, buildingPreviewRotation])

  // Cancel floor plan placement
  const cancelFloorPlanPlacement = useCallback(() => {
    setPendingFloorPlan(null)
    setFloorPlanPlacementMode(false)
    setBuildingPreviewPosition({ x: 0, z: 0 })
    setBuildingPreviewRotation(0)
    setUndoRedoToast(null)
  }, [])

  // Rotate building preview (or selected building)
  const rotateBuildingPreview = useCallback((angle = Math.PI / 2) => {
    if (floorPlanPlacementMode) {
      setBuildingPreviewRotation(prev => prev + angle)
    } else if (selectedBuildingId) {
      setBuildings(prev => prev.map(b =>
        b.id === selectedBuildingId
          ? { ...b, rotation: (b.rotation || 0) + angle }
          : b
      ))
    }
  }, [floorPlanPlacementMode, selectedBuildingId])

  // Move selected building
  const moveSelectedBuilding = useCallback((newPosition) => {
    if (!selectedBuildingId) return
    setBuildings(prev => prev.map(b =>
      b.id === selectedBuildingId
        ? { ...b, position: { x: newPosition.x, z: newPosition.z } }
        : b
    ))
  }, [selectedBuildingId])

  // Delete selected building
  const deleteSelectedBuilding = useCallback(() => {
    if (!selectedBuildingId) return
    setBuildings(prev => prev.filter(b => b.id !== selectedBuildingId))
    setSelectedBuildingId(null)
  }, [selectedBuildingId])

  // Rotate selected comparison object
  const rotateSelectedComparison = useCallback((angle = 90) => {
    if (!selectedComparisonId) return
    setComparisonRotations(prev => ({
      ...prev,
      [selectedComparisonId]: ((prev[selectedComparisonId] || 0) + angle) % 360
    }))
  }, [selectedComparisonId])

  // Delete selected comparison object
  const deleteSelectedComparison = useCallback(() => {
    if (!selectedComparisonId) return
    setActiveComparisons(prev => ({ ...prev, [selectedComparisonId]: false }))
    setSelectedComparisonId(null)
  }, [selectedComparisonId])

  // Delete selected room (by deleting its boundary walls)
  const deleteSelectedRoom = useCallback(() => {
    if (!selectedRoomId) return
    const room = rooms.find(r => r.id === selectedRoomId)
    if (!room) return
    const wallIds = findWallsForRoom(room, walls)
    if (wallIds.length > 0) {
      pushWallsState(walls.filter(w => !wallIds.includes(w.id)))
    }
    setSelectedRoomId(null)
  }, [selectedRoomId, rooms, walls, pushWallsState])

  // Rotate selected room by 90 degrees around its center
  const rotateSelectedRoom = useCallback(() => {
    if (!selectedRoomId) return
    const room = rooms.find(r => r.id === selectedRoomId)
    if (!room || !room.center) return
    const wallIds = findWallsForRoom(room, walls)
    if (wallIds.length === 0) return

    const cx = room.center.x
    const cz = room.center.z

    // Store center for re-selection after rooms regenerate
    pendingRoomSelectionRef.current = { x: cx, z: cz }

    // Rotate each wall's endpoints 90 degrees clockwise around center
    // For 90° rotation: newX = cx - (z - cz), newZ = cz + (x - cx)
    const newWalls = walls.map(wall => {
      if (!wallIds.includes(wall.id)) return wall
      return {
        ...wall,
        start: {
          x: cx - (wall.start.z - cz),
          z: cz + (wall.start.x - cx)
        },
        end: {
          x: cx - (wall.end.z - cz),
          z: cz + (wall.end.x - cx)
        }
      }
    })
    pushWallsState(newWalls)
  }, [selectedRoomId, rooms, walls, pushWallsState])

  // Resize selected room by scale factor (e.g., 1.1 = 10% larger)
  const resizeSelectedRoom = useCallback((scaleFactor) => {
    if (!selectedRoomId) return
    const room = rooms.find(r => r.id === selectedRoomId)
    if (!room || !room.center) return
    const wallIds = findWallsForRoom(room, walls)
    if (wallIds.length === 0) return

    const cx = room.center.x
    const cz = room.center.z

    // Store center for re-selection after rooms regenerate
    pendingRoomSelectionRef.current = { x: cx, z: cz }

    // Scale each wall's endpoints relative to center
    const newWalls = walls.map(wall => {
      if (!wallIds.includes(wall.id)) return wall
      return {
        ...wall,
        start: {
          x: cx + (wall.start.x - cx) * scaleFactor,
          z: cz + (wall.start.z - cz) * scaleFactor
        },
        end: {
          x: cx + (wall.end.x - cx) * scaleFactor,
          z: cz + (wall.end.z - cz) * scaleFactor
        }
      }
    })
    pushWallsState(newWalls)
  }, [selectedRoomId, rooms, walls, pushWallsState])

  // Wrapper to select room and deselect others
  const selectRoom = useCallback((id) => {
    setSelectedRoomId(id)
    if (id) {
      setSelectedBuildingId(null)
      setSelectedComparisonId(null)
    }
  }, [])

  // Set room label
  const handleSetRoomLabel = useCallback((roomId, label) => {
    setRoomLabels(prev => ({
      ...prev,
      [roomId]: label
    }))
  }, [])

  // Set room style (color, opacity, etc.)
  const handleSetRoomStyle = useCallback((roomId, style) => {
    setRoomStyles(prev => ({
      ...prev,
      [roomId]: { ...prev[roomId], ...style }
    }))
  }, [])

  // Move room by moving its boundary walls
  const moveRoom = useCallback((roomId, delta) => {
    const room = rooms.find(r => r.id === roomId)
    if (!room) return
    const wallIds = findWallsForRoom(room, walls)
    if (wallIds.length === 0) return

    const newWalls = walls.map(wall => {
      if (wallIds.includes(wall.id)) {
        return {
          ...wall,
          start: { x: wall.start.x + delta.x, z: wall.start.z + delta.z },
          end: { x: wall.end.x + delta.x, z: wall.end.z + delta.z }
        }
      }
      return wall
    })
    pushWallsState(newWalls)
  }, [rooms, walls, pushWallsState])

  // Move walls by IDs directly (used for room dragging to avoid ID regeneration issues)
  // Uses replaceWallsState for smooth real-time dragging (no history spam)
  const moveWallsByIds = useCallback((wallIds, delta) => {
    if (!wallIds || wallIds.length === 0) return
    const newWalls = walls.map(wall => {
      if (wallIds.includes(wall.id)) {
        return {
          ...wall,
          start: { x: wall.start.x + delta.x, z: wall.start.z + delta.z },
          end: { x: wall.end.x + delta.x, z: wall.end.z + delta.z }
        }
      }
      return wall
    })
    replaceWallsState(newWalls)
  }, [walls, replaceWallsState])

  // Commit current walls state to history (call after drag ends for undo support)
  const commitWallsToHistory = useCallback(() => {
    pushWallsState(walls)
  }, [walls, pushWallsState])

  // Wrapper to select building and deselect others
  const selectBuilding = useCallback((id) => {
    setSelectedBuildingId(id)
    if (id) {
      setSelectedComparisonId(null)
      setSelectedRoomId(null)
    }
  }, [])

  // Wrapper to select comparison and deselect others
  const selectComparison = useCallback((id) => {
    setSelectedComparisonId(id)
    if (id) {
      setSelectedBuildingId(null)
      setSelectedRoomId(null)
    }
  }, [])

  // Building/Comparison keyboard shortcuts (R to rotate, ESC to cancel, Delete to remove)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      // R to rotate (90 degrees)
      if (e.key === 'r' || e.key === 'R') {
        if (floorPlanPlacementMode || selectedBuildingId) {
          e.preventDefault()
          rotateBuildingPreview(Math.PI / 2)
        } else if (selectedComparisonId) {
          e.preventDefault()
          rotateSelectedComparison(90)
        } else if (selectedRoomId) {
          e.preventDefault()
          rotateSelectedRoom()
        }
      }

      // ESC to cancel placement or deselect
      if (e.key === 'Escape') {
        if (floorPlanPlacementMode) {
          e.preventDefault()
          cancelFloorPlanPlacement()
        } else if (selectedBuildingId) {
          e.preventDefault()
          setSelectedBuildingId(null)
        } else if (selectedComparisonId) {
          e.preventDefault()
          setSelectedComparisonId(null)
        } else if (selectedRoomId) {
          e.preventDefault()
          setRoomPropertiesOpen(false)  // Close properties panel first
          setSelectedRoomId(null)
        } else if (activePanel) {
          e.preventDefault()
          if (activePanel === 'build') setActiveBuildTool(BUILD_TOOLS.NONE)
          setActivePanel(null)
        }
      }

      // Delete/Backspace to remove selected
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBuildingId) {
          e.preventDefault()
          deleteSelectedBuilding()
        } else if (selectedComparisonId) {
          e.preventDefault()
          deleteSelectedComparison()
        } else if (selectedRoomId) {
          e.preventDefault()
          deleteSelectedRoom()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [floorPlanPlacementMode, selectedBuildingId, selectedComparisonId, selectedRoomId, rotateBuildingPreview, rotateSelectedComparison, rotateSelectedRoom, cancelFloorPlanPlacement, deleteSelectedBuilding, deleteSelectedComparison, deleteSelectedRoom, activePanel])

  // Show toast when building, comparison, or room is selected
  useEffect(() => {
    if (selectedBuildingId) {
      setUndoRedoToast('Building selected • Drag to move • R to rotate • ESC to deselect • Del to delete')
    } else if (selectedComparisonId) {
      setUndoRedoToast('Object selected • Drag to move • R to rotate • ESC to deselect • Del to remove')
    } else if (selectedRoomId) {
      setUndoRedoToast('Room selected • Drag to move • R to rotate • Double-click to name • ESC to deselect • Del to delete')
    } else if (!floorPlanPlacementMode) {
      setUndoRedoToast(null)
    }
  }, [selectedBuildingId, selectedComparisonId, selectedRoomId, floorPlanPlacementMode])

  // Get current polygon for snapping (memoized)
  const currentPolygon = useMemo(() => {
    if ((shapeMode === 'polygon' || shapeMode === 'upload') && confirmedPolygon) {
      return confirmedPolygon
    }
    // Convert rectangle to polygon
    const hw = dimensions.width / 2, hl = dimensions.length / 2
    return [
      { x: -hw, y: -hl },
      { x: hw, y: -hl },
      { x: hw, y: hl },
      { x: -hw, y: hl }
    ]
  }, [shapeMode, confirmedPolygon, dimensions.width, dimensions.length])

  const handlePlaceBuilding = (position) => {
    if (!canEdit) return
    if (!selectedBuilding) return
    const buildingType = BUILDING_TYPES.find(b => b.id === selectedBuilding)
    if (!buildingType) return

    // Apply snapping
    const { snappedPos } = applyPositionSnapping(
      { x: position.x, z: position.z },
      currentPolygon,
      { positionSnap: snapEnabled, gridSnap: gridSnapEnabled }
    )

    // Apply rotation snapping
    const finalRotation = snapEnabled ? snapRotation(buildingRotation) : buildingRotation

    // Check placement validity if setbacks enabled
    const setback = setbacksEnabled ? setbackDistanceM : 0
    if (!isPlacementValid(snappedPos, buildingType, finalRotation, currentPolygon, setback)) {
      return // Block invalid placement
    }

    const newBuilding = {
      id: Date.now(),
      type: buildingType,
      position: snappedPos,
      rotationY: finalRotation
    }

    setPlacedBuildings(prev => {
      const newBuildings = [...prev, newBuilding]

      // Analytics: track first building placed (fire once)
      if (prev.length === 0) {
        trackFirstBuildingPlaced(buildingType.id)
      }

      // Analytics: check coverage thresholds
      const { coveragePercent } = computeCoverage(newBuildings, area)
      trackCoverageThreshold(coveragePercent)

      return newBuildings
    })
    setSelectedBuilding(null) // Exit placement mode after placing
    setSnapIndicator(null) // Clear snap indicator
    setPlacementValid(true) // Reset validity
  }

  const handleDeleteBuilding = (buildingId) => {
    if (!canEdit) return
    setPlacedBuildings(prev => prev.filter(b => b.id !== buildingId))
    if (selectedPlacedBuildingId === buildingId) {
      setSelectedPlacedBuildingId(null)
    }
  }

  const handleMoveBuilding = (buildingId, newPosition) => {
    if (!canEdit) return
    setPlacedBuildings(prev => prev.map(b =>
      b.id === buildingId ? { ...b, position: newPosition } : b
    ))
  }

  // Handle pointer move for preview snapping
  const handlePreviewPointerMove = useCallback((position) => {
    if (!selectedBuilding) {
      setSnapIndicator(null)
      setPlacementValid(true)
      setDragOverlapping(false)
      return
    }
    const buildingType = BUILDING_TYPES.find(b => b.id === selectedBuilding)
    if (!buildingType) return

    const result = applyPositionSnapping(
      { x: position.x, z: position.z },
      currentPolygon,
      { positionSnap: snapEnabled, gridSnap: gridSnapEnabled }
    )

    // Check placement validity if setbacks enabled
    const setback = setbacksEnabled ? setbackDistanceM : 0
    const valid = isPlacementValid(result.snappedPos, buildingType, buildingRotation, currentPolygon, setback)
    setPlacementValid(valid)

    // Check for overlap with placed buildings (O(n))
    const overlaps = checkPreviewOverlap(result.snappedPos, buildingType, buildingRotation, placedBuildings)
    setDragOverlapping(overlaps)

    setSnapIndicator({
      snappedPos: result.snappedPos,
      snapType: result.snapType,
      point: result.snapPoint
    })
  }, [selectedBuilding, snapEnabled, gridSnapEnabled, currentPolygon, setbacksEnabled, setbackDistanceM, buildingRotation, placedBuildings])

  // Get selected building type for preview
  const selectedBuildingType = selectedBuilding ? BUILDING_TYPES.find(b => b.id === selectedBuilding) : null

  // Load saved state on mount
  useEffect(() => {
    const saved = localStorage.getItem('landVisualizer')
    if (saved) {
      try {
        const data = JSON.parse(saved)
        if (data.dimensions) {
          setDimensions(data.dimensions)
          setInputValues({ length: String(data.dimensions.length), width: String(data.dimensions.width) })
        }
        if (data.shapeMode) setShapeMode(data.shapeMode)
        if (data.polygonPoints) setPolygonPoints(data.polygonPoints)
        if (data.confirmedPolygon) setConfirmedPolygon(data.confirmedPolygon)
        if (data.placedBuildings) setPlacedBuildings(data.placedBuildings)
        if (data.activeComparisons) setActiveComparisons(data.activeComparisons)
        // Load walls with validation (backward compatible)
        if (data.walls && Array.isArray(data.walls)) {
          const validatedWalls = data.walls
            .filter(w => w && w.start && w.end) // Must have start/end
            .map(wall => ({
              id: wall.id || `wall-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              start: { x: wall.start.x || 0, z: wall.start.z || 0 },
              end: { x: wall.end.x || 0, z: wall.end.z || 0 },
              height: wall.height || 2.7,
              thickness: wall.thickness || 0.15,
              openings: Array.isArray(wall.openings)
                ? wall.openings.filter(o => o && o.type && typeof o.position === 'number')
                : []
            }))
          clearWallsHistory(validatedWalls)
        }
        // User has saved land data
        setUserHasLand(true)
      } catch (e) {
        console.error('Failed to load saved state:', e)
      }
    }
  }, [])

  const handleSave = () => {
    const data = {
      dimensions,
      shapeMode,
      polygonPoints,
      confirmedPolygon,
      placedBuildings,
      activeComparisons,
      walls
    }
    localStorage.setItem('landVisualizer', JSON.stringify(data))
    setSaveStatus('saved')
    setTimeout(() => setSaveStatus(null), 2000)
  }

  const handleClearSaved = () => {
    localStorage.removeItem('landVisualizer')
    // Reset to defaults
    setDimensions({ length: 20, width: 15 })
    setInputValues({ length: '20', width: '15' })
    setShapeMode('rectangle')
    setPolygonPoints([])
    setConfirmedPolygon(null)
    setPlacedBuildings([])
    setActiveComparisons({})
    clearWallsHistory([])
  }

  const handleExport = async (options = {}) => {
    // Export is a Pro feature
    if (!requirePaid()) return

    setIsExporting(true)
    try {
      await exportFloorPlanAsPNG({
        landPoints: currentPolygon || [],
        walls,
        rooms,
        includeDimensions: options.includeDimensions ?? true,
        includeRoomLabels: options.includeRoomLabels ?? true,
        includeLegend: options.includeLegend ?? true,
        includeGrid: options.includeGrid ?? false,
      })
    } catch (error) {
      console.error('Export error:', error)
    } finally {
      setIsExporting(false)
    }
  }

  // Handle 3D screenshot capture
  const handleScreenshot = async (options = {}) => {
    const canvas = canvasRef.current
    if (!canvas) {
      console.error('Canvas not available for screenshot')
      return
    }

    setIsCapturing(true)
    try {
      await captureAndDownload(canvas, {
        format: options.format || 'png',
        scale: options.scale || 1,
        quality: 0.92,
      })
    } catch (error) {
      console.error('Screenshot error:', error)
    } finally {
      setIsCapturing(false)
    }
  }

  // Handle 3D model export
  const handleModelExport = async (options = {}) => {
    const scene = sceneRef.current
    if (!scene) {
      console.error('Scene not available for export')
      return
    }

    setIsExportingModel(true)
    try {
      await exportModel(scene, options.format || 'glb', {
        filename: options.filename,
      })
    } catch (error) {
      console.error('Model export error:', error)
    } finally {
      setIsExportingModel(false)
    }
  }

  // Handle PDF export
  const handlePdfExport = async (options = {}) => {
    setIsExportingPdf(true)
    try {
      await exportToPDF({
        title: options.title || 'Floor Plan',
        wallCount: walls.length,
        roomCount: rooms.length,
        landArea: area,
        buildingArea: computeCoverage(placedBuildings, area).coverageAreaM2,
        landPoints: currentPolygon || [],
        walls,
        rooms,
        includeDimensions: options.includeDimensions ?? true,
        includeRoomLabels: options.includeRoomLabels ?? true,
      })
    } catch (error) {
      console.error('PDF export error:', error)
    } finally {
      setIsExportingPdf(false)
    }
  }

  // Share scene - create link and copy to clipboard
  const handleShare = async () => {
    // Analytics: track share clicked
    track('share_clicked', {})

    if (!isSupabaseConfigured()) {
      setShareStatus('error')
      setTimeout(() => setShareStatus(null), 3000)
      return
    }

    const payload = buildScenePayload({
      shapeMode,
      dimensions,
      confirmedPolygon,
      placedBuildings,
      lengthUnit,
      areaUnit,
      setbacksEnabled,
      setbackDistanceM,
      labels,
      activeComparisons,
      cameraState,
      walls
    })

    const result = await createSharedScene(payload)

    if (result.error) {
      setShareStatus('error')
      setTimeout(() => setShareStatus(null), 3000)
      return
    }

    // Analytics: track share created successfully
    track('share_created_success', { shareIdPresent: Boolean(result.id) })

    // Build share URL and copy to clipboard
    const shareUrl = `${window.location.origin}/s/${result.id}`
    try {
      await navigator.clipboard.writeText(shareUrl)
      setShareStatus('copied')
      setTimeout(() => setShareStatus(null), 3000)
    } catch (err) {
      // Fallback for older browsers
      console.error('Clipboard write failed:', err)
      setShareStatus('error')
      setTimeout(() => setShareStatus(null), 3000)
    }
  }

  // Exit read-only mode and go to define land
  const exitReadOnlyMode = () => {
    setIsReadOnly(false)
    window.history.pushState({}, '', '/')
    startDefiningLand()
  }

  // Handle land definition completion (from Onboarding component)
  const handleLandDefined = ({ dimensions: dims, polygon, shapeMode: mode, action, templateId, method }) => {
    // Set the land data
    setDimensions(dims)
    setShapeMode(mode)
    if (polygon) {
      setConfirmedPolygon(polygon)
      setPolygonPoints(polygon)
    } else {
      setConfirmedPolygon(null)
    }

    // Analytics: track land created
    const methodMap = { rectangle: 'rectangle', polygon: 'draw', upload: 'upload', template: 'template' }
    const landArea = polygon ? calculatePolygonArea(polygon) : dims.length * dims.width
    const trackProps = {
      method: method === 'template' ? 'template' : (methodMap[mode] || mode),
      areaM2: roundArea(landArea),
    }
    // Include templateId if method was template
    if (method === 'template' && templateId) {
      trackProps.templateId = templateId
    }
    track('land_created', trackProps)

    // Keep soccer field if already shown, otherwise don't force it
    // (Don't reset activeComparisons to preserve user's choices)

    // Mark user has defined their land
    setUserHasLand(true)
    setIsDefiningLand(false)

    // Mark intro as seen
    setHasSeenIntro(true)
    localStorage.setItem('landVisualizerIntroSeen', 'true')

    // Handle action
    if (action === 'build') {
      setActivePanel('build')
    } else if (action === 'save') {
      handleSave()
    }
    // 'explore' = just close and explore (default)
  }

  // Start land definition flow
  const startDefiningLand = () => {
    // Analytics: track define land clicked
    const mode = isReadOnly ? 'shared' : (userHasLand ? 'user' : 'example')
    trackDefineClicked(mode)

    setIsDefiningLand(true)
    // Clear walkthrough
    setWalkthroughStep(3)
    if (walkthroughTimerRef.current) clearTimeout(walkthroughTimerRef.current)
  }

  // Reset to example mode (for testing)
  const resetToExample = () => {
    setUserHasLand(false)
    setIsDefiningLand(false)
    setHasSeenIntro(false)
    setWalkthroughStep(0)
    localStorage.removeItem('landVisualizerIntroSeen')
    localStorage.removeItem('landVisualizer')
    setPlacedBuildings([])
    setConfirmedPolygon(EXAMPLE_LAND_POLYGON)
    setShapeMode('polygon')
    setActiveComparisons({}) // No default comparison objects
  }

  // Panel keyboard shortcuts (L=Land, C=Compare, B=Build, Alt+S=Save, P=Export, O=Reset)
  // Use refs so the handler closure always has current values without re-registering
  const activePanelRef = useRef(activePanel)
  activePanelRef.current = activePanel
  const canEditRef = useRef(canEdit)
  canEditRef.current = canEdit
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return
      const key = e.key.toLowerCase()
      // Alt+S = Save
      if (e.altKey && key === 's') {
        e.preventDefault()
        if (canEditRef.current) handleSave()
        return
      }
      if (e.ctrlKey || e.metaKey || e.altKey) return
      // When build panel is open, only allow B (to close it) — other keys are build tool shortcuts
      if (activePanelRef.current === 'build' && key !== 'b') return
      const panelMap = {
        l: 'land',
        c: 'compare',
        b: 'build',
        p: 'export',
      }
      if (panelMap[key]) {
        e.preventDefault()
        if (panelMap[key] === 'land' && !canEditRef.current) return
        togglePanel(panelMap[key])
      }
      if (key === 'o') {
        e.preventDefault()
        resetToExample()
      }
      if (key === 'u') {
        e.preventDefault()
        setShowHelp(prev => !prev)
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [togglePanel])

  // Loading state for shared scene
  if (shareLoading) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="text-center animate-fade-in">
          <div className="w-10 h-10 border-2 border-[var(--color-accent)] border-t-transparent rounded-full mx-auto mb-4 animate-spin" />
          <div className="text-[var(--color-text-primary)] font-display font-medium">Loading shared scene...</div>
        </div>
      </div>
    )
  }

  // Error state for shared scene
  if (shareError) {
    return (
      <div className="w-full h-full flex items-center justify-center bg-[var(--color-bg-primary)]">
        <div className="text-center panel-premium p-8 max-w-sm animate-fade-in-scale">
          <div className="w-16 h-16 rounded-full bg-red-500/20 flex items-center justify-center mx-auto mb-4">
            <svg className="w-8 h-8 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M12 9v3.75m9-.75a9 9 0 11-18 0 9 9 0 0118 0zm-9 3.75h.008v.008H12v-.008z" />
            </svg>
          </div>
          <div className="text-[var(--color-text-primary)] font-display text-xl font-semibold mb-2">Scene not found</div>
          <div className="text-[var(--color-text-secondary)] text-sm mb-6">{shareError}</div>
          <button
            onClick={() => { setShareError(null); window.location.href = '/' }}
            className="btn-primary"
          >
            Go to Home
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="w-full h-full relative">
      {/* Read-only banner for shared scenes */}
      {isReadOnly && (
        <div className="fixed top-0 left-0 right-0 z-50 bg-[var(--color-bg-secondary)] border-b border-[var(--color-border)] px-4 py-2.5 flex items-center justify-between animate-fade-in">
          <div className="flex items-center gap-3">
            <div className="w-2 h-2 rounded-full bg-[var(--color-accent)] animate-pulse" />
            <span className="text-[var(--color-text-primary)] text-sm font-medium">Shared layout</span>
            <span className="text-[var(--color-text-muted)] text-xs">view-only</span>
          </div>
          <button
            onClick={exitReadOnlyMode}
            className="btn-primary text-sm py-1.5 px-4"
          >
            Define Your Land
          </button>
        </div>
      )}

      {/* Land definition flow (non-blocking until user clicks Define) */}
      {isDefiningLand && (
        <Onboarding
          onComplete={handleLandDefined}
          onCancel={() => setIsDefiningLand(false)}
          lengthUnit={lengthUnit}
          setLengthUnit={setLengthUnit}
          isTouchDevice={isTouchDevice}
        />
      )}

      <Suspense fallback={<LoadingFallback />}>
        <LandScene
          length={dimensions.length}
          width={dimensions.width}
          isExploring={isExploring && !selectedBuilding}
        comparisonObjects={COMPARISON_OBJECTS.filter(obj => activeComparisons[obj.id])}
        polygonPoints={(shapeMode === 'polygon' || shapeMode === 'upload') ? confirmedPolygon : null}
        placedBuildings={placedBuildings}
        selectedBuilding={canEdit ? selectedBuilding : null}
        selectedBuildingType={canEdit ? selectedBuildingType : null}
        onPlaceBuilding={canEdit ? handlePlaceBuilding : undefined}
        onDeleteBuilding={canEdit ? handleDeleteBuilding : undefined}
        onMoveBuilding={canEdit ? handleMoveBuilding : undefined}
        selectedPlacedBuildingId={selectedPlacedBuildingId}
        setSelectedPlacedBuildingId={setSelectedPlacedBuildingId}
        canEdit={canEdit}
        joystickInput={joystickInput}
        lengthUnit={lengthUnit}
        onCameraUpdate={handleCameraUpdate}
        buildingRotation={buildingRotation}
        snapInfo={snapIndicator}
        onPointerMove={handlePreviewPointerMove}
        setbacksEnabled={setbacksEnabled}
        setbackDistanceM={setbackDistanceM}
        placementValid={placementValid}
        overlappingBuildingIds={overlappingBuildingIds}
        labels={labels}
        analyticsMode={isReadOnly ? 'shared' : (userHasLand ? 'user' : 'example')}
        cameraMode={cameraMode}
        setCameraMode={setCameraMode}
        followDistance={followDistance}
        setFollowDistance={setFollowDistance}
        orbitEnabled={orbitEnabled}
        setOrbitEnabled={setOrbitEnabled}
        viewMode={viewMode}
        fitToLandTrigger={fitToLandTrigger}
        quality={graphicsQuality}
        comparisonPositions={comparisonPositions}
        onComparisonPositionChange={updateComparisonPosition}
        comparisonRotations={comparisonRotations}
        onComparisonRotationChange={updateComparisonRotation}
        gridSnapEnabled={gridSnapEnabled}
        gridSize={gridSize}
        walls={walls}
        wallDrawingMode={wallDrawingMode}
        setWallDrawingMode={setWallDrawingMode}
        wallDrawingPoints={wallDrawingPoints}
        setWallDrawingPoints={setWallDrawingPoints}
        addWallFromPoints={addWallFromPoints}
        openingPlacementMode={openingPlacementMode}
        setOpeningPlacementMode={setOpeningPlacementMode}
        addOpeningToWall={addOpeningToWall}
        activeBuildTool={activeBuildTool}
        setActiveBuildTool={setActiveBuildTool}
        selectedElement={selectedElement}
        setSelectedElement={setSelectedElement}
        BUILD_TOOLS={BUILD_TOOLS}
        deleteWall={deleteWall}
        doorWidth={doorWidth}
        doorHeight={doorHeight}
        doorType={doorType}
        windowWidth={windowWidth}
        windowHeight={windowHeight}
        windowSillHeight={windowSillHeight}
        halfWallHeight={halfWallHeight}
        fenceType={fenceType}
        rooms={rooms}
        floorPlanImage={floorPlanImage}
        floorPlanSettings={floorPlanSettings}
        // Building placement props
        buildings={buildings}
        floorPlanPlacementMode={floorPlanPlacementMode}
        pendingFloorPlan={pendingFloorPlan}
        buildingPreviewPosition={buildingPreviewPosition}
        setBuildingPreviewPosition={setBuildingPreviewPosition}
        buildingPreviewRotation={buildingPreviewRotation}
        placeFloorPlanBuilding={placeFloorPlanBuilding}
        selectedBuildingId={selectedBuildingId}
        setSelectedBuildingId={selectBuilding}
        moveSelectedBuilding={moveSelectedBuilding}
        selectedComparisonId={selectedComparisonId}
        setSelectedComparisonId={selectComparison}
        selectedRoomId={selectedRoomId}
        setSelectedRoomId={selectRoom}
        roomLabels={roomLabels}
        roomStyles={roomStyles}
        setRoomLabel={handleSetRoomLabel}
        moveRoom={moveRoom}
        moveWallsByIds={moveWallsByIds}
        commitWallsToHistory={commitWallsToHistory}
        setRoomPropertiesOpen={setRoomPropertiesOpen}
        setWallPropertiesOpen={setWallPropertiesOpen}
        setFencePropertiesOpen={setFencePropertiesOpen}
        // Sims 4-style features
        pools={pools}
        addPool={addPool}
        deletePool={deletePool}
        updatePool={updatePool}
        poolPolygonPoints={poolPolygonPoints}
        setPoolPolygonPoints={setPoolPolygonPoints}
        poolDepth={poolDepth}
        poolDeckMaterial={poolDeckMaterial}
        selectedPoolId={selectedPoolId}
        setSelectedPoolId={setSelectedPoolId}
        setPoolPropertiesOpen={setPoolPropertiesOpen}
        foundations={foundations}
        addFoundation={addFoundation}
        deleteFoundation={deleteFoundation}
        updateFoundation={updateFoundation}
        foundationPolygonPoints={foundationPolygonPoints}
        setFoundationPolygonPoints={setFoundationPolygonPoints}
        foundationHeight={foundationHeight}
        foundationMaterial={foundationMaterial}
        selectedFoundationId={selectedFoundationId}
        setSelectedFoundationId={setSelectedFoundationId}
        setFoundationPropertiesOpen={setFoundationPropertiesOpen}
        stairs={stairs}
        addStairs={addStairs}
        deleteStairs={deleteStairs}
        updateStairs={updateStairs}
        stairsStartPoint={stairsStartPoint}
        setStairsStartPoint={setStairsStartPoint}
        stairsWidth={stairsWidth}
        stairsTopY={stairsTopY}
        stairsStyle={stairsStyle}
        selectedStairsId={selectedStairsId}
        setSelectedStairsId={setSelectedStairsId}
        setStairsPropertiesOpen={setStairsPropertiesOpen}
        roofs={roofs}
        addRoof={addRoof}
        deleteRoof={deleteRoof}
        updateRoof={updateRoof}
        roofType={roofType}
        roofPitch={roofPitch}
        selectedRoofId={selectedRoofId}
        setSelectedRoofId={setSelectedRoofId}
        setRoofPropertiesOpen={setRoofPropertiesOpen}
        canvasRef={canvasRef}
        sceneRef={sceneRef}
        // Multi-story floor props
        currentFloor={currentFloor}
        floorHeight={floorHeight}
        totalFloors={totalFloors}
        addFloorsToRoom={addFloorsToRoom}
        mobileRunning={isMobileRunning}
        mobileJumpTrigger={mobileJumpTrigger}
        onNearbyNPCChange={setNearbyNPC}
        onNearbyBuildingChange={setNearbyBuilding}
        />
      </Suspense>

      {/* Minimap (hidden in 2D mode - redundant with top-down view) */}
      {viewMode !== '2d' && (
        <Minimap
          landWidth={dimensions.width}
          landLength={dimensions.length}
          polygonPoints={(shapeMode === 'polygon' || shapeMode === 'upload') ? confirmedPolygon : null}
          placedBuildings={placedBuildings}
          comparisonObjects={COMPARISON_OBJECTS.filter(obj => activeComparisons[obj.id])}
          comparisonPositions={comparisonPositions}
          comparisonRotations={comparisonRotations}
          playerPosition={cameraState.position}
          playerRotation={cameraState.rotation}
          lengthUnit={lengthUnit}
          walls={walls}
          rooms={rooms}
          buildings={buildings}
          isLandscape={isLandscape}
        />
      )}

      {/* Mobile joystick - positioned above ribbon */}
      {isTouchDevice && <VirtualJoystick joystickInput={joystickInput} isRunning={isMobileRunning} setIsRunning={setIsMobileRunning} onJump={() => setMobileJumpTrigger(t => t + 1)} onTalk={() => window.dispatchEvent(new Event('mobileTalk'))} onUse={() => window.dispatchEvent(new Event('mobileUse'))} nearbyNPC={nearbyNPC} nearbyBuilding={nearbyBuilding} isLandscape={isLandscape} />}

      {/* Backdrop overlay when panel is open */}
      {activePanel && (
        <div
          className="fixed inset-0 z-40"
          onClick={() => setActivePanel(null)}
        />
      )}

      {/* Canva-style Compare sidebar - full height */}
      <div
        className={`build-sidebar ${activePanel === 'compare' ? 'open' : 'closed'}`}
        style={{
          top: 0,
          bottom: isLandscape ? 0 : '56px',
          left: isLandscape ? '48px' : 0,
        }}
      >
        <ComparePanel
          comparisonObjects={COMPARISON_OBJECTS}
          activeComparisons={activeComparisons}
          toggleComparison={toggleComparison}
          landArea={area}
          lengthUnit={lengthUnit}
          onClosePanel={() => setActivePanel(null)}
          onExpandedChange={setPanelExpanded}
          isActive={activePanel === 'compare'}
          gridSnapEnabled={gridSnapEnabled}
          setGridSnapEnabled={setGridSnapEnabled}
          gridSize={gridSize}
          setGridSize={setGridSize}
          comparisonRotations={comparisonRotations}
          onRotationChange={updateComparisonRotation}
          onResetTransform={resetComparisonTransform}
        />
      </div>

      {/* Land sidebar - separate from Build */}
      <div
        className={`build-sidebar ${activePanel === 'land' ? 'open' : 'closed'}`}
        style={{
          top: 0,
          bottom: isLandscape ? 0 : '56px',
          left: isLandscape ? '48px' : 0,
        }}
      >
        <LandPanel
          dimensions={dimensions}
          setDimensions={setDimensions}
          shapeMode={shapeMode}
          setShapeMode={setShapeMode}
          polygonPoints={polygonPoints}
          setPolygonPoints={setPolygonPoints}
          confirmedPolygon={confirmedPolygon}
          setConfirmedPolygon={setConfirmedPolygon}
          uploadedImage={uploadedImage}
          setUploadedImage={setUploadedImage}
          lengthUnit={lengthUnit}
          setLengthUnit={handleLengthUnitChange}
          onExpandedChange={setPanelExpanded}
          isActive={activePanel === 'land'}
          onDetectedFloorPlan={(imageData) => {
            // Floor plan analysis - upload gating handled in modal
            setFloorPlanImageForGenerator(imageData)
            setShowFloorPlanGenerator(true)
          }}
        />
      </div>

      {/* Build sidebar - separate from Land */}
      <div
        className={`build-sidebar ${activePanel === 'build' ? 'open' : 'closed'}`}
        style={{
          top: 0,
          bottom: isLandscape ? 0 : '56px',
          left: isLandscape ? '48px' : 0,
        }}
      >
        <BuildPanel
          canEdit={canEdit}
          selectedBuilding={selectedBuilding}
          setSelectedBuilding={setSelectedBuilding}
          buildingRotation={buildingRotation}
          setBuildingRotation={setBuildingRotation}
          placedBuildings={placedBuildings}
          setPlacedBuildings={setPlacedBuildings}
          setbacksEnabled={setbacksEnabled}
          setSetbacksEnabled={setSetbacksEnabled}
          setbackDistanceM={setbackDistanceM}
          setSetbackDistanceM={setSetbackDistanceM}
          gridSnapEnabled={gridSnapEnabled}
          setGridSnapEnabled={setGridSnapEnabled}
          labels={labels}
          setLabels={setLabels}
          coveragePercent={computeCoverage(placedBuildings, area).coveragePercent}
          coverageAreaM2={computeCoverage(placedBuildings, area).coverageAreaM2}
          landArea={area}
          overlappingCount={overlappingBuildingIds.size}
          formatArea={formatArea}
          areaUnit={areaUnit}
          lengthUnit={lengthUnit}
          FEET_PER_METER={FEET_PER_METER}
          BUILDING_TYPES={BUILDING_TYPES}
          polygon={currentPolygon}
          onClosePanel={() => setActivePanel(null)}
          onExpandedChange={setPanelExpanded}
          isActive={activePanel === 'build'}
          walls={walls}
          wallDrawingMode={wallDrawingMode}
          setWallDrawingMode={setWallDrawingMode}
          clearAllWalls={clearAllWalls}
          onClearByType={onClearByType}
          openingPlacementMode={openingPlacementMode}
          setOpeningPlacementMode={setOpeningPlacementMode}
          BUILD_TOOLS={BUILD_TOOLS}
          activeBuildTool={activeBuildTool}
          setActiveBuildTool={setActiveBuildTool}
          selectedElement={selectedElement}
          setSelectedElement={setSelectedElement}
          doorWidth={doorWidth}
          setDoorWidth={setDoorWidth}
          doorHeight={doorHeight}
          setDoorHeight={setDoorHeight}
          doorType={doorType}
          setDoorType={setDoorType}
          windowWidth={windowWidth}
          setWindowWidth={setWindowWidth}
          windowHeight={windowHeight}
          setWindowHeight={setWindowHeight}
          windowSillHeight={windowSillHeight}
          setWindowSillHeight={setWindowSillHeight}
          halfWallHeight={halfWallHeight}
          setHalfWallHeight={setHalfWallHeight}
          fenceType={fenceType}
          setFenceType={setFenceType}
          rooms={rooms}
          onUndo={undoWalls}
          onRedo={redoWalls}
          canUndo={canUndo}
          canRedo={canRedo}
          floorPlanImage={floorPlanImage}
          floorPlanSettings={floorPlanSettings}
          setFloorPlanSettings={setFloorPlanSettings}
          setFloorPlanImage={setFloorPlanImage}
          onRemoveFloorPlan={() => setFloorPlanImage(null)}
          onDetectedSitePlan={(imageData) => {
            // Detected site plan - switch to land mode
            setUploadedImage(imageData)
            setActivePanel('land')
          }}
          onOpenFloorPlanGenerator={(imageData) => {
            // Floor plan analysis - upload gating handled in modal
            setFloorPlanImageForGenerator(imageData)
            setShowFloorPlanGenerator(true)
          }}
          // Sims 4-style features
          pools={pools}
          foundations={foundations}
          stairs={stairs}
          roofs={roofs}
          poolDepth={poolDepth}
          setPoolDepth={setPoolDepth}
          poolDeckMaterial={poolDeckMaterial}
          setPoolDeckMaterial={setPoolDeckMaterial}
          foundationHeight={foundationHeight}
          setFoundationHeight={setFoundationHeight}
          foundationMaterial={foundationMaterial}
          setFoundationMaterial={setFoundationMaterial}
          stairsWidth={stairsWidth}
          setStairsWidth={setStairsWidth}
          stairsStyle={stairsStyle}
          setStairsStyle={setStairsStyle}
          stairsTopY={stairsTopY}
          setStairsTopY={setStairsTopY}
          roofType={roofType}
          setRoofType={setRoofType}
          roofPitch={roofPitch}
          setRoofPitch={setRoofPitch}
          roofOverhang={roofOverhang}
          setRoofOverhang={setRoofOverhang}
          roofThickness={roofThickness}
          setRoofThickness={setRoofThickness}
          selectedRoofId={selectedRoofId}
          updateRoof={updateRoof}
          // Multi-story floor props
          currentFloor={currentFloor}
          setCurrentFloor={setCurrentFloor}
          totalFloors={totalFloors}
          floorHeight={floorHeight}
          setFloorHeight={setFloorHeight}
          addFloor={addFloor}
          removeCurrentFloor={removeCurrentFloor}
          switchFloor={switchFloor}
          floorCountToAdd={floorCountToAdd}
          setFloorCountToAdd={setFloorCountToAdd}
        />
      </div>

      {/* Export sidebar */}
      <div
        className={`build-sidebar ${activePanel === 'export' ? 'open' : 'closed'}`}
        style={{
          top: 0,
          bottom: isLandscape ? 0 : '56px',
          left: isLandscape ? '48px' : 0,
        }}
      >
        <ExportPanel
          onExport={handleExport}
          isExporting={isExporting}
          wallCount={walls.length}
          roomCount={rooms.length}
          hasLand={!!currentPolygon && currentPolygon.length >= 3}
          onExpandedChange={setPanelExpanded}
          isActive={activePanel === 'export'}
          onScreenshot={handleScreenshot}
          isCapturing={isCapturing}
          viewMode={viewMode}
          onModelExport={handleModelExport}
          isExportingModel={isExportingModel}
          onPdfExport={handlePdfExport}
          isExportingPdf={isExportingPdf}
          landArea={area}
          buildingArea={computeCoverage(placedBuildings, area).coverageAreaM2}
        />
      </div>

      {/* Navigation ribbon - bottom in portrait, left sidebar in landscape */}
      <div className={
        isLandscape
          ? "fixed left-0 top-0 bottom-0 w-12 z-50 ribbon-nav landscape-nav flex flex-col"
          : "fixed bottom-0 left-0 right-0 z-50 ribbon-nav animate-slide-up safe-area-bottom"
      }>
        <div className={
          isLandscape
            ? "flex flex-col items-center justify-center gap-1 flex-1 py-2"
            : "flex justify-around items-center h-14"
        }>
          <button
            onClick={() => canEdit && togglePanel('land')}
            className={`ribbon-btn ${activePanel === 'land' ? 'active' : ''}`}
            disabled={!canEdit}
            title={!canEdit ? 'View-only mode' : ''}
          >
            <span className="icon">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </span>
            <span className="label">Land</span>
          </button>

          <button
            onClick={() => togglePanel('compare')}
            className={`ribbon-btn ${activePanel === 'compare' ? 'active' : ''}`}
          >
            <span className="icon">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
              </svg>
            </span>
            <span className="label">Compare</span>
          </button>

          <button
            onClick={() => togglePanel('build')}
            className={`ribbon-btn ${activePanel === 'build' ? 'active' : ''}`}
          >
            <span className="icon">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 21h19.5m-18-18v18m10.5-18v18m6-13.5V21M6.75 6.75h.75m-.75 3h.75m-.75 3h.75m3-6h.75m-.75 3h.75m-.75 3h.75M6.75 21v-3.375c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21M3 3h12m-.75 4.5H21m-3.75 3.75h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008zm0 3h.008v.008h-.008v-.008z" />
              </svg>
            </span>
            <span className="label">Build</span>
          </button>

          <button
            onClick={() => canEdit && handleSave()}
            className={`ribbon-btn ${saveStatus === 'saved' ? 'text-[var(--color-accent)]' : ''}`}
            disabled={!canEdit}
            title={!canEdit ? 'View-only mode' : 'Save your design'}
          >
            <span className="icon">
              {saveStatus === 'saved' ? (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M17.593 3.322c1.1.128 1.907 1.077 1.907 2.185V21L12 17.25 4.5 21V5.507c0-1.108.806-2.057 1.907-2.185a48.507 48.507 0 0111.186 0z" />
                </svg>
              )}
            </span>
            <span className="label">{saveStatus === 'saved' ? 'Saved' : 'Save'}</span>
          </button>

          {/* Desktop: show Export, Share, Help inline */}
          {!isMobile && (
            <>
              <button
                onClick={() => togglePanel('export')}
                className={`ribbon-btn ${activePanel === 'export' ? 'active' : ''}`}
              >
                <span className="icon">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                </span>
                <span className="label">Export</span>
              </button>

              <button
                onClick={handleShare}
                className={`ribbon-btn ${shareStatus === 'copied' ? 'text-[var(--color-accent)]' : shareStatus === 'error' ? 'text-red-400' : ''}`}
                title={shareStatus === 'error' ? 'Sharing unavailable' : 'Copy share link'}
              >
                <span className="icon">
                  {shareStatus === 'copied' ? (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                    </svg>
                  ) : (
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
                    </svg>
                  )}
                </span>
                <span className="label">{shareStatus === 'copied' ? 'Copied' : shareStatus === 'error' ? 'Error' : 'Share'}</span>
              </button>

              <button
                onClick={resetToExample}
                className="ribbon-btn"
                title="Reset to example"
              >
                <span className="icon">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182" />
                  </svg>
                </span>
                <span className="label">Reset</span>
              </button>

              {/* Help button */}
              <button
                onClick={() => setShowHelp(true)}
                className="ribbon-btn"
                title="Help & Shortcuts"
              >
                <span className="icon">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                  </svg>
                </span>
                <span className="label">Help</span>
              </button>

              {/* Upgrade to Pro - ribbon style */}
              {!isPaidUser && (
                <button
                  onClick={() => setShowPricingModal(true)}
                  className="flex flex-col items-center justify-center w-16 h-full text-[var(--color-text-secondary)] hover:text-[var(--color-text-primary)] hover:bg-white/5 transition-all flex-none"
                  title="Upgrade to Pro"
                >
                  <svg className="w-5 h-5 mb-0.5" fill="none" viewBox="0 0 24 24" stroke="#facc15" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
                  </svg>
                  <span className="text-[11px] font-medium text-yellow-400 leading-none">Pro</span>
                </button>
              )}

              {/* Account button */}
              <div className="relative flex-none w-16 flex items-center justify-center">
                {user ? (
                  <>
                    <button
                      onClick={() => setShowUserMenu(!showUserMenu)}
                      className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-sm hover:scale-110 transition-transform"
                      title={user.email}
                    >
                      {(user.email?.[0] || '?').toUpperCase()}
                    </button>
                    {showUserMenu && (
                      <>
                        <div className="fixed inset-0 z-40" onClick={() => setShowUserMenu(false)} />
                        <div className="absolute bottom-full right-0 mb-2 z-50 w-64 bg-[var(--color-panel)] backdrop-blur-xl rounded-xl shadow-2xl border border-[var(--color-border)] py-2 animate-slide-in-bottom-2">
                          {/* Profile header */}
                          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--color-border)]">
                            <div className="w-9 h-9 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-sm flex-shrink-0">
                              {(user.email?.[0] || '?').toUpperCase()}
                            </div>
                            <div className="min-w-0">
                              <div className="text-white text-sm truncate">{user.email}</div>
                              <div className="text-xs text-gray-400">
                                {isPaidUser ? (planType === 'lifetime' ? 'Pro Lifetime' : 'Pro Monthly') : 'Free'}
                              </div>
                            </div>
                          </div>
                          {/* Plans & Pricing */}
                          <button
                            onClick={() => { setShowPricingModal(true); setShowUserMenu(false) }}
                            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-colors text-white"
                          >
                            <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                            </svg>
                            <span>Plans & Pricing</span>
                          </button>
                          {/* Theme */}
                          <button
                            onClick={() => {
                              const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
                              setTheme(next)
                            }}
                            className="flex items-center justify-between w-full px-4 py-3 hover:bg-white/5 transition-colors text-white"
                          >
                            <div className="flex items-center gap-3">
                              <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                                {theme === 'dark' ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                                ) : theme === 'light' ? (
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                                ) : (
                                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                                )}
                              </svg>
                              <span>Theme</span>
                            </div>
                            <span className="text-xs text-gray-400 capitalize">{theme}</span>
                          </button>
                          {/* Divider + Log Out */}
                          <div className="border-t border-[var(--color-border)] my-1" />
                          <button
                            onClick={() => { signOut(); setShowUserMenu(false) }}
                            className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-colors text-red-400"
                          >
                            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                            </svg>
                            <span>Log Out</span>
                          </button>
                        </div>
                      </>
                    )}
                  </>
                ) : (
                  <button
                    onClick={() => setShowAuthModal(true)}
                    className="w-9 h-9 rounded-full bg-white/10 flex items-center justify-center text-gray-400 hover:bg-white/20 hover:text-white transition-all"
                    title="Sign In"
                  >
                    <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 6a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0zM4.501 20.118a7.5 7.5 0 0114.998 0A17.933 17.933 0 0112 21.75c-2.676 0-5.216-.584-7.499-1.632z" />
                    </svg>
                  </button>
                )}
              </div>
            </>
          )}

          {/* Mobile: "More" overflow button */}
          {isMobile && (
            <button
              onClick={() => setShowOverflow(!showOverflow)}
              className={`ribbon-btn ${showOverflow ? 'active' : ''}`}
            >
              <span className="icon">
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M6.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM12.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0zM18.75 12a.75.75 0 11-1.5 0 .75.75 0 011.5 0z" />
                </svg>
              </span>
              <span className="label">More</span>
            </button>
          )}
        </div>
      </div>

      {/* Mobile overflow menu popup */}
      {isMobile && showOverflow && (
        <>
          <div className="fixed inset-0 z-40" onClick={() => setShowOverflow(false)} />
          <div className={`fixed bg-[var(--color-panel)] backdrop-blur-xl rounded-xl shadow-2xl border border-[var(--color-border)] py-2 min-w-[180px] z-50 animate-slide-in-bottom-2 ${
            isLandscape ? 'left-14 bottom-4' : 'bottom-[72px] right-4'
          }`}>
            <button
              onClick={() => { togglePanel('export'); setShowOverflow(false) }}
              className={`flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-colors ${activePanel === 'export' ? 'text-[var(--color-accent)]' : 'text-white'}`}
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
              </svg>
              <span>Export</span>
            </button>
            <button
              onClick={() => { handleShare(); setShowOverflow(false) }}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-colors text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M7.217 10.907a2.25 2.25 0 100 2.186m0-2.186c.18.324.283.696.283 1.093s-.103.77-.283 1.093m0-2.186l9.566-5.314m-9.566 7.5l9.566 5.314m0 0a2.25 2.25 0 103.935 2.186 2.25 2.25 0 00-3.935-2.186zm0-12.814a2.25 2.25 0 103.933-2.185 2.25 2.25 0 00-3.933 2.185z" />
              </svg>
              <span>Share</span>
            </button>
            <button
              onClick={() => { setShowHelp(true); setShowOverflow(false) }}
              className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-colors text-white"
            >
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
              <span>Help</span>
            </button>
            <div className="border-t border-[var(--color-border)] my-2" />
            {user ? (
              <>
                {/* Profile header */}
                <div className="flex items-center gap-3 px-4 py-3">
                  <div className="w-8 h-8 rounded-full bg-gradient-to-br from-teal-500 to-cyan-600 flex items-center justify-center text-white font-semibold text-xs flex-shrink-0">
                    {(user.email?.[0] || '?').toUpperCase()}
                  </div>
                  <div className="min-w-0">
                    <div className="text-white text-sm truncate">{user.email}</div>
                    <div className="text-xs text-gray-400">
                      {isPaidUser ? (planType === 'lifetime' ? 'Pro Lifetime' : 'Pro Monthly') : 'Free'}
                    </div>
                  </div>
                </div>
                <div className="border-t border-[var(--color-border)] my-1" />
                {/* Plans & Pricing */}
                <button
                  onClick={() => { setShowPricingModal(true); setShowOverflow(false) }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-colors text-white"
                >
                  <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 8.25h19.5M2.25 9h19.5m-16.5 5.25h6m-6 2.25h3m-3.75 3h15a2.25 2.25 0 002.25-2.25V6.75A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25v10.5A2.25 2.25 0 004.5 19.5z" />
                  </svg>
                  <span>Plans & Pricing</span>
                </button>
                {/* Theme */}
                <button
                  onClick={() => {
                    const next = theme === 'dark' ? 'light' : theme === 'light' ? 'system' : 'dark'
                    setTheme(next)
                  }}
                  className="flex items-center justify-between w-full px-4 py-3 hover:bg-white/5 transition-colors text-white"
                >
                  <div className="flex items-center gap-3">
                    <svg className="w-5 h-5 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      {theme === 'dark' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M21.752 15.002A9.718 9.718 0 0118 15.75c-5.385 0-9.75-4.365-9.75-9.75 0-1.33.266-2.597.748-3.752A9.753 9.753 0 003 11.25C3 16.635 7.365 21 12.75 21a9.753 9.753 0 009.002-5.998z" />
                      ) : theme === 'light' ? (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M12 3v2.25m6.364.386l-1.591 1.591M21 12h-2.25m-.386 6.364l-1.591-1.591M12 18.75V21m-4.773-4.227l-1.591 1.591M5.25 12H3m4.227-4.773L5.636 5.636M15.75 12a3.75 3.75 0 11-7.5 0 3.75 3.75 0 017.5 0z" />
                      ) : (
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9 17.25v1.007a3 3 0 01-.879 2.122L7.5 21h9l-.621-.621A3 3 0 0115 18.257V17.25m6-12V15a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 15V5.25m18 0A2.25 2.25 0 0018.75 3H5.25A2.25 2.25 0 003 5.25m18 0V12a2.25 2.25 0 01-2.25 2.25H5.25A2.25 2.25 0 013 12V5.25" />
                      )}
                    </svg>
                    <span>Theme</span>
                  </div>
                  <span className="text-xs text-gray-400 capitalize">{theme}</span>
                </button>
                <div className="border-t border-[var(--color-border)] my-1" />
                {/* Log Out */}
                <button
                  onClick={() => { signOut(); setShowOverflow(false) }}
                  className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-colors text-red-400"
                >
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                  </svg>
                  <span>Log Out</span>
                </button>
              </>
            ) : (
              <button
                onClick={() => { setShowAuthModal(true); setShowOverflow(false) }}
                className="flex items-center gap-3 w-full px-4 py-3 hover:bg-white/5 transition-colors text-white"
              >
                <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 9V5.25A2.25 2.25 0 0013.5 3h-6a2.25 2.25 0 00-2.25 2.25v13.5A2.25 2.25 0 007.5 21h6a2.25 2.25 0 002.25-2.25V15m3 0l3-3m0 0l-3-3m3 3H9" />
                </svg>
                <span>Sign In</span>
              </button>
            )}
          </div>
        </>
      )}

      {/* Primary CTA Card - top left, shifts right when sidebar open */}
      {!isReadOnly && !isDefiningLand && (
        isMobile ? (
          /* Mobile: compact collapsible version */
          <div className={`absolute top-4 z-50 ${isLandscape ? 'left-16' : 'left-4'}`}>
            <button
              onClick={() => setMobileCtaExpanded(!mobileCtaExpanded)}
              className="panel-premium p-4 text-white animate-fade-in"
            >
              <div className="flex items-center gap-3">
                <div className="w-8 h-8 rounded-lg bg-[var(--color-accent)]/20 flex items-center justify-center">
                  <svg className="w-4 h-4 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                  </svg>
                </div>
                <div className="text-left">
                  <p className="font-display font-bold text-lg leading-tight">{formatArea(area, areaUnit)}</p>
                  <p className="text-[var(--color-text-secondary)] text-xs">Ready to plan</p>
                </div>
                <svg className={`w-4 h-4 text-[var(--color-text-secondary)] ml-2 transition-transform ${mobileCtaExpanded ? 'rotate-180' : ''}`} fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 8.25l-7.5 7.5-7.5-7.5" />
                </svg>
              </div>
            </button>
            {mobileCtaExpanded && (
              <div className="mt-2 panel-premium p-4 animate-slide-in-bottom-2">
                <button
                  onClick={startDefiningLand}
                  className="btn-primary w-full flex items-center justify-center gap-2"
                >
                  <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
                  </svg>
                  <span>Edit Land</span>
                </button>
              </div>
            )}
          </div>
        ) : (
          /* Desktop: full version */
          <div
            className="absolute top-4 panel-premium p-5 text-white z-50 min-w-[220px] animate-fade-in transition-all duration-300"
            style={{
              left: (activePanel === 'build' || activePanel === 'compare' || activePanel === 'land' || activePanel === 'export')
                ? (panelExpanded ? '332px' : '72px')
                : '16px',
            }}
          >
            <div className="flex items-center gap-3 mb-4">
              <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
                <svg className="w-5 h-5 text-[var(--color-bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                </svg>
              </div>
              <div>
                <h2 className="font-display font-semibold text-[15px] text-white leading-tight">Define Your Land</h2>
                <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">Ready to plan</p>
              </div>
            </div>
            <div className="mb-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]" style={{ padding: '10px 18px' }}>
              <div className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider mb-1">Total Area</div>
              <div className="font-display font-bold text-2xl text-white tracking-tight">{formatArea(area, areaUnit)}</div>
            </div>
            <button
              onClick={startDefiningLand}
              className="btn-primary w-full flex items-center justify-center gap-2"
            >
              <span>Edit Land</span>
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
            </button>
          </div>
        )
      )}

      {/* Non-blocking walkthrough hint (first visit only) */}
      {!hasSeenIntro && isExampleMode && !isDefiningLand && walkthroughStep === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 panel-premium py-3 z-40 animate-gentle-pulse" style={{ padding: '12px 32px' }}>
          <p className="text-[var(--color-text-primary)] text-sm font-medium">
            {isTouchDevice ? 'Use joystick to explore' : 'Use WASD to explore'}
          </p>
          <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">Walk around to feel the scale</p>
        </div>
      )}

      {/* Help text - top-center pill with auto-fade */}
      {!isDefiningLand && !isReadOnly && helpTextVisible && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 rounded-full pointer-events-none animate-fade-in"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.3s ease-out forwards',
            padding: '8px 32px',
          }}
        >
          <span className="text-[var(--color-text-secondary)] text-xs font-medium tracking-wide">
            {viewMode === '2d'
              ? 'Drag to pan · Scroll to zoom'
              : viewMode === 'orbit'
                ? 'Drag to orbit · Middle-drag to pan · Scroll to zoom'
                : isTouchDevice
                  ? 'Drag to look · Pinch to zoom · Joystick to move'
                  : 'WASD to move · Scroll to zoom · Right-click for cursor'
            }
          </span>
        </div>
      )}

      {/* Building placement indicator */}
      {selectedBuilding && (
        <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg transition-all ${
          !placementValid
            ? 'bg-red-500/90 text-white'
            : dragOverlapping
              ? 'bg-amber-500/90 text-white'
              : 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse'
        }`} style={{ padding: '10px 32px' }}>
          {!placementValid
            ? 'Too close to boundary'
            : dragOverlapping
              ? 'Overlaps another structure'
              : `Click to place ${BUILDING_TYPES.find(b => b.id === selectedBuilding)?.name}`
          }
        </div>
      )}

      {/* Wall drawing mode indicator */}
      {wallDrawingMode && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          {wallDrawingPoints.length === 0
            ? 'Click to place first corner'
            : `${wallDrawingPoints.length} points placed · Click to continue · Escape to finish`
          }
        </div>
      )}

      {/* Room tool indicator */}
      {activeBuildTool === BUILD_TOOLS.ROOM && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          Click to set corner · Click again to finish · Escape to cancel
        </div>
      )}

      {/* Wall tool indicator */}
      {activeBuildTool === BUILD_TOOLS.WALL && !wallDrawingMode && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          {wallDrawingPoints.length === 0
            ? 'Click to place first corner'
            : `${wallDrawingPoints.length} points placed · Click to continue · Escape to finish`
          }
        </div>
      )}

      {/* Door tool indicator */}
      {activeBuildTool === BUILD_TOOLS.DOOR && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          {walls.length === 0 ? 'Draw walls first to place doors' : 'Click on a wall to place a door · Escape to cancel'}
        </div>
      )}

      {/* Window tool indicator */}
      {activeBuildTool === BUILD_TOOLS.WINDOW && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          {walls.length === 0 ? 'Draw walls first to place windows' : 'Click on a wall to place a window · Escape to cancel'}
        </div>
      )}

      {/* Select tool indicator */}
      {activeBuildTool === BUILD_TOOLS.SELECT && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          {selectedElement
            ? `Selected: ${selectedElement.type} · Escape to deselect`
            : 'Click on a wall to select it · Escape to cancel'}
        </div>
      )}

      {/* Fence tool indicator */}
      {activeBuildTool === BUILD_TOOLS.FENCE && !wallDrawingMode && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          Click to place first post · Click to continue · Escape to finish
        </div>
      )}

      {/* Pool tool indicator */}
      {activeBuildTool === BUILD_TOOLS.POOL && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          Click to place corners · Escape to finish · Enter pool depth in panel
        </div>
      )}

      {/* Foundation/Platform tool indicator */}
      {activeBuildTool === BUILD_TOOLS.FOUNDATION && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          Click to place corners · Escape to finish · Set height in panel
        </div>
      )}

      {/* Stairs tool indicator */}
      {activeBuildTool === BUILD_TOOLS.STAIRS && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          Click to place start point · Click again to set direction · Escape to cancel
        </div>
      )}

      {/* Roof tool indicator */}
      {activeBuildTool === BUILD_TOOLS.ROOF && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          {rooms.length === 0 ? 'Draw a room first to add a roof' : 'Click on a room to add a roof · Escape to cancel'}
        </div>
      )}

      {/* Add Floors tool indicator */}
      {activeBuildTool === BUILD_TOOLS.ADD_FLOORS && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          {rooms.length === 0 ? 'Draw a room first to add floors' : 'Click on a room to add floors · Escape to cancel'}
        </div>
      )}

      {/* Polygon room tool indicator */}
      {activeBuildTool === BUILD_TOOLS.POLYGON_ROOM && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          Click to place points · Close shape to finish · Escape to cancel
        </div>
      )}

      {/* Half wall tool indicator */}
      {activeBuildTool === BUILD_TOOLS.HALF_WALL && !wallDrawingMode && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          Click to place first point · Click to continue · Escape to finish
        </div>
      )}

      {/* Delete tool indicator */}
      {activeBuildTool === BUILD_TOOLS.DELETE && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 rounded-xl text-sm font-medium shadow-lg bg-red-500 text-white animate-gentle-pulse" style={{ padding: '10px 32px' }}>
          {walls.length === 0 ? 'No walls to delete' : 'Click on a wall to delete it · Escape to cancel'}
        </div>
      )}

      {/* Grouped View Controls - top right */}
      {/* Mobile: settings icon + slide-up sheet */}
      {isMobile && (
        <div className={`absolute right-3 z-30 flex items-center gap-2 animate-fade-in ${isReadOnly ? 'top-14' : 'top-3'}`}>
          <div className="panel-premium flex items-center rounded-xl p-1.5 gap-1">
            {[['firstPerson', '1P'], ['orbit', '3D'], ['2d', '2D']].map(([mode, label]) => (
              <button key={mode} onClick={() => setViewMode(mode)}
                className={`px-5 py-2.5 text-base font-bold rounded-lg transition-all ${viewMode === mode ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] shadow-md' : 'text-[var(--color-text-secondary)]'}`}
              >{label}</button>
            ))}
          </div>
          <button
            onClick={() => setShowMobileViewControls(true)}
            className="panel-premium p-3 rounded-xl"
          >
            <svg className="w-6 h-6 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </button>
        </div>
      )}

      {/* Mobile view controls slide-up sheet */}
      {isMobile && showMobileViewControls && (
        <>
          <div className="fixed inset-0 bg-black/50 z-40" onClick={() => setShowMobileViewControls(false)} />
          <div className="fixed bottom-0 left-0 right-0 z-50 p-4 pb-20 animate-slide-in-bottom">
            <div className="panel-premium p-5 text-white">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-display font-semibold text-white">View Settings</h3>
                <button onClick={() => setShowMobileViewControls(false)} className="p-1 hover:bg-white/10 rounded-lg">
                  <svg className="w-5 h-5 text-[var(--color-text-secondary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="space-y-3">
                <div className="flex items-center justify-between gap-6">
                  <span className="text-[var(--color-text-secondary)] text-sm" style={{ marginLeft: 4 }}>Dimensions</span>
                  <button onClick={() => setLabels(prev => ({ ...prev, land: !prev.land }))} className={`toggle-switch ${labels.land ? 'active' : ''}`}><span className="toggle-knob" /></button>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-[var(--color-text-secondary)] text-sm" style={{ marginLeft: 4 }}>Grid</span>
                  <button onClick={() => setGridSnapEnabled(!gridSnapEnabled)} className={`toggle-switch ${gridSnapEnabled ? 'active' : ''}`}><span className="toggle-knob" /></button>
                </div>
                <div className="flex items-center justify-between gap-6">
                  <span className="text-[var(--color-text-secondary)] text-sm" style={{ marginLeft: 4 }}>Quality</span>
                  <select value={graphicsQuality} onChange={(e) => setGraphicsQuality(e.target.value)} className="select-premium" style={{ fontSize: '11px', padding: '4px 22px 4px 8px', borderRadius: '6px' }}>
                    <option value={QUALITY.FAST}>Fast</option>
                    <option value={QUALITY.BEST}>Best</option>
                  </select>
                </div>
              </div>
            </div>
          </div>
        </>
      )}

      {/* Desktop: always-visible view controls */}
      {!isMobile && (
      <div className={`absolute right-4 panel-premium text-white overflow-hidden animate-fade-in ${isReadOnly ? 'top-14' : 'top-4'}`}>
        <div className="px-4 py-3 space-y-3">
          <div className="space-y-2">
            <span className="text-[var(--color-text-secondary)] text-sm text-center block">View</span>
            <div className="flex bg-[var(--color-bg-secondary)] rounded-lg p-1 gap-1">
              <button
                onClick={() => setViewMode('firstPerson')}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'firstPerson'
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] shadow-md'
                    : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-white/10'
                }`}
                title="First Person View (Press 1)"
              >
                1P
              </button>
              <button
                onClick={() => setViewMode('orbit')}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === 'orbit'
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] shadow-md'
                    : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-white/10'
                }`}
                title="3D Orbit View (Press 2)"
              >
                3D
              </button>
              <button
                onClick={() => setViewMode('2d')}
                className={`flex-1 px-3 py-1.5 text-sm font-medium rounded-md transition-all ${
                  viewMode === '2d'
                    ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] shadow-md'
                    : 'text-[var(--color-text-secondary)] hover:text-white hover:bg-white/10'
                }`}
                title="2D Top-Down View (Press 3)"
              >
                2D
              </button>
            </div>
          </div>

          {(viewMode === 'orbit' || viewMode === '2d') && (
            <button
              onClick={() => setFitToLandTrigger(t => t + 1)}
              className="w-full py-1.5 px-3 text-sm font-medium rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] text-[var(--color-text-secondary)] transition-colors border border-[var(--color-border)]"
            >
              Fit to Land
            </button>
          )}

          <div className="flex items-center justify-between gap-6">
            <span className="text-[var(--color-text-secondary)] text-sm" style={{ marginLeft: 4 }}>Dimensions</span>
            <button
              onClick={() => setLabels(prev => ({ ...prev, land: !prev.land }))}
              className={`toggle-switch ${labels.land ? 'active' : ''}`}
              aria-pressed={labels.land}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-6">
            <span className="text-[var(--color-text-secondary)] text-sm" style={{ marginLeft: 4 }}>Grid</span>
            <button
              onClick={() => setGridSnapEnabled(!gridSnapEnabled)}
              className={`toggle-switch ${gridSnapEnabled ? 'active' : ''}`}
              aria-pressed={gridSnapEnabled}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          <div className="flex items-center justify-between gap-6">
            <span className="text-[var(--color-text-secondary)] text-sm" style={{ marginLeft: 4 }}>Quality</span>
            <select
              value={graphicsQuality}
              onChange={(e) => setGraphicsQuality(e.target.value)}
              className="select-premium"
              style={{ fontSize: '11px', padding: '4px 22px 4px 8px', borderRadius: '6px' }}
            >
              <option value={QUALITY.FAST}>Fast</option>
              <option value={QUALITY.BEST}>Best</option>
            </select>
          </div>
        </div>
      </div>
      )}

      {/* Compass overlay - positioned below view controls */}
      {labels.orientation && (
        <div className={`absolute right-4 panel-premium w-14 h-14 flex items-center justify-center animate-fade-in ${isReadOnly ? 'top-44' : 'top-40'}`}>
          <div
            className="relative w-10 h-10"
            style={{ transform: `rotate(${computeCompassRotation(cameraState.rotation)}deg)`, transition: 'transform 0.15s ease-out' }}
          >
            <div className="absolute top-0 left-1/2 -translate-x-1/2 text-[var(--color-accent)] font-bold text-[11px]">N</div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-[var(--color-text-muted)] text-[10px]">S</div>
            <div className="absolute left-0 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-[10px]">W</div>
            <div className="absolute right-0 top-1/2 -translate-y-1/2 text-[var(--color-text-muted)] text-[10px]">E</div>
            <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-1.5 h-1.5 bg-[var(--color-text-secondary)] rounded-full" />
          </div>
        </div>
      )}

      {/* Undo/Redo toast notification */}
      {undoRedoToast && (
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm font-medium shadow-lg border border-[var(--color-border)] animate-fade-in" style={{ padding: '8px 32px' }}>
          {undoRedoToast}
        </div>
      )}

      {/* Unified Upload Modal */}
      {showUploadModal && (
        <Suspense fallback={<LoadingFallback />}>
          <UploadImageModal
            onClose={() => setShowUploadModal(false)}
            onUploadForLand={(imageData) => {
              // Set the image for land boundary tracing
              setUploadedImage(imageData)
              setActivePanel('land') // Switch to land panel
            }}
            onUploadForFloorPlan={(imageData) => {
              // Floor plan analysis - upload gating handled in modal
              setFloorPlanImageForGenerator(imageData)
              setShowFloorPlanGenerator(true)
            }}
          />
        </Suspense>
      )}

      {/* Floor Plan Generator Modal (AI-powered) */}
      {showFloorPlanGenerator && floorPlanImageForGenerator && (
        <Suspense fallback={<LoadingFallback />}>
          <FloorPlanGeneratorModal
            image={floorPlanImageForGenerator}
            onGenerate={handleFloorPlanGenerated}
            onCancel={() => {
              setShowFloorPlanGenerator(false)
              setFloorPlanImageForGenerator(null)
            }}
            isPaidUser={true}
          />
        </Suspense>
      )}

      {/* Room Properties Panel */}
      {roomPropertiesOpen && selectedRoomId && (
        <RoomPropertiesPanel
          room={rooms.find(r => r.id === selectedRoomId)}
          walls={walls}
          roomLabel={roomLabels[selectedRoomId] || ''}
          onLabelChange={(label) => handleSetRoomLabel(selectedRoomId, label)}
          onClose={() => {
            setRoomPropertiesOpen(false)
            setSelectedRoomId(null)
          }}
          selectedWallId={selectedElement?.type === 'wall' ? selectedElement.id : null}
          onSelectWall={(wallId) => {
            // Toggle - if already selected, deselect
            if (selectedElement?.type === 'wall' && selectedElement?.id === wallId) {
              setSelectedElement(null)
            } else {
              setSelectedElement({ type: 'wall', id: wallId })
            }
          }}
          onDeleteWall={(wallId) => {
            deleteWall(wallId)
          }}
          onResizeWall={resizeWall}
          roomStyle={roomStyles[selectedRoomId] || {}}
          onStyleChange={(style) => handleSetRoomStyle(selectedRoomId, style)}
          lengthUnit={lengthUnit}
        />
      )}

      {/* Wall Properties Panel */}
      {wallPropertiesOpen && selectedElement?.type === 'wall' && (
        <WallPropertiesPanel
          wall={walls.find(w => w.id === selectedElement.id)}
          onClose={() => {
            setWallPropertiesOpen(false)
            setSelectedElement(null)
          }}
          onResizeWall={resizeWall}
          onChangeHeight={changeWallHeight}
          onChangeColor={changeWallColor}
          onChangePattern={changeWallPattern}
          onDeleteOpening={deleteOpening}
          lengthUnit={lengthUnit}
        />
      )}

      {/* Fence Properties Panel */}
      {fencePropertiesOpen && selectedElement?.type === 'fence' && (
        <FencePropertiesPanel
          fence={walls.find(w => w.id === selectedElement.id && w.isFence)}
          onClose={() => {
            setFencePropertiesOpen(false)
            setSelectedElement(null)
          }}
          onChangeHeight={changeFenceHeight}
          onChangeFenceType={changeFenceType}
          lengthUnit={lengthUnit}
        />
      )}

      {/* Pool Properties Panel */}
      {poolPropertiesOpen && selectedPoolId && (
        <PoolPropertiesPanel
          pool={pools.find(p => p.id === selectedPoolId)}
          onClose={() => {
            setPoolPropertiesOpen(false)
            setSelectedPoolId(null)
          }}
          onUpdatePool={updatePool}
        />
      )}

      {/* Foundation Properties Panel */}
      {foundationPropertiesOpen && selectedFoundationId && (
        <FoundationPropertiesPanel
          foundation={foundations.find(f => f.id === selectedFoundationId)}
          onClose={() => {
            setFoundationPropertiesOpen(false)
            setSelectedFoundationId(null)
          }}
          onUpdateFoundation={updateFoundation}
        />
      )}

      {/* Stairs Properties Panel */}
      {stairsPropertiesOpen && selectedStairsId && (
        <StairsPropertiesPanel
          stairs={stairs.find(s => s.id === selectedStairsId)}
          onClose={() => {
            setStairsPropertiesOpen(false)
            setSelectedStairsId(null)
          }}
          onUpdateStairs={updateStairs}
          onDeleteStairs={deleteStairs}
        />
      )}

      {/* Roof Properties Panel */}
      {roofPropertiesOpen && selectedRoofId && (
        <RoofPropertiesPanel
          roof={roofs.find(r => r.id === selectedRoofId)}
          onClose={() => {
            setRoofPropertiesOpen(false)
            setSelectedRoofId(null)
          }}
          onUpdateRoof={updateRoof}
        />
      )}

      {/* Account buttons now integrated into toolbar ribbon above */}

      {/* Pricing Modal for upgrades */}
      {showPricingModal && (
        <Suspense fallback={<LoadingFallback />}>
          <PricingModal
            onClose={() => setShowPricingModal(false)}
            onSuccess={onPaymentSuccess}
          />
        </Suspense>
      )}

      {/* Auth Modal for sign in/sign up */}
      {showAuthModal && (
        <Suspense fallback={<LoadingFallback />}>
          <AuthModal
            onClose={() => setShowAuthModal(false)}
            onSuccess={() => setShowAuthModal(false)}
          />
        </Suspense>
      )}

      {/* Help Modal */}
      {showHelp && (
        <div className="fixed inset-0 z-[100] flex items-center justify-center" onClick={() => setShowHelp(false)} onKeyDown={e => { if (e.key === 'Escape') setShowHelp(false) }} tabIndex={-1} ref={el => el?.focus()}>
          <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />
          <div
            className="relative bg-[var(--color-panel)] backdrop-blur-xl rounded-2xl shadow-2xl border border-[var(--color-border)] max-w-xl max-h-[80vh] overflow-y-auto animate-fade-in"
            style={{ width: '90vw' }}
            onClick={e => e.stopPropagation()}
          >
            {/* Header + Tabs */}
            <div className="border-b border-[var(--color-border)]" style={{ padding: '20px 32px 16px' }}>
              <div className="flex items-center justify-between" style={{ marginBottom: '16px' }}>
                <h2 className="text-lg font-bold text-white">Help</h2>
                <button onClick={() => setShowHelp(false)} className="text-gray-400 hover:text-white transition-colors">
                  <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                  </svg>
                </button>
              </div>
              <div className="flex bg-[var(--color-bg-elevated)] rounded-xl p-1 gap-1">
                <button
                  onClick={() => setHelpTab('guide')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${helpTab === 'guide' ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] shadow-md' : 'text-[var(--color-text-secondary)] hover:text-white'}`}
                >
                  Guide
                </button>
                <button
                  onClick={() => setHelpTab('shortcuts')}
                  className={`flex-1 px-4 py-2 text-sm font-medium rounded-lg transition-all ${helpTab === 'shortcuts' ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] shadow-md' : 'text-[var(--color-text-secondary)] hover:text-white'}`}
                >
                  Shortcuts
                </button>
              </div>
            </div>

            {/* Content */}
            <div className="space-y-5 text-sm" style={{ padding: '24px 32px' }}>
              {helpTab === 'guide' ? (
                <>
                  {/* Guide sub-tabs */}
                  <div className="flex border-b border-white/10" style={{ marginBottom: '16px' }}>
                    {[
                      { id: 'start', label: 'Getting Started' },
                      { id: 'land', label: 'Land' },
                      { id: 'build', label: 'Build' },
                      { id: 'explore', label: 'Explore' },
                      { id: 'views', label: 'Views' },
                    ].map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setHelpGuideSection(tab.id)}
                        className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                          helpGuideSection === tab.id
                            ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                            : 'text-[var(--color-text-muted)] hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {helpGuideSection === 'start' && (
                    <p className="text-gray-300 leading-relaxed">
                      Sitea is a 3D land visualizer that lets you design buildings on your land plot. Walk around in first-person, draw walls, place rooms, and see your design come to life.
                    </p>
                  )}

                  {helpGuideSection === 'land' && (
                    <p className="text-gray-300 leading-relaxed">
                      Open the <span className="text-white font-medium">Land</span> panel to trace your land boundary. Click points to outline your plot shape, or upload a site plan image to trace over.
                    </p>
                  )}

                  {helpGuideSection === 'build' && (
                    <div className="space-y-4 text-gray-300 leading-relaxed">
                      <p>Open the <span className="text-white font-medium">Build</span> panel to access tools. Draw rooms, walls, and fences. Add doors, windows, pools, platforms, stairs, and roofs. Use the Structures tab to place pre-made buildings.</p>
                      <p>In the Floors section, select a number of floors and click a room to stack floors on top. Use the floor selector to switch between levels.</p>
                    </div>
                  )}

                  {helpGuideSection === 'explore' && (
                    <div className="space-y-4 text-gray-300 leading-relaxed">
                      <p>Open the <span className="text-white font-medium">Compare</span> panel to drop reference objects (tennis court, basketball court, etc.) onto your land to understand the scale.</p>
                      <p>Walk around in first-person (1P) to feel the scale. Switch to 3D orbit view for an overview. Use 2D view for precise placement. Save your design, export it, or share a link with others.</p>
                    </div>
                  )}

                  {helpGuideSection === 'views' && (
                    <div className="space-y-1.5 text-gray-300">
                      <div className="flex gap-3"><span className="text-white font-medium w-8 shrink-0">1P</span><span>First-person walkthrough — feel the real scale</span></div>
                      <div className="flex gap-3"><span className="text-white font-medium w-8 shrink-0">3D</span><span>Orbit view — rotate and zoom freely</span></div>
                      <div className="flex gap-3"><span className="text-white font-medium w-8 shrink-0">2D</span><span>Top-down view — precise placement and measurements</span></div>
                    </div>
                  )}
                </>
              ) : (
                <>
                  {/* Sub-tabs for shortcut categories */}
                  <div className="flex border-b border-white/10" style={{ marginBottom: '16px' }}>
                    {(isMobile ? [
                      { id: 'movement', label: 'Getting Around' },
                      { id: 'editing', label: 'Building' },
                    ] : [
                      { id: 'movement', label: 'Getting Around' },
                      { id: 'editing', label: 'Building' },
                      { id: 'drawing', label: 'Drawing' },
                      { id: 'panels', label: 'Panels' },
                      { id: 'tools', label: 'Build Tools' },
                    ]).map(tab => (
                      <button
                        key={tab.id}
                        onClick={() => setHelpShortcutSection(tab.id)}
                        className={`flex-1 px-3 py-2.5 text-xs font-medium transition-colors ${
                          helpShortcutSection === tab.id
                            ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                            : 'text-[var(--color-text-muted)] hover:text-white'
                        }`}
                      >
                        {tab.label}
                      </button>
                    ))}
                  </div>

                  {/* Sub-tab content */}
                  {helpShortcutSection === 'movement' && (
                    <div className="space-y-1 text-gray-300">
                      {isMobile ? (<>
                        <div className="flex justify-between gap-4"><span>Move</span><span className="text-gray-400 shrink-0">Joystick</span></div>
                        <div className="flex justify-between gap-4"><span>Look around</span><span className="text-gray-400 shrink-0">Drag</span></div>
                        <div className="flex justify-between gap-4"><span>Zoom</span><span className="text-gray-400 shrink-0">Pinch</span></div>
                        <div className="flex justify-between gap-4"><span>Jump</span><span className="text-gray-400 shrink-0">Jump button</span></div>
                      </>) : (<>
                        <div className="flex justify-between gap-4"><span>Move</span><span className="text-gray-400 shrink-0">WASD</span></div>
                        <div className="flex justify-between gap-4"><span>Run</span><span className="text-gray-400 shrink-0">Shift</span></div>
                        <div className="flex justify-between gap-4"><span>Jump</span><span className="text-gray-400 shrink-0">Space</span></div>
                        <div className="flex justify-between gap-4"><span>Look around</span><span className="text-gray-400 shrink-0">Mouse</span></div>
                        <div className="flex justify-between gap-4"><span>Zoom</span><span className="text-gray-400 shrink-0">Scroll</span></div>
                        <div className="flex justify-between gap-4"><span>Cycle camera</span><span className="text-gray-400 shrink-0">V</span></div>
                        <div className="flex justify-between gap-4"><span>First-Person / Orbit / 2D</span><span className="text-gray-400 shrink-0">1 / 2 / 3</span></div>
                        <div className="flex justify-between gap-4"><span>Fit to Land</span><span className="text-gray-400 shrink-0">F</span></div>
                      </>)}
                    </div>
                  )}

                  {helpShortcutSection === 'editing' && (
                    <div className="space-y-1 text-gray-300">
                      {isMobile ? (<>
                        <div className="flex justify-between gap-4"><span>Select</span><span className="text-gray-400 shrink-0">Tap object</span></div>
                        <div className="flex justify-between gap-4"><span>Rotate</span><span className="text-gray-400 shrink-0">Rotate button</span></div>
                        <div className="flex justify-between gap-4"><span>Delete</span><span className="text-gray-400 shrink-0">Long press</span></div>
                      </>) : (<>
                        <div className="flex justify-between gap-4"><span>Rotate selected</span><span className="text-gray-400 shrink-0">R</span></div>
                        <div className="flex justify-between gap-4"><span>Remove selected</span><span className="text-gray-400 shrink-0">Delete</span></div>
                        <div className="flex justify-between gap-4"><span>Undo</span><span className="text-gray-400 shrink-0">Ctrl+Z</span></div>
                        <div className="flex justify-between gap-4"><span>Redo</span><span className="text-gray-400 shrink-0">Ctrl+Shift+Z</span></div>
                        <div className="flex justify-between gap-4"><span>Cancel / Deselect</span><span className="text-gray-400 shrink-0">Escape</span></div>
                      </>)}
                    </div>
                  )}

                  {helpShortcutSection === 'drawing' && !isMobile && (
                    <div className="space-y-1 text-gray-300">
                      <div className="flex justify-between gap-4"><span>Snap to 45°</span><span className="text-gray-400 shrink-0">Shift (hold)</span></div>
                      <div className="flex justify-between gap-4"><span>Confirm dimension</span><span className="text-gray-400 shrink-0">Space</span></div>
                      <div className="flex justify-between gap-4"><span>Pause preview</span><span className="text-gray-400 shrink-0">Right-click</span></div>
                    </div>
                  )}

                  {helpShortcutSection === 'panels' && !isMobile && (
                    <div className="space-y-1 text-gray-300">
                      <div className="flex justify-between gap-4"><span>Land</span><span className="text-gray-400 shrink-0">L</span></div>
                      <div className="flex justify-between gap-4"><span>Compare</span><span className="text-gray-400 shrink-0">C</span></div>
                      <div className="flex justify-between gap-4"><span>Build</span><span className="text-gray-400 shrink-0">B</span></div>
                      <div className="flex justify-between gap-4"><span>Save</span><span className="text-gray-400 shrink-0">Alt+S</span></div>
                      <div className="flex justify-between gap-4"><span>Export</span><span className="text-gray-400 shrink-0">P</span></div>
                      <div className="flex justify-between gap-4"><span>Reset</span><span className="text-gray-400 shrink-0">O</span></div>
                      <div className="flex justify-between gap-4"><span>Help</span><span className="text-gray-400 shrink-0">U</span></div>
                      <div className="flex justify-between gap-4"><span>Close panel</span><span className="text-gray-400 shrink-0">Escape</span></div>
                    </div>
                  )}

                  {helpShortcutSection === 'tools' && !isMobile && (
                    <div className="space-y-1 text-gray-300">
                      <div className="flex justify-between gap-4"><span>Room</span><span className="text-gray-400 shrink-0">Q</span></div>
                      <div className="flex justify-between gap-4"><span>Wall</span><span className="text-gray-400 shrink-0">T</span></div>
                      <div className="flex justify-between gap-4"><span>Fence</span><span className="text-gray-400 shrink-0">G</span></div>
                      <div className="flex justify-between gap-4"><span>Door</span><span className="text-gray-400 shrink-0">C</span></div>
                      <div className="flex justify-between gap-4"><span>Window</span><span className="text-gray-400 shrink-0">V</span></div>
                      <div className="flex justify-between gap-4"><span>Pool</span><span className="text-gray-400 shrink-0">B</span></div>
                      <div className="flex justify-between gap-4"><span>Platform</span><span className="text-gray-400 shrink-0">N</span></div>
                      <div className="flex justify-between gap-4"><span>Stairs</span><span className="text-gray-400 shrink-0">H</span></div>
                      <div className="flex justify-between gap-4"><span>Roof</span><span className="text-gray-400 shrink-0">J</span></div>
                      <div className="flex justify-between gap-4"><span>Delete</span><span className="text-gray-400 shrink-0">X</span></div>
                    </div>
                  )}
                </>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}

export default App
