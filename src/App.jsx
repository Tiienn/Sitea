import { useState, useEffect, useRef, useCallback, useMemo } from 'react'
import { useBuildHistory } from './hooks/useBuildHistory'
import { useParams, useNavigate, Routes, Route } from 'react-router-dom'
import nipplejs from 'nipplejs'
import LandScene, { CAMERA_MODE, DEFAULT_TP_DISTANCE, ORBIT_START_DISTANCE, QUALITY } from './components/LandScene'
import PolygonEditor, { calculatePolygonArea } from './components/PolygonEditor'
import ImageTracer from './components/ImageTracer'
import Minimap from './components/Minimap'
import Onboarding from './components/Onboarding'
import BuildPanel from './components/BuildPanel'
import ComparePanel from './components/ComparePanel'
import LandPanel from './components/LandPanel'
import ExportPanel from './components/ExportPanel'
import UploadImageModal from './components/UploadImageModal'
import FloorPlanGeneratorModal from './components/FloorPlanGeneratorModal'
import { useUser } from './hooks/useUser'
import { exportFloorPlanAsPNG } from './utils/exportFloorPlan'
import { computeOverlappingIds, checkPreviewOverlap } from './utils/collision2d'
import { computeCompassRotation } from './utils/labels'
import { detectRooms } from './utils/roomDetection'
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
const SQ_FEET_PER_SQ_METER = 10.7639
const SQ_METERS_PER_ACRE = 4046.86
const SQ_METERS_PER_HECTARE = 10000

// Conversion utilities
const convertLength = (meters, unit) => {
  if (unit === 'ft') return meters * FEET_PER_METER
  return meters
}

const convertLengthToMeters = (value, unit) => {
  if (unit === 'ft') return value / FEET_PER_METER
  return value
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
]

const BUILDING_TYPES = [
  { id: 'smallHouse', name: 'Small House', width: 8, length: 10, height: 5, color: '#D2691E' },
  { id: 'mediumHouse', name: 'Medium House', width: 12, length: 15, height: 6, color: '#CD853F' },
  { id: 'largeHouse', name: 'Large House', width: 15, length: 20, height: 7, color: '#8B4513' },
  { id: 'shed', name: 'Shed', width: 3, length: 4, height: 2.5, color: '#A0522D' },
  { id: 'garage', name: 'Garage', width: 6, length: 6, height: 3, color: '#808080' },
  { id: 'pool', name: 'Swimming Pool', width: 5, length: 10, height: -1.5, color: '#00CED1' },
]

