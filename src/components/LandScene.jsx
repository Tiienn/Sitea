import { useRef, useEffect, useMemo, useState, useCallback, Suspense } from 'react'
import { createPortal } from 'react-dom'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { Grid, Text, Billboard, OrbitControls, MapControls, OrthographicCamera, PerspectiveCamera, Line, useTexture, Html } from '@react-three/drei'
import * as THREE from 'three'
import { computeEdgeLabelData, formatEdgeLength } from '../utils/labels'
import { findWallsForRoom } from '../utils/roomDetection'
import {
  trackFirstMovement,
  trackWalk5sCompleted,
  accumulateWalkTime,
} from '../services/analytics'

// Import extracted constants and utilities
import {
  QUALITY,
  QUALITY_SETTINGS,
  CAMERA_MODE,
  MIN_DISTANCE,
  SWITCH_OUT_DISTANCE,
  SWITCH_IN_DISTANCE,
  MAX_DISTANCE,
  DEFAULT_TP_DISTANCE,
  ORBIT_START_DISTANCE,
  FOLLOW_SMOOTH,
  YAW_SMOOTH,
  WALK_SPEED,
  RUN_SPEED,
  ZOOM_SPEED,
  PINCH_SPEED,
  CAMERA_BOB_WALK,
  CAMERA_BOB_RUN,
  CAMERA_BOB_SPEED,
  JUMP_FORCE,
  GRAVITY,
  PLAYER_HEIGHT,
  FEET_PER_METER,
  SQ_FEET_PER_SQ_METER,
  PREVIEW_COLOR_VALID,
  PREVIEW_COLOR_INVALID,
  PREVIEW_OPACITY,
  SUN_POSITION,
  IDLE_BOB_AMPLITUDE,
  IDLE_BOB_SPEED,
  WALK_LEG_SWING,
  WALK_ARM_SWING,
  WALK_BOB_AMPLITUDE,
  WALK_CYCLE_SPEED,
  RUN_LEG_SWING,
  RUN_ARM_SWING,
  RUN_BOB_AMPLITUDE,
  RUN_CYCLE_SPEED,
  RUN_LEAN,
  NPC_COLORS,
  formatDimension,
  formatDimensions,
  getWallLength,
  getWallAngle,
  getWorldPositionOnWall,
  isValidOpeningPlacement
} from '../constants/landSceneConstants'

// Import extracted components
import { RealisticSky, NightStars, EnhancedGround, MountainSilhouettes, ScatteredTrees } from './scene/SceneEnvironment'
import { AnimatedPlayerMesh } from './scene/AnimatedPlayerMesh'
import { NPCCharacter } from './scene/NPCCharacter'
import { GridOverlay, CADDotGrid, PreviewDimensionLabel } from './scene/GridComponents'
import { CameraController } from './scene/CameraController'
import { calculateNPCPositions } from '../utils/npcHelpers'
import {
  createFloorTexture,
  createWallTexture,
  createDeckTexture,
  createFoundationTexture,
  createStairsTexture,
  createRoofTexture
} from '../utils/textureGenerators'
import {
  ComparisonObject,
  SnapGuideLine,
  isAxisAligned,
  getRotatedDimensions,
  getObjectBounds,
  checkOverlap,
  SNAP_THRESHOLD
} from './scene/ComparisonObjects'
import { WallSegment } from './scene/WallSegment'
import { RoomFloor } from './scene/RoomFloor'
import { PlacedBuilding, BuildingPreview, SetbackZone, SnapIndicator, EdgeLabels } from './scene/BuildingComponents'
import { PoolItem, FoundationItem, StairsItem, RoofItem } from './scene/PolygonRenderers'
import { Component } from 'react'

// Silent error boundary - renders nothing on error (used for optional components like player mesh)
class SilentErrorBoundary extends Component {
  constructor(props) { super(props); this.state = { hasError: false } }
  static getDerivedStateFromError() { return { hasError: true } }
  componentDidCatch(error) { console.error('[PlayerMesh] Failed to load:', error.message) }
  render() { return this.state.hasError ? null : this.props.children }
}

// Error boundary for 3D canvas - prevents crashes from taking down the whole app
class Canvas3DErrorBoundary extends Component {
  constructor(props) {
    super(props)
    this.state = { hasError: false, error: null }
  }

  static getDerivedStateFromError(error) {
    return { hasError: true, error }
  }

  componentDidCatch(error, errorInfo) {
    console.error('3D Canvas error:', error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          width: '100%',
          height: '100%',
          display: 'flex',
          flexDirection: 'column',
          alignItems: 'center',
          justifyContent: 'center',
          background: '#1a1a1a',
          color: '#fff',
          padding: '20px',
          textAlign: 'center'
        }}>
          <div style={{ fontSize: '48px', marginBottom: '16px' }}>⚠️</div>
          <h2 style={{ margin: '0 0 8px 0' }}>3D View Error</h2>
          <p style={{ color: '#888', margin: '0 0 16px 0' }}>
            Something went wrong with the 3D rendering.
          </p>
          <button
            onClick={() => this.setState({ hasError: false, error: null })}
            style={{
              padding: '8px 16px',
              background: '#14B8A6',
              color: '#fff',
              border: 'none',
              borderRadius: '4px',
              cursor: 'pointer'
            }}
          >
            Try Again
          </button>
        </div>
      )
    }
    return this.props.children
  }
}

// Floor Plan Background Component - renders uploaded floor plan as a textured plane
function FloorPlanBackground({ imageUrl, settings = {} }) {
  const { opacity = 0.5, visible = true, scale = 1, offsetX = 0, offsetZ = 0 } = settings

  // Load texture from base64 data URL
  const texture = useTexture(imageUrl)

  // Calculate aspect ratio and size
  const aspect = texture.image ? texture.image.width / texture.image.height : 1
  const baseSize = 20 // Base size in meters
  const planeWidth = baseSize * scale * aspect
  const planeHeight = baseSize * scale

  if (!visible) return null

  return (
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[offsetX, 0.02, offsetZ]}
    >
      <planeGeometry args={[planeWidth, planeHeight]} />
      <meshBasicMaterial
        map={texture}
        transparent
        opacity={opacity}
        side={THREE.DoubleSide}
        depthWrite={false}
      />
    </mesh>
  )
}

// Reports camera position/rotation to parent
function CameraReporter({ onUpdate }) {
  const { camera } = useThree()
  const lastUpdate = useRef(0)

  useFrame(() => {
    // Throttle updates to 10fps to avoid performance issues
    const now = Date.now()
    if (now - lastUpdate.current < 100) return
    lastUpdate.current = now

    if (onUpdate) {
      // Get Y rotation (yaw) from camera quaternion
      const euler = new THREE.Euler()
      euler.setFromQuaternion(camera.quaternion, 'YXZ')

      onUpdate({
        position: { x: camera.position.x, y: camera.position.y, z: camera.position.z },
        rotation: euler.y
      })
    }
  })

  return null
}

// CameraController extracted to ./scene/CameraController.jsx


function LandPlot({ length, width, polygonPoints, onClick, onPointerMove, onPointerLeave, onPointerDown, onPointerUp, viewMode = 'firstPerson' }) {
  const is2D = viewMode === '2d'

  // Create a stable hash of polygon points for cache invalidation
  const polygonHash = useMemo(() => {
    if (!polygonPoints || polygonPoints.length < 3) return `rect-${length}-${width}`
    return polygonPoints.map(p => `${p.x.toFixed(2)},${p.y.toFixed(2)}`).join('|')
  }, [polygonPoints, length, width])

  // Create shape geometry for polygon or rectangle
  const shapeGeometry = useMemo(() => {
    const shape = new THREE.Shape()

    if (polygonPoints && polygonPoints.length >= 3) {
      // Polygon mode
      shape.moveTo(polygonPoints[0].x, polygonPoints[0].y)
      for (let i = 1; i < polygonPoints.length; i++) {
        shape.lineTo(polygonPoints[i].x, polygonPoints[i].y)
      }
      shape.closePath()
    } else {
      // Rectangle mode
      const hw = width / 2
      const hl = length / 2
      shape.moveTo(-hw, -hl)
      shape.lineTo(hw, -hl)
      shape.lineTo(hw, hl)
      shape.lineTo(-hw, hl)
      shape.closePath()
    }

    return new THREE.ShapeGeometry(shape)
  }, [polygonHash]) // eslint-disable-line react-hooks/exhaustive-deps

  // Get corner points for posts (must be in perimeter order for line drawing)
  const corners = useMemo(() => {
    if (polygonPoints && polygonPoints.length >= 3) {
      return polygonPoints.map(p => [p.x, p.y])
    }
    // Rectangle corners in clockwise order: top-left → top-right → bottom-right → bottom-left
    return [
      [-width / 2, length / 2],
      [width / 2, length / 2],
      [width / 2, -length / 2],
      [-width / 2, -length / 2],
    ]
  }, [polygonHash]) // eslint-disable-line react-hooks/exhaustive-deps

  // Create line geometry from same corners used by shapeGeometry
  const linePositions = useMemo(() => {
    return new Float32Array([...corners.flatMap(([x, y]) => [x, y, 0]), corners[0][0], corners[0][1], 0])
  }, [corners])

  // 2D CAD colors
  const landFillColor = is2D ? '#0a2020' : '#4a7c59'  // Dark teal in 2D, green in 3D
  const borderColor = is2D ? '#00ffff' : '#ffffff'     // Cyan in 2D, white in 3D

  return (
    <group>
      {/* Main land surface */}
      <mesh key={`fill-${polygonHash}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow={!is2D} geometry={shapeGeometry} onClick={onClick} onPointerMove={onPointerMove} onPointerLeave={onPointerLeave} onPointerDown={onPointerDown} onPointerUp={onPointerUp}>
        {is2D ? (
          <meshBasicMaterial color={landFillColor} transparent opacity={0.5} />
        ) : (
          <meshStandardMaterial color="#4a7c59" roughness={0.95} metalness={0} />
        )}
      </mesh>

      {/* Border outline - uses same corners as fill for perfect alignment */}
      <line key={`outline-${polygonHash}`} rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={corners.length + 1}
            array={linePositions}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color={borderColor} linewidth={2} />
      </line>

      {/* Corner posts - hidden in 2D mode, negate z to match rotated land surface */}
      {!is2D && corners.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.5, -z]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
          <meshStandardMaterial color="#8b4513" />
        </mesh>
      ))}
    </group>
  )
}

// PlacedBuilding, BuildingPreview, SetbackZone, SnapIndicator, EdgeLabels are now imported from BuildingComponents.jsx

// ComparisonObject and utility functions are now imported from ComparisonObjects

// SnapGuideLine and ComparisonObject are now imported from ComparisonObjects

// WallSegment component is now imported from WallSegment.jsx

// RoomFloor component is now imported from RoomFloor.jsx

// Lighting interpolation table for day/night cycle
const LIGHT_STOPS = [
  { t: 0.0,  sunY: -50, sunInt: 0.0, sunCol: [0,0,0],           ambInt: 0.12, ambCol: [0.133,0.200,0.333], fogCol: [0.039,0.082,0.125] },
  { t: 0.2,  sunY: 20,  sunInt: 0.4, sunCol: [1.0,0.6,0.4],     ambInt: 0.25, ambCol: [0.533,0.467,0.400], fogCol: [0.753,0.502,0.376] },
  { t: 0.35, sunY: 120, sunInt: 1.4, sunCol: [1.0,0.976,0.940], ambInt: 0.45, ambCol: [0.941,0.961,1.0],   fogCol: [0.753,0.831,0.878] },
  { t: 0.5,  sunY: 150, sunInt: 1.5, sunCol: [1.0,1.0,1.0],     ambInt: 0.5,  ambCol: [0.941,0.961,1.0],   fogCol: [0.722,0.831,0.910] },
  { t: 0.7,  sunY: 30,  sunInt: 0.8, sunCol: [1.0,0.533,0.267], ambInt: 0.3,  ambCol: [0.667,0.533,0.400], fogCol: [0.784,0.565,0.408] },
  { t: 0.85, sunY: -10, sunInt: 0.1, sunCol: [0.333,0.200,0.267],ambInt: 0.15, ambCol: [0.200,0.267,0.333], fogCol: [0.102,0.145,0.251] },
  { t: 1.0,  sunY: -50, sunInt: 0.0, sunCol: [0,0,0],           ambInt: 0.12, ambCol: [0.133,0.200,0.333], fogCol: [0.039,0.082,0.125] },
]

function lerpLightValue(time, key) {
  for (let i = 0; i < LIGHT_STOPS.length - 1; i++) {
    if (time >= LIGHT_STOPS[i].t && time <= LIGHT_STOPS[i + 1].t) {
      const f = (time - LIGHT_STOPS[i].t) / (LIGHT_STOPS[i + 1].t - LIGHT_STOPS[i].t)
      const a = LIGHT_STOPS[i][key], b = LIGHT_STOPS[i + 1][key]
      if (Array.isArray(a)) return a.map((v, j) => v + (b[j] - v) * f)
      return a + (b - a) * f
    }
  }
  const s = LIGHT_STOPS[0]
  return Array.isArray(s[key]) ? s[key] : s[key]
}

// Updates lights, fog imperatively each frame — no React re-renders
function DayNightController({ timeOfDay, setTimeOfDay, isPaidUser, viewMode, sunRef, ambientRef, fillRef, fogRef }) {
  const isPaused = useRef(false)

  useFrame((_, delta) => {
    // Auto-cycle: ~10 min per full cycle, only for paid users in 3D
    if (isPaidUser && viewMode !== '2d' && !isPaused.current) {
      // 600s cycle → delta/600 per frame
      setTimeOfDay(prev => {
        const next = prev + delta / 600
        return next >= 1 ? next - 1 : next
      })
    }

    // Clamp for free users
    const t = isPaidUser ? timeOfDay : 0.35

    // Sun orbit
    const sunX = Math.cos(t * Math.PI * 2) * 80
    const sunY = lerpLightValue(t, 'sunY')
    const sunZ = Math.sin(t * Math.PI * 2) * 40

    if (sunRef.current) {
      sunRef.current.position.set(sunX, sunY, sunZ)
      sunRef.current.intensity = lerpLightValue(t, 'sunInt')
      const sc = lerpLightValue(t, 'sunCol')
      sunRef.current.color.setRGB(sc[0], sc[1], sc[2])
    }

    if (ambientRef.current) {
      ambientRef.current.intensity = lerpLightValue(t, 'ambInt')
      const ac = lerpLightValue(t, 'ambCol')
      ambientRef.current.color.setRGB(ac[0], ac[1], ac[2])
    }

    if (fillRef.current) {
      // Fill light opposite to sun, half intensity
      fillRef.current.position.set(-sunX, Math.max(sunY * 0.3, 10), -sunZ)
      fillRef.current.intensity = lerpLightValue(t, 'sunInt') * 0.2
    }

    if (fogRef.current) {
      const fc = lerpLightValue(t, 'fogCol')
      fogRef.current.color.setRGB(fc[0], fc[1], fc[2])
    }
  })

  return null
}

function Scene({ length, width, isExploring, comparisonObjects = [], polygonPoints, placedBuildings = [], selectedBuilding, selectedBuildingType, onPlaceBuilding, onDeleteBuilding, onMoveBuilding, selectedPlacedBuildingId = null, setSelectedPlacedBuildingId, joystickInput, lengthUnit = 'm', onCameraUpdate, buildingRotation = 0, snapInfo, onPointerMove, setbacksEnabled = false, setbackDistanceM = 0, placementValid = true, overlappingBuildingIds = new Set(), labels = {}, canEdit = true, analyticsMode = 'example', cameraMode, setCameraMode, followDistance, setFollowDistance, orbitEnabled, setOrbitEnabled, viewMode = 'firstPerson', fitToLandTrigger = 0, quality = QUALITY.BEST, comparisonPositions = {}, onComparisonPositionChange, comparisonRotations = {}, onComparisonRotationChange, gridSnapEnabled = false, gridSize = 1, walls = [], wallDrawingMode = false, setWallDrawingMode, wallDrawingPoints = [], setWallDrawingPoints, addWallFromPoints, openingPlacementMode = 'none', setOpeningPlacementMode, addOpeningToWall, activeBuildTool = 'none', setActiveBuildTool, selectedElement, setSelectedElement, BUILD_TOOLS = {}, deleteWall, doorWidth = 0.9, doorHeight = 2.1, doorType = 'single', windowWidth = 1.2, windowHeight = 1.2, windowSillHeight = 0.9, halfWallHeight = 1.2, fenceType = 'picket', rooms = [], floorPlanImage = null, floorPlanSettings = {}, buildings = [], floorPlanPlacementMode = false, pendingFloorPlan = null, buildingPreviewPosition = { x: 0, z: 0 }, setBuildingPreviewPosition, buildingPreviewRotation = 0, placeFloorPlanBuilding, selectedBuildingId = null, setSelectedBuildingId, moveSelectedBuilding, selectedComparisonId = null, setSelectedComparisonId, selectedRoomId = null, setSelectedRoomId, roomLabels = {}, roomStyles = {}, setRoomLabel, moveRoom, moveWallsByIds, commitWallsToHistory, setRoomPropertiesOpen, setWallPropertiesOpen, setFencePropertiesOpen, pools = [], addPool, deletePool, updatePool, poolPolygonPoints = [], setPoolPolygonPoints, poolDepth = 1.5, selectedPoolId = null, setSelectedPoolId, setPoolPropertiesOpen, foundations = [], addFoundation, deleteFoundation, updateFoundation, foundationPolygonPoints = [], setFoundationPolygonPoints, roomPolygonPoints = [], setRoomPolygonPoints, foundationHeight = 0.6, selectedFoundationId = null, setSelectedFoundationId, setFoundationPropertiesOpen, stairs = [], addStairs, deleteStairs, updateStairs, stairsStartPoint = null, setStairsStartPoint, stairsWidth = 1.0, stairsTopY = 2.7, stairsStyle = 'straight', selectedStairsId = null, setSelectedStairsId, setStairsPropertiesOpen, roofs = [], addRoof, deleteRoof, roofType = 'gable', roofPitch = 30, selectedRoofId = null, setSelectedRoofId, setRoofPropertiesOpen, onNPCInteract, wrapperActiveNPC, currentFloor = 0, floorHeight = 2.7, totalFloors = 1, addFloorsToRoom, mobileRunning = false, mobileJumpTrigger = 0, onNearbyNPCChange, onNearbyBuildingChange, timeOfDay = 0.35, setTimeOfDay, isPaidUser = false }) {
  const { camera, gl } = useThree()
  const [previewPos, setPreviewPos] = useState(null)
  const qualitySettings = QUALITY_SETTINGS[quality]

  // Refs for imperative day/night updates (no re-renders)
  const sunRef = useRef()
  const ambientRef = useRef()
  const fillRef = useRef()
  const fogRef = useRef()

  // Track if camera has been initialized to prevent re-positioning on subsequent renders
  const cameraInitialized = useRef(false)

  // Building drag state
  const [isDraggingBuilding, setIsDraggingBuilding] = useState(false)

  // Room move drag state - tracks which walls are being dragged and by how much (for visual offset)
  const [roomMoveDragState, setRoomMoveDragState] = useState({ wallIds: [], offset: { x: 0, z: 0 } })

  // Track which NPC is nearby for E key interaction
  const [nearbyNPC, setNearbyNPC] = useState(null)
  const nearbyNPCRef = useRef(null) // Ref for event handler closure
  const NPC_INTERACT_RANGE = 4 // meters

  // Compute wall colors based on room styles
  const wallColorMap = useMemo(() => {
    const colorMap = {} // { wallId: color }
    for (const room of rooms) {
      const style = roomStyles[room.id]
      if (style?.wallColor) {
        const wallIds = findWallsForRoom(room, walls)
        for (const wallId of wallIds) {
          colorMap[wallId] = style.wallColor
        }
      }
    }
    return colorMap
  }, [rooms, roomStyles, walls])

  // Snap guide lines for comparison objects
  const [comparisonSnapLines, setComparisonSnapLines] = useState([])

  // Calculate overlapping comparison objects
  const overlappingComparisonIds = useMemo(() => {
    const overlapping = new Set()
    if (comparisonObjects.length < 2) return overlapping

    for (let i = 0; i < comparisonObjects.length; i++) {
      const objA = comparisonObjects[i]
      const defaultXA = (i - (comparisonObjects.length - 1) / 2) * 15
      const posA = comparisonPositions[objA.id] || { x: defaultXA, z: 0 }
      const rotA = comparisonRotations[objA.id] || 0
      const boundsA = getObjectBounds(posA.x, posA.z, objA.width, objA.length, rotA)

      for (let j = i + 1; j < comparisonObjects.length; j++) {
        const objB = comparisonObjects[j]
        const defaultXB = (j - (comparisonObjects.length - 1) / 2) * 15
        const posB = comparisonPositions[objB.id] || { x: defaultXB, z: 0 }
        const rotB = comparisonRotations[objB.id] || 0
        const boundsB = getObjectBounds(posB.x, posB.z, objB.width, objB.length, rotB)

        if (checkOverlap(boundsA, boundsB)) {
          overlapping.add(objA.id)
          overlapping.add(objB.id)
        }
      }
    }
    return overlapping
  }, [comparisonObjects, comparisonPositions, comparisonRotations])

  // Player position, rotation, and velocity for mesh and minimap (updated by CameraController)
  const [playerState, setPlayerState] = useState({ position: { x: 0, y: 1.65, z: 0 }, rotation: 0, velocity: 0, moveType: 'idle' })

  // Compute land centroid for orbit target
  const orbitTarget = useMemo(() => {
    if (polygonPoints && polygonPoints.length >= 3) {
      const cx = polygonPoints.reduce((sum, p) => sum + p.x, 0) / polygonPoints.length
      const cz = polygonPoints.reduce((sum, p) => sum + (p.y ?? p.z), 0) / polygonPoints.length
      return new THREE.Vector3(cx, 1.5, cz)
    }
    return new THREE.Vector3(0, 1.5, 0)
  }, [polygonPoints])

  // Ref for OrbitControls to enable programmatic camera positioning
  const orbitControlsRef = useRef(null)

  // Compute land bounding box for fit-to-land
  const landBounds = useMemo(() => {
    if (polygonPoints && polygonPoints.length >= 3) {
      const xs = polygonPoints.map(p => p.x)
      const zs = polygonPoints.map(p => p.y ?? p.z)
      return {
        minX: Math.min(...xs),
        maxX: Math.max(...xs),
        minZ: Math.min(...zs),
        maxZ: Math.max(...zs)
      }
    }
    return {
      minX: -width / 2,
      maxX: width / 2,
      minZ: -length / 2,
      maxZ: length / 2
    }
  }, [polygonPoints, width, length])

  // Fit camera to land when trigger changes
  useEffect(() => {
    if (fitToLandTrigger === 0 || !orbitControlsRef.current) return
    if (viewMode !== 'orbit' && viewMode !== '2d') return

    const extentX = landBounds.maxX - landBounds.minX
    const extentZ = landBounds.maxZ - landBounds.minZ
    const maxExtent = Math.max(extentX, extentZ)

    if (viewMode === '2d') {
      // For orthographic camera, adjust zoom to fit land
      // Zoom = viewportSize / worldSize (approximately)
      const padding = 1.2 // 20% padding
      const targetZoom = Math.min(window.innerWidth, window.innerHeight) / (maxExtent * padding)
      camera.zoom = Math.max(1, Math.min(100, targetZoom))
      // Position camera directly above (MapControls polar angle lock handles orientation)
      camera.position.set(orbitTarget.x, 200, orbitTarget.z)
      camera.updateProjectionMatrix()
    } else {
      // For perspective camera in orbit mode
      const fov = camera.fov * (Math.PI / 180)
      const distance = (maxExtent * 1.1) / (2 * Math.tan(fov / 2))

      // Position camera above and back from target
      const angle = Math.PI / 4 // 45 degree angle
      camera.position.set(
        orbitTarget.x,
        orbitTarget.y + distance * Math.sin(angle),
        orbitTarget.z + distance * Math.cos(angle)
      )
      camera.lookAt(orbitTarget)
    }

    // Update controls
    if (orbitControlsRef.current.target) {
      if (orbitControlsRef.current.target.copy) {
        orbitControlsRef.current.target.copy(orbitTarget)
      } else {
        orbitControlsRef.current.target.set(orbitTarget.x, 0, orbitTarget.z)
      }
    }
    orbitControlsRef.current.update()
  }, [fitToLandTrigger, viewMode, landBounds, orbitTarget, camera])

  // Auto-fit when entering 2D mode
  const prevViewModeRef = useRef(viewMode)
  useEffect(() => {
    const prevMode = prevViewModeRef.current
    prevViewModeRef.current = viewMode

    // Only auto-fit when switching TO 2D mode (not already in 2D)
    if (viewMode === '2d' && prevMode !== '2d') {
      // Small delay to let camera switch happen first
      setTimeout(() => {
        const extentX = landBounds.maxX - landBounds.minX
        const extentZ = landBounds.maxZ - landBounds.minZ
        const maxExtent = Math.max(extentX, extentZ)
        const centerX = (landBounds.minX + landBounds.maxX) / 2
        const centerZ = (landBounds.minZ + landBounds.maxZ) / 2

        // Calculate zoom to fit land with padding
        const padding = 1.3 // 30% padding
        const targetZoom = Math.min(window.innerWidth, window.innerHeight) / (maxExtent * padding)
        camera.zoom = Math.max(1, Math.min(100, targetZoom))
        camera.position.set(centerX, 200, centerZ)
        camera.updateProjectionMatrix()

        if (orbitControlsRef.current) {
          orbitControlsRef.current.target.set(centerX, 0, centerZ)
          orbitControlsRef.current.update()
        }
      }, 50)
    }
  }, [viewMode, landBounds, camera])

  // Calculate NPC positions outside land boundary (recalculates when land changes)
  const npcPositions = useMemo(() => {
    return calculateNPCPositions(polygonPoints, length, width)
  }, [polygonPoints, length, width])

  // Check for nearby NPCs when player moves
  useEffect(() => {
    if (!npcPositions?.guide1?.position || !npcPositions?.guide2?.position) {
      setNearbyNPC(null)
      nearbyNPCRef.current = null
      return
    }
    if (viewMode === '2d' || wrapperActiveNPC) {
      setNearbyNPC(null)
      nearbyNPCRef.current = null
      return
    }

    const px = playerState.position.x
    const pz = playerState.position.z

    // Calculate distances to each NPC
    const dist1 = Math.sqrt(
      Math.pow(px - npcPositions.guide1.position.x, 2) +
      Math.pow(pz - npcPositions.guide1.position.z, 2)
    )
    const dist2 = Math.sqrt(
      Math.pow(px - npcPositions.guide2.position.x, 2) +
      Math.pow(pz - npcPositions.guide2.position.z, 2)
    )

    // Find closest NPC within range
    let nearby = null
    if (dist1 <= NPC_INTERACT_RANGE && dist1 <= dist2) {
      nearby = 'guide1'
    } else if (dist2 <= NPC_INTERACT_RANGE) {
      nearby = 'guide2'
    }
    setNearbyNPC(nearby)
    nearbyNPCRef.current = nearby
    onNearbyNPCChange?.(!!nearby)
  }, [playerState.position.x, playerState.position.z, npcPositions, viewMode, wrapperActiveNPC, NPC_INTERACT_RANGE, onNearbyNPCChange])

  // E key to interact with nearby NPC
  useEffect(() => {
    const handleKeyDown = (e) => {
      const key = e.key.toLowerCase()
      if (key === 'e' && nearbyNPCRef.current && !wrapperActiveNPC) {
        e.preventDefault()
        e.stopPropagation()
        onNPCInteract?.(nearbyNPCRef.current)
      }
      if (key === 'escape' && wrapperActiveNPC) {
        e.preventDefault()
        e.stopPropagation()
        onNPCInteract?.(null)
      }
    }
    document.addEventListener('keydown', handleKeyDown, true)
    return () => document.removeEventListener('keydown', handleKeyDown, true)
  }, [wrapperActiveNPC, onNPCInteract])

  // Mobile Talk trigger — uses DOM custom event (same pattern as E key handler above).
  // DOM events work reliably across R3F's Canvas reconciler boundary.
  useEffect(() => {
    const handler = () => {
      if (nearbyNPCRef.current && !wrapperActiveNPC) {
        onNPCInteract?.(nearbyNPCRef.current)
      }
    }
    window.addEventListener('mobileTalk', handler)
    return () => window.removeEventListener('mobileTalk', handler)
  }, [wrapperActiveNPC, onNPCInteract])

  // Track nearby placed building for mobile Use button
  const nearbyBuildingRef = useRef(null)
  const BUILDING_INTERACT_RANGE = 5 // meters

  // Building proximity check (runs on player movement — state is inside R3F reconciler)
  useEffect(() => {
    if (viewMode === '2d' || !placedBuildings.length) {
      nearbyBuildingRef.current = null
      onNearbyBuildingChange?.(false)
      return
    }
    const px = playerState.position.x
    const pz = playerState.position.z
    let closest = null
    let closestDist = BUILDING_INTERACT_RANGE
    for (const b of placedBuildings) {
      const dx = px - (b.position?.x ?? b.x ?? 0)
      const dz = pz - (b.position?.z ?? b.z ?? 0)
      const dist = Math.sqrt(dx * dx + dz * dz)
      if (dist < closestDist) {
        closestDist = dist
        closest = b
      }
    }
    nearbyBuildingRef.current = closest
    onNearbyBuildingChange?.(!!closest)
  }, [playerState.position.x, playerState.position.z, placedBuildings, viewMode, onNearbyBuildingChange])

  // Mobile Use trigger — DOM custom event
  useEffect(() => {
    const handler = () => {
      if (nearbyBuildingRef.current) {
        setSelectedPlacedBuildingId?.(nearbyBuildingRef.current.id)
      }
    }
    window.addEventListener('mobileUse', handler)
    return () => window.removeEventListener('mobileUse', handler)
  }, [setSelectedPlacedBuildingId])

  // Wall drawing state
  const [wallPreviewPos, setWallPreviewPos] = useState(null)
  const [shiftHeld, setShiftHeld] = useState(false)
  const [wallLengthInput, setWallLengthInput] = useState('') // For typing exact wall length
  const CLOSE_THRESHOLD = 1.0 // meters - snap to close loop when within this distance
  const ANGLE_SNAP_THRESHOLD = 0.15 // radians (~8.5°) - snap to 90° angles within this

  // Room tool state (click-drag rectangle)
  const [roomDragState, setRoomDragState] = useState({
    isDragging: false,
    startPoint: null,
    currentPoint: null
  })

  // Polygon room tool state (roomPolygonPoints/setRoomPolygonPoints come from props)
  const [roomPolygonCurrentPoint, setRoomPolygonCurrentPoint] = useState(null) // Preview point

  // Pool tool preview state (pools array and setPoolPolygonPoints come from props)
  const [poolPolygonCurrentPoint, setPoolPolygonCurrentPoint] = useState(null) // Preview point for pool drawing
  const [poolLengthInput, setPoolLengthInput] = useState('') // For typing exact pool segment length

  // Pool drag state for moving selected pools
  const [poolDragState, setPoolDragState] = useState({
    isDragging: false,
    startPoint: null,
    offset: { x: 0, z: 0 }
  })

  // Manual double-click tracking for pools (to avoid browser's persistent dblclick timing)
  const poolClickTracker = useRef({ lastClickTime: 0, lastPoolId: null })
  const POOL_DOUBLE_CLICK_THRESHOLD = 400 // ms

  // Reset click tracker when pool selection changes (e.g., after Escape closes properties)
  useEffect(() => {
    poolClickTracker.current = { lastClickTime: 0, lastPoolId: null }
  }, [selectedPoolId])

  // Foundation drag state for moving selected foundations
  const [foundationDragState, setFoundationDragState] = useState({
    isDragging: false,
    foundationId: null,
    startPoint: null,
    offset: { x: 0, z: 0 }
  })

  // Manual double-click tracking for foundations
  const foundationClickTracker = useRef({ lastClickTime: 0, lastFoundationId: null })
  const FOUNDATION_DOUBLE_CLICK_THRESHOLD = 400 // ms

  // Reset click tracker when foundation selection changes
  useEffect(() => {
    foundationClickTracker.current = { lastClickTime: 0, lastFoundationId: null }
  }, [selectedFoundationId])

  // Foundation tool preview state
  const [foundationPolygonCurrentPoint, setFoundationPolygonCurrentPoint] = useState(null)
  const [foundationLengthInput, setFoundationLengthInput] = useState('') // For typing exact segment length

  // Stairs preview state for hover preview
  const [stairsPreviewPos, setStairsPreviewPos] = useState(null) // { x, z } position

  // Stairs drag state for moving selected stairs
  const [stairsDragState, setStairsDragState] = useState({
    isDragging: false,
    stairsId: null,
    startPoint: null,
    offset: { x: 0, z: 0 }
  })

  // Manual double-click tracking for stairs
  const stairsClickTracker = useRef({ lastClickTime: 0, lastStairsId: null })
  const STAIRS_DOUBLE_CLICK_THRESHOLD = 400 // ms

  // Manual double-click tracking for roofs
  const roofClickTracker = useRef({ lastClickTime: 0, lastRoofId: null })
  const ROOF_DOUBLE_CLICK_THRESHOLD = 400 // ms

  // Opening (door/window) hover preview state
  const [openingHover, setOpeningHover] = useState({
    wall: null,           // The wall being hovered
    positionOnWall: 0,    // Distance along wall from start
    isValid: false        // Whether placement is valid
  })

  // Wall tool mode - combines legacy wallDrawingMode and new activeBuildTool (includes half walls and fences)
  const isWallMode = wallDrawingMode || activeBuildTool === BUILD_TOOLS.WALL || activeBuildTool === BUILD_TOOLS.HALF_WALL || activeBuildTool === BUILD_TOOLS.FENCE
  const isHalfWallMode = activeBuildTool === BUILD_TOOLS.HALF_WALL
  const isFenceMode = activeBuildTool === BUILD_TOOLS.FENCE

  // Effective opening mode - combines legacy openingPlacementMode and new activeBuildTool
  const effectiveOpeningMode = useMemo(() => {
    if (activeBuildTool === BUILD_TOOLS.DOOR) return 'door'
    if (activeBuildTool === BUILD_TOOLS.WINDOW) return 'window'
    return openingPlacementMode
  }, [activeBuildTool, openingPlacementMode, BUILD_TOOLS])

  // Track shift key for angle snap override
  useEffect(() => {
    const handleKeyDown = (e) => { if (e.key === 'Shift') setShiftHeld(true) }
    const handleKeyUp = (e) => { if (e.key === 'Shift') setShiftHeld(false) }
    window.addEventListener('keydown', handleKeyDown)
    window.addEventListener('keyup', handleKeyUp)
    return () => {
      window.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('keyup', handleKeyUp)
    }
  }, [])

  // Synchronously disable OrbitControls when build tool is active
  // This runs during React's commit phase, before any new events can be processed
  useEffect(() => {
    if (orbitControlsRef.current) {
      const shouldBeEnabled = (activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS) && !roomDragState.isDragging && !poolDragState.isDragging && !foundationDragState.isDragging && !stairsDragState.isDragging && !selectedBuildingId && !floorPlanPlacementMode && !selectedComparisonId && !selectedRoomId && !selectedPlacedBuildingId
      orbitControlsRef.current.enabled = shouldBeEnabled
    }
  }, [activeBuildTool, roomDragState.isDragging, poolDragState.isDragging, foundationDragState.isDragging, stairsDragState.isDragging, selectedBuildingId, floorPlanPlacementMode, selectedComparisonId, selectedRoomId, selectedPlacedBuildingId, BUILD_TOOLS])

  // Unified snap constants
  const SNAP_THRESHOLD = {
    corner: 0.8,    // Snap to corners/endpoints
    edge: 0.5,      // Snap to wall edges
    grid: 0.3,      // Grid snap threshold
  }

  // Snap point for wall drawing (corners, edges, buildings, angles, grid)
  const snapWallPoint = useCallback((rawPoint, lastPoint) => {
    let point = { ...rawPoint }
    let snapInfo = { type: 'none', point: null }

    // 1. Snap to existing wall corners (highest priority)
    for (const wall of walls) {
      for (const corner of [wall.start, wall.end]) {
        const dx = point.x - corner.x
        const dz = point.z - corner.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < SNAP_THRESHOLD.corner) {
          return { x: corner.x, z: corner.z, snapType: 'corner', snapPoint: corner }
        }
      }
    }

    // 2. Snap to building wall corners
    for (const building of buildings) {
      const cos = Math.cos(building.rotation || 0)
      const sin = Math.sin(building.rotation || 0)
      for (const bWall of (building.walls || [])) {
        for (const corner of [bWall.start, bWall.end]) {
          // Transform building-local coords to world coords
          const worldX = building.position.x + corner.x * cos - corner.z * sin
          const worldZ = building.position.z + corner.x * sin + corner.z * cos
          const dx = point.x - worldX
          const dz = point.z - worldZ
          const dist = Math.sqrt(dx * dx + dz * dz)
          if (dist < SNAP_THRESHOLD.corner) {
            return { x: worldX, z: worldZ, snapType: 'corner', snapPoint: { x: worldX, z: worldZ } }
          }
        }
      }
    }

    // 3. Snap to drawing points (current wall chain)
    for (const dp of wallDrawingPoints) {
      const dx = point.x - dp.x
      const dz = point.z - dp.z
      if (Math.sqrt(dx * dx + dz * dz) < SNAP_THRESHOLD.corner) {
        return { x: dp.x, z: dp.z, snapType: 'corner', snapPoint: dp }
      }
    }

    // 4. Snap to wall edges (perpendicular projection)
    for (const wall of walls) {
      const wallDx = wall.end.x - wall.start.x
      const wallDz = wall.end.z - wall.start.z
      const wallLen = Math.sqrt(wallDx * wallDx + wallDz * wallDz)
      if (wallLen < 0.01) continue

      // Project point onto wall line
      const t = Math.max(0, Math.min(1,
        ((point.x - wall.start.x) * wallDx + (point.z - wall.start.z) * wallDz) / (wallLen * wallLen)
      ))
      const projX = wall.start.x + t * wallDx
      const projZ = wall.start.z + t * wallDz

      const dx = point.x - projX
      const dz = point.z - projZ
      const dist = Math.sqrt(dx * dx + dz * dz)

      if (dist < SNAP_THRESHOLD.edge && t > 0.01 && t < 0.99) {
        return { x: projX, z: projZ, snapType: 'edge', snapPoint: { x: projX, z: projZ } }
      }
    }

    // 5. 45° angle snap when Shift is held
    if (lastPoint && shiftHeld) {
      const dx = point.x - lastPoint.x
      const dz = point.z - lastPoint.z
      const angle = Math.atan2(dx, dz)
      const length = Math.sqrt(dx * dx + dz * dz)

      // Snap to nearest 45° (0°, 45°, 90°, 135°, 180°, -135°, -90°, -45°)
      const snapAngles = [
        0,                    // 0° (North)
        Math.PI / 4,          // 45° (NE)
        Math.PI / 2,          // 90° (East)
        (3 * Math.PI) / 4,    // 135° (SE)
        Math.PI,              // 180° (South)
        -(3 * Math.PI) / 4,   // -135° (SW)
        -Math.PI / 2,         // -90° (West)
        -Math.PI / 4,         // -45° (NW)
      ]

      // Find the nearest snap angle
      let nearestAngle = snapAngles[0]
      let minDiff = Math.abs(angle - nearestAngle)
      for (const snapAngle of snapAngles) {
        const diff = Math.abs(angle - snapAngle)
        if (diff < minDiff) {
          minDiff = diff
          nearestAngle = snapAngle
        }
      }

      // Always snap when shift is held
      point = {
        x: lastPoint.x + Math.sin(nearestAngle) * length,
        z: lastPoint.z + Math.cos(nearestAngle) * length
      }
      snapInfo = { type: 'angle', point }
    }

    // 6. Grid snap (lowest priority)
    if (gridSnapEnabled) {
      point = {
        x: Math.round(point.x / gridSize) * gridSize,
        z: Math.round(point.z / gridSize) * gridSize
      }
      snapInfo = { type: 'grid', point }
    }

    return { ...point, snapType: snapInfo.type, snapPoint: snapInfo.point }
  }, [walls, buildings, wallDrawingPoints, shiftHeld, gridSnapEnabled, gridSize])

  // Track snap indicator for wall/fence/room drawing
  const [wallSnapIndicator, setWallSnapIndicator] = useState(null) // { x, z, type: 'corner' | 'edge' | 'grid' }
  const [roomSnapIndicator, setRoomSnapIndicator] = useState(null) // { x, z, type: 'corner' | 'edge' | 'grid' }

  // Snap point for room tool - check wall/building endpoints, edges, then grid
  const snapRoomPoint = useCallback((rawPoint) => {
    let point = { x: rawPoint.x, z: rawPoint.z }

    // 1. Check wall endpoints (highest priority)
    for (const wall of walls) {
      for (const endpoint of [wall.start, wall.end]) {
        const dist = Math.sqrt(
          Math.pow(point.x - endpoint.x, 2) + Math.pow(point.z - endpoint.z, 2)
        )
        if (dist < SNAP_THRESHOLD.corner) {
          setRoomSnapIndicator({ x: endpoint.x, z: endpoint.z, type: 'corner' })
          return { x: endpoint.x, z: endpoint.z }
        }
      }
    }

    // 2. Check building wall corners
    for (const building of buildings) {
      const cos = Math.cos(building.rotation || 0)
      const sin = Math.sin(building.rotation || 0)
      for (const bWall of (building.walls || [])) {
        for (const corner of [bWall.start, bWall.end]) {
          const worldX = building.position.x + corner.x * cos - corner.z * sin
          const worldZ = building.position.z + corner.x * sin + corner.z * cos
          const dist = Math.sqrt(Math.pow(point.x - worldX, 2) + Math.pow(point.z - worldZ, 2))
          if (dist < SNAP_THRESHOLD.corner) {
            setRoomSnapIndicator({ x: worldX, z: worldZ, type: 'corner' })
            return { x: worldX, z: worldZ }
          }
        }
      }
    }

    // 3. Check wall edges (perpendicular projection)
    for (const wall of walls) {
      const wallDx = wall.end.x - wall.start.x
      const wallDz = wall.end.z - wall.start.z
      const wallLen = Math.sqrt(wallDx * wallDx + wallDz * wallDz)
      if (wallLen < 0.01) continue

      const t = Math.max(0, Math.min(1,
        ((point.x - wall.start.x) * wallDx + (point.z - wall.start.z) * wallDz) / (wallLen * wallLen)
      ))
      const projX = wall.start.x + t * wallDx
      const projZ = wall.start.z + t * wallDz
      const dist = Math.sqrt(Math.pow(point.x - projX, 2) + Math.pow(point.z - projZ, 2))

      if (dist < SNAP_THRESHOLD.edge && t > 0.01 && t < 0.99) {
        setRoomSnapIndicator({ x: projX, z: projZ, type: 'edge' })
        return { x: projX, z: projZ }
      }
    }

    // 4. Grid snapping (fallback)
    if (gridSnapEnabled) {
      point = {
        x: Math.round(point.x / gridSize) * gridSize,
        z: Math.round(point.z / gridSize) * gridSize
      }
      setRoomSnapIndicator({ x: point.x, z: point.z, type: 'grid' })
    } else {
      setRoomSnapIndicator(null)
    }

    return point
  }, [walls, buildings, gridSnapEnabled, gridSize, SNAP_THRESHOLD])

  // Snap point to nearest 45° angle relative to lastPoint (when Shift is held)
  const snapToAngle = useCallback((point, lastPoint) => {
    if (!lastPoint) return point
    const dx = point.x - lastPoint.x
    const dz = point.z - lastPoint.z
    const length = Math.sqrt(dx * dx + dz * dz)
    if (length < 0.01) return point
    const angle = Math.atan2(dx, dz)
    const snapAngles = [0, Math.PI / 4, Math.PI / 2, (3 * Math.PI) / 4, Math.PI, -(3 * Math.PI) / 4, -Math.PI / 2, -Math.PI / 4]
    let nearest = snapAngles[0]
    let minDiff = Math.abs(angle - nearest)
    for (const sa of snapAngles) {
      const diff = Math.abs(angle - sa)
      if (diff < minDiff) { minDiff = diff; nearest = sa }
    }
    return { x: lastPoint.x + Math.sin(nearest) * length, z: lastPoint.z + Math.cos(nearest) * length }
  }, [])

  // Handle room tool click (click-move-click pattern)
  // First click: set start point, Second click: finish room
  const handleRoomPointerDown = (e) => {
    if (activeBuildTool !== BUILD_TOOLS.ROOM) return
    e.stopPropagation()
    const point = snapRoomPoint(e.point)

    if (!roomDragState.isDragging) {
      // First click - start drawing
      setRoomDragState({
        isDragging: true,
        startPoint: point,
        currentPoint: point
      })
    } else {
      // Second click - finish room
      const { startPoint } = roomDragState
      const currentPoint = point // Use clicked point as final point

      if (startPoint && currentPoint) {
        const minX = Math.min(startPoint.x, currentPoint.x)
        const maxX = Math.max(startPoint.x, currentPoint.x)
        const minZ = Math.min(startPoint.z, currentPoint.z)
        const maxZ = Math.max(startPoint.z, currentPoint.z)

        const width = maxX - minX
        const height = maxZ - minZ

        // Only create if big enough (at least 0.5m on each side)
        if (width >= 0.5 && height >= 0.5) {
          const corners = [
            { x: minX, z: minZ },
            { x: maxX, z: minZ },
            { x: maxX, z: maxZ },
            { x: minX, z: maxZ },
            { x: minX, z: minZ },
          ]
          addWallFromPoints?.(corners)
        }
      }

      // Reset drag state and snap indicator
      setRoomDragState({
        isDragging: false,
        startPoint: null,
        currentPoint: null
      })
      setRoomSnapIndicator(null)
    }
  }

  // Handle pointer up (only for building drag, not room drawing)
  const handleRoomPointerUp = (e) => {
    // End building drag
    if (isDraggingBuilding) {
      setIsDraggingBuilding(false)
    }
    // Room drawing now uses click-move-click, not click-drag
  }

  // Polygon room tool - click handler
  const POLYGON_CLOSE_DISTANCE = 0.5 // 50cm to close polygon
  const handlePolygonClick = (e) => {
    if (activeBuildTool !== BUILD_TOOLS.POLYGON_ROOM) return
    e.stopPropagation()

    let point = snapRoomPoint(e.point)
    if (shiftHeld && roomPolygonPoints.length > 0) {
      point = snapToAngle(point, roomPolygonPoints[roomPolygonPoints.length - 1])
    }

    // Check if clicking near first point to close polygon
    if (roomPolygonPoints.length >= 3) {
      const firstPoint = roomPolygonPoints[0]
      const dist = Math.sqrt(
        Math.pow(point.x - firstPoint.x, 2) + Math.pow(point.z - firstPoint.z, 2)
      )
      if (dist < POLYGON_CLOSE_DISTANCE) {
        // Close the polygon - create walls and exit tool
        const closedPoints = [...roomPolygonPoints, roomPolygonPoints[0]]
        addWallFromPoints?.(closedPoints)
        setRoomPolygonPoints([])
        setRoomPolygonCurrentPoint(null)
        setRoomSnapIndicator(null)
        setActiveBuildTool?.(BUILD_TOOLS.NONE)
        return
      }
    }

    // Add point to polygon
    setRoomPolygonPoints(prev => [...prev, point])
  }

  // Pool tool - click handler (follows polygon pattern)
  const POOL_CLOSE_DISTANCE = 0.5 // 50cm to close polygon
  const handlePoolClick = (e) => {
    if (activeBuildTool !== BUILD_TOOLS.POOL) return
    e.stopPropagation()

    let point = snapRoomPoint(e.point) // Use same snap logic
    if (shiftHeld && poolPolygonPoints.length > 0) {
      point = snapToAngle(point, poolPolygonPoints[poolPolygonPoints.length - 1])
    }

    // If user typed a length, use that exact length in the direction of click
    if (poolLengthInput && poolPolygonPoints.length > 0) {
      const typedLength = parseFloat(poolLengthInput)
      if (typedLength > 0 && typedLength <= 100) {
        const lastPoint = poolPolygonPoints[poolPolygonPoints.length - 1]
        const dx = point.x - lastPoint.x
        const dz = point.z - lastPoint.z
        const clickDist = Math.sqrt(dx * dx + dz * dz)
        if (clickDist > 0) {
          // Normalize direction and apply typed length
          const dirX = dx / clickDist
          const dirZ = dz / clickDist
          point = {
            x: lastPoint.x + dirX * typedLength,
            z: lastPoint.z + dirZ * typedLength
          }
        }
        // Clear the typed length after use
        setPoolLengthInput('')
      }
    }

    // Check if clicking near first point to close polygon
    if (poolPolygonPoints.length >= 3) {
      const firstPoint = poolPolygonPoints[0]
      const dist = Math.sqrt(
        Math.pow(point.x - firstPoint.x, 2) + Math.pow(point.z - firstPoint.z, 2)
      )
      if (dist < POOL_CLOSE_DISTANCE) {
        // Close the polygon - create pool and exit tool
        addPool?.(poolPolygonPoints)
        setPoolPolygonPoints([])
        setPoolPolygonCurrentPoint(null)
        setPoolLengthInput('')
        setActiveBuildTool?.(BUILD_TOOLS.NONE)
        return
      }
    }

    // Add point to polygon
    setPoolPolygonPoints(prev => [...prev, point])
  }

  // Foundation tool - click handler (follows polygon pattern)
  const FOUNDATION_CLOSE_DISTANCE = 0.5
  const handleFoundationClick = (e) => {
    if (activeBuildTool !== BUILD_TOOLS.FOUNDATION) return
    e.stopPropagation()

    let point = snapRoomPoint(e.point)
    if (shiftHeld && foundationPolygonPoints.length > 0) {
      point = snapToAngle(point, foundationPolygonPoints[foundationPolygonPoints.length - 1])
    }

    // If user typed a length, use that exact length in the direction of click
    if (foundationLengthInput && foundationPolygonPoints.length > 0) {
      const typedLength = parseFloat(foundationLengthInput)
      if (typedLength > 0 && typedLength <= 100) {
        const lastPoint = foundationPolygonPoints[foundationPolygonPoints.length - 1]
        const dx = point.x - lastPoint.x
        const dz = point.z - lastPoint.z
        const clickDist = Math.sqrt(dx * dx + dz * dz)
        if (clickDist > 0) {
          // Normalize direction and apply typed length
          const dirX = dx / clickDist
          const dirZ = dz / clickDist
          point = {
            x: lastPoint.x + dirX * typedLength,
            z: lastPoint.z + dirZ * typedLength
          }
        }
        // Clear the typed length after use
        setFoundationLengthInput('')
      }
    }

    // Check if clicking near first point to close polygon
    if (foundationPolygonPoints.length >= 3) {
      const firstPoint = foundationPolygonPoints[0]
      const dist = Math.sqrt(
        Math.pow(point.x - firstPoint.x, 2) + Math.pow(point.z - firstPoint.z, 2)
      )
      if (dist < FOUNDATION_CLOSE_DISTANCE) {
        // Close the polygon - create foundation and exit tool
        addFoundation?.(foundationPolygonPoints)
        setFoundationPolygonPoints([])
        setFoundationPolygonCurrentPoint(null)
        setFoundationLengthInput('')
        setActiveBuildTool?.(BUILD_TOOLS.NONE)
        return
      }
    }

    setFoundationPolygonPoints(prev => [...prev, point])
  }

  // Stairs tool - click handler (single-click preset placement)
  const handleStairsClick = (e) => {
    if (activeBuildTool !== BUILD_TOOLS.STAIRS) return
    e.stopPropagation()

    const point = snapRoomPoint(e.point)

    // Detect nearby foundation height
    let nearbyFoundationHeight = null
    const searchRadius = 3 // meters to search for nearby foundations

    for (const foundation of foundations) {
      if (!foundation.points || foundation.points.length < 3) continue
      // Check if click is near the foundation
      for (const fp of foundation.points) {
        const dist = Math.sqrt((fp.x - point.x) ** 2 + (fp.z - point.z) ** 2)
        if (dist < searchRadius) {
          nearbyFoundationHeight = foundation.height || 0.6
          break
        }
      }
      if (nearbyFoundationHeight) break
    }

    // Single click places stairs with detected or default height
    addStairs?.(point, nearbyFoundationHeight)
  }

  // Stairs tool - move handler for preview
  const handleStairsMove = (e) => {
    if (activeBuildTool !== BUILD_TOOLS.STAIRS) return
    const point = snapRoomPoint(e.point)
    setStairsPreviewPos({ x: point.x, z: point.z })
  }

  // Roof tool - click handler (click on room to add roof)
  const handleRoofClick = (e, roomId) => {
    if (activeBuildTool !== BUILD_TOOLS.ROOF) return
    if (!roomId) return
    e.stopPropagation()

    // Check if room already has a roof
    const existingRoof = roofs.find(r => r.roomId === roomId)
    if (existingRoof) {
      // Select existing roof
      setSelectedRoofId?.(existingRoof.id)
      return
    }

    // Add roof to room
    addRoof?.(roomId)
  }

  const handleLandClick = (e) => {
    e.stopPropagation()
    const point = e.point

    // Check if click was on a comparison object - if so, don't handle here
    // (ComparisonObject's onPointerDown will handle it)
    if (e.intersections && e.intersections.length > 1) {
      // Multiple objects hit - check if any is above the land (y > 0.01)
      const hasObjectAboveLand = e.intersections.some(int => int.point && int.point.y > 0.01)
      if (hasObjectAboveLand) {
        return // Let the other object handle this click
      }
    }

    // Floor plan placement mode - place building on click
    if (floorPlanPlacementMode && placeFloorPlanBuilding) {
      const pos = gridSnapEnabled
        ? { x: Math.round(point.x / gridSize) * gridSize, z: Math.round(point.z / gridSize) * gridSize }
        : { x: point.x, z: point.z }
      placeFloorPlanBuilding(pos)
      return
    }

    // End building drag on click (if was dragging)
    if (isDraggingBuilding) {
      setIsDraggingBuilding(false)
      return
    }

    // Deselect placed building when clicking on empty land
    if (selectedPlacedBuildingId) {
      setSelectedPlacedBuildingId?.(null)
      return
    }

    // Deselect floor plan building when clicking on empty land
    if (selectedBuildingId && !isDraggingBuilding) {
      setSelectedBuildingId(null)
      return
    }

    // Deselect comparison object when clicking on empty land
    if (selectedComparisonId) {
      setSelectedComparisonId?.(null)
      return
    }

    // Deselect room when clicking on empty land
    if (selectedRoomId) {
      setSelectedRoomId?.(null)
      return
    }

    // Deselect roof when clicking on empty land
    if (selectedRoofId) {
      setSelectedRoofId?.(null)
      return
    }

    // Room tool uses pointer down/up, not click
    if (activeBuildTool === BUILD_TOOLS.ROOM) return

    // Polygon room tool - handle via handlePolygonClick
    if (activeBuildTool === BUILD_TOOLS.POLYGON_ROOM) {
      handlePolygonClick(e)
      return
    }

    // Pool tool - handle via handlePoolClick
    if (activeBuildTool === BUILD_TOOLS.POOL) {
      handlePoolClick(e)
      return
    }

    // Foundation tool - handle via handleFoundationClick
    if (activeBuildTool === BUILD_TOOLS.FOUNDATION) {
      handleFoundationClick(e)
      return
    }

    // Stairs tool - handle via handleStairsClick
    if (activeBuildTool === BUILD_TOOLS.STAIRS) {
      handleStairsClick(e)
      return
    }

    // Wall drawing mode takes priority (legacy mode or Wall tool)
    if (isWallMode && setWallDrawingPoints) {
      const lastPoint = wallDrawingPoints.length > 0 ? wallDrawingPoints[wallDrawingPoints.length - 1] : null
      let newPoint = snapWallPoint({ x: point.x, z: point.z }, lastPoint)

      // If user typed a length, use that exact length in the direction of click
      if (wallLengthInput && lastPoint) {
        const typedLength = parseFloat(wallLengthInput)
        if (typedLength > 0 && typedLength <= 100) {
          const dx = newPoint.x - lastPoint.x
          const dz = newPoint.z - lastPoint.z
          const clickDist = Math.sqrt(dx * dx + dz * dz)
          if (clickDist > 0) {
            // Normalize direction and apply typed length
            const dirX = dx / clickDist
            const dirZ = dz / clickDist
            newPoint = {
              x: lastPoint.x + dirX * typedLength,
              z: lastPoint.z + dirZ * typedLength
            }
          }
          // Clear the typed length after use
          setWallLengthInput('')
        }
      }

      // Check if close to starting point (close loop)
      if (wallDrawingPoints.length >= 3) {
        const start = wallDrawingPoints[0]
        const dx = newPoint.x - start.x
        const dz = newPoint.z - start.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < CLOSE_THRESHOLD) {
          // Close the loop - add starting point again and finish
          const closedPoints = [...wallDrawingPoints, start]
          const wallHeight = isFenceMode ? 1.0 : (isHalfWallMode ? halfWallHeight : 2.7)
          addWallFromPoints?.(closedPoints, wallHeight, isFenceMode, fenceType)
          setWallDrawingPoints([])
          setWallDrawingMode?.(false)
          return
        }
      }

      // Add point to drawing
      setWallDrawingPoints([...wallDrawingPoints, newPoint])
      return
    }

    // Opening placement mode (door/window)
    if (effectiveOpeningMode !== 'none' && addOpeningToWall && walls.length > 0) {
      const clickPoint = { x: point.x, z: point.z }

      // Find nearest wall to click point
      let nearestWall = null
      let nearestDist = Infinity
      let nearestPosOnWall = 0

      for (const wall of walls) {
        const { start, end } = wall
        const wdx = end.x - start.x
        const wdz = end.z - start.z
        const wallLen = Math.sqrt(wdx * wdx + wdz * wdz)
        if (wallLen < 0.01) continue

        // Project click point onto wall line
        const t = Math.max(0, Math.min(1,
          ((clickPoint.x - start.x) * wdx + (clickPoint.z - start.z) * wdz) / (wallLen * wallLen)
        ))
        const closestX = start.x + t * wdx
        const closestZ = start.z + t * wdz
        const dist = Math.sqrt((clickPoint.x - closestX) ** 2 + (clickPoint.z - closestZ) ** 2)

        if (dist < nearestDist) {
          nearestDist = dist
          nearestWall = wall
          nearestPosOnWall = t * wallLen // Distance from wall start
        }
      }

      // Only place if click is close enough to a wall (within 1m)
      if (nearestWall && nearestDist < 1.0) {
        const wallLen = Math.sqrt(
          (nearestWall.end.x - nearestWall.start.x) ** 2 +
          (nearestWall.end.z - nearestWall.start.z) ** 2
        )

        // Opening specs - use props for size
        const isDoor = effectiveOpeningMode === 'door'
        const openingWidth = isDoor ? doorWidth : windowWidth
        const openingHeight = isDoor ? doorHeight : windowHeight
        const sillHeight = isDoor ? 0 : windowSillHeight
        const MIN_EDGE_DIST = 0.3

        // Validate placement
        const halfWidth = openingWidth / 2
        if (nearestPosOnWall - halfWidth < MIN_EDGE_DIST) {
          // Too close to start
          return
        }
        if (nearestPosOnWall + halfWidth > wallLen - MIN_EDGE_DIST) {
          // Too close to end
          return
        }

        // Check for overlap with existing openings
        const existingOpenings = nearestWall.openings || []
        for (const existing of existingOpenings) {
          const existingStart = existing.position - existing.width / 2
          const existingEnd = existing.position + existing.width / 2
          const newStart = nearestPosOnWall - halfWidth
          const newEnd = nearestPosOnWall + halfWidth
          if (!(newEnd < existingStart || newStart > existingEnd)) {
            // Overlapping
            return
          }
        }

        // Create opening
        const opening = {
          id: `${effectiveOpeningMode}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
          type: effectiveOpeningMode,
          position: nearestPosOnWall,
          width: openingWidth,
          height: openingHeight,
          sillHeight: sillHeight,
          ...(isDoor && { doorType }), // Include doorType for doors
        }

        addOpeningToWall(nearestWall.id, opening)
      }
      return
    }

    // Normal building placement
    if (!selectedBuilding || !onPlaceBuilding) return
    onPlaceBuilding({ x: point.x, z: point.z })
  }

  const handlePointerMove = (e) => {
    e.stopPropagation()
    const point = e.point

    // Floor plan placement mode - update preview position
    if (floorPlanPlacementMode && setBuildingPreviewPosition) {
      const pos = gridSnapEnabled
        ? { x: Math.round(point.x / gridSize) * gridSize, z: Math.round(point.z / gridSize) * gridSize }
        : { x: point.x, z: point.z }
      setBuildingPreviewPosition(pos)
    }

    // Building drag - move selected building while dragging
    if (isDraggingBuilding && selectedBuildingId && moveSelectedBuilding) {
      const pos = gridSnapEnabled
        ? { x: Math.round(point.x / gridSize) * gridSize, z: Math.round(point.z / gridSize) * gridSize }
        : { x: point.x, z: point.z }
      moveSelectedBuilding(pos)
      return
    }

    // Room tool drag preview
    if (roomDragState.isDragging && activeBuildTool === BUILD_TOOLS.ROOM) {
      const snappedPoint = snapRoomPoint(point)
      setRoomDragState(prev => ({
        ...prev,
        currentPoint: snappedPoint
      }))
      return
    }

    // Polygon room tool preview
    if (activeBuildTool === BUILD_TOOLS.POLYGON_ROOM && roomPolygonPoints.length > 0) {
      let snappedPoint = snapRoomPoint(point)
      if (shiftHeld) snappedPoint = snapToAngle(snappedPoint, roomPolygonPoints[roomPolygonPoints.length - 1])
      setRoomPolygonCurrentPoint(snappedPoint)
      return
    }

    // Pool tool preview
    if (activeBuildTool === BUILD_TOOLS.POOL && poolPolygonPoints.length > 0) {
      let snappedPoint = snapRoomPoint(point)
      if (shiftHeld) snappedPoint = snapToAngle(snappedPoint, poolPolygonPoints[poolPolygonPoints.length - 1])
      setPoolPolygonCurrentPoint(snappedPoint)
      return
    }

    // Foundation tool preview
    if (activeBuildTool === BUILD_TOOLS.FOUNDATION && foundationPolygonPoints.length > 0) {
      let snappedPoint = snapRoomPoint(point)
      if (shiftHeld) snappedPoint = snapToAngle(snappedPoint, foundationPolygonPoints[foundationPolygonPoints.length - 1])
      setFoundationPolygonCurrentPoint(snappedPoint)
      return
    }

    // Stairs preview
    if (activeBuildTool === BUILD_TOOLS.STAIRS) {
      const snappedPoint = snapRoomPoint(point)
      setStairsPreviewPos({ x: snappedPoint.x, z: snappedPoint.z })
    }

    // Wall drawing preview (with snapping)
    if (isWallMode) {
      const lastPoint = wallDrawingPoints.length > 0 ? wallDrawingPoints[wallDrawingPoints.length - 1] : null
      const snappedPoint = snapWallPoint({ x: point.x, z: point.z }, lastPoint)
      setWallPreviewPos(snappedPoint)
      // Update snap indicator
      if (snappedPoint.snapType && snappedPoint.snapType !== 'none') {
        setWallSnapIndicator({ x: snappedPoint.x, z: snappedPoint.z, type: snappedPoint.snapType })
      } else {
        setWallSnapIndicator(null)
      }
    } else {
      setWallSnapIndicator(null)
    }

    // Opening (door/window) hover preview
    if (effectiveOpeningMode !== 'none' && walls.length > 0) {
      const hoverPoint = { x: point.x, z: point.z }
      let nearestWall = null
      let nearestDist = Infinity
      let nearestPosOnWall = 0

      for (const wall of walls) {
        const wallLen = getWallLength(wall)
        if (wallLen < 0.01) continue

        const dx = wall.end.x - wall.start.x
        const dz = wall.end.z - wall.start.z
        const t = Math.max(0, Math.min(1,
          ((hoverPoint.x - wall.start.x) * dx + (hoverPoint.z - wall.start.z) * dz) / (wallLen * wallLen)
        ))
        const closestX = wall.start.x + t * dx
        const closestZ = wall.start.z + t * dz
        const dist = Math.sqrt((hoverPoint.x - closestX) ** 2 + (hoverPoint.z - closestZ) ** 2)

        if (dist < nearestDist) {
          nearestDist = dist
          nearestWall = wall
          nearestPosOnWall = t * wallLen
        }
      }

      // Only show preview within snap distance (1.5m)
      const OPENING_SNAP_DISTANCE = 1.5
      if (nearestWall && nearestDist < OPENING_SNAP_DISTANCE) {
        const openingWidth = effectiveOpeningMode === 'door' ? doorWidth : windowWidth
        const validation = isValidOpeningPlacement(
          nearestWall,
          nearestPosOnWall,
          openingWidth,
          nearestWall.openings || []
        )
        setOpeningHover({
          wall: nearestWall,
          positionOnWall: nearestPosOnWall,
          isValid: validation.valid
        })
      } else {
        // Too far from any wall - hide preview
        setOpeningHover({ wall: null, positionOnWall: 0, isValid: false })
      }
    } else {
      // Not in opening mode - clear hover state
      if (openingHover.wall !== null) {
        setOpeningHover({ wall: null, positionOnWall: 0, isValid: false })
      }
    }

    // Building placement preview
    if (!selectedBuilding) {
      setPreviewPos(null)
      return
    }
    setPreviewPos({ x: point.x, z: point.z })
    if (onPointerMove) {
      onPointerMove({ x: point.x, z: point.z })
    }
  }

  const handlePointerLeave = () => {
    setPreviewPos(null)
    setWallPreviewPos(null)
    setOpeningHover({ wall: null, positionOnWall: 0, isValid: false })
    setIsDraggingBuilding(false)
  }

  // Keyboard handler for wall drawing (Escape, number input for length)
  useEffect(() => {
    if (!isWallMode) return

    const handleKeyDown = (e) => {
      // Escape to finish/cancel
      if (e.key === 'Escape') {
        // Finish drawing - create walls from current points
        if (wallDrawingPoints.length >= 2) {
          const wallHeight = isFenceMode ? 1.0 : (isHalfWallMode ? halfWallHeight : 2.7)
          addWallFromPoints?.(wallDrawingPoints, wallHeight, isFenceMode, fenceType)
        }
        setWallDrawingPoints?.([])
        setWallDrawingMode?.(false)
        setWallLengthInput('')
        // Also reset wall tool
        if (activeBuildTool === BUILD_TOOLS.WALL || activeBuildTool === BUILD_TOOLS.HALF_WALL || activeBuildTool === BUILD_TOOLS.FENCE) {
          setActiveBuildTool?.(BUILD_TOOLS.NONE)
        }
        return
      }

      // Only handle number input when we have at least one point placed
      if (wallDrawingPoints.length === 0) return

      // Number keys (0-9) and decimal point
      if (/^[0-9]$/.test(e.key)) {
        e.preventDefault()
        setWallLengthInput(prev => prev + e.key)
        return
      }
      if (e.key === '.' && !wallLengthInput.includes('.')) {
        e.preventDefault()
        setWallLengthInput(prev => prev + '.')
        return
      }

      // Backspace to delete last character
      if (e.key === 'Backspace' && wallLengthInput.length > 0) {
        e.preventDefault()
        setWallLengthInput(prev => prev.slice(0, -1))
        return
      }

      // Enter to confirm length and place point
      if (e.key === 'Enter' && wallLengthInput.length > 0 && wallPreviewPos) {
        e.preventDefault()
        const length = parseFloat(wallLengthInput)
        if (length > 0 && length <= 100) { // Max 100m wall segment
          const lastPoint = wallDrawingPoints[wallDrawingPoints.length - 1]
          const dx = wallPreviewPos.x - lastPoint.x
          const dz = wallPreviewPos.z - lastPoint.z
          const currentLength = Math.sqrt(dx * dx + dz * dz)

          if (currentLength > 0.1) {
            // Calculate the angle from last point to preview position
            const angle = Math.atan2(dx, dz)

            // Create new point at exact length in that direction
            const newPoint = {
              x: lastPoint.x + Math.sin(angle) * length,
              z: lastPoint.z + Math.cos(angle) * length
            }

            setWallDrawingPoints([...wallDrawingPoints, newPoint])
            setWallLengthInput('')
          }
        }
        return
      }

      // Spacebar to confirm point
      if (e.key === ' ' && wallPreviewPos) {
        e.preventDefault()
        let newPoint = { x: wallPreviewPos.x, z: wallPreviewPos.z }
        if (wallLengthInput && wallDrawingPoints.length > 0) {
          const length = parseFloat(wallLengthInput)
          if (length > 0 && length <= 100) {
            const lastPoint = wallDrawingPoints[wallDrawingPoints.length - 1]
            const dx = wallPreviewPos.x - lastPoint.x
            const dz = wallPreviewPos.z - lastPoint.z
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist > 0.1) {
              const angle = Math.atan2(dx, dz)
              newPoint = { x: lastPoint.x + Math.sin(angle) * length, z: lastPoint.z + Math.cos(angle) * length }
            }
          }
        }
        setWallDrawingPoints([...wallDrawingPoints, newPoint])
        setWallLengthInput('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isWallMode, isHalfWallMode, isFenceMode, halfWallHeight, fenceType, wallDrawingPoints, wallPreviewPos, wallLengthInput, addWallFromPoints, setWallDrawingPoints, setWallDrawingMode, activeBuildTool, setActiveBuildTool, BUILD_TOOLS])

  // Escape key to cancel opening placement
  useEffect(() => {
    if (effectiveOpeningMode === 'none') return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setOpeningPlacementMode?.('none')
        // Also reset door/window tool
        if (activeBuildTool === BUILD_TOOLS.DOOR || activeBuildTool === BUILD_TOOLS.WINDOW) {
          setActiveBuildTool?.(BUILD_TOOLS.NONE)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [effectiveOpeningMode, setOpeningPlacementMode, activeBuildTool, setActiveBuildTool, BUILD_TOOLS])

  // Escape key to cancel room tool (both active and dragging)
  useEffect(() => {
    if (activeBuildTool !== BUILD_TOOLS.ROOM) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (roomDragState.isDragging) {
          // Cancel current drag
          setRoomDragState({
            isDragging: false,
            startPoint: null,
            currentPoint: null
          })
          setRoomSnapIndicator(null)
        } else {
          // Cancel room tool
          setActiveBuildTool?.(BUILD_TOOLS.NONE)
          setRoomSnapIndicator(null)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBuildTool, roomDragState.isDragging, setActiveBuildTool, BUILD_TOOLS])

  // Keyboard handler for polygon room tool
  useEffect(() => {
    if (activeBuildTool !== BUILD_TOOLS.POLYGON_ROOM) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (roomPolygonPoints.length > 0) {
          setRoomPolygonPoints([])
          setRoomPolygonCurrentPoint(null)
          setRoomSnapIndicator(null)
        } else {
          setActiveBuildTool?.(BUILD_TOOLS.NONE)
        }
        return
      }

      // Spacebar to confirm point at current preview position
      if (e.key === ' ' && roomPolygonCurrentPoint) {
        e.preventDefault()
        // Check if close to first point to close polygon
        if (roomPolygonPoints.length >= 3) {
          const firstPoint = roomPolygonPoints[0]
          const dist = Math.sqrt(
            Math.pow(roomPolygonCurrentPoint.x - firstPoint.x, 2) + Math.pow(roomPolygonCurrentPoint.z - firstPoint.z, 2)
          )
          if (dist < POLYGON_CLOSE_DISTANCE) {
            const closedPoints = [...roomPolygonPoints, roomPolygonPoints[0]]
            addWallFromPoints?.(closedPoints)
            setRoomPolygonPoints([])
            setRoomPolygonCurrentPoint(null)
            setRoomSnapIndicator(null)
            setActiveBuildTool?.(BUILD_TOOLS.NONE)
            return
          }
        }
        setRoomPolygonPoints(prev => [...prev, roomPolygonCurrentPoint])
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBuildTool, roomPolygonPoints, roomPolygonCurrentPoint, setActiveBuildTool, BUILD_TOOLS, addWallFromPoints])

  // Pool tool keyboard handler (Escape, number input for dimensions)
  useEffect(() => {
    if (activeBuildTool !== BUILD_TOOLS.POOL) return

    const handleKeyDown = (e) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        if (poolPolygonPoints.length > 0) {
          setPoolPolygonPoints([])
          setPoolPolygonCurrentPoint(null)
          setPoolLengthInput('')
        } else {
          setActiveBuildTool?.(BUILD_TOOLS.NONE)
        }
        return
      }

      // Only allow typing when we have at least one point
      if (poolPolygonPoints.length === 0) return

      // Number keys (0-9) - append to length input
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        setPoolLengthInput(prev => prev + e.key)
        return
      }

      // Decimal point (only one allowed)
      if (e.key === '.' && !poolLengthInput.includes('.')) {
        e.preventDefault()
        setPoolLengthInput(prev => prev + '.')
        return
      }

      // Backspace to delete last character
      if (e.key === 'Backspace' && poolLengthInput.length > 0) {
        e.preventDefault()
        setPoolLengthInput(prev => prev.slice(0, -1))
        return
      }

      // Enter to confirm length and place point
      if (e.key === 'Enter' && poolLengthInput.length > 0 && poolPolygonCurrentPoint) {
        e.preventDefault()
        const length = parseFloat(poolLengthInput)
        if (length > 0 && length <= 100) {
          const lastPoint = poolPolygonPoints[poolPolygonPoints.length - 1]
          const dx = poolPolygonCurrentPoint.x - lastPoint.x
          const dz = poolPolygonCurrentPoint.z - lastPoint.z
          const currentLength = Math.sqrt(dx * dx + dz * dz)
          if (currentLength > 0) {
            const dirX = dx / currentLength
            const dirZ = dz / currentLength
            const newPoint = {
              x: lastPoint.x + dirX * length,
              z: lastPoint.z + dirZ * length
            }
            setPoolPolygonPoints(prev => [...prev, newPoint])
            setPoolLengthInput('')
          }
        }
        return
      }

      // Spacebar to confirm point
      if (e.key === ' ' && poolPolygonCurrentPoint) {
        e.preventDefault()
        let newPoint = { ...poolPolygonCurrentPoint }
        if (poolLengthInput && poolPolygonPoints.length > 0) {
          const length = parseFloat(poolLengthInput)
          if (length > 0 && length <= 100) {
            const lastPoint = poolPolygonPoints[poolPolygonPoints.length - 1]
            const dx = poolPolygonCurrentPoint.x - lastPoint.x
            const dz = poolPolygonCurrentPoint.z - lastPoint.z
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist > 0) {
              newPoint = { x: lastPoint.x + (dx / dist) * length, z: lastPoint.z + (dz / dist) * length }
            }
          }
        }
        if (poolPolygonPoints.length >= 3) {
          const firstPoint = poolPolygonPoints[0]
          const dist = Math.sqrt(
            Math.pow(newPoint.x - firstPoint.x, 2) + Math.pow(newPoint.z - firstPoint.z, 2)
          )
          if (dist < POOL_CLOSE_DISTANCE) {
            addPool?.(poolPolygonPoints)
            setPoolPolygonPoints([])
            setPoolPolygonCurrentPoint(null)
            setPoolLengthInput('')
            setActiveBuildTool?.(BUILD_TOOLS.NONE)
            return
          }
        }
        setPoolPolygonPoints(prev => [...prev, newPoint])
        setPoolLengthInput('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBuildTool, poolPolygonPoints, poolPolygonCurrentPoint, poolLengthInput, setActiveBuildTool, BUILD_TOOLS, addPool])

  // Foundation tool keyboard handler (Escape, number input for dimensions)
  useEffect(() => {
    if (activeBuildTool !== BUILD_TOOLS.FOUNDATION) return

    const handleKeyDown = (e) => {
      // Escape to cancel
      if (e.key === 'Escape') {
        if (foundationPolygonPoints.length > 0) {
          setFoundationPolygonPoints([])
          setFoundationPolygonCurrentPoint(null)
          setFoundationLengthInput('')
        } else {
          setActiveBuildTool?.(BUILD_TOOLS.NONE)
        }
        return
      }

      // Only allow typing when we have at least one point
      if (foundationPolygonPoints.length === 0) return

      // Number keys (0-9) - append to length input
      if (e.key >= '0' && e.key <= '9') {
        e.preventDefault()
        setFoundationLengthInput(prev => prev + e.key)
        return
      }

      // Decimal point (only one allowed)
      if (e.key === '.' && !foundationLengthInput.includes('.')) {
        e.preventDefault()
        setFoundationLengthInput(prev => prev + '.')
        return
      }

      // Backspace to delete last character
      if (e.key === 'Backspace' && foundationLengthInput.length > 0) {
        e.preventDefault()
        setFoundationLengthInput(prev => prev.slice(0, -1))
        return
      }

      // Enter to confirm length and place point
      if (e.key === 'Enter' && foundationLengthInput.length > 0 && foundationPolygonCurrentPoint) {
        e.preventDefault()
        const length = parseFloat(foundationLengthInput)
        if (length > 0 && length <= 100) {
          const lastPoint = foundationPolygonPoints[foundationPolygonPoints.length - 1]
          const dx = foundationPolygonCurrentPoint.x - lastPoint.x
          const dz = foundationPolygonCurrentPoint.z - lastPoint.z
          const currentLength = Math.sqrt(dx * dx + dz * dz)
          if (currentLength > 0) {
            const dirX = dx / currentLength
            const dirZ = dz / currentLength
            const newPoint = {
              x: lastPoint.x + dirX * length,
              z: lastPoint.z + dirZ * length
            }
            setFoundationPolygonPoints(prev => [...prev, newPoint])
            setFoundationLengthInput('')
          }
        }
        return
      }

      // Spacebar to confirm point
      if (e.key === ' ' && foundationPolygonCurrentPoint) {
        e.preventDefault()
        let newPoint = { ...foundationPolygonCurrentPoint }
        if (foundationLengthInput && foundationPolygonPoints.length > 0) {
          const length = parseFloat(foundationLengthInput)
          if (length > 0 && length <= 100) {
            const lastPoint = foundationPolygonPoints[foundationPolygonPoints.length - 1]
            const dx = foundationPolygonCurrentPoint.x - lastPoint.x
            const dz = foundationPolygonCurrentPoint.z - lastPoint.z
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist > 0) {
              newPoint = { x: lastPoint.x + (dx / dist) * length, z: lastPoint.z + (dz / dist) * length }
            }
          }
        }
        if (foundationPolygonPoints.length >= 3) {
          const firstPoint = foundationPolygonPoints[0]
          const dist = Math.sqrt(
            Math.pow(newPoint.x - firstPoint.x, 2) + Math.pow(newPoint.z - firstPoint.z, 2)
          )
          if (dist < FOUNDATION_CLOSE_DISTANCE) {
            addFoundation?.(foundationPolygonPoints)
            setFoundationPolygonPoints([])
            setFoundationPolygonCurrentPoint(null)
            setFoundationLengthInput('')
            setActiveBuildTool?.(BUILD_TOOLS.NONE)
            return
          }
        }
        setFoundationPolygonPoints(prev => [...prev, newPoint])
        setFoundationLengthInput('')
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBuildTool, foundationPolygonPoints, foundationPolygonCurrentPoint, foundationLengthInput, setActiveBuildTool, BUILD_TOOLS, addFoundation])

  // Escape key to cancel stairs tool
  useEffect(() => {
    if (activeBuildTool !== BUILD_TOOLS.STAIRS) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setStairsPreviewPos(null)
        setActiveBuildTool?.(BUILD_TOOLS.NONE)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBuildTool, setActiveBuildTool, BUILD_TOOLS])

  // Escape key to deselect or cancel select tool
  useEffect(() => {
    if (activeBuildTool !== BUILD_TOOLS.SELECT) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        if (selectedElement) {
          // First escape: deselect
          setSelectedElement?.(null)
        } else {
          // Second escape: cancel select tool
          setActiveBuildTool?.(BUILD_TOOLS.NONE)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBuildTool, selectedElement, setSelectedElement, setActiveBuildTool, BUILD_TOOLS])

  // Escape key to cancel delete tool
  useEffect(() => {
    if (activeBuildTool !== BUILD_TOOLS.DELETE) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveBuildTool?.(BUILD_TOOLS.NONE)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBuildTool, setActiveBuildTool, BUILD_TOOLS])

  // Escape key to cancel roof tool
  useEffect(() => {
    if (activeBuildTool !== BUILD_TOOLS.ROOF) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveBuildTool?.(BUILD_TOOLS.NONE)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBuildTool, setActiveBuildTool, BUILD_TOOLS])

  // Escape key to cancel add floors tool
  useEffect(() => {
    if (activeBuildTool !== BUILD_TOOLS.ADD_FLOORS) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setActiveBuildTool?.(BUILD_TOOLS.NONE)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBuildTool, setActiveBuildTool, BUILD_TOOLS])

  // Right-click to exit any active drawing tool
  useEffect(() => {
    if (activeBuildTool === BUILD_TOOLS.NONE) return

    const handleContextMenu = (e) => {
      e.preventDefault()
      // Clear any in-progress polygon points
      if (activeBuildTool === BUILD_TOOLS.POLYGON_ROOM) {
        setRoomPolygonPoints([])
        setRoomPolygonCurrentPoint(null)
        setRoomSnapIndicator(null)
      } else if (activeBuildTool === BUILD_TOOLS.POOL) {
        setPoolPolygonPoints([])
        setPoolPolygonCurrentPoint(null)
        setPoolLengthInput('')
      } else if (activeBuildTool === BUILD_TOOLS.FOUNDATION) {
        setFoundationPolygonPoints([])
        setFoundationPolygonCurrentPoint(null)
        setFoundationLengthInput('')
      } else if (activeBuildTool === BUILD_TOOLS.STAIRS) {
        setStairsPreviewPos(null)
      } else if (activeBuildTool === BUILD_TOOLS.WALL || activeBuildTool === BUILD_TOOLS.HALF_WALL || activeBuildTool === BUILD_TOOLS.FENCE) {
        setWallDrawingPoints?.([])
        setWallDrawingMode?.(false)
      }
      setActiveBuildTool?.(BUILD_TOOLS.NONE)
    }

    window.addEventListener('contextmenu', handleContextMenu)
    return () => window.removeEventListener('contextmenu', handleContextMenu)
  }, [activeBuildTool, BUILD_TOOLS, setActiveBuildTool, setWallDrawingPoints, setWallDrawingMode])

  // Delete/Backspace/Escape for selected placed building
  useEffect(() => {
    if (!selectedPlacedBuildingId) return

    const handleKeyDown = (e) => {
      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        onDeleteBuilding?.(selectedPlacedBuildingId)
        setSelectedPlacedBuildingId?.(null)
      } else if (e.key === 'Escape') {
        setSelectedPlacedBuildingId?.(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPlacedBuildingId, onDeleteBuilding, setSelectedPlacedBuildingId])

  // Delete/Backspace key to delete selected pool
  useEffect(() => {
    if (!selectedPoolId) return

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deletePool?.(selectedPoolId)
        setSelectedPoolId?.(null)
      }

      if (e.key === 'Escape') {
        setPoolPropertiesOpen?.(false)  // Close properties panel first
        setSelectedPoolId?.(null)
        setPoolDragState({ isDragging: false, startPoint: null, offset: { x: 0, z: 0 } })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedPoolId, deletePool, setSelectedPoolId, setPoolPropertiesOpen])

  // Delete/Backspace/Escape key to delete or deselect selected foundation
  useEffect(() => {
    if (!selectedFoundationId) return

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteFoundation?.(selectedFoundationId)
        setSelectedFoundationId?.(null)
      }

      if (e.key === 'Escape') {
        setFoundationPropertiesOpen?.(false)  // Close properties panel first
        setSelectedFoundationId?.(null)
        setFoundationDragState({ isDragging: false, foundationId: null, startPoint: null, offset: { x: 0, z: 0 } })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedFoundationId, deleteFoundation, setSelectedFoundationId, setFoundationPropertiesOpen])

  // Delete/Backspace/Escape key to delete or deselect selected stairs
  useEffect(() => {
    if (!selectedStairsId) return

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteStairs?.(selectedStairsId)
        setSelectedStairsId?.(null)
      }

      if (e.key === 'Escape') {
        setStairsPropertiesOpen?.(false)
        setSelectedStairsId?.(null)
        setStairsDragState({ isDragging: false, stairsId: null, startPoint: null, offset: { x: 0, z: 0 } })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedStairsId, deleteStairs, setSelectedStairsId, setStairsPropertiesOpen])

  // Delete/Backspace/Escape key to delete or deselect selected roof
  useEffect(() => {
    if (!selectedRoofId) return

    const handleKeyDown = (e) => {
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      if (e.key === 'Delete' || e.key === 'Backspace') {
        e.preventDefault()
        deleteRoof?.(selectedRoofId)
        setSelectedRoofId?.(null)
      }

      if (e.key === 'Escape') {
        setRoofPropertiesOpen?.(false)
        setSelectedRoofId?.(null)
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [selectedRoofId, deleteRoof, setSelectedRoofId, setRoofPropertiesOpen])

  // Note: Build tool keyboard shortcuts are handled in App.jsx (only active when Build panel is open)

  useEffect(() => {
    // Only initialize camera position once on mount
    // This prevents camera from jumping back to ground level during interactions
    if (cameraInitialized.current) return
    cameraInitialized.current = true

    // Position camera inside land boundary, facing forward with good visibility
    // Camera height: 1.65m (eye level), positioned ~2.5m inside boundary
    if (polygonPoints && polygonPoints.length >= 3) {
      // For polygon: start near first point, inside the boundary
      const p0 = polygonPoints[0]
      const p1 = polygonPoints[1]
      // Direction from p0 to p1
      const dx = p1.x - p0.x
      const dy = p1.y - p0.y
      const len = Math.sqrt(dx * dx + dy * dy)
      // Normalize
      const nx = dx / len
      const ny = dy / len
      // Move 2.5m inside from first edge (perpendicular inward)
      const startX = p0.x + nx * 5 + ny * 2.5
      const startZ = p0.y + ny * 5 - nx * 2.5

      camera.position.set(startX, 1.65, startZ)
      // Look along the edge using lookAt (more reliable than euler)
      const lookX = startX + nx * 10
      const lookZ = startZ + ny * 10
      camera.lookAt(lookX, 1.5, lookZ)
    } else {
      // Rectangle: position near corner, looking along length
      camera.position.set(-width / 2 + 2.5, 1.65, -length / 2 + 5)
      camera.lookAt(0, 1.5, length / 2)
    }
  }, [length, width, polygonPoints, camera])

  return (
    <>
      {/* Day/night controller — imperatively updates lights & fog each frame */}
      <DayNightController
        timeOfDay={timeOfDay}
        setTimeOfDay={setTimeOfDay}
        isPaidUser={isPaidUser}
        viewMode={viewMode}
        sunRef={sunRef}
        ambientRef={ambientRef}
        fillRef={fillRef}
        fogRef={fogRef}
      />

      {/* Linear fog for depth (hidden in 2D mode) */}
      {viewMode !== '2d' && <fog ref={fogRef} attach="fog" args={['#c0d4e0', 60, 280]} />}

      {/* Original gradient sky with clouds (hidden in 2D mode) */}
      {viewMode !== '2d' && <RealisticSky timeOfDay={isPaidUser ? timeOfDay : 0.35} />}

      {/* Night stars (hidden in 2D mode) */}
      {viewMode !== '2d' && <NightStars timeOfDay={isPaidUser ? timeOfDay : 0.35} />}

      {/* Main sun light */}
      <directionalLight
        ref={sunRef}
        position={SUN_POSITION}
        intensity={1.4}
        color="#fff4e0"
        castShadow={qualitySettings.shadowsEnabled}
        shadow-mapSize-width={qualitySettings.shadowMapSize}
        shadow-mapSize-height={qualitySettings.shadowMapSize}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0001}
      />

      {/* Ambient light */}
      <ambientLight ref={ambientRef} intensity={0.45} color="#ffeedd" />

      {/* Fill light from opposite side */}
      <directionalLight ref={fillRef} position={[-30, 40, -20]} intensity={0.3} color="#ffe0b0" />

      {/* Enhanced ground with quality-based materials (hidden in 2D - show flat dark surface) */}
      {viewMode !== '2d' && <EnhancedGround key={quality} quality={quality} />}

      {/* Mountain silhouettes and scattered trees (hidden in 2D) */}
      {viewMode !== '2d' && <MountainSilhouettes />}
      {viewMode !== '2d' && <ScatteredTrees quality={quality} />}

      {/* Subtle grid for scale reference (hidden in 2D - replaced by CAD-style grid) */}
      {viewMode !== '2d' && (
        <Grid
          position={[0, 0.003, 0]}
          args={[100, 100]}
          cellSize={1}
          cellThickness={0.3}
          cellColor="rgba(100, 100, 100, 0.4)"
          sectionSize={5}
          sectionThickness={0.6}
          sectionColor="rgba(120, 120, 120, 0.5)"
          fadeDistance={60}
          fadeStrength={1.5}
          followCamera={false}
        />
      )}

      <LandPlot length={length} width={width} polygonPoints={polygonPoints} onClick={handleLandClick} onPointerMove={handlePointerMove} onPointerLeave={handlePointerLeave} onPointerDown={handleRoomPointerDown} onPointerUp={handleRoomPointerUp} viewMode={viewMode} />

      {/* Floor plan background image for tracing */}
      {floorPlanImage && floorPlanSettings.visible && (
        <FloorPlanBackground
          imageUrl={floorPlanImage}
          settings={floorPlanSettings}
        />
      )}

      {/* Setback zone visualization */}
      {setbacksEnabled && setbackDistanceM > 0 && (
        <SetbackZone
          polygonPoints={polygonPoints}
          length={length}
          width={width}
          setbackDistance={setbackDistanceM}
        />
      )}

      {/* Grid overlay for snap-to-grid (comparison objects) */}
      <GridOverlay visible={gridSnapEnabled} gridSize={gridSize} />

      {/* CAD-style dot grid for 2D mode */}
      {viewMode === '2d' && <CADDotGrid size={200} spacing={2} />}

      {/* Land edge dimension labels */}
      {labels.land && (
        <EdgeLabels
          polygonPoints={polygonPoints}
          length={length}
          width={width}
          lengthUnit={lengthUnit}
          viewMode={viewMode}
        />
      )}

      {/* Building preview during placement */}
      {selectedBuilding && selectedBuildingType && (
        <BuildingPreview
          buildingType={selectedBuildingType}
          position={snapInfo?.snappedPos || previewPos}
          rotation={buildingRotation}
          isValid={placementValid}
        />
      )}

      {/* Snap indicator */}
      {selectedBuilding && snapInfo && snapInfo.snapType !== 'none' && (
        <SnapIndicator snapInfo={snapInfo} />
      )}

      {/* NPC guide characters - positioned outside land boundary, facing inward */}
      {/* Hidden in 2D mode - they're for first-person immersion */}
      {viewMode !== '2d' && npcPositions?.guide1?.position && npcPositions?.guide2?.position && (
        <>
          <NPCCharacter
            id="guide1"
            position={npcPositions.guide1.position}
            rotation={npcPositions.guide1.rotation}
            onClick={onNPCInteract}
            isActive={wrapperActiveNPC === 'guide1'}
            isNearby={nearbyNPC === 'guide1'}
            onClose={() => onNPCInteract?.(null)}
          />
          <NPCCharacter
            id="guide2"
            position={npcPositions.guide2.position}
            rotation={npcPositions.guide2.rotation}
            onClick={onNPCInteract}
            isActive={wrapperActiveNPC === 'guide2'}
            isNearby={nearbyNPC === 'guide2'}
            onClose={() => onNPCInteract?.(null)}
          />
        </>
      )}

      {/* Placed buildings */}
      {placedBuildings.map((building) => (
        <PlacedBuilding
          key={building.id}
          building={building}
          onDelete={onDeleteBuilding}
          onMove={onMoveBuilding}
          onSelect={setSelectedPlacedBuildingId}
          isSelected={selectedPlacedBuildingId === building.id}
          isDeleteMode={activeBuildTool === BUILD_TOOLS.DELETE}
          lengthUnit={lengthUnit}
          isOverlapping={overlappingBuildingIds.has(building.id)}
          showLabels={labels.buildings}
          showBuildingDimensions={labels.buildingDimensions}
          canEdit={canEdit}
          viewMode={viewMode}
        />
      ))}

      {/* Comparison objects */}
      {comparisonObjects.map((obj, index) => (
        <ComparisonObject
          key={obj.id}
          obj={obj}
          index={index}
          totalObjects={comparisonObjects.length}
          lengthUnit={lengthUnit}
          position={comparisonPositions[obj.id]}
          onPositionChange={onComparisonPositionChange}
          rotation={comparisonRotations[obj.id] || 0}
          onRotationChange={onComparisonRotationChange}
          polygonPoints={polygonPoints}
          allObjects={comparisonObjects}
          allPositions={comparisonPositions}
          allRotations={comparisonRotations}
          onSnapLineChange={setComparisonSnapLines}
          isOverlapping={overlappingComparisonIds.has(obj.id)}
          gridSnapEnabled={gridSnapEnabled}
          gridSize={gridSize}
          viewMode={viewMode}
          isSelected={selectedComparisonId === obj.id}
          onSelect={() => setSelectedComparisonId?.(obj.id)}
          onDeselect={() => setSelectedComparisonId?.(null)}
        />
      ))}

      {/* Snap guide lines */}
      {comparisonSnapLines.map((line, i) => (
        <SnapGuideLine key={i} line={line} />
      ))}

      {/* Room tool preview rectangle */}
      {roomDragState.isDragging && roomDragState.startPoint && roomDragState.currentPoint && (
        (() => {
          const { startPoint, currentPoint } = roomDragState
          const minX = Math.min(startPoint.x, currentPoint.x)
          const maxX = Math.max(startPoint.x, currentPoint.x)
          const minZ = Math.min(startPoint.z, currentPoint.z)
          const maxZ = Math.max(startPoint.z, currentPoint.z)
          const rectWidth = maxX - minX
          const rectHeight = maxZ - minZ
          const centerX = (minX + maxX) / 2
          const centerZ = (minZ + maxZ) / 2
          const is2D = viewMode === '2d'
          const wallHeight = 2.7
          const wallThickness = 0.15

          // Don't render if too small
          if (rectWidth < 0.1 || rectHeight < 0.1) return null

          return (
            <group>
              {/* Fill rectangle (floor preview) */}
              <mesh position={[centerX, 0.05, centerZ]} rotation={[-Math.PI / 2, 0, 0]}>
                <planeGeometry args={[rectWidth, rectHeight]} />
                <meshBasicMaterial color={PREVIEW_COLOR_VALID} transparent opacity={0.3} side={THREE.DoubleSide} />
              </mesh>

              {/* Outline - use direct 3D coordinates with key to force updates */}
              <line key={`room-outline-${minX.toFixed(2)}-${minZ.toFixed(2)}-${maxX.toFixed(2)}-${maxZ.toFixed(2)}`}>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={5}
                    array={new Float32Array([
                      minX, 0.06, minZ,
                      maxX, 0.06, minZ,
                      maxX, 0.06, maxZ,
                      minX, 0.06, maxZ,
                      minX, 0.06, minZ,
                    ])}
                    itemSize={3}
                  />
                </bufferGeometry>
                <lineBasicMaterial color={PREVIEW_COLOR_VALID} linewidth={2} />
              </line>

              {/* 3D Wall previews (only in 1P/3D modes) */}
              {!is2D && (
                <>
                  {/* Left wall (minX) */}
                  <mesh position={[minX, wallHeight / 2, centerZ]}>
                    <boxGeometry args={[wallThickness, wallHeight, rectHeight]} />
                    <meshBasicMaterial color={PREVIEW_COLOR_VALID} transparent opacity={PREVIEW_OPACITY} />
                  </mesh>
                  {/* Right wall (maxX) */}
                  <mesh position={[maxX, wallHeight / 2, centerZ]}>
                    <boxGeometry args={[wallThickness, wallHeight, rectHeight]} />
                    <meshBasicMaterial color={PREVIEW_COLOR_VALID} transparent opacity={PREVIEW_OPACITY} />
                  </mesh>
                  {/* Front wall (minZ) */}
                  <mesh position={[centerX, wallHeight / 2, minZ]}>
                    <boxGeometry args={[rectWidth, wallHeight, wallThickness]} />
                    <meshBasicMaterial color={PREVIEW_COLOR_VALID} transparent opacity={PREVIEW_OPACITY} />
                  </mesh>
                  {/* Back wall (maxZ) */}
                  <mesh position={[centerX, wallHeight / 2, maxZ]}>
                    <boxGeometry args={[rectWidth, wallHeight, wallThickness]} />
                    <meshBasicMaterial color={PREVIEW_COLOR_VALID} transparent opacity={PREVIEW_OPACITY} />
                  </mesh>
                </>
              )}

              {/* Dimension label */}
              <PreviewDimensionLabel
                position={[centerX, is2D ? 0.5 : wallHeight + 0.5, centerZ]}
                text={`${rectWidth.toFixed(1)}m × ${rectHeight.toFixed(1)}m`}
              />
            </group>
          )
        })()
      )}

      {/* Room tool snap indicator */}
      {roomSnapIndicator && roomDragState.isDragging && activeBuildTool === BUILD_TOOLS.ROOM && (
        <mesh
          position={[roomSnapIndicator.x, 0.08, roomSnapIndicator.z]}
          rotation={[-Math.PI / 2, 0, 0]}
        >
          <ringGeometry args={[0.15, 0.25, 16]} />
          <meshBasicMaterial
            color={roomSnapIndicator.type === 'corner' ? '#00ff00' : roomSnapIndicator.type === 'edge' ? '#ffff00' : '#00ffff'}
            transparent
            opacity={0.9}
          />
        </mesh>
      )}

      {/* Polygon room preview */}
      {roomPolygonPoints.length > 0 && activeBuildTool === BUILD_TOOLS.POLYGON_ROOM && (
        <group>
          {/* Existing points as markers */}
          {roomPolygonPoints.map((pt, i) => (
            <mesh key={i} position={[pt.x, 0.1, pt.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.2, 16]} />
              <meshBasicMaterial color={i === 0 ? '#FF6B6B' : PREVIEW_COLOR_VALID} />
            </mesh>
          ))}

          {/* Lines connecting points */}
          {roomPolygonPoints.length >= 1 && (
            <line>
              <bufferGeometry>
                <bufferAttribute
                  attach="attributes-position"
                  count={roomPolygonPoints.length + (roomPolygonCurrentPoint ? 1 : 0)}
                  array={new Float32Array([
                    ...roomPolygonPoints.flatMap(pt => [pt.x, 0.08, pt.z]),
                    ...(roomPolygonCurrentPoint ? [roomPolygonCurrentPoint.x, 0.08, roomPolygonCurrentPoint.z] : [])
                  ])}
                  itemSize={3}
                />
              </bufferGeometry>
              <lineBasicMaterial color={PREVIEW_COLOR_VALID} linewidth={2} />
            </line>
          )}

          {/* Closing line preview (to first point) */}
          {roomPolygonPoints.length >= 3 && roomPolygonCurrentPoint && (
            (() => {
              const firstPoint = roomPolygonPoints[0]
              const dist = Math.sqrt(
                Math.pow(roomPolygonCurrentPoint.x - firstPoint.x, 2) +
                Math.pow(roomPolygonCurrentPoint.z - firstPoint.z, 2)
              )
              const canClose = dist < 0.5
              return canClose ? (
                <line>
                  <bufferGeometry>
                    <bufferAttribute
                      attach="attributes-position"
                      count={2}
                      array={new Float32Array([
                        roomPolygonCurrentPoint.x, 0.08, roomPolygonCurrentPoint.z,
                        firstPoint.x, 0.08, firstPoint.z
                      ])}
                      itemSize={3}
                    />
                  </bufferGeometry>
                  <lineBasicMaterial color="#FF6B6B" linewidth={2} />
                </line>
              ) : null
            })()
          )}

          {/* Snap indicator for polygon */}
          {roomSnapIndicator && (
            <mesh
              position={[roomSnapIndicator.x, 0.12, roomSnapIndicator.z]}
              rotation={[-Math.PI / 2, 0, 0]}
            >
              <ringGeometry args={[0.15, 0.25, 16]} />
              <meshBasicMaterial
                color={roomSnapIndicator.type === 'corner' ? '#00ff00' : roomSnapIndicator.type === 'edge' ? '#ffff00' : '#00ffff'}
                transparent
                opacity={0.9}
              />
            </mesh>
          )}
        </group>
      )}

      {/* Pool polygon preview */}
      {poolPolygonPoints.length > 0 && activeBuildTool === BUILD_TOOLS.POOL && (
        <group>
          {/* Existing points as markers */}
          {poolPolygonPoints.map((pt, i) => (
            <mesh key={i} position={[pt.x, 0.1, pt.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.2, 16]} />
              <meshBasicMaterial color={i === 0 ? '#FF6B6B' : '#00CED1'} />
            </mesh>
          ))}

          {/* Drawn segments with dimension labels */}
          {poolPolygonPoints.length >= 2 && poolPolygonPoints.slice(0, -1).map((pt, i) => {
            const nextPt = poolPolygonPoints[i + 1]
            const dx = nextPt.x - pt.x
            const dz = nextPt.z - pt.z
            const length = Math.sqrt(dx * dx + dz * dz)
            const midX = (pt.x + nextPt.x) / 2
            const midZ = (pt.z + nextPt.z) / 2
            const segAngle = Math.atan2(dx, dz)
            const is2D = viewMode === '2d'

            return (
              <group key={`segment-${i}`}>
                {/* Segment line - using mesh for visibility */}
                <mesh
                  position={[midX, 0.15, midZ]}
                  rotation={[0, segAngle, 0]}
                >
                  <boxGeometry args={[0.08, 0.05, length]} />
                  <meshBasicMaterial color="#00CED1" transparent opacity={0.9} />
                </mesh>
                {/* Dimension label */}
                <PreviewDimensionLabel
                  position={[midX, is2D ? 0.5 : 0.5, midZ]}
                  text={`${length.toFixed(1)}m`}
                  color="#00CED1"
                  fontSize={0.3}
                />
              </group>
            )
          })}

          {/* Preview line from last point to cursor with dimension */}
          {poolPolygonCurrentPoint && (() => {
            const lastPoint = poolPolygonPoints[poolPolygonPoints.length - 1]
            const dx = poolPolygonCurrentPoint.x - lastPoint.x
            const dz = poolPolygonCurrentPoint.z - lastPoint.z
            const cursorLen = Math.sqrt(dx * dx + dz * dz)
            if (cursorLen < 0.1) return null

            const is2D = viewMode === '2d'
            const typedLength = poolLengthInput ? parseFloat(poolLengthInput) : null
            const displayLen = (typedLength && typedLength > 0) ? typedLength : cursorLen

            // Calculate display end point
            const angle = Math.atan2(dx, dz)
            const displayEndX = lastPoint.x + Math.sin(angle) * displayLen
            const displayEndZ = lastPoint.z + Math.cos(angle) * displayLen
            const midX = (lastPoint.x + displayEndX) / 2
            const midZ = (lastPoint.z + displayEndZ) / 2

            return (
              <group>
                {/* Preview line - using mesh for visibility */}
                <mesh
                  position={[midX, 0.15, midZ]}
                  rotation={[0, angle, 0]}
                >
                  <boxGeometry args={[0.08, 0.05, displayLen]} />
                  <meshBasicMaterial color="#00CED1" transparent opacity={0.8} />
                </mesh>
                {/* Dimension label - show typed input or current length */}
                <PreviewDimensionLabel
                  position={[midX, is2D ? 0.5 : 0.5, midZ]}
                  text={poolLengthInput ? `${poolLengthInput}m ⏎` : `${cursorLen.toFixed(1)}m`}
                  color="#00CED1"
                  fontSize={0.3}
                />
                {/* Preview end point marker */}
                <mesh position={[displayEndX, 0.15, displayEndZ]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.15, 16]} />
                  <meshBasicMaterial color="#00CED1" transparent opacity={0.8} />
                </mesh>
              </group>
            )
          })()}

          {/* Closing line preview */}
          {poolPolygonPoints.length >= 3 && poolPolygonCurrentPoint && (
            (() => {
              const firstPoint = poolPolygonPoints[0]
              const dist = Math.sqrt(
                Math.pow(poolPolygonCurrentPoint.x - firstPoint.x, 2) +
                Math.pow(poolPolygonCurrentPoint.z - firstPoint.z, 2)
              )
              const canClose = dist < 0.5
              if (!canClose) return null

              // Calculate line geometry
              const dx = firstPoint.x - poolPolygonCurrentPoint.x
              const dz = firstPoint.z - poolPolygonCurrentPoint.z
              const closeLen = Math.sqrt(dx * dx + dz * dz)
              const closeAngle = Math.atan2(dx, dz)
              const closeMidX = (poolPolygonCurrentPoint.x + firstPoint.x) / 2
              const closeMidZ = (poolPolygonCurrentPoint.z + firstPoint.z) / 2

              return (
                <group>
                  {/* Closing line - using mesh for visibility */}
                  <mesh
                    position={[closeMidX, 0.15, closeMidZ]}
                    rotation={[0, closeAngle, 0]}
                  >
                    <boxGeometry args={[0.08, 0.05, closeLen]} />
                    <meshBasicMaterial color="#FF6B6B" transparent opacity={0.8} />
                  </mesh>
                  {/* Close indicator ring */}
                  <mesh position={[firstPoint.x, 0.2, firstPoint.z]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.25, 0.35, 32]} />
                    <meshBasicMaterial color="#FF6B6B" transparent opacity={0.8} side={THREE.DoubleSide} />
                  </mesh>
                  <PreviewDimensionLabel
                    position={[firstPoint.x, 0.8, firstPoint.z]}
                    text="Click to close"
                    color="#FF6B6B"
                    fontSize={0.25}
                  />
                </group>
              )
            })()
          )}
        </group>
      )}

      {/* Foundation polygon preview */}
      {foundationPolygonPoints.length > 0 && activeBuildTool === BUILD_TOOLS.FOUNDATION && (
        <group>
          {/* Existing points as markers */}
          {foundationPolygonPoints.map((pt, i) => (
            <mesh key={i} position={[pt.x, 0.1, pt.z]} rotation={[-Math.PI / 2, 0, 0]}>
              <circleGeometry args={[0.2, 16]} />
              <meshBasicMaterial color={i === 0 ? '#FF6B6B' : '#8B7355'} />
            </mesh>
          ))}

          {/* Drawn segments with dimension labels */}
          {foundationPolygonPoints.length >= 2 && foundationPolygonPoints.slice(0, -1).map((pt, i) => {
            const nextPt = foundationPolygonPoints[i + 1]
            const dx = nextPt.x - pt.x
            const dz = nextPt.z - pt.z
            const length = Math.sqrt(dx * dx + dz * dz)
            const midX = (pt.x + nextPt.x) / 2
            const midZ = (pt.z + nextPt.z) / 2
            const segAngle = Math.atan2(dx, dz)
            const is2D = viewMode === '2d'

            return (
              <group key={`foundation-segment-${i}`}>
                {/* Segment line - using mesh for visibility */}
                <mesh
                  position={[midX, 0.15, midZ]}
                  rotation={[0, segAngle, 0]}
                >
                  <boxGeometry args={[0.08, 0.05, length]} />
                  <meshBasicMaterial color="#8B7355" transparent opacity={0.9} />
                </mesh>
                {/* Dimension label */}
                <PreviewDimensionLabel
                  position={[midX, is2D ? 0.5 : 0.5, midZ]}
                  text={`${length.toFixed(1)}m`}
                  color="#8B7355"
                  fontSize={0.3}
                />
              </group>
            )
          })}

          {/* Preview line from last point to cursor with dimension */}
          {foundationPolygonCurrentPoint && (() => {
            const lastPoint = foundationPolygonPoints[foundationPolygonPoints.length - 1]
            const dx = foundationPolygonCurrentPoint.x - lastPoint.x
            const dz = foundationPolygonCurrentPoint.z - lastPoint.z
            const cursorLen = Math.sqrt(dx * dx + dz * dz)
            if (cursorLen < 0.1) return null

            const is2D = viewMode === '2d'
            const typedLength = foundationLengthInput ? parseFloat(foundationLengthInput) : null
            const displayLen = (typedLength && typedLength > 0) ? typedLength : cursorLen

            // Calculate display end point
            const angle = Math.atan2(dx, dz)
            const displayEndX = lastPoint.x + Math.sin(angle) * displayLen
            const displayEndZ = lastPoint.z + Math.cos(angle) * displayLen
            const midX = (lastPoint.x + displayEndX) / 2
            const midZ = (lastPoint.z + displayEndZ) / 2

            return (
              <group>
                {/* Preview line - using mesh for visibility */}
                <mesh
                  position={[midX, 0.15, midZ]}
                  rotation={[0, angle, 0]}
                >
                  <boxGeometry args={[0.08, 0.05, displayLen]} />
                  <meshBasicMaterial color="#8B7355" transparent opacity={0.8} />
                </mesh>
                {/* Dimension label - show typed input or current length */}
                <PreviewDimensionLabel
                  position={[midX, is2D ? 0.5 : 0.5, midZ]}
                  text={foundationLengthInput ? `${foundationLengthInput}m ⏎` : `${cursorLen.toFixed(1)}m`}
                  color="#8B7355"
                  fontSize={0.3}
                />
                {/* Preview end point marker */}
                <mesh position={[displayEndX, 0.15, displayEndZ]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.15, 16]} />
                  <meshBasicMaterial color="#8B7355" transparent opacity={0.8} />
                </mesh>
              </group>
            )
          })()}

          {/* Closing line preview */}
          {foundationPolygonPoints.length >= 3 && foundationPolygonCurrentPoint && (
            (() => {
              const firstPoint = foundationPolygonPoints[0]
              const dist = Math.sqrt(
                Math.pow(foundationPolygonCurrentPoint.x - firstPoint.x, 2) +
                Math.pow(foundationPolygonCurrentPoint.z - firstPoint.z, 2)
              )
              const canClose = dist < FOUNDATION_CLOSE_DISTANCE
              if (!canClose) return null

              // Calculate line geometry
              const dx = firstPoint.x - foundationPolygonCurrentPoint.x
              const dz = firstPoint.z - foundationPolygonCurrentPoint.z
              const closeLen = Math.sqrt(dx * dx + dz * dz)
              const closeAngle = Math.atan2(dx, dz)
              const closeMidX = (foundationPolygonCurrentPoint.x + firstPoint.x) / 2
              const closeMidZ = (foundationPolygonCurrentPoint.z + firstPoint.z) / 2

              return (
                <group>
                  {/* Closing line - using mesh for visibility */}
                  <mesh
                    position={[closeMidX, 0.15, closeMidZ]}
                    rotation={[0, closeAngle, 0]}
                  >
                    <boxGeometry args={[0.08, 0.05, closeLen]} />
                    <meshBasicMaterial color="#FF6B6B" transparent opacity={0.8} />
                  </mesh>
                  {/* Close indicator ring */}
                  <mesh position={[firstPoint.x, 0.2, firstPoint.z]} rotation={[-Math.PI / 2, 0, 0]}>
                    <ringGeometry args={[0.25, 0.35, 32]} />
                    <meshBasicMaterial color="#FF6B6B" transparent opacity={0.8} side={THREE.DoubleSide} />
                  </mesh>
                  <PreviewDimensionLabel
                    position={[firstPoint.x, 0.8, firstPoint.z]}
                    text="Click to close"
                    color="#FF6B6B"
                    fontSize={0.25}
                  />
                </group>
              )
            })()
          )}
        </group>
      )}

      {/* Stairs 3D preview */}
      {stairsPreviewPos && activeBuildTool === BUILD_TOOLS.STAIRS && (() => {
        const previewTopY = stairsTopY || 2.7
        const previewWidth = stairsStyle === 'wide' ? 1.5 : (stairsWidth || 1)
        const segmentLength = 1.5
        const isLShape = stairsStyle === 'l-left' || stairsStyle === 'l-right'
        const turnDir = stairsStyle === 'l-left' ? -1 : 1

        // Helper to render preview segment
        const renderPreviewSegment = (startX, startZ, endX, endZ, startY, endY) => {
          const dx = endX - startX
          const dz = endZ - startZ
          const length = Math.sqrt(dx * dx + dz * dz)
          const angle = Math.atan2(dx, dz)
          const heightDiff = endY - startY
          const stepCount = Math.max(1, Math.floor(heightDiff / 0.18))
          const stepHeight = heightDiff / stepCount
          const stepDepth = length / stepCount

          return (
            <group position={[startX, startY, startZ]} rotation={[0, angle, 0]}>
              {Array.from({ length: stepCount }, (_, i) => (
                <mesh key={i} position={[0, stepHeight * (i + 0.5), stepDepth * (i + 0.5)]}>
                  <boxGeometry args={[previewWidth, stepHeight, stepDepth]} />
                  <meshBasicMaterial color="#8B4513" transparent opacity={0.5} />
                </mesh>
              ))}
            </group>
          )
        }

        if (isLShape) {
          const midY = previewTopY / 2
          const mid2X = stairsPreviewPos.x + (previewWidth / 2 * turnDir)
          return (
            <group>
              {/* First segment */}
              {renderPreviewSegment(stairsPreviewPos.x, stairsPreviewPos.z, stairsPreviewPos.x, stairsPreviewPos.z - segmentLength, 0, midY)}
              {/* Landing */}
              <mesh position={[stairsPreviewPos.x, midY, stairsPreviewPos.z - segmentLength]}>
                <boxGeometry args={[previewWidth, 0.1, previewWidth]} />
                <meshBasicMaterial color="#8B4513" transparent opacity={0.5} />
              </mesh>
              {/* Second segment */}
              {renderPreviewSegment(mid2X, stairsPreviewPos.z - segmentLength, mid2X + (segmentLength * turnDir), stairsPreviewPos.z - segmentLength, midY, previewTopY)}
            </group>
          )
        }

        // Straight stairs preview
        return renderPreviewSegment(stairsPreviewPos.x, stairsPreviewPos.z, stairsPreviewPos.x, stairsPreviewPos.z - 2, 0, previewTopY)
      })()}

      {/* Pools */}
      {pools.map((pool) => (
        <PoolItem
          key={pool.id}
          pool={pool}
          isSelected={selectedPoolId === pool.id}
          isDeleteMode={activeBuildTool === BUILD_TOOLS.DELETE}
          onDelete={deletePool}
          onUpdate={updatePool}
          onSelect={setSelectedPoolId}
          onOpenProperties={() => setPoolPropertiesOpen?.(true)}
          onDragStart={() => setPoolDragState(s => ({ ...s, isDragging: true }))}
          onDragEnd={() => setPoolDragState({ isDragging: false, startPoint: null, offset: { x: 0, z: 0 } })}
        />
      ))}

      {/* Foundations */}
      {foundations.map((foundation) => (
        <FoundationItem
          key={foundation.id}
          foundation={foundation}
          isSelected={selectedFoundationId === foundation.id}
          isDeleteMode={activeBuildTool === BUILD_TOOLS.DELETE}
          onDelete={deleteFoundation}
          onUpdate={updateFoundation}
          onSelect={setSelectedFoundationId}
          onOpenProperties={() => setFoundationPropertiesOpen?.(true)}
          onDragStart={() => setFoundationDragState(s => ({ ...s, isDragging: true }))}
          onDragEnd={() => setFoundationDragState({ isDragging: false, foundationId: null, startPoint: null, offset: { x: 0, z: 0 } })}
        />
      ))}

      {/* Stairs */}
      {stairs.map((stair) => (
        <StairsItem
          key={stair.id}
          stair={stair}
          isSelected={selectedStairsId === stair.id}
          isDeleteMode={activeBuildTool === BUILD_TOOLS.DELETE}
          onDelete={deleteStairs}
          onUpdate={updateStairs}
          onSelect={setSelectedStairsId}
          onOpenProperties={() => setStairsPropertiesOpen?.(true)}
          onDragStart={() => setStairsDragState(s => ({ ...s, isDragging: true }))}
          onDragEnd={() => setStairsDragState({ isDragging: false, stairsId: null, startPoint: null, offset: { x: 0, z: 0 } })}
        />
      ))}

      {/* Roofs */}
      {roofs.map((roof) => (
        <RoofItem
          key={`${roof.id}-${roof.roomId}`}
          roof={roof}
          room={rooms.find(r => r.id === roof.roomId)}
          isSelected={selectedRoofId === roof.id}
          isDeleteMode={activeBuildTool === BUILD_TOOLS.DELETE}
          onDelete={deleteRoof}
          onSelect={setSelectedRoofId}
          onOpenProperties={() => setRoofPropertiesOpen?.(true)}
        />
      ))}

      {/* Room floors */}
      {rooms.map((room) => {
        const roomFloorLevel = room.floorLevel ?? 0
        const roomFloorYOffset = roomFloorLevel * floorHeight
        const isInactiveRoomFloor = roomFloorLevel !== currentFloor
        return (
          <RoomFloor
            key={room.id}
            room={room}
            isSelected={selectedRoomId === room.id}
            viewMode={viewMode}
            lengthUnit={lengthUnit}
            onSelect={() => {
              // If roof tool is active, add roof to this room
              if (activeBuildTool === BUILD_TOOLS.ROOF) {
                const existingRoof = roofs.find(r => r.roomId === room.id)
                if (existingRoof) {
                  setSelectedRoofId?.(existingRoof.id)
                } else {
                  addRoof?.(room.id)
                }
                return
              }
              // If add floors tool is active, add floors to this room
              if (activeBuildTool === BUILD_TOOLS.ADD_FLOORS) {
                addFloorsToRoom?.(room.id)
                return
              }
              setSelectedRoomId?.(room.id)
            }}
            label={roomLabels[room.id] || ''}
            onLabelChange={(newLabel) => setRoomLabel?.(room.id, newLabel)}
            style={roomStyles[room.id] || {}}
            walls={walls}
            moveWallsByIds={moveWallsByIds}
            commitWallsToHistory={commitWallsToHistory}
            setRoomMoveDragState={setRoomMoveDragState}
            onOpenProperties={() => setRoomPropertiesOpen?.(true)}
            floorYOffset={roomFloorYOffset}
            isInactiveFloor={isInactiveRoomFloor}
          />
        )
      })}

      {/* Walls */}
      {walls.map((wall) => {
        const wallFloorLevel = wall.floorLevel ?? 0
        const floorYOffset = wallFloorLevel * floorHeight
        const isInactiveFloor = wallFloorLevel !== currentFloor
        return (
        <WallSegment
          key={wall.id}
          wall={wall}
          lengthUnit={lengthUnit}
          viewMode={viewMode}
          showDimensions={labels.buildingDimensions}
          isSelected={(selectedElement?.type === 'wall' || selectedElement?.type === 'fence') && selectedElement?.id === wall.id}
          wallColor={wallColorMap[wall.id]}
          floorYOffset={floorYOffset}
          isInactiveFloor={isInactiveFloor}
          onOpenProperties={() => {
            if (wall.isFence) {
              setSelectedElement?.({ type: 'fence', id: wall.id })
              setFencePropertiesOpen?.(true)
            } else {
              setSelectedElement?.({ type: 'wall', id: wall.id })
              setWallPropertiesOpen?.(true)
            }
          }}
          onSelect={activeBuildTool === BUILD_TOOLS.SELECT ? () => {
            setSelectedElement?.({ type: 'wall', id: wall.id })
          } : undefined}
          isDeleteMode={activeBuildTool === BUILD_TOOLS.DELETE}
          onDelete={activeBuildTool === BUILD_TOOLS.DELETE ? () => {
            deleteWall?.(wall.id)
          } : undefined}
          isOpeningMode={effectiveOpeningMode !== 'none'}
          openingType={effectiveOpeningMode}
          roomMoveDragState={roomMoveDragState}
          onPlaceOpening={(wallId, posOnWall, type) => {
            // Validate and place opening
            const targetWall = walls.find(w => w.id === wallId)
            if (!targetWall) return

            const wallLen = Math.sqrt(
              (targetWall.end.x - targetWall.start.x) ** 2 +
              (targetWall.end.z - targetWall.start.z) ** 2
            )

            // Use custom sizes from props
            const isDoor = type === 'door'
            const openingWidth = isDoor ? doorWidth : windowWidth
            const openingHeight = isDoor ? doorHeight : windowHeight
            const sillHeight = isDoor ? 0 : windowSillHeight
            const MIN_EDGE_DIST = 0.3
            const halfWidth = openingWidth / 2

            // Validate: not too close to edges
            if (posOnWall - halfWidth < MIN_EDGE_DIST) return
            if (posOnWall + halfWidth > wallLen - MIN_EDGE_DIST) return

            // Validate: no overlap with existing openings
            const existingOpenings = targetWall.openings || []
            for (const existing of existingOpenings) {
              const existingStart = existing.position - existing.width / 2
              const existingEnd = existing.position + existing.width / 2
              const newStart = posOnWall - halfWidth
              const newEnd = posOnWall + halfWidth
              if (!(newEnd < existingStart || newStart > existingEnd)) return
            }

            // Create and add opening
            const opening = {
              id: `${type}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`,
              type,
              position: posOnWall,
              width: openingWidth,
              height: openingHeight,
              sillHeight,
            }
            addOpeningToWall?.(wallId, opening)
          }}
        />
      )})}

      {/* Buildings (placed floor plans) */}
      {buildings.map((building) => (
        <group
          key={building.id}
          position={[building.position.x, 0, building.position.z]}
          rotation={[0, building.rotation || 0, 0]}
          onPointerDown={(e) => {
            e.stopPropagation()
            // Select building and start drag
            setSelectedBuildingId?.(building.id)
            setIsDraggingBuilding(true)
          }}
          onPointerUp={() => setIsDraggingBuilding(false)}
        >
          {building.walls.map((wall, wallIndex) => (
            <WallSegment
              key={`${building.id}-wall-${wallIndex}`}
              wall={wall}
              lengthUnit={lengthUnit}
              viewMode={viewMode}
              showDimensions={labels.buildingDimensions}
              isSelected={selectedBuildingId === building.id}
            />
          ))}
          {/* Building selection outline */}
          {selectedBuildingId === building.id && (
            <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
              <ringGeometry args={[4, 4.2, 32]} />
              <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} />
            </mesh>
          )}
        </group>
      ))}

      {/* Floor plan placement preview (ghost building) */}
      {floorPlanPlacementMode && pendingFloorPlan && (
        <group
          position={[buildingPreviewPosition.x, 0, buildingPreviewPosition.z]}
          rotation={[0, buildingPreviewRotation, 0]}
        >
          {pendingFloorPlan.walls.map((wall, wallIndex) => {
            const dx = wall.end.x - wall.start.x
            const dz = wall.end.z - wall.start.z
            const length = Math.sqrt(dx * dx + dz * dz)
            const angle = Math.atan2(dx, dz)
            const midX = (wall.start.x + wall.end.x) / 2
            const midZ = (wall.start.z + wall.end.z) / 2
            const wallHeight = wall.height || 2.7
            const thickness = wall.thickness || 0.15
            return (
              <mesh
                key={`preview-wall-${wallIndex}`}
                position={[midX, wallHeight / 2, midZ]}
                rotation={[0, angle, 0]}
              >
                <boxGeometry args={[thickness, wallHeight, length]} />
                <meshBasicMaterial color="#22d3ee" transparent opacity={0.5} />
              </mesh>
            )
          })}
          {/* Placement indicator */}
          <mesh position={[0, 0.02, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <ringGeometry args={[3, 3.3, 32]} />
            <meshBasicMaterial color="#22d3ee" transparent opacity={0.7} />
          </mesh>
        </group>
      )}

      {/* Door/Window placement preview */}
      {openingHover.wall && effectiveOpeningMode !== 'none' && (() => {
        const wall = openingHover.wall
        const posOnWall = openingHover.positionOnWall
        const isValid = openingHover.isValid
        const isDoor = effectiveOpeningMode === 'door'
        const is2D = viewMode === '2d'

        const openingWidth = isDoor ? doorWidth : windowWidth
        const openingHeight = isDoor ? doorHeight : windowHeight
        const sillHeight = isDoor ? 0 : windowSillHeight
        const wallAngle = getWallAngle(wall)
        const worldPos = getWorldPositionOnWall(wall, posOnWall)
        const previewColor = isValid ? PREVIEW_COLOR_VALID : PREVIEW_COLOR_INVALID

        return (
          <group position={[worldPos.x, 0, worldPos.z]} rotation={[0, wallAngle, 0]}>
            {/* 3D opening preview (1P/3D modes) */}
            {/* After rotation: local Z = along wall, local X = perpendicular to wall */}
            {!is2D && (
              <>
                {/* Opening frame outline - width along Z (wall direction) */}
                <mesh position={[0, sillHeight + openingHeight / 2, 0]}>
                  <boxGeometry args={[0.25, openingHeight, openingWidth]} />
                  <meshBasicMaterial color={previewColor} transparent opacity={PREVIEW_OPACITY} />
                </mesh>

                {/* Door swing arc (only for doors) - in XZ plane at floor level */}
                {isDoor && (
                  <line position={[0, 0.05, 0]}>
                    <bufferGeometry>
                      <bufferAttribute
                        attach="attributes-position"
                        count={17}
                        array={new Float32Array(
                          Array.from({ length: 17 }, (_, i) => {
                            const theta = (i / 16) * (Math.PI / 2)
                            // Arc centered at hinge (z = -openingWidth/2), swings from z=+W/2 to x=+W
                            return [
                              Math.sin(theta) * openingWidth * 0.85,  // X: swings out perpendicular
                              0,                                      // Y: floor level
                              Math.cos(theta) * openingWidth * 0.85 - openingWidth / 2  // Z: along wall
                            ]
                          }).flat()
                        )}
                        itemSize={3}
                      />
                    </bufferGeometry>
                    <lineDashedMaterial color={previewColor} dashSize={0.15} gapSize={0.1} />
                  </line>
                )}

                {/* Window glass preview (only for windows) - rotated to face perpendicular */}
                {!isDoor && (
                  <mesh position={[0, sillHeight + openingHeight / 2, 0]} rotation={[0, Math.PI / 2, 0]}>
                    <planeGeometry args={[openingWidth - 0.1, openingHeight - 0.1]} />
                    <meshBasicMaterial color="#87CEEB" transparent opacity={0.3} side={THREE.DoubleSide} />
                  </mesh>
                )}
              </>
            )}

            {/* 2D preview (top-down) */}
            {is2D && (
              <>
                {/* Opening gap indicator - 0.3 perpendicular (X), openingWidth along wall (Z) */}
                <mesh position={[0, 0.08, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                  <planeGeometry args={[0.4, openingWidth]} />
                  <meshBasicMaterial color={previewColor} transparent opacity={0.5} />
                </mesh>

                {/* Door swing arc in 2D - in XZ plane */}
                {isDoor && (
                  <line position={[0, 0.09, 0]}>
                    <bufferGeometry>
                      <bufferAttribute
                        attach="attributes-position"
                        count={17}
                        array={new Float32Array(
                          Array.from({ length: 17 }, (_, i) => {
                            const theta = (i / 16) * (Math.PI / 2)
                            return [
                              Math.sin(theta) * openingWidth * 0.8,
                              0,
                              Math.cos(theta) * openingWidth * 0.8 - openingWidth / 2
                            ]
                          }).flat()
                        )}
                        itemSize={3}
                      />
                    </bufferGeometry>
                    <lineBasicMaterial color={previewColor} />
                  </line>
                )}
              </>
            )}

            {/* Dimension label */}
            <PreviewDimensionLabel
              position={[0, is2D ? 0.5 : sillHeight + openingHeight + 0.3, 0]}
              text={`${openingWidth.toFixed(1)}m × ${openingHeight.toFixed(1)}m`}
              color={previewColor}
              fontSize={0.3}
            />
          </group>
        )
      })()}

      {/* Wall drawing mode visuals */}
      {isWallMode && (
        <>
          {/* Snap indicator */}
          {wallSnapIndicator && (
            <group position={[wallSnapIndicator.x, 0.15, wallSnapIndicator.z]}>
              {/* Outer ring */}
              <mesh rotation={[-Math.PI / 2, 0, 0]}>
                <ringGeometry args={[0.25, 0.35, 32]} />
                <meshBasicMaterial
                  color={wallSnapIndicator.type === 'corner' ? '#00ff00' : wallSnapIndicator.type === 'edge' ? '#ffff00' : '#00ffff'}
                  transparent
                  opacity={0.8}
                />
              </mesh>
              {/* Center dot */}
              <mesh>
                <sphereGeometry args={[0.1, 16, 16]} />
                <meshBasicMaterial
                  color={wallSnapIndicator.type === 'corner' ? '#00ff00' : wallSnapIndicator.type === 'edge' ? '#ffff00' : '#00ffff'}
                />
              </mesh>
            </group>
          )}

          {/* Corner markers for placed points */}
          {wallDrawingPoints.map((point, i) => (
            <mesh key={i} position={[point.x, 0.1, point.z]}>
              <sphereGeometry args={[0.15, 16, 16]} />
              <meshStandardMaterial color={i === 0 ? '#22d3ee' : '#ffffff'} />
            </mesh>
          ))}

          {/* Wall segments being drawn (preview) */}
          {wallDrawingPoints.length >= 2 && wallDrawingPoints.slice(0, -1).map((point, i) => {
            const next = wallDrawingPoints[i + 1]
            const dx = next.x - point.x
            const dz = next.z - point.z
            const len = Math.sqrt(dx * dx + dz * dz)
            const angle = Math.atan2(dx, dz)
            const midX = (point.x + next.x) / 2
            const midZ = (point.z + next.z) / 2
            return (
              <mesh
                key={`preview-${i}`}
                position={[midX, 1.35, midZ]}
                rotation={[0, angle, 0]}
              >
                <boxGeometry args={[0.15, 2.7, len]} />
                <meshStandardMaterial color="#E5E5E5" transparent opacity={0.7} />
              </mesh>
            )
          })}

          {/* Preview wall from last point to cursor */}
          {wallDrawingPoints.length >= 1 && wallPreviewPos && (() => {
            const lastPoint = wallDrawingPoints[wallDrawingPoints.length - 1]
            const dx = wallPreviewPos.x - lastPoint.x
            const dz = wallPreviewPos.z - lastPoint.z
            const cursorLen = Math.sqrt(dx * dx + dz * dz)
            if (cursorLen < 0.1) return null

            const angle = Math.atan2(dx, dz)
            const is2D = viewMode === '2d'
            const previewWallHeight = isHalfWallMode ? halfWallHeight : 2.7

            // Use typed length if available, otherwise cursor length
            const typedLength = wallLengthInput ? parseFloat(wallLengthInput) : null
            const displayLen = (typedLength && typedLength > 0) ? typedLength : cursorLen

            // Calculate end point based on display length
            const endX = lastPoint.x + Math.sin(angle) * displayLen
            const endZ = lastPoint.z + Math.cos(angle) * displayLen
            const midX = (lastPoint.x + endX) / 2
            const midZ = (lastPoint.z + endZ) / 2

            return (
              <group>
                {/* 3D wall box preview (1P/3D only) */}
                {!is2D && (
                  <mesh position={[midX, previewWallHeight / 2, midZ]} rotation={[0, angle, 0]}>
                    <boxGeometry args={[0.15, previewWallHeight, displayLen]} />
                    <meshBasicMaterial color={PREVIEW_COLOR_VALID} transparent opacity={PREVIEW_OPACITY} />
                  </mesh>
                )}

                {/* Base line (visible in all modes) - key forces re-render when coordinates change */}
                <line key={`wall-preview-line-${lastPoint.x.toFixed(2)}-${lastPoint.z.toFixed(2)}-${endX.toFixed(2)}-${endZ.toFixed(2)}`}>
                  <bufferGeometry>
                    <bufferAttribute
                      attach="attributes-position"
                      count={2}
                      array={new Float32Array([
                        lastPoint.x, is2D ? 0.06 : 0.15, lastPoint.z,
                        endX, is2D ? 0.06 : 0.15, endZ
                      ])}
                      itemSize={3}
                    />
                  </bufferGeometry>
                  <lineDashedMaterial color={PREVIEW_COLOR_VALID} dashSize={0.5} gapSize={0.3} linewidth={2} />
                </line>

                {/* End point marker */}
                <mesh position={[endX, 0.1, endZ]}>
                  <sphereGeometry args={[0.12]} />
                  <meshBasicMaterial color={typedLength ? '#FFD700' : PREVIEW_COLOR_VALID} />
                </mesh>

                {/* Length dimension label - show typed input or current length */}
                <PreviewDimensionLabel
                  position={[midX, is2D ? 0.5 : previewWallHeight + 0.3, midZ]}
                  text={wallLengthInput ? `${wallLengthInput}m ⏎` : `${cursorLen.toFixed(1)}m`}
                />
              </group>
            )
          })()}

          {/* Close loop indicator */}
          {wallDrawingPoints.length >= 3 && wallPreviewPos && (() => {
            const start = wallDrawingPoints[0]
            const dx = wallPreviewPos.x - start.x
            const dz = wallPreviewPos.z - start.z
            const dist = Math.sqrt(dx * dx + dz * dz)
            if (dist < CLOSE_THRESHOLD) {
              return (
                <mesh position={[start.x, 0.2, start.z]}>
                  <ringGeometry args={[0.3, 0.5, 32]} />
                  <meshBasicMaterial color="#22d3ee" transparent opacity={0.8} side={THREE.DoubleSide} />
                </mesh>
              )
            }
            return null
          })()}
        </>
      )}

      {/* Camera controller (FP/TP modes only - disabled in orbit and 2D) */}
      <CameraController
        enabled={isExploring && !selectedBuilding && viewMode === 'firstPerson' && activeBuildTool === BUILD_TOOLS.NONE}
        joystickInput={joystickInput}
        analyticsMode={analyticsMode}
        cameraMode={cameraMode}
        setCameraMode={setCameraMode}
        followDistance={followDistance}
        setFollowDistance={setFollowDistance}
        orbitEnabled={orbitEnabled}
        orbitTarget={orbitTarget}
        onPlayerPositionUpdate={(state) => {
          setPlayerState(state)
          if (onCameraUpdate) onCameraUpdate(state)
        }}
        walls={walls}
        mobileRunning={mobileRunning}
        mobileJumpTrigger={mobileJumpTrigger}
      />

      {/* Orbit controls (when orbit mode enabled) */}
      {orbitEnabled && (
        <OrbitControls
          ref={orbitControlsRef}
          target={orbitTarget}
          enabled={!selectedBuildingId && !floorPlanPlacementMode && !selectedComparisonId && !roomDragState.isDragging && !poolDragState.isDragging && !foundationDragState.isDragging && !stairsDragState.isDragging && !selectedPlacedBuildingId && (activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS)}
          enablePan={activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS}
          enableRotate={activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS}
          enableZoom={activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS}
          minDistance={3}
          maxDistance={MAX_DISTANCE}
          maxPolarAngle={Math.PI / 2 - 0.1}
          mouseButtons={{
            LEFT: (activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS) ? THREE.MOUSE.ROTATE : null,
            MIDDLE: (activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS) ? THREE.MOUSE.PAN : null,
            RIGHT: null // Disable right-click drag
          }}
          screenSpacePanning={true}
        />
      )}

      {/* Perspective camera for 3D modes (1P/orbit) - ensures clean camera switch from 2D */}
      {viewMode !== '2d' && (
        <PerspectiveCamera
          makeDefault
          fov={60}
          near={0.1}
          far={1000}
        />
      )}

      {/* 2D Top-Down view (orthographic camera + locked controls) */}
      {viewMode === '2d' && (
        <>
          <OrthographicCamera
            makeDefault
            position={[orbitTarget.x, 200, orbitTarget.z]}
            zoom={5}
            near={0.1}
            far={500}
          />
          <MapControls
            ref={orbitControlsRef}
            target={[orbitTarget.x, 0, orbitTarget.z]}
            enabled={!roomDragState.isDragging && !poolDragState.isDragging && !foundationDragState.isDragging && !stairsDragState.isDragging && (activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS)}
            enableRotate={false}
            enableDamping={false}
            enablePan={activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS}
            enableZoom={activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS}
            minZoom={1}
            maxZoom={100}
            maxPolarAngle={0}
            minPolarAngle={0}
            minAzimuthAngle={0}
            maxAzimuthAngle={0}
            screenSpacePanning={true}
            mouseButtons={{
              LEFT: (activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS) ? THREE.MOUSE.PAN : null,
              MIDDLE: (activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS) ? THREE.MOUSE.PAN : null,
              RIGHT: null
            }}
            touches={{
              ONE: (activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS) ? THREE.TOUCH.PAN : null,
              TWO: (activeBuildTool === BUILD_TOOLS.NONE || activeBuildTool === BUILD_TOOLS.ROOF || activeBuildTool === BUILD_TOOLS.ADD_FLOORS) ? THREE.TOUCH.DOLLY_PAN : null
            }}
          />
        </>
      )}

      {/* Animated player mesh (visible in TP mode only, hidden in orbit and 2D) */}
      <SilentErrorBoundary>
        <Suspense fallback={null}>
          <AnimatedPlayerMesh
            visible={cameraMode === CAMERA_MODE.THIRD_PERSON && viewMode === 'firstPerson'}
            position={playerState.position}
            rotation={playerState.rotation}
            velocity={playerState.velocity}
            moveType={playerState.moveType}
          />
        </Suspense>
      </SilentErrorBoundary>

      {/* 2D mode: Player position marker (shows where player will spawn on mode switch) */}
      {viewMode === '2d' && (
        <group position={[playerState.position.x, 0.1, playerState.position.z]}>
          {/* Cyan dot */}
          <mesh rotation={[-Math.PI / 2, 0, 0]}>
            <circleGeometry args={[0.4, 16]} />
            <meshBasicMaterial color="#22d3ee" />
          </mesh>
          {/* Direction indicator */}
          <mesh
            rotation={[-Math.PI / 2, 0, -playerState.rotation]}
            position={[0, 0.01, 0]}
          >
            <bufferGeometry>
              <bufferAttribute
                attach="attributes-position"
                count={3}
                array={new Float32Array([
                  0, 0.8, 0,
                  -0.3, 0.3, 0,
                  0.3, 0.3, 0,
                ])}
                itemSize={3}
              />
            </bufferGeometry>
            <meshBasicMaterial color="#22d3ee" side={2} />
          </mesh>
        </group>
      )}

    </>
  )
}

// Format timeOfDay (0-1) to clock string like "6:00 AM"
function formatTimeLabel(t) {
  const hours24 = (t * 24) % 24
  const h = Math.floor(hours24)
  const m = Math.floor((hours24 - h) * 60)
  const ampm = h >= 12 ? 'PM' : 'AM'
  const h12 = h === 0 ? 12 : h > 12 ? h - 12 : h
  return `${h12}:${m.toString().padStart(2, '0')} ${ampm}`
}

// Pro-only time-of-day slider (rendered outside Canvas as plain HTML)
function TimeSlider({ timeOfDay, setTimeOfDay }) {
  const icon = timeOfDay > 0.25 && timeOfDay < 0.75 ? '\u2600' : '\uD83C\uDF19'

  return (
    <div style={{
      position: 'absolute',
      right: 16,
      top: '50%',
      transform: 'translateY(-50%)',
      display: 'flex',
      flexDirection: 'column',
      alignItems: 'center',
      gap: 6,
      background: 'rgba(0,0,0,0.5)',
      borderRadius: 20,
      padding: '12px 6px',
      color: '#fff',
      fontSize: 13,
      pointerEvents: 'auto',
      zIndex: 10,
      userSelect: 'none',
    }}>
      <span style={{ fontSize: 16 }}>☀️</span>
      <input
        type="range"
        min={0}
        max={1}
        step={0.001}
        value={timeOfDay}
        onChange={e => setTimeOfDay(parseFloat(e.target.value))}
        style={{
          width: 100,
          cursor: 'pointer',
          accentColor: '#f59e0b',
          writingMode: 'vertical-lr',
          direction: 'rtl',
        }}
      />
      <span style={{ fontSize: 16 }}>🌙</span>
    </div>
  )
}

export default function LandScene({ length, width, isExploring, comparisonObjects = [], polygonPoints, placedBuildings = [], selectedBuilding, selectedBuildingType, onPlaceBuilding, onDeleteBuilding, onMoveBuilding, selectedPlacedBuildingId = null, setSelectedPlacedBuildingId, joystickInput, lengthUnit = 'm', onCameraUpdate, buildingRotation = 0, snapInfo, onPointerMove, setbacksEnabled = false, setbackDistanceM = 0, placementValid = true, overlappingBuildingIds = new Set(), labels = {}, canEdit = true, analyticsMode = 'example', cameraMode, setCameraMode, followDistance, setFollowDistance, orbitEnabled, setOrbitEnabled, viewMode = 'firstPerson', fitToLandTrigger = 0, quality = QUALITY.BEST, comparisonPositions = {}, onComparisonPositionChange, comparisonRotations = {}, onComparisonRotationChange, gridSnapEnabled = false, gridSize = 1, walls = [], wallDrawingMode = false, setWallDrawingMode, wallDrawingPoints = [], setWallDrawingPoints, addWallFromPoints, openingPlacementMode = 'none', setOpeningPlacementMode, addOpeningToWall, activeBuildTool = 'none', setActiveBuildTool, selectedElement, setSelectedElement, BUILD_TOOLS = {}, deleteWall, doorWidth = 0.9, doorHeight = 2.1, doorType = 'single', windowWidth = 1.2, windowHeight = 1.2, windowSillHeight = 0.9, halfWallHeight = 1.2, fenceType = 'picket', rooms = [], floorPlanImage = null, floorPlanSettings = {}, buildings = [], floorPlanPlacementMode = false, pendingFloorPlan = null, buildingPreviewPosition = { x: 0, z: 0 }, setBuildingPreviewPosition, buildingPreviewRotation = 0, placeFloorPlanBuilding, selectedBuildingId = null, setSelectedBuildingId, moveSelectedBuilding, selectedComparisonId = null, setSelectedComparisonId, selectedRoomId = null, setSelectedRoomId, roomLabels = {}, roomStyles = {}, setRoomLabel, moveRoom, moveWallsByIds, commitWallsToHistory, setRoomPropertiesOpen, setWallPropertiesOpen, setFencePropertiesOpen, pools = [], addPool, deletePool, updatePool, poolPolygonPoints = [], setPoolPolygonPoints, poolDepth = 1.5, selectedPoolId = null, setSelectedPoolId, setPoolPropertiesOpen, foundations = [], addFoundation, deleteFoundation, updateFoundation, foundationPolygonPoints = [], setFoundationPolygonPoints, roomPolygonPoints = [], setRoomPolygonPoints, foundationHeight = 0.6, selectedFoundationId = null, setSelectedFoundationId, setFoundationPropertiesOpen, stairs = [], addStairs, deleteStairs, updateStairs, stairsStartPoint = null, setStairsStartPoint, stairsWidth = 1.0, stairsTopY = 2.7, stairsStyle = 'straight', selectedStairsId = null, setSelectedStairsId, setStairsPropertiesOpen, roofs = [], addRoof, deleteRoof, roofType = 'gable', roofPitch = 30, selectedRoofId = null, setSelectedRoofId, setRoofPropertiesOpen, canvasRef, sceneRef, currentFloor = 0, floorHeight = 2.7, totalFloors = 1, addFloorsToRoom, mobileRunning = false, mobileJumpTrigger = 0, onNearbyNPCChange, onNearbyBuildingChange, timeOfDay = 0.35, setTimeOfDay, isPaidUser = false }) {
  const qualitySettings = QUALITY_SETTINGS[quality]

  // NPC dialog state - lifted to wrapper so dialog renders outside Canvas
  const [wrapperActiveNPC, setWrapperActiveNPC] = useState(null)

  // Compute DPR capped by device capability
  const dpr = useMemo(() => {
    const deviceDpr = typeof window !== 'undefined' ? window.devicePixelRatio : 1
    return Math.min(qualitySettings.dpr, deviceDpr)
  }, [qualitySettings.dpr])

  // Debug log on quality change (dev only)
  useEffect(() => {
    if (process.env.NODE_ENV === 'development') {
      console.log(`[Quality] ${quality.toUpperCase()} | dpr=${dpr} | shadows=${qualitySettings.shadowsEnabled} | shadowMap=${qualitySettings.shadowMapSize}`)
    }
  }, [quality, dpr, qualitySettings])

  // Dark background for 2D mode (AutoCAD style), sky blue for 3D modes
  const bgColor = viewMode === '2d' ? '#1a1a1a' : '#87ceeb'

  return (
    <>
    <Canvas3DErrorBoundary>
      <Canvas
        dpr={dpr}
        shadows={qualitySettings.shadowsEnabled ? qualitySettings.shadowType : false}
        camera={{ fov: 60, near: 0.1, far: 1000 }}
        style={{ background: bgColor, cursor: viewMode === '2d' ? 'crosshair' : 'default' }}
        gl={{
          preserveDrawingBuffer: true
        }}
        onCreated={({ gl, scene }) => {
          if (canvasRef) {
            canvasRef.current = gl.domElement
          }
          if (sceneRef) {
            sceneRef.current = scene
          }
        }}
      >
      <Scene
        length={length}
        width={width}
        isExploring={isExploring}
        comparisonObjects={comparisonObjects}
        polygonPoints={polygonPoints}
        placedBuildings={placedBuildings}
        selectedBuilding={selectedBuilding}
        selectedBuildingType={selectedBuildingType}
        onPlaceBuilding={onPlaceBuilding}
        onDeleteBuilding={onDeleteBuilding}
        onMoveBuilding={onMoveBuilding}
        selectedPlacedBuildingId={selectedPlacedBuildingId}
        setSelectedPlacedBuildingId={setSelectedPlacedBuildingId}
        joystickInput={joystickInput}
        lengthUnit={lengthUnit}
        onCameraUpdate={onCameraUpdate}
        buildingRotation={buildingRotation}
        snapInfo={snapInfo}
        onPointerMove={onPointerMove}
        setbacksEnabled={setbacksEnabled}
        setbackDistanceM={setbackDistanceM}
        placementValid={placementValid}
        overlappingBuildingIds={overlappingBuildingIds}
        labels={labels}
        canEdit={canEdit}
        analyticsMode={analyticsMode}
        cameraMode={cameraMode}
        setCameraMode={setCameraMode}
        followDistance={followDistance}
        setFollowDistance={setFollowDistance}
        orbitEnabled={orbitEnabled}
        setOrbitEnabled={setOrbitEnabled}
        viewMode={viewMode}
        fitToLandTrigger={fitToLandTrigger}
        quality={quality}
        comparisonPositions={comparisonPositions}
        onComparisonPositionChange={onComparisonPositionChange}
        comparisonRotations={comparisonRotations}
        onComparisonRotationChange={onComparisonRotationChange}
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
        selectedComparisonId={selectedComparisonId}
        setSelectedComparisonId={setSelectedComparisonId}
        selectedRoomId={selectedRoomId}
        setSelectedRoomId={setSelectedRoomId}
        roomLabels={roomLabels}
        roomStyles={roomStyles}
        setRoomLabel={setRoomLabel}
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
        selectedPoolId={selectedPoolId}
        setSelectedPoolId={setSelectedPoolId}
        setPoolPropertiesOpen={setPoolPropertiesOpen}
        foundations={foundations}
        addFoundation={addFoundation}
        deleteFoundation={deleteFoundation}
        updateFoundation={updateFoundation}
        foundationPolygonPoints={foundationPolygonPoints}
        setFoundationPolygonPoints={setFoundationPolygonPoints}
        roomPolygonPoints={roomPolygonPoints}
        setRoomPolygonPoints={setRoomPolygonPoints}
        foundationHeight={foundationHeight}
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
        roofType={roofType}
        roofPitch={roofPitch}
        selectedRoofId={selectedRoofId}
        setSelectedRoofId={setSelectedRoofId}
        setRoofPropertiesOpen={setRoofPropertiesOpen}
        onNPCInteract={setWrapperActiveNPC}
        wrapperActiveNPC={wrapperActiveNPC}
        // Multi-story floor props
        currentFloor={currentFloor}
        floorHeight={floorHeight}
        totalFloors={totalFloors}
        addFloorsToRoom={addFloorsToRoom}
        mobileRunning={mobileRunning}
        mobileJumpTrigger={mobileJumpTrigger}
        onNearbyNPCChange={onNearbyNPCChange}
        onNearbyBuildingChange={onNearbyBuildingChange}
        timeOfDay={timeOfDay}
        setTimeOfDay={setTimeOfDay}
        isPaidUser={isPaidUser}
        />
      </Canvas>
    </Canvas3DErrorBoundary>

    {/* Pro-only time slider */}
    {isPaidUser && viewMode !== '2d' && (
      <TimeSlider timeOfDay={timeOfDay} setTimeOfDay={setTimeOfDay} />
    )}

  </>
  )
}

// Export constants for use in App.jsx
export { CAMERA_MODE, DEFAULT_TP_DISTANCE, ORBIT_START_DISTANCE, QUALITY }