// Build tool constants
const BUILD_TOOLS = {
  NONE: 'none',
  ROOM: 'room',       // Click-drag rectangular room
  WALL: 'wall',       // Click-drag single wall
  DOOR: 'door',       // Click on wall to place door
  WINDOW: 'window',   // Click on wall to place window
  SELECT: 'select',   // Click to select elements
  DELETE: 'delete',   // Click to delete elements
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
function VirtualJoystick({ joystickInput }) {
  const joystickRef = useRef(null)
  const containerRef = useRef(null)

  useEffect(() => {
    if (!containerRef.current) return

    const manager = nipplejs.create({
      zone: containerRef.current,
      mode: 'static',
      position: { left: '80px', bottom: '140px' },
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

  return (
    <div
      ref={containerRef}
      className="joystick-zone fixed left-4 w-40 h-40 z-50"
      style={{ touchAction: 'none', bottom: '80px' }}
    />
  )
}

function App() {
  // User context for paid features
  const { isPaidUser } = useUser()

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
  const [buildingPreviewPosition, setBuildingPreviewPosition] = useState({ x: 0, z: 0 })
  const [buildingPreviewRotation, setBuildingPreviewRotation] = useState(0)

  // Build tools state (Sims 4-style)
  const [activeBuildTool, setActiveBuildTool] = useState(BUILD_TOOLS.NONE)
  const [selectedElement, setSelectedElement] = useState(null) // {type: 'wall'|'door'|'window'|'room', id, parentId?}

  // Door/Window size state
  const [doorWidth, setDoorWidth] = useState(0.9)
  const [doorHeight, setDoorHeight] = useState(2.1)
  const [windowWidth, setWindowWidth] = useState(1.2)
  const [windowHeight, setWindowHeight] = useState(1.2)
  const [windowSillHeight, setWindowSillHeight] = useState(0.9)

  // Room detection (auto-detect enclosed areas from walls)
  const rooms = useMemo(() => detectRooms(walls), [walls])

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
    return { land: true, buildings: false, orientation: false }
  })

  // Shared scene state
  const [isReadOnly, setIsReadOnly] = useState(false)
  const [shareLoading, setShareLoading] = useState(false)
  const [shareError, setShareError] = useState(null)
  const [shareStatus, setShareStatus] = useState(null) // 'copied' | 'error' | null
  const [isExporting, setIsExporting] = useState(false)

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
    // Default: LOW on mobile, MEDIUM on desktop
    const isMobile = 'ontouchstart' in window || navigator.maxTouchPoints > 0
    return isMobile ? QUALITY.LOW : QUALITY.MEDIUM
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
      if (e.key === '1') setViewMode('firstPerson')
      else if (e.key === '2') setViewMode('orbit')
      else if (e.key === '3') setViewMode('2d')
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

  // Cycle through quality presets
  const cycleQuality = useCallback(() => {
    setGraphicsQuality(prev => {
      if (prev === QUALITY.LOW) return QUALITY.MEDIUM
      if (prev === QUALITY.MEDIUM) return QUALITY.HIGH
      return QUALITY.LOW
    })
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

  // When length unit changes, update area unit to match (m→m², ft→ft²)
  const handleLengthUnitChange = (unit) => {
    setLengthUnit(unit)
    // Auto-switch area unit to match, unless using acres/hectares
    if (areaUnit !== 'acres' && areaUnit !== 'hectares') {
      setAreaUnit(unit === 'm' ? 'm²' : 'ft²')
    }
  }

  // Toggle panel - close if same, open if different
  const togglePanel = (panel) => {
    setActivePanel(prev => prev === panel ? null : panel)
  }

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
    const lengthInput = parseFloat(inputValues.length) || (lengthUnit === 'm' ? 20 : 65)
    const widthInput = parseFloat(inputValues.width) || (lengthUnit === 'm' ? 15 : 50)
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
  const addWallFromPoints = useCallback((points) => {
    if (points.length < 2) return
    const newWalls = []
    for (let i = 0; i < points.length - 1; i++) {
      newWalls.push({
        id: `wall-${Date.now()}-${i}`,
        start: { x: points[i].x, z: points[i].z },
        end: { x: points[i + 1].x, z: points[i + 1].z },
        height: 2.7,
        thickness: 0.15,
        openings: [] // Doors and windows
      })
    }
    pushWallsState([...walls, ...newWalls])
  }, [walls, pushWallsState])

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

  // Delete a single wall by ID
  const deleteWall = useCallback((wallId) => {
    pushWallsState(walls.filter(w => w.id !== wallId))
    // Clear selection if deleted wall was selected
    if (selectedElement?.type === 'wall' && selectedElement?.id === wallId) {
      setSelectedElement(null)
    }
  }, [walls, pushWallsState, selectedElement])

  // Handle generated floor plan from AI - enters placement mode
  const handleFloorPlanGenerated = useCallback((generatedData) => {
    // Store pending floor plan and enter placement mode
    setPendingFloorPlan(generatedData)
    setFloorPlanPlacementMode(true)
    setBuildingPreviewPosition({ x: 0, z: 0 })
    setBuildingPreviewRotation(0)

    // Close the generator modal
    setShowFloorPlanGenerator(false)
    setFloorPlanImageForGenerator(null)

    // Switch to build mode and 3D view
    setActivePanel('build')
    setViewMode('orbit')

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

  // Building placement keyboard shortcuts (R to rotate, ESC to cancel, Delete to remove)
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      // R to rotate (90 degrees)
      if (e.key === 'r' || e.key === 'R') {
        if (floorPlanPlacementMode || selectedBuildingId) {
          e.preventDefault()
          rotateBuildingPreview(Math.PI / 2)
        }
      }

      // ESC to cancel placement
      if (e.key === 'Escape') {
        if (floorPlanPlacementMode) {
          e.preventDefault()
          cancelFloorPlanPlacement()
        } else if (selectedBuildingId) {
          e.preventDefault()
          setSelectedBuildingId(null)
        }
      }

      // Delete/Backspace to remove selected building
      if (e.key === 'Delete' || e.key === 'Backspace') {
        if (selectedBuildingId) {
          e.preventDefault()
          deleteSelectedBuilding()
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [floorPlanPlacementMode, selectedBuildingId, rotateBuildingPreview, cancelFloorPlanPlacement, deleteSelectedBuilding])

  // Show toast when building is selected
  useEffect(() => {
    if (selectedBuildingId) {
      setUndoRedoToast('Building selected • Click to move • R to rotate • ESC to deselect • Del to delete')
    } else if (!floorPlanPlacementMode) {
      setUndoRedoToast(null)
    }
  }, [selectedBuildingId, floorPlanPlacementMode])

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
        windowWidth={windowWidth}
        windowHeight={windowHeight}
        windowSillHeight={windowSillHeight}
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
        setSelectedBuildingId={setSelectedBuildingId}
        moveSelectedBuilding={moveSelectedBuilding}
      />

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
        />
      )}

      {/* Mobile joystick - positioned above ribbon */}
      {isTouchDevice && <VirtualJoystick joystickInput={joystickInput} />}

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
          bottom: '56px',
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
          bottom: '56px',
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
            // Detected floor plan - open AI generator modal
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
          bottom: '56px',
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
          windowWidth={windowWidth}
          setWindowWidth={setWindowWidth}
          windowHeight={windowHeight}
          setWindowHeight={setWindowHeight}
          windowSillHeight={windowSillHeight}
          setWindowSillHeight={setWindowSillHeight}
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
            // Open AI floor plan generator modal
            setFloorPlanImageForGenerator(imageData)
            setShowFloorPlanGenerator(true)
          }}
        />
      </div>

      {/* Export sidebar */}
      <div
        className={`build-sidebar ${activePanel === 'export' ? 'open' : 'closed'}`}
        style={{
          top: 0,
          bottom: '56px',
        }}
      >
        <div className="h-full flex text-white">
          <div className="flex-1 p-4 overflow-y-auto">
            <div className="flex items-center px-0 py-3 border-b border-[var(--color-border)] mb-4">
              <h2 className="font-display font-semibold text-sm">Export Floor Plan</h2>
            </div>
            <ExportPanel
              onExport={handleExport}
              isExporting={isExporting}
              wallCount={walls.length}
              roomCount={rooms.length}
              hasLand={!!currentPolygon && currentPolygon.length >= 3}
            />
          </div>
        </div>
      </div>

      {/* Bottom ribbon navigation */}
      <div className="fixed bottom-0 left-0 right-0 z-50 ribbon-nav animate-slide-up">
        <div className="flex justify-around items-center h-14">
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
            className="ribbon-btn w-12 flex-none"
            title="Reset to example"
          >
            <span className="icon">
              <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
              </svg>
            </span>
          </button>
        </div>
      </div>

      {/* Primary CTA Card - top left, shifts right when sidebar open */}
      {!isReadOnly && !isDefiningLand && (
        <div
          className="absolute top-4 panel-premium p-5 text-white z-50 min-w-[220px] animate-fade-in transition-all duration-300"
          style={{
            // 16px = no sidebar, 72px = icon rail only (56px + 16px), 332px = full expanded (56px + 260px + 16px)
            left: (activePanel === 'build' || activePanel === 'compare' || activePanel === 'land' || activePanel === 'export')
              ? (panelExpanded ? '332px' : '72px')
              : '16px',
          }}
        >
          {/* Header */}
          <div className="flex items-center gap-3 mb-4">
            <div className="w-10 h-10 rounded-xl bg-[var(--color-accent)] flex items-center justify-center">
              <svg className="w-5 h-5 text-[var(--color-bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <div>
              <h2 className="font-display font-semibold text-[15px] text-white leading-tight">Define Your Land</h2>
              <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">
                Ready to plan
              </p>
            </div>
          </div>

          {/* Area display */}
          <div className="mb-4 py-3 px-4 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)]">
            <div className="text-[var(--color-text-muted)] text-[10px] uppercase tracking-wider mb-1">Total Area</div>
            <div className="font-display font-bold text-2xl text-white tracking-tight">{formatArea(area, areaUnit)}</div>
          </div>

          {/* CTA Button */}
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
      )}

      {/* Non-blocking walkthrough hint (first visit only) */}
      {!hasSeenIntro && isExampleMode && !isDefiningLand && walkthroughStep === 0 && (
        <div className="absolute top-4 left-1/2 -translate-x-1/2 panel-premium px-5 py-3 z-40 animate-gentle-pulse">
          <p className="text-[var(--color-text-primary)] text-sm font-medium">
            {isTouchDevice ? 'Use joystick to explore' : 'Use WASD to explore'}
          </p>
          <p className="text-[var(--color-text-secondary)] text-xs mt-0.5">Walk around to feel the scale</p>
        </div>
      )}

      {/* Help text - top-center pill with auto-fade */}
      {!isDefiningLand && !isReadOnly && helpTextVisible && (
        <div
          className="absolute top-4 left-1/2 -translate-x-1/2 z-30 px-4 py-2 rounded-full pointer-events-none animate-fade-in"
          style={{
            background: 'rgba(15, 23, 42, 0.75)',
            backdropFilter: 'blur(8px)',
            animation: 'fadeIn 0.3s ease-out forwards',
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
        <div className={`absolute bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg transition-all ${
          !placementValid
            ? 'bg-red-500/90 text-white'
            : dragOverlapping
              ? 'bg-amber-500/90 text-white'
              : 'bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse'
        }`}>
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
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse">
          {wallDrawingPoints.length === 0
            ? 'Click to place first corner'
            : `${wallDrawingPoints.length} points placed · Click to continue · Escape to finish`
          }
        </div>
      )}

      {/* Room tool indicator */}
      {activeBuildTool === BUILD_TOOLS.ROOM && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse">
          Click and drag to draw a room · Escape to cancel
        </div>
      )}

      {/* Wall tool indicator */}
      {activeBuildTool === BUILD_TOOLS.WALL && !wallDrawingMode && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse">
          {wallDrawingPoints.length === 0
            ? 'Click to place first corner'
            : `${wallDrawingPoints.length} points placed · Click to continue · Escape to finish`
          }
        </div>
      )}

      {/* Door tool indicator */}
      {activeBuildTool === BUILD_TOOLS.DOOR && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse">
          {walls.length === 0 ? 'Draw walls first to place doors' : 'Click on a wall to place a door · Escape to cancel'}
        </div>
      )}

      {/* Window tool indicator */}
      {activeBuildTool === BUILD_TOOLS.WINDOW && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse">
          {walls.length === 0 ? 'Draw walls first to place windows' : 'Click on a wall to place a window · Escape to cancel'}
        </div>
      )}

      {/* Select tool indicator */}
      {activeBuildTool === BUILD_TOOLS.SELECT && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg bg-[var(--color-accent)] text-[var(--color-bg-primary)] animate-gentle-pulse">
          {selectedElement
            ? `Selected: ${selectedElement.type} · Escape to deselect`
            : 'Click on a wall to select it · Escape to cancel'}
        </div>
      )}

      {/* Delete tool indicator */}
      {activeBuildTool === BUILD_TOOLS.DELETE && (
        <div className="absolute bottom-20 left-1/2 -translate-x-1/2 px-5 py-2.5 rounded-xl text-sm font-medium shadow-lg bg-red-500 text-white animate-gentle-pulse">
          {walls.length === 0 ? 'No walls to delete' : 'Click on a wall to delete it · Escape to cancel'}
        </div>
      )}

      {/* Grouped View Controls - top right */}
      <div className={`absolute right-4 panel-premium text-white overflow-hidden animate-fade-in ${isReadOnly ? 'top-14' : 'top-4'}`}>
        {/* Controls only - area is shown in CTA card */}
        <div className="px-4 py-3 space-y-3">
          {/* View mode segmented control */}
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

          {/* Fit to Land button (in orbit and 2D modes) */}
          {(viewMode === 'orbit' || viewMode === '2d') && (
            <button
              onClick={() => setFitToLandTrigger(t => t + 1)}
              className="w-full py-1.5 px-3 text-sm font-medium rounded-lg bg-[var(--color-bg-secondary)] hover:bg-[var(--color-accent)] hover:text-[var(--color-bg-primary)] text-[var(--color-text-secondary)] transition-colors border border-[var(--color-border)]"
            >
              Fit to Land
            </button>
          )}

          {/* Distance labels toggle */}
          <div className="flex items-center justify-between gap-6">
            <span className="text-[var(--color-text-secondary)] text-sm">Dimensions</span>
            <button
              onClick={() => setLabels(prev => ({ ...prev, land: !prev.land }))}
              className={`toggle-switch ${labels.land ? 'active' : ''}`}
              aria-pressed={labels.land}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          {/* Grid toggle */}
          <div className="flex items-center justify-between gap-6">
            <span className="text-[var(--color-text-secondary)] text-sm">Grid</span>
            <button
              onClick={() => setGridSnapEnabled(!gridSnapEnabled)}
              className={`toggle-switch ${gridSnapEnabled ? 'active' : ''}`}
              aria-pressed={gridSnapEnabled}
            >
              <span className="toggle-knob" />
            </button>
          </div>

          {/* Quality dropdown */}
          <div className="flex items-center justify-between gap-6">
            <span className="text-[var(--color-text-secondary)] text-sm">Quality</span>
            <select
              value={graphicsQuality}
              onChange={(e) => setGraphicsQuality(e.target.value)}
              className="select-premium"
              style={{ fontSize: '11px', padding: '4px 22px 4px 8px', borderRadius: '6px' }}
            >
              <option value={QUALITY.LOW}>Low</option>
              <option value={QUALITY.MEDIUM}>Medium</option>
              <option value={QUALITY.HIGH}>High</option>
            </select>
          </div>
        </div>
      </div>

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
        <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-50 px-4 py-2 rounded-lg bg-[var(--color-bg-secondary)] text-[var(--color-text-primary)] text-sm font-medium shadow-lg border border-[var(--color-border)] animate-fade-in">
          {undoRedoToast}
        </div>
      )}

      {/* Unified Upload Modal */}
      {showUploadModal && (
        <UploadImageModal
          onClose={() => setShowUploadModal(false)}
          onUploadForLand={(imageData) => {
            // Set the image for land boundary tracing
            setUploadedImage(imageData)
            setActivePanel('land') // Switch to land panel
          }}
          onUploadForFloorPlan={(imageData) => {
            // Open the floor plan generator modal for AI analysis
            setFloorPlanImageForGenerator(imageData)
            setShowFloorPlanGenerator(true)
          }}
        />
      )}

      {/* Floor Plan Generator Modal (AI-powered) */}
      {showFloorPlanGenerator && floorPlanImageForGenerator && (
        <FloorPlanGeneratorModal
          image={floorPlanImageForGenerator}
          onGenerate={handleFloorPlanGenerated}
          onCancel={() => {
            setShowFloorPlanGenerator(false)
            setFloorPlanImageForGenerator(null)
          }}
          isPaidUser={true}
        />
      )}
    </div>
  )
}

export default App
