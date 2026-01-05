import { useRef, useEffect, useMemo, useState, useCallback } from 'react'
import { Canvas, useFrame, useThree, extend } from '@react-three/fiber'
import { Grid, Text, Billboard, OrbitControls, MapControls, OrthographicCamera, PerspectiveCamera, Line, useTexture } from '@react-three/drei'
import * as THREE from 'three'
import { computeEdgeLabelData, formatEdgeLength } from '../utils/labels'
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
  FEET_PER_METER,
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
import { RealisticSky, EnhancedGround, PostProcessing, DistantTreeline } from './scene/SceneEnvironment'
import { AnimatedPlayerMesh } from './scene/AnimatedPlayerMesh'
import { NPCCharacter } from './scene/NPCCharacter'
import { GridOverlay, CADDotGrid, PreviewDimensionLabel } from './scene/GridComponents'
import { calculateNPCPositions } from '../utils/npcHelpers'

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

// Unified camera controller handling FP, TP, and zoom switching
function CameraController({
  enabled,
  joystickInput,
  analyticsMode = 'example',
  cameraMode,
  setCameraMode,
  followDistance,
  setFollowDistance,
  orbitEnabled,
  orbitTarget,
  onPlayerPositionUpdate,
  walls = []
}) {
  const { camera, gl } = useThree()

  // Player state (separate from camera in TP mode)
  const playerPosition = useRef(new THREE.Vector3(0, 1.65, 0))
  const playerYaw = useRef(0) // Y-axis rotation

  // Input state
  const moveState = useRef({ forward: false, backward: false, left: false, right: false })
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const isLocked = useRef(false)
  const isTouchDevice = useRef(false)
  const touchLookActive = useRef(false)
  const lastTouch = useRef({ x: 0, y: 0 })
  const shiftHeld = useRef(false)

  // Pinch zoom state
  const lastPinchDistance = useRef(0)

  // Analytics
  const hasTrackedFirstMove = useRef(false)

  // Movement speed with acceleration
  const currentSpeed = useRef(0)
  const accelerationTime = 0.175

  // Camera bob time accumulator
  const bobTimeRef = useRef(0)

  // Initialize player position from camera on mount
  useEffect(() => {
    playerPosition.current.copy(camera.position)
    playerPosition.current.y = 1.65
    euler.current.setFromQuaternion(camera.quaternion, 'YXZ')
    playerYaw.current = euler.current.y
  }, [])

  useEffect(() => {
    isTouchDevice.current = 'ontouchstart' in window || navigator.maxTouchPoints > 0

    if (!enabled || orbitEnabled) {
      document.exitPointerLock?.()
      isLocked.current = false
      return
    }

    const canvas = gl.domElement

    // Desktop: pointer lock for look
    const lockPointer = () => {
      if (!isTouchDevice.current && !orbitEnabled) {
        canvas.requestPointerLock()
      }
    }

    const onPointerLockChange = () => {
      isLocked.current = document.pointerLockElement === canvas
    }

    const onMouseMove = (e) => {
      if (!isLocked.current || orbitEnabled) return

      euler.current.setFromQuaternion(camera.quaternion)
      euler.current.y -= e.movementX * 0.002
      euler.current.x -= e.movementY * 0.002
      euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x))
      camera.quaternion.setFromEuler(euler.current)

      // Update player yaw to match camera in both FP and TP
      playerYaw.current = euler.current.y
    }

    // Scroll wheel zoom
    const onWheel = (e) => {
      if (orbitEnabled) return
      e.preventDefault()

      const delta = e.deltaY * ZOOM_SPEED
      const newDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, followDistance + delta))
      setFollowDistance(newDistance)

      // Apply hysteresis for mode switching
      if (cameraMode === CAMERA_MODE.FIRST_PERSON && newDistance > SWITCH_OUT_DISTANCE) {
        setCameraMode(CAMERA_MODE.THIRD_PERSON)
      } else if (cameraMode === CAMERA_MODE.THIRD_PERSON && newDistance < SWITCH_IN_DISTANCE) {
        setCameraMode(CAMERA_MODE.FIRST_PERSON)
      }
    }

    const onKeyDown = (e) => {
      if (!enabled || orbitEnabled) return
      switch (e.code) {
        case 'KeyW': moveState.current.forward = true; break
        case 'KeyS': moveState.current.backward = true; break
        case 'KeyA': moveState.current.left = true; break
        case 'KeyD': moveState.current.right = true; break
        case 'ShiftLeft':
        case 'ShiftRight':
          if (!isTouchDevice.current) shiftHeld.current = true
          break
      }
    }

    const onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = false; break
        case 'KeyS': moveState.current.backward = false; break
        case 'KeyA': moveState.current.left = false; break
        case 'KeyD': moveState.current.right = false; break
        case 'ShiftLeft':
        case 'ShiftRight':
          shiftHeld.current = false
          break
      }
    }

    // Touch: look + pinch zoom
    const onTouchStart = (e) => {
      if (!isTouchDevice.current || !enabled || orbitEnabled) return
      const target = e.target
      if (target.closest('.control-panel') || target.closest('.joystick-zone')) return

      if (e.touches.length === 1) {
        const touch = e.touches[0]
        lastTouch.current = { x: touch.clientX, y: touch.clientY }
        touchLookActive.current = true
      } else if (e.touches.length === 2) {
        // Start pinch
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        lastPinchDistance.current = Math.sqrt(dx * dx + dy * dy)
        touchLookActive.current = false
      }
    }

    const onTouchMove = (e) => {
      if (!enabled || orbitEnabled) return

      if (e.touches.length === 1 && touchLookActive.current) {
        // Single finger: look
        const touch = e.touches[0]
        const deltaX = touch.clientX - lastTouch.current.x
        const deltaY = touch.clientY - lastTouch.current.y

        euler.current.setFromQuaternion(camera.quaternion)
        euler.current.y -= deltaX * 0.003
        euler.current.x -= deltaY * 0.003
        euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x))
        camera.quaternion.setFromEuler(euler.current)
        playerYaw.current = euler.current.y

        lastTouch.current = { x: touch.clientX, y: touch.clientY }
      } else if (e.touches.length === 2) {
        // Two fingers: pinch zoom
        const dx = e.touches[0].clientX - e.touches[1].clientX
        const dy = e.touches[0].clientY - e.touches[1].clientY
        const pinchDistance = Math.sqrt(dx * dx + dy * dy)

        if (lastPinchDistance.current > 0) {
          const delta = (lastPinchDistance.current - pinchDistance) * PINCH_SPEED
          const newDistance = Math.max(MIN_DISTANCE, Math.min(MAX_DISTANCE, followDistance + delta))
          setFollowDistance(newDistance)

          // Apply hysteresis
          if (cameraMode === CAMERA_MODE.FIRST_PERSON && newDistance > SWITCH_OUT_DISTANCE) {
            setCameraMode(CAMERA_MODE.THIRD_PERSON)
          } else if (cameraMode === CAMERA_MODE.THIRD_PERSON && newDistance < SWITCH_IN_DISTANCE) {
            setCameraMode(CAMERA_MODE.FIRST_PERSON)
          }
        }
        lastPinchDistance.current = pinchDistance
      }
    }

    const onTouchEnd = () => {
      touchLookActive.current = false
      lastPinchDistance.current = 0
    }

    // Right-click releases pointer lock so user can interact with UI
    const onMouseDown = (e) => {
      if (e.button === 2) { // Right mouse button
        e.preventDefault()
        document.exitPointerLock?.()
      }
    }

    // Also prevent context menu from appearing
    const onContextMenu = (e) => {
      e.preventDefault()
    }

    canvas.addEventListener('click', lockPointer)
    canvas.addEventListener('mousedown', onMouseDown)
    canvas.addEventListener('contextmenu', onContextMenu)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('mousemove', onMouseMove)
    canvas.addEventListener('wheel', onWheel, { passive: false })
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)
    canvas.addEventListener('touchstart', onTouchStart, { passive: true })
    canvas.addEventListener('touchmove', onTouchMove, { passive: true })
    canvas.addEventListener('touchend', onTouchEnd)

    if (!isTouchDevice.current) {
      lockPointer()
    }

    return () => {
      canvas.removeEventListener('click', lockPointer)
      canvas.removeEventListener('mousedown', onMouseDown)
      canvas.removeEventListener('contextmenu', onContextMenu)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('mousemove', onMouseMove)
      canvas.removeEventListener('wheel', onWheel)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      canvas.removeEventListener('touchstart', onTouchStart)
      canvas.removeEventListener('touchmove', onTouchMove)
      canvas.removeEventListener('touchend', onTouchEnd)
      moveState.current = { forward: false, backward: false, left: false, right: false }
    }
  }, [enabled, camera, gl, orbitEnabled, cameraMode, followDistance, setCameraMode, setFollowDistance])

  useFrame((_, delta) => {
    if (!enabled || orbitEnabled) return

    // Calculate movement direction
    const direction = new THREE.Vector3()
    if (moveState.current.forward) direction.z -= 1
    if (moveState.current.backward) direction.z += 1
    if (moveState.current.left) direction.x -= 1
    if (moveState.current.right) direction.x += 1

    if (joystickInput?.current) {
      direction.x += joystickInput.current.x
      direction.z -= joystickInput.current.y
    }

    const isMoving = direction.length() > 0.1

    // Analytics
    if (isMoving && !hasTrackedFirstMove.current) {
      hasTrackedFirstMove.current = true
      trackFirstMovement(analyticsMode)
    }
    if (isMoving) {
      const deltaMs = delta * 1000
      const shouldFireWalk5s = accumulateWalkTime(deltaMs)
      if (shouldFireWalk5s) {
        trackWalk5sCompleted(analyticsMode)
      }
    }

    // Speed calculation
    const targetSpeed = (shiftHeld.current && isMoving) ? RUN_SPEED : WALK_SPEED
    if (isMoving) {
      currentSpeed.current = Math.min(targetSpeed, currentSpeed.current + (targetSpeed / accelerationTime) * delta)
    } else {
      currentSpeed.current = Math.max(0, currentSpeed.current - (WALK_SPEED / accelerationTime) * delta)
    }

    // Move player position with wall collision
    if (currentSpeed.current > 0 && isMoving) {
      direction.normalize()
      // Apply camera yaw to movement direction
      const yawQuat = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), playerYaw.current)
      direction.applyQuaternion(yawQuat)
      direction.y = 0
      direction.normalize()

      // Calculate desired movement
      const moveAmount = currentSpeed.current * delta
      let moveX = direction.x * moveAmount
      let moveZ = direction.z * moveAmount

      // Wall collision detection and sliding
      const PLAYER_RADIUS = 0.4 // Player collision radius
      const WALL_BUFFER = 0.05 // Extra buffer

      // Helper: check if position collides with a wall
      const checkWallCollision = (posX, posZ, wall) => {
        const wx1 = wall.start.x
        const wz1 = wall.start.z
        const wx2 = wall.end.x
        const wz2 = wall.end.z
        const wdx = wx2 - wx1
        const wdz = wz2 - wz1
        const wallLen = Math.sqrt(wdx * wdx + wdz * wdz)
        if (wallLen < 0.01) return { collides: false }

        // Project position onto wall line
        const t = Math.max(0, Math.min(1, ((posX - wx1) * wdx + (posZ - wz1) * wdz) / (wallLen * wallLen)))
        const closestX = wx1 + t * wdx
        const closestZ = wz1 + t * wdz
        const distX = posX - closestX
        const distZ = posZ - closestZ
        const dist = Math.sqrt(distX * distX + distZ * distZ)

        const collisionDist = (wall.thickness || 0.15) / 2 + PLAYER_RADIUS + WALL_BUFFER
        if (dist >= collisionDist) return { collides: false }

        // Check door openings
        const posOnWall = t * wallLen
        for (const opening of wall.openings || []) {
          if (opening.type === 'door') {
            const doorStart = opening.position - opening.width / 2 - PLAYER_RADIUS
            const doorEnd = opening.position + opening.width / 2 + PLAYER_RADIUS
            if (posOnWall >= doorStart && posOnWall <= doorEnd) {
              return { collides: false }
            }
          }
        }

        // Return collision info
        const nx = -wdz / wallLen
        const nz = wdx / wallLen
        return {
          collides: true,
          normal: { x: nx, z: nz },
          wallDir: { x: wdx / wallLen, z: wdz / wallLen },
          penetration: collisionDist - dist,
          closestPoint: { x: closestX, z: closestZ }
        }
      }

      // Calculate intended position
      let finalX = playerPosition.current.x + moveX
      let finalZ = playerPosition.current.z + moveZ

      // Check collision with all walls and resolve
      let iterations = 0
      const maxIterations = 3

      while (iterations < maxIterations) {
        let hadCollision = false

        for (const wall of walls) {
          const result = checkWallCollision(finalX, finalZ, wall)
          if (result.collides) {
            hadCollision = true

            // Push out of wall
            const pushX = (finalX - result.closestPoint.x)
            const pushZ = (finalZ - result.closestPoint.z)
            const pushDist = Math.sqrt(pushX * pushX + pushZ * pushZ)

            if (pushDist > 0.001) {
              const pushNormX = pushX / pushDist
              const pushNormZ = pushZ / pushDist
              const pushAmount = result.penetration + 0.01
              finalX += pushNormX * pushAmount
              finalZ += pushNormZ * pushAmount
            } else {
              // Directly on wall line, push along normal
              finalX += result.normal.x * (result.penetration + 0.01)
              finalZ += result.normal.z * (result.penetration + 0.01)
            }
          }
        }

        if (!hadCollision) break
        iterations++
      }

      // Final safety: if still colliding after iterations, don't move
      let stillColliding = false
      for (const wall of walls) {
        if (checkWallCollision(finalX, finalZ, wall).collides) {
          stillColliding = true
          break
        }
      }

      if (stillColliding) {
        // Don't move at all
        finalX = playerPosition.current.x
        finalZ = playerPosition.current.z
      }

      // Apply final movement
      playerPosition.current.x = finalX
      playerPosition.current.z = finalZ
    } else {
      // Even when not moving, check if player is stuck inside walls and push out
      // This handles the case where a room is created around the player
      const PLAYER_RADIUS = 0.4
      const WALL_BUFFER = 0.05

      const checkWallCollisionStatic = (posX, posZ, wall) => {
        const wx1 = wall.start.x
        const wz1 = wall.start.z
        const wx2 = wall.end.x
        const wz2 = wall.end.z
        const wdx = wx2 - wx1
        const wdz = wz2 - wz1
        const wallLen = Math.sqrt(wdx * wdx + wdz * wdz)
        if (wallLen < 0.01) return { collides: false }

        const t = Math.max(0, Math.min(1, ((posX - wx1) * wdx + (posZ - wz1) * wdz) / (wallLen * wallLen)))
        const closestX = wx1 + t * wdx
        const closestZ = wz1 + t * wdz
        const distX = posX - closestX
        const distZ = posZ - closestZ
        const dist = Math.sqrt(distX * distX + distZ * distZ)

        const collisionDist = (wall.thickness || 0.15) / 2 + PLAYER_RADIUS + WALL_BUFFER
        if (dist >= collisionDist) return { collides: false }

        // Check door openings
        const posOnWall = t * wallLen
        for (const opening of wall.openings || []) {
          if (opening.type === 'door') {
            const doorStart = opening.position - opening.width / 2 - PLAYER_RADIUS
            const doorEnd = opening.position + opening.width / 2 + PLAYER_RADIUS
            if (posOnWall >= doorStart && posOnWall <= doorEnd) {
              return { collides: false }
            }
          }
        }

        return {
          collides: true,
          penetration: collisionDist - dist,
          closestPoint: { x: closestX, z: closestZ }
        }
      }

      let posX = playerPosition.current.x
      let posZ = playerPosition.current.z

      for (let iter = 0; iter < 3; iter++) {
        let pushed = false
        for (const wall of walls) {
          const result = checkWallCollisionStatic(posX, posZ, wall)
          if (result.collides) {
            const pushX = posX - result.closestPoint.x
            const pushZ = posZ - result.closestPoint.z
            const pushDist = Math.sqrt(pushX * pushX + pushZ * pushZ)
            if (pushDist > 0.001) {
              const pushAmount = result.penetration + 0.02
              posX += (pushX / pushDist) * pushAmount
              posZ += (pushZ / pushDist) * pushAmount
              pushed = true
            }
          }
        }
        if (!pushed) break
      }

      playerPosition.current.x = posX
      playerPosition.current.z = posZ
    }

    // Update camera based on mode
    if (cameraMode === CAMERA_MODE.FIRST_PERSON) {
      // FP: camera at player position with subtle bob
      camera.position.copy(playerPosition.current)

      // Very subtle camera bob when moving (to avoid motion sickness)
      if (currentSpeed.current > 0.1) {
        bobTimeRef.current += delta * CAMERA_BOB_SPEED * (currentSpeed.current / WALK_SPEED)
        const isRunning = currentSpeed.current > WALK_SPEED * 1.2
        const bobAmplitude = isRunning ? CAMERA_BOB_RUN : CAMERA_BOB_WALK
        // Use abs(sin) for double-frequency bob (one per footstep)
        const bob = Math.abs(Math.sin(bobTimeRef.current)) * bobAmplitude
        camera.position.y += bob
      }
    } else if (cameraMode === CAMERA_MODE.THIRD_PERSON) {
      // TP: camera behind and above player
      const pitch = euler.current.x
      const yaw = playerYaw.current

      // Calculate camera offset (behind player based on yaw and pitch)
      const offsetX = Math.sin(yaw) * Math.cos(pitch) * followDistance
      const offsetY = Math.sin(pitch) * followDistance + 1.65 // Add player height
      const offsetZ = Math.cos(yaw) * Math.cos(pitch) * followDistance

      const targetCamPos = new THREE.Vector3(
        playerPosition.current.x + offsetX,
        playerPosition.current.y + offsetY,
        playerPosition.current.z + offsetZ
      )

      // Smooth camera follow
      camera.position.lerp(targetCamPos, FOLLOW_SMOOTH + delta * 5)

      // Camera looks at player
      const lookTarget = new THREE.Vector3(
        playerPosition.current.x,
        playerPosition.current.y,
        playerPosition.current.z
      )
      camera.lookAt(lookTarget)
    }

    // Report player position and velocity for minimap and animation
    if (onPlayerPositionUpdate) {
      onPlayerPositionUpdate({
        position: { x: playerPosition.current.x, y: playerPosition.current.y, z: playerPosition.current.z },
        rotation: playerYaw.current,
        velocity: currentSpeed.current
      })
    }
  })

  return null
}

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
          <meshStandardMaterial color={landFillColor} />
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

function PlacedBuilding({ building, onDelete, lengthUnit = 'm', isOverlapping = false, showLabels = false, canEdit = true, viewMode = 'firstPerson' }) {
  const { type, position, rotationY = 0 } = building
  const [hovered, setHovered] = useState(false)
  const is2D = viewMode === '2d'
  const isPool = type.height < 0
  const height = Math.abs(type.height)
  // For pools: top surface just above ground (visible), rest below
  // For buildings: bottom at ground level (box centered above ground)
  const yPos = isPool ? -height / 2 + 0.03 : height / 2

  // Overlap highlight: subtle orange tint when overlapping
  const baseColor = isOverlapping ? '#ff9955' : type.color
  // Only show delete hover color if editing allowed
  const displayColor = (hovered && canEdit) ? '#ff6666' : baseColor

  // Show dimensions only when labels enabled AND hovered
  const showDimensions = showLabels && hovered

  // 2D rendering: flat colored rectangle with white outline
  if (is2D) {
    return (
      <group position={[position.x, 0.05, position.z]} rotation={[0, rotationY * Math.PI / 180, 0]}>
        {/* Building fill */}
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
          onPointerOut={() => setHovered(false)}
          onClick={(e) => {
            e.stopPropagation()
            if (!canEdit || !onDelete) return
            onDelete(building.id)
          }}
        >
          <planeGeometry args={[type.width, type.length]} />
          <meshBasicMaterial color={displayColor} transparent opacity={hovered ? 0.9 : 0.7} />
        </mesh>
        {/* White outline */}
        <line rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={5}
              array={new Float32Array([
                -type.width / 2, -type.length / 2, 0,
                type.width / 2, -type.length / 2, 0,
                type.width / 2, type.length / 2, 0,
                -type.width / 2, type.length / 2, 0,
                -type.width / 2, -type.length / 2, 0,
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={hovered ? '#ff6666' : '#ffffff'} />
        </line>
        {/* Label on hover */}
        {hovered && (
          <Text
            position={[0, 0.15, 0]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={0.6}
            color={hovered ? '#ff6666' : '#ffffff'}
            anchorX="center"
            anchorY="middle"
          >
            {type.name}
          </Text>
        )}
      </group>
    )
  }

  // 3D rendering
  return (
    <group position={[position.x, yPos, position.z]} rotation={[0, rotationY * Math.PI / 180, 0]}>
      <mesh
        castShadow
        receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation()
          // Guard: only allow deletion if canEdit
          if (!canEdit || !onDelete) return
          onDelete(building.id)
        }}
      >
        <boxGeometry args={[type.width, height, type.length]} />
        <meshStandardMaterial
          color={displayColor}
          transparent={isPool || hovered || isOverlapping}
          opacity={isPool ? 0.7 : (hovered ? 0.85 : (isOverlapping ? 0.9 : 1))}
          emissive={hovered ? '#ff0000' : (isOverlapping ? '#ff6600' : '#000000')}
          emissiveIntensity={hovered ? 0.2 : (isOverlapping ? 0.1 : 0)}
        />
      </mesh>
      {/* Overlap outline */}
      {isOverlapping && !hovered && (
        <mesh>
          <boxGeometry args={[type.width + 0.1, height + 0.1, type.length + 0.1]} />
          <meshBasicMaterial color="#ff6600" wireframe transparent opacity={0.4} />
        </mesh>
      )}
      {/* Labels - name always shows on hover, dimensions only when labels toggle enabled */}
      {hovered && (
        <Billboard position={[0, height / 2 + 1, 0]} follow={true}>
          <Text
            fontSize={0.8}
            color={hovered ? '#ff6666' : (isOverlapping ? '#ff9955' : '#ffffff')}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.08}
            outlineColor="#000000"
          >
            {type.name}
          </Text>
          <Text
            position={[0, -0.6, 0]}
            fontSize={0.5}
            color={canEdit ? "#ff9999" : "#aaaaaa"}
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            {showDimensions ? formatDimensions(type.width, type.length, lengthUnit) : (canEdit ? 'Click to remove' : '')}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

// Building preview ghost during placement
function BuildingPreview({ buildingType, position, rotation = 0, isValid = true }) {
  if (!buildingType || !position) return null
  const isPool = buildingType.height < 0
  const height = Math.abs(buildingType.height)
  const yPos = isPool ? -height / 2 + 0.03 : height / 2

  // Invalid placement: red color with more opacity
  const color = isValid ? buildingType.color : '#ff3333'
  const wireColor = isValid ? '#ffffff' : '#ff0000'

  return (
    <group position={[position.x, yPos, position.z]} rotation={[0, rotation * Math.PI / 180, 0]}>
      <mesh>
        <boxGeometry args={[buildingType.width, height, buildingType.length]} />
        <meshStandardMaterial
          color={color}
          transparent
          opacity={isValid ? 0.5 : 0.6}
          wireframe={false}
        />
      </mesh>
      {/* Wireframe outline */}
      <mesh>
        <boxGeometry args={[buildingType.width, height, buildingType.length]} />
        <meshBasicMaterial color={wireColor} wireframe transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

// Setback zone visualization - renders a shaded band along boundary
function SetbackZone({ polygonPoints, length, width, setbackDistance }) {
  if (setbackDistance <= 0) return null

  // Get the land boundary vertices
  // Note: polygonPoints uses { x, y } where y maps to -z in world space (matching LandPlot's rotation)
  const vertices = useMemo(() => {
    if (polygonPoints && polygonPoints.length >= 3) {
      return polygonPoints.map(p => ({ x: p.x, z: -(p.y ?? p.z) }))
    }
    // Rectangle fallback
    const hw = width / 2, hl = length / 2
    return [
      { x: -hw, z: -hl },
      { x: hw, z: -hl },
      { x: hw, z: hl },
      { x: -hw, z: hl }
    ]
  }, [polygonPoints, length, width])

  // Compute proper parallel offset polygon (inner boundary)
  const innerVertices = useMemo(() => {
    const n = vertices.length
    if (n < 3) return []

    // Determine winding order using signed area
    let signedArea = 0
    for (let i = 0; i < n; i++) {
      const curr = vertices[i]
      const next = vertices[(i + 1) % n]
      signedArea += (next.x - curr.x) * (next.z + curr.z)
    }
    // signedArea > 0 means clockwise, < 0 means counter-clockwise
    const windingSign = signedArea > 0 ? -1 : 1

    const result = []
    for (let i = 0; i < n; i++) {
      const prev = vertices[(i - 1 + n) % n]
      const curr = vertices[i]
      const next = vertices[(i + 1) % n]

      // Edge vectors
      const e1x = curr.x - prev.x, e1z = curr.z - prev.z
      const e2x = next.x - curr.x, e2z = next.z - curr.z
      const len1 = Math.sqrt(e1x * e1x + e1z * e1z)
      const len2 = Math.sqrt(e2x * e2x + e2z * e2z)

      if (len1 === 0 || len2 === 0) {
        result.push({ x: curr.x, z: curr.z })
        continue
      }

      // Inward normals (perpendicular, adjusted for winding order)
      const n1x = (-e1z / len1) * windingSign, n1z = (e1x / len1) * windingSign
      const n2x = (-e2z / len2) * windingSign, n2z = (e2x / len2) * windingSign

      // Bisector (average of normals)
      let bx = n1x + n2x, bz = n1z + n2z
      const bLen = Math.sqrt(bx * bx + bz * bz)

      if (bLen < 0.001) {
        // Normals nearly opposite (180° corner), use one normal
        result.push({ x: curr.x + n1x * setbackDistance, z: curr.z + n1z * setbackDistance })
        continue
      }

      bx /= bLen
      bz /= bLen

      // Offset distance along bisector (accounts for corner angle)
      const dot = n1x * bx + n1z * bz
      const offsetDist = setbackDistance / Math.max(dot, 0.3) // Clamp to prevent extreme miter

      result.push({ x: curr.x + bx * offsetDist, z: curr.z + bz * offsetDist })
    }
    return result
  }, [vertices, setbackDistance])

  // Create band geometry between outer and inner polygon
  const bandGeometry = useMemo(() => {
    const n = vertices.length
    if (n < 3 || innerVertices.length !== n) return null

    const positions = []
    const indices = []

    // Add all outer vertices, then all inner vertices
    for (let i = 0; i < n; i++) {
      positions.push(vertices[i].x, 0.015, vertices[i].z)
    }
    for (let i = 0; i < n; i++) {
      positions.push(innerVertices[i].x, 0.015, innerVertices[i].z)
    }

    // Create quads connecting outer to inner
    for (let i = 0; i < n; i++) {
      const o1 = i, o2 = (i + 1) % n
      const i1 = n + i, i2 = n + (i + 1) % n

      indices.push(o1, o2, i2)
      indices.push(o1, i2, i1)
    }

    const geometry = new THREE.BufferGeometry()
    geometry.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
    geometry.setIndex(indices)
    return geometry
  }, [vertices, innerVertices])

  if (!bandGeometry) return null

  return (
    <mesh geometry={bandGeometry}>
      <meshBasicMaterial color="#ff6600" transparent opacity={0.15} side={THREE.DoubleSide} />
    </mesh>
  )
}

// Snap indicator dot
function SnapIndicator({ snapInfo }) {
  if (!snapInfo || snapInfo.type === 'none') return null
  const color = snapInfo.type === 'vertex' ? '#00ff00' : snapInfo.type === 'edge' ? '#ffff00' : '#00ffff'
  return (
    <mesh position={[snapInfo.point.x, 0.1, snapInfo.point.z]}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

// Edge dimension labels for land boundary
function EdgeLabels({ polygonPoints, length, width, lengthUnit, viewMode = 'firstPerson' }) {
  const is2D = viewMode === '2d'

  // Precompute edge label data (only recomputes when inputs change)
  const edgeData = useMemo(() => {
    return computeEdgeLabelData(polygonPoints, length, width)
  }, [polygonPoints, length, width])

  // Calculate dynamic font size based on land size
  const fontSize2D = useMemo(() => {
    let landSize
    if (polygonPoints && polygonPoints.length >= 3) {
      const xs = polygonPoints.map(p => p.x)
      const ys = polygonPoints.map(p => p.y ?? p.z)
      const minX = Math.min(...xs), maxX = Math.max(...xs)
      const minY = Math.min(...ys), maxY = Math.max(...ys)
      landSize = Math.max(maxX - minX, maxY - minY)
    } else {
      landSize = Math.max(length, width)
    }
    // Scale font: ~2% of land size, clamped between 0.6 and 4
    return Math.max(0.6, Math.min(4, landSize * 0.025))
  }, [polygonPoints, length, width])

  // 2D mode: flat cyan labels
  if (is2D) {
    return (
      <group>
        {edgeData.map(({ position, length: edgeLength, key }) => (
          <Text
            key={key}
            position={[position.x, 0.15, position.z]}
            rotation={[-Math.PI / 2, 0, 0]}
            fontSize={fontSize2D}
            color="#00ffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={fontSize2D * 0.08}
            outlineColor="#000000"
          >
            {formatEdgeLength(edgeLength, lengthUnit)}
          </Text>
        ))}
      </group>
    )
  }

  // 3D mode: billboard labels
  return (
    <group>
      {edgeData.map(({ position, length: edgeLength, key }) => (
        <Billboard key={key} position={[position.x, 0.25, position.z]} follow={true}>
          <Text
            fontSize={0.5}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
            material-transparent={true}
            material-opacity={0.85}
          >
            {formatEdgeLength(edgeLength, lengthUnit)}
          </Text>
        </Billboard>
      ))}
    </group>
  )
}

// Create textures for comparison objects
function useSoccerFieldTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Green grass base
    ctx.fillStyle = '#2d8a2d'
    ctx.fillRect(0, 0, w, h)

    // Grass stripes
    ctx.fillStyle = '#259925'
    for (let i = 0; i < h; i += h / 12) {
      ctx.fillRect(0, i, w, h / 24)
    }

    // White lines
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4

    // Outer boundary
    ctx.strokeRect(20, 20, w - 40, h - 40)

    // Center line
    ctx.beginPath()
    ctx.moveTo(20, h / 2)
    ctx.lineTo(w - 20, h / 2)
    ctx.stroke()

    // Center circle
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w * 0.15, 0, Math.PI * 2)
    ctx.stroke()

    // Center dot
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Penalty areas
    const penaltyW = w * 0.6, penaltyH = h * 0.15
    ctx.strokeRect((w - penaltyW) / 2, 20, penaltyW, penaltyH)
    ctx.strokeRect((w - penaltyW) / 2, h - 20 - penaltyH, penaltyW, penaltyH)

    // Goal areas
    const goalW = w * 0.3, goalH = h * 0.05
    ctx.strokeRect((w - goalW) / 2, 20, goalW, goalH)
    ctx.strokeRect((w - goalW) / 2, h - 20 - goalH, goalW, goalH)

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

function useBasketballCourtTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Tan court
    ctx.fillStyle = '#c4a66a'
    ctx.fillRect(0, 0, w, h)

    // Wood grain effect
    ctx.strokeStyle = 'rgba(139, 90, 43, 0.15)'
    ctx.lineWidth = 1
    for (let i = 0; i < w; i += 8) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, h)
      ctx.stroke()
    }

    // White lines
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3

    // Outer boundary
    ctx.strokeRect(15, 15, w - 30, h - 30)

    // Center line
    ctx.beginPath()
    ctx.moveTo(15, h / 2)
    ctx.lineTo(w - 15, h / 2)
    ctx.stroke()

    // Center circle
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w * 0.12, 0, Math.PI * 2)
    ctx.stroke()

    // Keys/paint areas
    const keyW = w * 0.25, keyH = h * 0.18
    ctx.fillStyle = 'rgba(139, 69, 19, 0.3)'
    ctx.fillRect((w - keyW) / 2, 15, keyW, keyH)
    ctx.fillRect((w - keyW) / 2, h - 15 - keyH, keyW, keyH)
    ctx.strokeRect((w - keyW) / 2, 15, keyW, keyH)
    ctx.strokeRect((w - keyW) / 2, h - 15 - keyH, keyW, keyH)

    // Three-point arcs
    ctx.beginPath()
    ctx.arc(w / 2, 15, w * 0.35, 0, Math.PI)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(w / 2, h - 15, w * 0.35, Math.PI, Math.PI * 2)
    ctx.stroke()

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

function useTennisCourtTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Blue court
    ctx.fillStyle = '#2563eb'
    ctx.fillRect(0, 0, w, h)

    // White lines
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3

    // Outer boundary
    ctx.strokeRect(20, 20, w - 40, h - 40)

    // Service boxes
    const serviceH = h * 0.35
    ctx.beginPath()
    ctx.moveTo(20, h / 2 - serviceH / 2)
    ctx.lineTo(w - 20, h / 2 - serviceH / 2)
    ctx.moveTo(20, h / 2 + serviceH / 2)
    ctx.lineTo(w - 20, h / 2 + serviceH / 2)
    ctx.stroke()

    // Center service line
    ctx.beginPath()
    ctx.moveTo(w / 2, h / 2 - serviceH / 2)
    ctx.lineTo(w / 2, h / 2 + serviceH / 2)
    ctx.stroke()

    // Center mark
    ctx.beginPath()
    ctx.moveTo(w / 2, 20)
    ctx.lineTo(w / 2, 35)
    ctx.moveTo(w / 2, h - 20)
    ctx.lineTo(w / 2, h - 35)
    ctx.stroke()

    // Net line
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 4])
    ctx.beginPath()
    ctx.moveTo(15, h / 2)
    ctx.lineTo(w - 15, h / 2)
    ctx.stroke()
    ctx.setLineDash([])

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

function usePoolTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Pool water
    const gradient = ctx.createLinearGradient(0, 0, w, h)
    gradient.addColorStop(0, '#0891b2')
    gradient.addColorStop(0.5, '#06b6d4')
    gradient.addColorStop(1, '#0891b2')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    // Lane lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.lineWidth = 2
    for (let i = 1; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (h / 8) * i)
      ctx.lineTo(w, (h / 8) * i)
      ctx.stroke()
    }

    // Water ripple effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    for (let i = 0; i < 20; i++) {
      const y = Math.random() * h
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(w * 0.25, y + 5, w * 0.75, y - 5, w, y)
      ctx.stroke()
    }

    // Pool edge
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 12
    ctx.strokeRect(6, 6, w - 12, h - 12)

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

function useHouseTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Foundation gray
    ctx.fillStyle = '#9ca3af'
    ctx.fillRect(0, 0, w, h)

    // Slight texture
    ctx.fillStyle = 'rgba(0,0,0,0.05)'
    for (let i = 0; i < 100; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3)
    }

    // Roof indication (darker center)
    const gradient = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2)
    gradient.addColorStop(0, 'rgba(107, 114, 128, 0.4)')
    gradient.addColorStop(1, 'rgba(107, 114, 128, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    // Border
    ctx.strokeStyle = '#6b7280'
    ctx.lineWidth = 8
    ctx.strokeRect(4, 4, w - 8, h - 8)

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

function useParkingTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Asphalt gray
    ctx.fillStyle = '#374151'
    ctx.fillRect(0, 0, w, h)

    // Asphalt texture
    for (let i = 0; i < 200; i++) {
      const shade = Math.random() * 20 - 10
      ctx.fillStyle = `rgb(${55 + shade}, ${65 + shade}, ${81 + shade})`
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }

    // White border lines
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.strokeRect(10, 10, w - 20, h - 20)

    // Parking symbol (P)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.font = 'bold 80px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('P', w / 2, h / 2)

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

// Soccer Field with goal posts
function SoccerField3D({ obj }) {
  const texture = useSoccerFieldTexture(obj.width, obj.length)
  const goalWidth = 7.32, goalHeight = 2.44, goalDepth = 2

  return (
    <group>
      {/* Field surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
      </mesh>

      {/* Goal posts - both ends */}
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, side * (obj.length / 2)]}>
          {/* Left post */}
          <mesh position={[-goalWidth / 2, goalHeight / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, goalHeight, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Right post */}
          <mesh position={[goalWidth / 2, goalHeight / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, goalHeight, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Crossbar */}
          <mesh position={[0, goalHeight, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, goalWidth, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Net (simple back frame) */}
          <mesh position={[0, goalHeight / 2, side * goalDepth / 2]}>
            <boxGeometry args={[goalWidth, goalHeight, 0.05]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.3} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Basketball Court with hoops
function BasketballCourt3D({ obj }) {
  const texture = useBasketballCourtTexture(obj.width, obj.length)
  const poleHeight = 3, rimHeight = 3.05, backboardWidth = 1.8, backboardHeight = 1.05

  return (
    <group>
      {/* Court surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
      </mesh>

      {/* Hoops at each end */}
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, side * (obj.length / 2 - 1.2)]}>
          {/* Pole */}
          <mesh position={[0, poleHeight / 2, -side * 0.5]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, poleHeight, 8]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          {/* Backboard */}
          <mesh position={[0, rimHeight + backboardHeight / 2 - 0.15, 0]} castShadow>
            <boxGeometry args={[backboardWidth, backboardHeight, 0.05]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
          {/* Rim */}
          <mesh position={[0, rimHeight, side * 0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.23, 0.02, 8, 16]} />
            <meshStandardMaterial color="#ff4500" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Tennis Court with net
function TennisCourt3D({ obj }) {
  const texture = useTennisCourtTexture(obj.width, obj.length)
  const netHeight = 1.07, postHeight = 1.2

  return (
    <group>
      {/* Court surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
      </mesh>

      {/* Net posts */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (obj.width / 2 + 0.3), postHeight / 2, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, postHeight, 8]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}

      {/* Net */}
      <mesh position={[0, netHeight / 2 + 0.1, 0]}>
        <planeGeometry args={[obj.width + 0.6, netHeight]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Net top cable */}
      <mesh position={[0, netHeight + 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, obj.width + 0.6, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

// 3D House with pitched roof
function House3D({ obj }) {
  const wallHeight = 3, roofHeight = 2

  return (
    <group>
      {/* Foundation/shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width + 0.5, obj.length + 0.5]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.15} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, wallHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[obj.width, wallHeight, obj.length]} />
        <meshStandardMaterial color="#f5f5dc" />
      </mesh>

      {/* Pitched roof - using a simple triangular prism shape */}
      <mesh position={[0, wallHeight + roofHeight / 2, 0]} castShadow>
        <boxGeometry args={[obj.width + 0.5, 0.2, obj.length + 0.5]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>

      {/* Roof slopes */}
      <mesh position={[0, wallHeight + roofHeight / 2, 0]} rotation={[0, 0, Math.PI / 6]} castShadow>
        <boxGeometry args={[obj.width / 2 + 0.8, 0.15, obj.length + 0.3]} />
        <meshStandardMaterial color="#6b3a1f" />
      </mesh>
      <mesh position={[0, wallHeight + roofHeight / 2, 0]} rotation={[0, 0, -Math.PI / 6]} castShadow>
        <boxGeometry args={[obj.width / 2 + 0.8, 0.15, obj.length + 0.3]} />
        <meshStandardMaterial color="#6b3a1f" />
      </mesh>

      {/* Door */}
      <mesh position={[0, 1, obj.length / 2 + 0.01]}>
        <planeGeometry args={[1.2, 2]} />
        <meshStandardMaterial color="#5c4033" />
      </mesh>

      {/* Windows */}
      {[[-obj.width / 3, obj.length / 2], [obj.width / 3, obj.length / 2]].map(([x, z], i) => (
        <mesh key={i} position={[x, wallHeight / 2 + 0.3, z + 0.01]}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color="#87ceeb" transparent opacity={0.7} />
        </mesh>
      ))}
    </group>
  )
}

// Parking Space (flat)
function ParkingSpace3D({ obj }) {
  const texture = useParkingTexture(obj.width, obj.length)

  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
      </mesh>
    </group>
  )
}

// Olympic Pool (sunken)
function Pool3D({ obj }) {
  const texture = usePoolTexture(obj.width, obj.length)
  const poolDepth = 2

  return (
    <group>
      {/* Pool edge/deck */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width + 2, obj.length + 2]} />
        <meshStandardMaterial color="#d4d4d4" />
      </mesh>

      {/* Pool walls (sunken box) */}
      <mesh position={[0, -poolDepth / 2, 0]}>
        <boxGeometry args={[obj.width, poolDepth, obj.length]} />
        <meshStandardMaterial color="#0ea5e9" side={THREE.BackSide} />
      </mesh>

      {/* Water surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} transparent opacity={0.9} />
      </mesh>

      {/* Lane dividers */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[0, -poolDepth / 2, -obj.length / 2 + (obj.length / 8) * (i + 1)]}>
          <boxGeometry args={[obj.width - 0.2, 0.1, 0.1]} />
          <meshStandardMaterial color="#1e40af" />
        </mesh>
      ))}
    </group>
  )
}

// Car Sedan
function CarSedan3D({ obj }) {
  return (
    <group>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width + 0.2, obj.length + 0.2]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.15} />
      </mesh>
      {/* Body */}
      <mesh position={[0, 0.4, 0]} castShadow>
        <boxGeometry args={[obj.width, 0.5, obj.length]} />
        <meshStandardMaterial color="#8C8C8C" />
      </mesh>
      {/* Cabin/Roof */}
      <mesh position={[0, 0.8, -0.3]} castShadow>
        <boxGeometry args={[obj.width - 0.2, 0.4, obj.length * 0.5]} />
        <meshStandardMaterial color="#7A7A7A" />
      </mesh>
      {/* Wheels */}
      {[[-obj.width / 2 + 0.15, obj.length / 2 - 0.6], [obj.width / 2 - 0.15, obj.length / 2 - 0.6],
        [-obj.width / 2 + 0.15, -obj.length / 2 + 0.6], [obj.width / 2 - 0.15, -obj.length / 2 + 0.6]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.2, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.2, 0.2, 0.15, 12]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}
    </group>
  )
}

// Shipping Container
function ShippingContainer3D({ obj }) {
  const containerHeight = 2.6
  return (
    <group>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width + 0.3, obj.length + 0.3]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.15} />
      </mesh>
      {/* Main container box */}
      <mesh position={[0, containerHeight / 2, 0]} castShadow>
        <boxGeometry args={[obj.width, containerHeight, obj.length]} />
        <meshStandardMaterial color="#C75B39" />
      </mesh>
      {/* Door end - slightly darker */}
      <mesh position={[0, containerHeight / 2, obj.length / 2 + 0.01]}>
        <planeGeometry args={[obj.width - 0.1, containerHeight - 0.1]} />
        <meshStandardMaterial color="#A64B2E" />
      </mesh>
      {/* Corrugation lines on sides */}
      {Array.from({ length: 5 }, (_, i) => (
        <mesh key={i} position={[obj.width / 2 + 0.01, containerHeight / 2, -obj.length / 2 + (obj.length / 6) * (i + 1)]}>
          <boxGeometry args={[0.02, containerHeight - 0.2, 0.08]} />
          <meshStandardMaterial color="#B8532F" />
        </mesh>
      ))}
    </group>
  )
}

// School Bus
function SchoolBus3D({ obj }) {
  const busHeight = 2.5
  return (
    <group>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width + 0.3, obj.length + 0.3]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.15} />
      </mesh>
      {/* Main body */}
      <mesh position={[0, busHeight / 2, 0]} castShadow>
        <boxGeometry args={[obj.width, busHeight, obj.length]} />
        <meshStandardMaterial color="#F7B500" />
      </mesh>
      {/* Black stripe for windows */}
      <mesh position={[obj.width / 2 + 0.01, busHeight / 2 + 0.3, 0]}>
        <planeGeometry args={[obj.length - 2, busHeight * 0.35]} />
        <meshStandardMaterial color="#333333" transparent opacity={0.7} />
      </mesh>
      <mesh position={[-obj.width / 2 - 0.01, busHeight / 2 + 0.3, 0]} rotation={[0, Math.PI, 0]}>
        <planeGeometry args={[obj.length - 2, busHeight * 0.35]} />
        <meshStandardMaterial color="#333333" transparent opacity={0.7} />
      </mesh>
      {/* Hood (front) */}
      <mesh position={[0, busHeight / 2 - 0.3, obj.length / 2 + 0.01]}>
        <planeGeometry args={[obj.width - 0.1, busHeight - 0.5]} />
        <meshStandardMaterial color="#E5A800" />
      </mesh>
      {/* Wheels */}
      {[[-obj.width / 2, obj.length / 2 - 1.5], [obj.width / 2, obj.length / 2 - 1.5],
        [-obj.width / 2, -obj.length / 2 + 1.5], [obj.width / 2, -obj.length / 2 + 1.5]].map(([x, z], i) => (
        <mesh key={i} position={[x, 0.4, z]} rotation={[0, 0, Math.PI / 2]}>
          <cylinderGeometry args={[0.4, 0.4, 0.3, 12]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}
    </group>
  )
}

// King Size Bed
function KingSizeBed3D({ obj }) {
  return (
    <group>
      {/* Shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width + 0.2, obj.length + 0.2]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.1} />
      </mesh>
      {/* Bed frame */}
      <mesh position={[0, 0.2, 0]} castShadow>
        <boxGeometry args={[obj.width, 0.4, obj.length]} />
        <meshStandardMaterial color="#5C4033" />
      </mesh>
      {/* Mattress */}
      <mesh position={[0, 0.55, 0]} castShadow>
        <boxGeometry args={[obj.width - 0.1, 0.3, obj.length - 0.1]} />
        <meshStandardMaterial color="#E8DCC8" />
      </mesh>
      {/* Headboard */}
      <mesh position={[0, 0.6, -obj.length / 2 + 0.05]} castShadow>
        <boxGeometry args={[obj.width, 0.8, 0.1]} />
        <meshStandardMaterial color="#5C4033" />
      </mesh>
      {/* Pillows */}
      <mesh position={[-obj.width / 4, 0.75, -obj.length / 2 + 0.35]}>
        <boxGeometry args={[obj.width / 3, 0.12, 0.4]} />
        <meshStandardMaterial color="#F5F0E6" />
      </mesh>
      <mesh position={[obj.width / 4, 0.75, -obj.length / 2 + 0.35]}>
        <boxGeometry args={[obj.width / 3, 0.12, 0.4]} />
        <meshStandardMaterial color="#F5F0E6" />
      </mesh>
    </group>
  )
}

// Studio Apartment Floor Plan
function StudioApartment3D({ obj }) {
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial color="#9CA3AF" transparent opacity={0.3} />
      </mesh>
      {/* Walls - low outline */}
      <mesh position={[0, 0.15, -obj.length / 2]} castShadow>
        <boxGeometry args={[obj.width, 0.3, 0.1]} />
        <meshStandardMaterial color="#D1D5DB" />
      </mesh>
      <mesh position={[0, 0.15, obj.length / 2]} castShadow>
        <boxGeometry args={[obj.width, 0.3, 0.1]} />
        <meshStandardMaterial color="#D1D5DB" />
      </mesh>
      <mesh position={[-obj.width / 2, 0.15, 0]} castShadow>
        <boxGeometry args={[0.1, 0.3, obj.length]} />
        <meshStandardMaterial color="#D1D5DB" />
      </mesh>
      <mesh position={[obj.width / 2, 0.15, 0]} castShadow>
        <boxGeometry args={[0.1, 0.3, obj.length]} />
        <meshStandardMaterial color="#D1D5DB" />
      </mesh>
      {/* Kitchen area indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-obj.width / 4, 0.03, -obj.length / 4]}>
        <planeGeometry args={[obj.width / 2.5, obj.length / 3]} />
        <meshStandardMaterial color="#6B7280" transparent opacity={0.3} />
      </mesh>
    </group>
  )
}

const SNAP_THRESHOLD = 1.5 // meters - snap distance for edge snapping

// Check if rotation is axis-aligned (0, 90, 180, 270 degrees)
function isAxisAligned(rotation) {
  const normalized = ((rotation % 360) + 360) % 360
  return normalized < 5 || Math.abs(normalized - 90) < 5 || Math.abs(normalized - 180) < 5 || Math.abs(normalized - 270) < 5
}

// Get effective width/length after rotation (swapped for 90°/270°)
function getRotatedDimensions(width, length, rotation) {
  const normalized = ((rotation % 360) + 360) % 360
  // At 90° or 270°, width and length are swapped
  if (Math.abs(normalized - 90) < 5 || Math.abs(normalized - 270) < 5) {
    return { width: length, length: width }
  }
  return { width, length }
}

// Get object bounding box (accounts for axis-aligned rotation)
function getObjectBounds(x, z, width, length, rotation = 0) {
  const dims = getRotatedDimensions(width, length, rotation)
  return {
    left: x - dims.width / 2,
    right: x + dims.width / 2,
    top: z + dims.length / 2,
    bottom: z - dims.length / 2,
    centerX: x,
    centerZ: z,
  }
}

// Check if two objects overlap
function checkOverlap(bounds1, bounds2) {
  return !(
    bounds1.right <= bounds2.left ||
    bounds1.left >= bounds2.right ||
    bounds1.top <= bounds2.bottom ||
    bounds1.bottom >= bounds2.top
  )
}

function ComparisonObject({ obj, index, totalObjects, lengthUnit = 'm', position, onPositionChange, rotation = 0, onRotationChange, polygonPoints, allObjects, allPositions, allRotations = {}, onSnapLineChange, isOverlapping, gridSnapEnabled = false, gridSize = 1, viewMode = 'firstPerson' }) {
  const { camera, gl } = useThree()
  const groupRef = useRef()
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [snapType, setSnapType] = useState('none') // 'none', 'edge', 'object', 'center'
  const dragStartRef = useRef(null)
  const DRAG_THRESHOLD = 5

  // Default position: stagger objects so they don't stack
  const defaultX = (index - (totalObjects - 1) / 2) * 15
  const defaultZ = 0
  const currentPos = position || { x: defaultX, z: defaultZ }

  // Ground plane for raycasting
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  // Calculate snapped position with edge-to-edge and land boundary snapping
  const applySnap = useCallback((pos) => {
    let snappedX = pos.x
    let snappedZ = pos.z
    let snapLines = []
    let foundSnap = false

    // Get rotated dimensions for this object
    const dims = getRotatedDimensions(obj.width, obj.length, rotation)
    const draggedBounds = getObjectBounds(pos.x, pos.z, obj.width, obj.length, rotation)

    // Only do edge snapping if this object is axis-aligned
    const canEdgeSnap = isAxisAligned(rotation)

    // 1. Check edge-to-edge snap with other objects (only if axis-aligned)
    if (canEdgeSnap && allObjects && allPositions) {
      for (const other of allObjects) {
        if (other.id === obj.id) continue

        const otherDefaultX = (allObjects.indexOf(other) - (allObjects.length - 1) / 2) * 15
        const otherPos = allPositions[other.id] || { x: otherDefaultX, z: 0 }
        const otherRotation = allRotations[other.id] || 0

        // Only snap to other objects that are also axis-aligned
        if (!isAxisAligned(otherRotation)) continue

        const otherBounds = getObjectBounds(otherPos.x, otherPos.z, other.width, other.length, otherRotation)

        // Check X-axis snapping (left/right edges)
        // Dragged right edge → Other left edge
        const rightToLeft = Math.abs(draggedBounds.right - otherBounds.left)
        if (rightToLeft < SNAP_THRESHOLD && !foundSnap) {
          snappedX = otherBounds.left - dims.width / 2
          snapLines.push({ type: 'vertical', x: otherBounds.left, z1: Math.min(draggedBounds.bottom, otherBounds.bottom) - 2, z2: Math.max(draggedBounds.top, otherBounds.top) + 2 })
          foundSnap = true
        }
        // Dragged left edge → Other right edge
        const leftToRight = Math.abs(draggedBounds.left - otherBounds.right)
        if (leftToRight < SNAP_THRESHOLD && !foundSnap) {
          snappedX = otherBounds.right + dims.width / 2
          snapLines.push({ type: 'vertical', x: otherBounds.right, z1: Math.min(draggedBounds.bottom, otherBounds.bottom) - 2, z2: Math.max(draggedBounds.top, otherBounds.top) + 2 })
          foundSnap = true
        }

        // Check Z-axis snapping (top/bottom edges)
        // Dragged top edge → Other bottom edge
        const topToBottom = Math.abs(draggedBounds.top - otherBounds.bottom)
        if (topToBottom < SNAP_THRESHOLD && !foundSnap) {
          snappedZ = otherBounds.bottom - dims.length / 2
          snapLines.push({ type: 'horizontal', z: otherBounds.bottom, x1: Math.min(draggedBounds.left, otherBounds.left) - 2, x2: Math.max(draggedBounds.right, otherBounds.right) + 2 })
          foundSnap = true
        }
        // Dragged bottom edge → Other top edge
        const bottomToTop = Math.abs(draggedBounds.bottom - otherBounds.top)
        if (bottomToTop < SNAP_THRESHOLD && !foundSnap) {
          snappedZ = otherBounds.top + dims.length / 2
          snapLines.push({ type: 'horizontal', z: otherBounds.top, x1: Math.min(draggedBounds.left, otherBounds.left) - 2, x2: Math.max(draggedBounds.right, otherBounds.right) + 2 })
          foundSnap = true
        }

        // Center alignment (lower priority, only if no edge snap)
        if (!foundSnap) {
          const centerXDiff = Math.abs(pos.x - otherPos.x)
          const centerZDiff = Math.abs(pos.z - otherPos.z)
          if (centerXDiff < SNAP_THRESHOLD * 0.7) {
            snappedX = otherPos.x
            snapLines.push({ type: 'vertical', x: otherPos.x, z1: Math.min(pos.z, otherPos.z) - 5, z2: Math.max(pos.z, otherPos.z) + 5 })
            foundSnap = true
          }
          if (centerZDiff < SNAP_THRESHOLD * 0.7 && !foundSnap) {
            snappedZ = otherPos.z
            snapLines.push({ type: 'horizontal', z: otherPos.z, x1: Math.min(pos.x, otherPos.x) - 5, x2: Math.max(pos.x, otherPos.x) + 5 })
            foundSnap = true
          }
        }
      }
    }

    // 2. Check snap to land boundary edges (only if axis-aligned)
    if (canEdgeSnap && !foundSnap && polygonPoints && polygonPoints.length >= 3) {
      const vertices = polygonPoints.map(p => ({ x: p.x, z: -p.y }))

      for (let i = 0; i < vertices.length; i++) {
        const a = vertices[i]
        const b = vertices[(i + 1) % vertices.length]

        // Check if edge is mostly vertical (X alignment)
        if (Math.abs(a.x - b.x) < 0.5) {
          const edgeX = (a.x + b.x) / 2
          // Snap right edge to land edge
          if (Math.abs(draggedBounds.right - edgeX) < SNAP_THRESHOLD) {
            snappedX = edgeX - dims.width / 2
            snapLines.push({ type: 'vertical', x: edgeX, z1: Math.min(a.z, b.z), z2: Math.max(a.z, b.z) })
            foundSnap = true
            break
          }
          // Snap left edge to land edge
          if (Math.abs(draggedBounds.left - edgeX) < SNAP_THRESHOLD) {
            snappedX = edgeX + dims.width / 2
            snapLines.push({ type: 'vertical', x: edgeX, z1: Math.min(a.z, b.z), z2: Math.max(a.z, b.z) })
            foundSnap = true
            break
          }
        }

        // Check if edge is mostly horizontal (Z alignment)
        if (Math.abs(a.z - b.z) < 0.5) {
          const edgeZ = (a.z + b.z) / 2
          // Snap top edge to land edge
          if (Math.abs(draggedBounds.top - edgeZ) < SNAP_THRESHOLD) {
            snappedZ = edgeZ - dims.length / 2
            snapLines.push({ type: 'horizontal', z: edgeZ, x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x) })
            foundSnap = true
            break
          }
          // Snap bottom edge to land edge
          if (Math.abs(draggedBounds.bottom - edgeZ) < SNAP_THRESHOLD) {
            snappedZ = edgeZ + dims.length / 2
            snapLines.push({ type: 'horizontal', z: edgeZ, x1: Math.min(a.x, b.x), x2: Math.max(a.x, b.x) })
            foundSnap = true
            break
          }
        }
      }
    }

    // 3. Grid snap (lowest priority, only if no edge snap and grid enabled)
    if (!foundSnap && gridSnapEnabled) {
      snappedX = Math.round(pos.x / gridSize) * gridSize
      snappedZ = Math.round(pos.z / gridSize) * gridSize
      foundSnap = true
      // No snap lines for grid snap - the grid itself is visible
    }

    return {
      snappedPos: { x: snappedX, z: snappedZ },
      snapType: foundSnap ? 'edge' : 'none',
      snapLines
    }
  }, [obj.id, obj.width, obj.length, rotation, allObjects, allPositions, allRotations, polygonPoints, gridSnapEnabled, gridSize])

  // Raycast mouse to ground plane
  const raycastToGround = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const intersectPoint = new THREE.Vector3()
    raycaster.ray.intersectPlane(groundPlane, intersectPoint)
    return intersectPoint
  }, [camera, gl.domElement, groundPlane, raycaster])

  // Pointer down - start potential drag
  const handlePointerDown = useCallback((e) => {
    e.stopPropagation()
    const point = raycastToGround(e.clientX, e.clientY)
    dragStartRef.current = {
      mouseX: e.clientX,
      mouseY: e.clientY,
      objX: currentPos.x,
      objZ: currentPos.z,
      startPoint: point
    }
    gl.domElement.style.cursor = 'grabbing'
  }, [currentPos, gl.domElement, raycastToGround])

  // Global pointer move - handle drag
  useEffect(() => {
    const handlePointerMove = (e) => {
      if (!dragStartRef.current) return

      const dx = e.clientX - dragStartRef.current.mouseX
      const dy = e.clientY - dragStartRef.current.mouseY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > DRAG_THRESHOLD) {
        setIsDragging(true)
        const point = raycastToGround(e.clientX, e.clientY)
        if (point && onPositionChange) {
          const { snappedPos, snapType: newSnapType, snapLines } = applySnap({ x: point.x, z: point.z })
          setSnapType(newSnapType)
          onPositionChange(obj.id, snappedPos)
          onSnapLineChange?.(snapLines)
        }
      }
    }

    const handlePointerUp = () => {
      if (dragStartRef.current) {
        dragStartRef.current = null
        setIsDragging(false)
        setSnapType('none')
        onSnapLineChange?.([])
        gl.domElement.style.cursor = 'auto'
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [gl.domElement, obj.id, onPositionChange, raycastToGround, applySnap, onSnapLineChange])

  // Hover handlers for cursor
  const handlePointerEnter = useCallback(() => {
    setIsHovered(true)
    if (!isDragging) {
      gl.domElement.style.cursor = 'grab'
    }
  }, [isDragging, gl.domElement])

  const handlePointerLeave = useCallback(() => {
    setIsHovered(false)
    if (!isDragging) {
      gl.domElement.style.cursor = 'auto'
    }
  }, [isDragging, gl.domElement])

  // Render the appropriate 3D component based on object type
  const render3DObject = () => {
    switch (obj.id) {
      case 'soccerField': return <SoccerField3D obj={obj} />
      case 'basketballCourt': return <BasketballCourt3D obj={obj} />
      case 'tennisCourt': return <TennisCourt3D obj={obj} />
      case 'house': return <House3D obj={obj} />
      case 'parkingSpace': return <ParkingSpace3D obj={obj} />
      case 'swimmingPool': return <Pool3D obj={obj} />
      case 'carSedan': return <CarSedan3D obj={obj} />
      case 'shippingContainer': return <ShippingContainer3D obj={obj} />
      case 'schoolBus': return <SchoolBus3D obj={obj} />
      case 'kingSizeBed': return <KingSizeBed3D obj={obj} />
      case 'studioApartment': return <StudioApartment3D obj={obj} />
      default: return null
    }
  }

  // Render 2D rectangle for CAD view
  const render2DObject = () => {
    return (
      <group>
        {/* Colored fill */}
        <mesh rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[obj.width, obj.length]} />
          <meshBasicMaterial color={obj.color} transparent opacity={isHovered ? 0.9 : 0.6} />
        </mesh>
        {/* White outline */}
        <line rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={5}
              array={new Float32Array([
                -obj.width / 2, -obj.length / 2, 0,
                obj.width / 2, -obj.length / 2, 0,
                obj.width / 2, obj.length / 2, 0,
                -obj.width / 2, obj.length / 2, 0,
                -obj.width / 2, -obj.length / 2, 0,
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color={isHovered ? '#ffff00' : '#ffffff'} />
        </line>
      </group>
    )
  }

  const is2D = viewMode === '2d'

  // Calculate label height based on object type
  const labelHeight = ['house', 'shippingContainer', 'schoolBus'].includes(obj.id) ? 5 : 3

  // Convert rotation from degrees to radians
  const rotationRad = (rotation * Math.PI) / 180

  return (
    <group
      ref={groupRef}
      position={[currentPos.x, 0, currentPos.z]}
      rotation={[0, rotationRad, 0]}
      onPointerDown={handlePointerDown}
      onPointerEnter={handlePointerEnter}
      onPointerLeave={handlePointerLeave}
    >
      {/* Wrapper for opacity during drag */}
      <group>
        <mesh visible={false}>
          <boxGeometry args={[obj.width, 2, obj.length]} />
          <meshBasicMaterial transparent opacity={0} />
        </mesh>
        {is2D ? render2DObject() : render3DObject()}
      </group>

      {/* Billboard labels - 3D mode */}
      {!is2D && (
        <Billboard position={[0, labelHeight, 0]} follow={true}>
          <Text
            fontSize={1.2}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.12}
            outlineColor="#000000"
          >
            {obj.name}
          </Text>
          <Text
            position={[0, -1, 0]}
            fontSize={0.7}
            color="#eeeeee"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.08}
            outlineColor="#000000"
          >
            {formatDimensions(obj.width, obj.length, lengthUnit)}
          </Text>
        </Billboard>
      )}

      {/* 2D mode label (flat, above object) */}
      {is2D && (
        <Text
          position={[0, 0.15, 0]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.8}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
        >
          {obj.name}
        </Text>
      )}

      {/* Snap indicator while dragging */}
      {isDragging && snapType !== 'none' && (
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color="#14B8A6" />
        </mesh>
      )}

      {/* Overlap warning indicator */}
      {isOverlapping && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[obj.width + 0.5, obj.length + 0.5]} />
          <meshBasicMaterial color="#EF4444" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  )
}

// Snap guide line component
function SnapGuideLine({ line }) {
  if (line.type === 'vertical') {
    return (
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([line.x, 0.15, line.z1, line.x, 0.15, line.z2])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineDashedMaterial color="#14B8A6" dashSize={0.5} gapSize={0.3} linewidth={2} />
      </line>
    )
  } else {
    return (
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([line.x1, 0.15, line.z, line.x2, 0.15, line.z])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineDashedMaterial color="#14B8A6" dashSize={0.5} gapSize={0.3} linewidth={2} />
      </line>
    )
  }
}

// Wall segment component - renders a single wall between two points, with openings (doors/windows)
function WallSegment({ wall, lengthUnit = 'm', viewMode = 'firstPerson', isSelected = false, onSelect, isDeleteMode = false, onDelete, isOpeningMode = false, openingType = 'door', onPlaceOpening }) {
  const [isHovered, setIsHovered] = useState(false)
  const { start, end, height = 2.7, thickness = 0.15, openings = [] } = wall
  const is2D = viewMode === '2d'

  // Calculate wall length and angle
  const dx = end.x - start.x
  const dz = end.z - start.z
  const wallLength = Math.sqrt(dx * dx + dz * dz)
  const angle = Math.atan2(dx, dz)

  // Direction unit vector
  const dirX = wallLength > 0 ? dx / wallLength : 0
  const dirZ = wallLength > 0 ? dz / wallLength : 0

  // Format length for label
  const displayLength = lengthUnit === 'ft' ? wallLength * FEET_PER_METER : wallLength
  const lengthLabel = displayLength < 10
    ? `${displayLength.toFixed(1)}${lengthUnit}`
    : `${Math.round(displayLength)}${lengthUnit}`

  // Midpoint for label positioning
  const midX = (start.x + end.x) / 2
  const midZ = (start.z + end.z) / 2

  // Build wall segments around openings
  // Each segment: { startDist, endDist, bottomY, topY }
  const segments = useMemo(() => {
    if (!openings || openings.length === 0) {
      // No openings: single full segment
      return [{ startDist: 0, endDist: wallLength, bottomY: 0, topY: height }]
    }

    // Sort openings by position
    const sorted = [...openings].sort((a, b) => a.position - b.position)
    const segs = []
    let currentDist = 0

    for (const opening of sorted) {
      const openingStart = opening.position - opening.width / 2
      const openingEnd = opening.position + opening.width / 2

      // Solid segment before this opening
      if (openingStart > currentDist) {
        segs.push({ startDist: currentDist, endDist: openingStart, bottomY: 0, topY: height })
      }

      // For windows: wall below and above the opening
      if (opening.type === 'window') {
        const sillHeight = opening.sillHeight || 0.9
        const windowTop = sillHeight + opening.height

        // Wall below window (sill)
        if (sillHeight > 0) {
          segs.push({ startDist: openingStart, endDist: openingEnd, bottomY: 0, topY: sillHeight })
        }
        // Wall above window (header)
        if (windowTop < height) {
          segs.push({ startDist: openingStart, endDist: openingEnd, bottomY: windowTop, topY: height })
        }
      }
      // For doors: wall above the door (header)
      if (opening.type === 'door') {
        const doorHeight = opening.height || 2.1
        // Header segment above door (from door top to wall top)
        if (doorHeight < height) {
          segs.push({ startDist: openingStart, endDist: openingEnd, bottomY: doorHeight, topY: height })
        }
      }

      currentDist = openingEnd
    }

    // Final segment after last opening
    if (currentDist < wallLength) {
      segs.push({ startDist: currentDist, endDist: wallLength, bottomY: 0, topY: height })
    }

    return segs
  }, [openings, wallLength, height])

  // Helper: get world position at distance along wall
  const getWorldPos = (dist) => ({
    x: start.x + dirX * dist,
    z: start.z + dirZ * dist
  })

  // 2D rendering: flat rectangles from above (gaps for openings)
  if (is2D) {
    return (
      <group>
        {segments.map((seg, i) => {
          const segLength = seg.endDist - seg.startDist
          const centerDist = (seg.startDist + seg.endDist) / 2
          const pos = getWorldPos(centerDist)
          return (
            <mesh
              key={i}
              position={[pos.x, 0.1, pos.z]}
              rotation={[-Math.PI / 2, 0, -angle]}
            >
              <planeGeometry args={[thickness * 2, segLength]} />
              <meshBasicMaterial color="#ffffff" />
            </mesh>
          )
        })}

        {/* 2D Door symbols (swing arc) */}
        {openings.filter(o => o.type === 'door').map(opening => {
          const pos = getWorldPos(opening.position)
          const doorWidth = opening.width || 0.9
          const isDoubleDoor = opening.doorType === 'double'
          const leafWidth = isDoubleDoor ? doorWidth / 2 : doorWidth
          const arcSegments = 16

          if (isDoubleDoor) {
            // Double door: two swing arcs forming butterfly pattern
            const leftArcPoints = []
            const rightArcPoints = []
            for (let i = 0; i <= arcSegments; i++) {
              const a = (i / arcSegments) * (Math.PI / 2)
              // Left arc: swings to the left (negative Z)
              leftArcPoints.push([Math.sin(a) * leafWidth, 0.12, -Math.cos(a) * leafWidth])
              // Right arc: swings to the right (positive Z)
              rightArcPoints.push([Math.sin(a) * leafWidth, 0.12, Math.cos(a) * leafWidth])
            }
            return (
              <group key={`door2d-${opening.id}`} position={[pos.x, 0, pos.z]} rotation={[0, angle, 0]}>
                {/* Left door swing arc */}
                <Line points={leftArcPoints} color="#00ffff" lineWidth={1} />
                {/* Right door swing arc */}
                <Line points={rightArcPoints} color="#00ffff" lineWidth={1} />
                {/* Left door leaf (closed position) */}
                <Line points={[[0, 0.12, 0], [0, 0.12, -leafWidth]]} color="#00ffff" lineWidth={2} />
                {/* Right door leaf (closed position) */}
                <Line points={[[0, 0.12, 0], [0, 0.12, leafWidth]]} color="#00ffff" lineWidth={2} />
              </group>
            )
          }

          // Single door: one swing arc
          const arcPoints = []
          for (let i = 0; i <= arcSegments; i++) {
            const a = (i / arcSegments) * (Math.PI / 2)
            arcPoints.push([Math.sin(a) * doorWidth, 0.12, Math.cos(a) * doorWidth])
          }
          return (
            <group key={`door2d-${opening.id}`} position={[pos.x, 0, pos.z]} rotation={[0, angle, 0]}>
              {/* Door swing arc */}
              <Line points={arcPoints} color="#00ffff" lineWidth={1} />
              {/* Door leaf (closed position along wall) */}
              <Line points={[[0, 0.12, 0], [0, 0.12, doorWidth]]} color="#00ffff" lineWidth={2} />
            </group>
          )
        })}

        {/* 2D Window symbols (perpendicular lines) */}
        {openings.filter(o => o.type === 'window').map(opening => {
          const pos = getWorldPos(opening.position)
          const halfWidth = (opening.width || 1.2) / 2
          return (
            <group key={`window2d-${opening.id}`} position={[pos.x, 0, pos.z]} rotation={[0, angle, 0]}>
              {/* Two short perpendicular lines at window edges */}
              <Line points={[[-0.15, 0.12, -halfWidth], [0.15, 0.12, -halfWidth]]} color="#00ffff" lineWidth={1} />
              <Line points={[[-0.15, 0.12, halfWidth], [0.15, 0.12, halfWidth]]} color="#00ffff" lineWidth={1} />
            </group>
          )
        })}

        {/* Dimension label */}
        <Text
          position={[midX, 0.2, midZ]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.5}
          color="#00ffff"
          anchorX="center"
          anchorY="middle"
        >
          {lengthLabel}
        </Text>
      </group>
    )
  }

  // 3D rendering: wall segments with openings
  return (
    <group>
      {segments.map((seg, i) => {
        const segLength = seg.endDist - seg.startDist
        const segHeight = seg.topY - seg.bottomY
        const centerDist = (seg.startDist + seg.endDist) / 2
        const centerY = (seg.bottomY + seg.topY) / 2
        const pos = getWorldPos(centerDist)

        // Determine wall color based on state
        let wallColor = '#E5E5E5'
        let emissiveColor = '#000000'
        let emissiveInt = 0

        if (isDeleteMode && isHovered) {
          wallColor = '#FF4444'
          emissiveColor = '#FF0000'
          emissiveInt = 0.4
        } else if (isSelected) {
          wallColor = '#FFD700'
          emissiveColor = '#FFD700'
          emissiveInt = 0.3
        }

        return (
          <mesh
            key={i}
            position={[pos.x, centerY, pos.z]}
            rotation={[0, angle, 0]}
            castShadow
            receiveShadow
            onClick={(e) => {
              e.stopPropagation()
              if (isDeleteMode && onDelete) {
                onDelete()
              } else if (isOpeningMode && onPlaceOpening) {
                // Calculate position along wall from click point
                const clickPoint = e.point
                const toClickX = clickPoint.x - start.x
                const toClickZ = clickPoint.z - start.z
                const posOnWall = (toClickX * dirX + toClickZ * dirZ)
                onPlaceOpening(wall.id, posOnWall, openingType)
              } else if (onSelect) {
                onSelect()
              }
            }}
            onPointerEnter={() => setIsHovered(true)}
            onPointerLeave={() => setIsHovered(false)}
          >
            <boxGeometry args={[thickness, segHeight, segLength]} />
            <meshStandardMaterial
              color={wallColor}
              roughness={0.8}
              emissive={emissiveColor}
              emissiveIntensity={emissiveInt}
            />
          </mesh>
        )
      })}

      {/* Door frames */}
      {openings.filter(o => o.type === 'door').map(opening => {
        const pos = getWorldPos(opening.position)
        const frameThickness = 0.05
        const frameDepth = thickness + 0.02
        const doorHeight = opening.height || 2.1
        const doorWidth = opening.width || 0.9
        const isDoubleDoor = opening.doorType === 'double'

        return (
          <group key={`door-${opening.id}`} position={[pos.x, 0, pos.z]} rotation={[0, angle, 0]}>
            {/* Left frame */}
            <mesh position={[0, doorHeight / 2, -doorWidth / 2 - frameThickness / 2]} castShadow>
              <boxGeometry args={[frameDepth, doorHeight, frameThickness]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            {/* Right frame */}
            <mesh position={[0, doorHeight / 2, doorWidth / 2 + frameThickness / 2]} castShadow>
              <boxGeometry args={[frameDepth, doorHeight, frameThickness]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            {/* Top frame */}
            <mesh position={[0, doorHeight + frameThickness / 2, 0]} castShadow>
              <boxGeometry args={[frameDepth, frameThickness, doorWidth + frameThickness * 2]} />
              <meshStandardMaterial color="#8B4513" />
            </mesh>
            {/* Center mullion for double doors */}
            {isDoubleDoor && (
              <mesh position={[0, doorHeight / 2, 0]} castShadow>
                <boxGeometry args={[frameDepth, doorHeight, frameThickness]} />
                <meshStandardMaterial color="#8B4513" />
              </mesh>
            )}
          </group>
        )
      })}

      {/* Window glass panes */}
      {openings.filter(o => o.type === 'window').map(opening => {
        const pos = getWorldPos(opening.position)
        const winHeight = opening.height || 1.2
        const winWidth = opening.width || 1.2
        const sillHt = opening.sillHeight || 0.9
        const windowCenterY = sillHt + winHeight / 2
        const frameThick = 0.04
        const frameDepth = 0.06
        return (
          <group key={`window-${opening.id}`} position={[pos.x, windowCenterY, pos.z]} rotation={[0, angle, 0]}>
            {/* Glass pane - highly transparent */}
            <mesh rotation={[0, Math.PI / 2, 0]}>
              <planeGeometry args={[winWidth - frameThick * 2, winHeight - frameThick * 2]} />
              <meshStandardMaterial color="#88CCEE" transparent opacity={0.2} side={2} roughness={0} metalness={0.1} />
            </mesh>
            {/* Frame - top */}
            <mesh position={[0, winHeight / 2 - frameThick / 2, 0]}>
              <boxGeometry args={[frameDepth, frameThick, winWidth]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            {/* Frame - bottom */}
            <mesh position={[0, -winHeight / 2 + frameThick / 2, 0]}>
              <boxGeometry args={[frameDepth, frameThick, winWidth]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            {/* Frame - left */}
            <mesh position={[0, 0, -winWidth / 2 + frameThick / 2]}>
              <boxGeometry args={[frameDepth, winHeight, frameThick]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            {/* Frame - right */}
            <mesh position={[0, 0, winWidth / 2 - frameThick / 2]}>
              <boxGeometry args={[frameDepth, winHeight, frameThick]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            {/* Center crossbar - horizontal */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[frameDepth / 2, frameThick / 2, winWidth - frameThick * 2]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            {/* Center crossbar - vertical */}
            <mesh position={[0, 0, 0]}>
              <boxGeometry args={[frameDepth / 2, winHeight - frameThick * 2, frameThick / 2]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
          </group>
        )
      })}

      {/* Dimension label at top of wall */}
      <Billboard position={[midX, height + 0.5, midZ]} follow={true}>
        <Text
          fontSize={0.4}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          {lengthLabel}
        </Text>
      </Billboard>
    </group>
  )
}

// Room floor component - renders floor and area label for detected rooms
function RoomFloor({ room, isSelected, viewMode = 'firstPerson', lengthUnit = 'm', onSelect, isSelectMode = false }) {
  const [isHovered, setIsHovered] = useState(false)
  const is2D = viewMode === '2d'

  // Create shape from room points
  const shape = useMemo(() => {
    if (!room.points || room.points.length < 3) return null

    const s = new THREE.Shape()
    s.moveTo(room.points[0].x, room.points[0].z)

    for (let i = 1; i < room.points.length; i++) {
      s.lineTo(room.points[i].x, room.points[i].z)
    }

    s.closePath()
    return s
  }, [room.points])

  if (!shape) return null

  // Calculate area display
  const FEET_PER_METER = 3.28084
  const SQ_FEET_PER_SQ_METER = 10.7639
  const areaDisplay = lengthUnit === 'ft'
    ? `${(room.area * SQ_FEET_PER_SQ_METER).toFixed(0)} ft²`
    : `${room.area.toFixed(1)} m²`

  // Determine colors based on state
  let floorColor = is2D ? '#1E3A3A' : '#3A3A3A'
  let floorOpacity = is2D ? 0.4 : 0.8
  if (isSelected) {
    floorColor = is2D ? '#14B8A6' : '#2A5A4A'
    floorOpacity = is2D ? 0.5 : 0.9
  } else if (isHovered && isSelectMode) {
    floorColor = is2D ? '#1A4A4A' : '#4A4A4A'
  }

  return (
    <group>
      {/* Floor surface */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, is2D ? 0.01 : 0.02, 0]}
        receiveShadow
        onClick={(e) => {
          if (isSelectMode && onSelect) {
            e.stopPropagation()
            onSelect()
          }
        }}
        onPointerEnter={() => setIsHovered(true)}
        onPointerLeave={() => setIsHovered(false)}
      >
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color={floorColor}
          transparent
          opacity={floorOpacity}
        />
      </mesh>

      {/* Room area label */}
      {is2D ? (
        <Text
          position={[room.center.x, 0.05, room.center.z]}
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={1.0}
          color={isSelected ? '#22D3EE' : '#00FFFF'}
          anchorX="center"
          anchorY="middle"
        >
          {areaDisplay}
        </Text>
      ) : (
        <Billboard position={[room.center.x, 0.5, room.center.z]} follow={true}>
          <Text
            fontSize={0.6}
            color="#FFFFFF"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.04}
            outlineColor="#000000"
          >
            {areaDisplay}
          </Text>
        </Billboard>
      )}
    </group>
  )
}

function Scene({ length, width, isExploring, comparisonObjects = [], polygonPoints, placedBuildings = [], selectedBuilding, selectedBuildingType, onPlaceBuilding, onDeleteBuilding, joystickInput, lengthUnit = 'm', onCameraUpdate, buildingRotation = 0, snapInfo, onPointerMove, setbacksEnabled = false, setbackDistanceM = 0, placementValid = true, overlappingBuildingIds = new Set(), labels = {}, canEdit = true, analyticsMode = 'example', cameraMode, setCameraMode, followDistance, setFollowDistance, orbitEnabled, setOrbitEnabled, viewMode = 'firstPerson', fitToLandTrigger = 0, quality = QUALITY.MEDIUM, comparisonPositions = {}, onComparisonPositionChange, comparisonRotations = {}, onComparisonRotationChange, gridSnapEnabled = false, gridSize = 1, walls = [], wallDrawingMode = false, setWallDrawingMode, wallDrawingPoints = [], setWallDrawingPoints, addWallFromPoints, openingPlacementMode = 'none', setOpeningPlacementMode, addOpeningToWall, activeBuildTool = 'none', setActiveBuildTool, selectedElement, setSelectedElement, BUILD_TOOLS = {}, deleteWall, doorWidth = 0.9, doorHeight = 2.1, windowWidth = 1.2, windowHeight = 1.2, windowSillHeight = 0.9, rooms = [], floorPlanImage = null, floorPlanSettings = {}, buildings = [], floorPlanPlacementMode = false, pendingFloorPlan = null, buildingPreviewPosition = { x: 0, z: 0 }, setBuildingPreviewPosition, buildingPreviewRotation = 0, placeFloorPlanBuilding, selectedBuildingId = null, setSelectedBuildingId, moveSelectedBuilding }) {
  const { camera } = useThree()
  const [previewPos, setPreviewPos] = useState(null)
  const qualitySettings = QUALITY_SETTINGS[quality]

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
  const [playerState, setPlayerState] = useState({ position: { x: 0, y: 1.65, z: 0 }, rotation: 0, velocity: 0 })

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

  // Wall drawing state
  const [wallPreviewPos, setWallPreviewPos] = useState(null)
  const [shiftHeld, setShiftHeld] = useState(false)
  const CLOSE_THRESHOLD = 1.0 // meters - snap to close loop when within this distance
  const ANGLE_SNAP_THRESHOLD = 0.15 // radians (~8.5°) - snap to 90° angles within this

  // Room tool state (click-drag rectangle)
  const [roomDragState, setRoomDragState] = useState({
    isDragging: false,
    startPoint: null,
    currentPoint: null
  })

  // Opening (door/window) hover preview state
  const [openingHover, setOpeningHover] = useState({
    wall: null,           // The wall being hovered
    positionOnWall: 0,    // Distance along wall from start
    isValid: false        // Whether placement is valid
  })

  // Wall tool mode - combines legacy wallDrawingMode and new activeBuildTool
  const isWallMode = wallDrawingMode || activeBuildTool === BUILD_TOOLS.WALL

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

  // Snap point for wall drawing (90° angles, grid, corners)
  const snapWallPoint = useCallback((rawPoint, lastPoint) => {
    let point = { ...rawPoint }

    // 1. Snap to existing wall corners (highest priority)
    const CORNER_SNAP = 0.8
    for (const wall of walls) {
      for (const corner of [wall.start, wall.end]) {
        const dx = point.x - corner.x
        const dz = point.z - corner.z
        if (Math.sqrt(dx * dx + dz * dz) < CORNER_SNAP) {
          return { x: corner.x, z: corner.z }
        }
      }
    }
    // Also snap to drawing points
    for (const dp of wallDrawingPoints) {
      const dx = point.x - dp.x
      const dz = point.z - dp.z
      if (Math.sqrt(dx * dx + dz * dz) < CORNER_SNAP) {
        return { x: dp.x, z: dp.z }
      }
    }

    // 2. 90° angle snap (if we have a previous point and shift not held)
    if (lastPoint && !shiftHeld) {
      const dx = point.x - lastPoint.x
      const dz = point.z - lastPoint.z
      const angle = Math.atan2(dx, dz)
      const length = Math.sqrt(dx * dx + dz * dz)

      // Snap to nearest 90° (0, π/2, π, 3π/2)
      const snapAngles = [0, Math.PI / 2, Math.PI, -Math.PI / 2, -Math.PI]
      for (const snapAngle of snapAngles) {
        if (Math.abs(angle - snapAngle) < ANGLE_SNAP_THRESHOLD) {
          point = {
            x: lastPoint.x + Math.sin(snapAngle) * length,
            z: lastPoint.z + Math.cos(snapAngle) * length
          }
          break
        }
      }
    }

    // 3. Grid snap (lowest priority)
    if (gridSnapEnabled) {
      point = {
        x: Math.round(point.x / gridSize) * gridSize,
        z: Math.round(point.z / gridSize) * gridSize
      }
    }

    return point
  }, [walls, wallDrawingPoints, shiftHeld, gridSnapEnabled, gridSize])

  // Snap point for room tool (grid only for simplicity)
  const snapRoomPoint = useCallback((rawPoint) => {
    let point = { x: rawPoint.x, z: rawPoint.z }
    if (gridSnapEnabled) {
      point = {
        x: Math.round(point.x / gridSize) * gridSize,
        z: Math.round(point.z / gridSize) * gridSize
      }
    }
    return point
  }, [gridSnapEnabled, gridSize])

  // Handle room tool pointer down (start dragging)
  const handleRoomPointerDown = (e) => {
    if (activeBuildTool !== BUILD_TOOLS.ROOM) return
    e.stopPropagation()
    const point = snapRoomPoint(e.point)
    setRoomDragState({
      isDragging: true,
      startPoint: point,
      currentPoint: point
    })
  }

  // Handle room tool pointer up (finish rectangle, create walls)
  const handleRoomPointerUp = (e) => {
    if (!roomDragState.isDragging) return
    e.stopPropagation()

    const { startPoint, currentPoint } = roomDragState
    if (startPoint && currentPoint) {
      // Calculate rectangle dimensions
      const minX = Math.min(startPoint.x, currentPoint.x)
      const maxX = Math.max(startPoint.x, currentPoint.x)
      const minZ = Math.min(startPoint.z, currentPoint.z)
      const maxZ = Math.max(startPoint.z, currentPoint.z)

      const width = maxX - minX
      const height = maxZ - minZ

      // Only create if big enough (at least 0.5m on each side)
      if (width >= 0.5 && height >= 0.5) {
        // Create 4 corners
        const corners = [
          { x: minX, z: minZ }, // bottom-left
          { x: maxX, z: minZ }, // bottom-right
          { x: maxX, z: maxZ }, // top-right
          { x: minX, z: maxZ }, // top-left
          { x: minX, z: minZ }, // back to start (close loop)
        ]
        addWallFromPoints?.(corners)
      }
    }

    // Reset drag state
    setRoomDragState({
      isDragging: false,
      startPoint: null,
      currentPoint: null
    })
  }

  const handleLandClick = (e) => {
    e.stopPropagation()
    const point = e.point

    // Floor plan placement mode - place building on click
    if (floorPlanPlacementMode && placeFloorPlanBuilding) {
      placeFloorPlanBuilding({ x: point.x, z: point.z })
      return
    }

    // Move selected building to clicked position
    if (selectedBuildingId && moveSelectedBuilding) {
      moveSelectedBuilding({ x: point.x, z: point.z })
      return
    }

    // Room tool uses pointer down/up, not click
    if (activeBuildTool === BUILD_TOOLS.ROOM) return

    // Wall drawing mode takes priority (legacy mode or Wall tool)
    if (isWallMode && setWallDrawingPoints) {
      const lastPoint = wallDrawingPoints.length > 0 ? wallDrawingPoints[wallDrawingPoints.length - 1] : null
      const newPoint = snapWallPoint({ x: point.x, z: point.z }, lastPoint)

      // Check if close to starting point (close loop)
      if (wallDrawingPoints.length >= 3) {
        const start = wallDrawingPoints[0]
        const dx = newPoint.x - start.x
        const dz = newPoint.z - start.z
        const dist = Math.sqrt(dx * dx + dz * dz)
        if (dist < CLOSE_THRESHOLD) {
          // Close the loop - add starting point again and finish
          const closedPoints = [...wallDrawingPoints, start]
          addWallFromPoints?.(closedPoints)
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

        // Opening specs
        const isDoor = effectiveOpeningMode === 'door'
        const openingWidth = isDoor ? 0.9 : 1.2
        const openingHeight = isDoor ? 2.1 : 1.2
        const sillHeight = isDoor ? 0 : 0.9
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
      setBuildingPreviewPosition({ x: point.x, z: point.z })
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

    // Wall drawing preview (with snapping)
    if (isWallMode) {
      const lastPoint = wallDrawingPoints.length > 0 ? wallDrawingPoints[wallDrawingPoints.length - 1] : null
      const snappedPoint = snapWallPoint({ x: point.x, z: point.z }, lastPoint)
      setWallPreviewPos(snappedPoint)
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
  }

  // Escape key to finish wall drawing
  useEffect(() => {
    if (!isWallMode) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        // Finish drawing - create walls from current points
        if (wallDrawingPoints.length >= 2) {
          addWallFromPoints?.(wallDrawingPoints)
        }
        setWallDrawingPoints?.([])
        setWallDrawingMode?.(false)
        // Also reset wall tool
        if (activeBuildTool === BUILD_TOOLS.WALL) {
          setActiveBuildTool?.(BUILD_TOOLS.NONE)
        }
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [isWallMode, wallDrawingPoints, addWallFromPoints, setWallDrawingPoints, setWallDrawingMode, activeBuildTool, setActiveBuildTool, BUILD_TOOLS])

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

  // Escape key to cancel room tool drag
  useEffect(() => {
    if (!roomDragState.isDragging) return

    const handleKeyDown = (e) => {
      if (e.key === 'Escape') {
        setRoomDragState({
          isDragging: false,
          startPoint: null,
          currentPoint: null
        })
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [roomDragState.isDragging])

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

  // Build tool keyboard shortcuts: R=Room, W=Wall, D=Door, N=Window, S=Select, X=Delete
  useEffect(() => {
    const handleKeyDown = (e) => {
      // Ignore if typing in an input
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') return

      const key = e.key.toLowerCase()

      // Toggle tool (press again to deselect)
      const toggleTool = (tool) => {
        if (activeBuildTool === tool) {
          setActiveBuildTool?.(BUILD_TOOLS.NONE)
        } else {
          setActiveBuildTool?.(tool)
          // Clear any in-progress drawing
          setWallDrawingPoints?.([])
          setSelectedElement?.(null)
        }
      }

      switch (key) {
        case 'r':
          toggleTool(BUILD_TOOLS.ROOM)
          break
        case 'w':
          // Only if not moving (WASD) - check if in exploring mode
          if (!isExploring) {
            toggleTool(BUILD_TOOLS.WALL)
          }
          break
        case 'd':
          toggleTool(BUILD_TOOLS.DOOR)
          break
        case 'n':
          toggleTool(BUILD_TOOLS.WINDOW)
          break
        case 's':
          // Only if not moving (WASD)
          if (!isExploring) {
            toggleTool(BUILD_TOOLS.SELECT)
          }
          break
        case 'x':
          toggleTool(BUILD_TOOLS.DELETE)
          break
        case 'delete':
        case 'backspace':
          // Delete selected element
          if (selectedElement?.type === 'wall' && deleteWall) {
            e.preventDefault()
            deleteWall(selectedElement.id)
          }
          break
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [activeBuildTool, setActiveBuildTool, BUILD_TOOLS, setWallDrawingPoints, setSelectedElement, isExploring, selectedElement, deleteWall])

  useEffect(() => {
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
      {/* Linear fog for depth (hidden in 2D mode) */}
      {viewMode !== '2d' && <fog attach="fog" args={['#b8d4e8', 80, 300]} />}

      {/* Original gradient sky with clouds (hidden in 2D mode) */}
      {viewMode !== '2d' && <RealisticSky />}

      {/* Main sun light */}
      <directionalLight
        position={SUN_POSITION}
        intensity={1.2}
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
      <ambientLight intensity={0.5} color="#f0f5ff" />

      {/* Fill light from opposite side */}
      <directionalLight position={[-30, 40, -20]} intensity={0.3} color="#ffe4c4" />

      {/* Hidden in 2D mode - 3D environment elements */}
      {viewMode !== '2d' && <DistantTreeline />}

      {/* Enhanced ground with quality-based materials (hidden in 2D - show flat dark surface) */}
      {viewMode !== '2d' && <EnhancedGround quality={quality} />}

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
      {viewMode !== '2d' && (
        <>
          <NPCCharacter
            id="guide1"
            position={npcPositions.guide1.position}
            rotation={npcPositions.guide1.rotation}
          />
          <NPCCharacter
            id="guide2"
            position={npcPositions.guide2.position}
            rotation={npcPositions.guide2.rotation}
          />
        </>
      )}

      {/* Placed buildings */}
      {placedBuildings.map((building) => (
        <PlacedBuilding
          key={building.id}
          building={building}
          onDelete={onDeleteBuilding}
          lengthUnit={lengthUnit}
          isOverlapping={overlappingBuildingIds.has(building.id)}
          showLabels={labels.buildings}
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

              {/* Outline */}
              <line position={[0, 0.06, 0]} rotation={[-Math.PI / 2, 0, 0]}>
                <bufferGeometry>
                  <bufferAttribute
                    attach="attributes-position"
                    count={5}
                    array={new Float32Array([
                      minX, minZ, 0,
                      maxX, minZ, 0,
                      maxX, maxZ, 0,
                      minX, maxZ, 0,
                      minX, minZ, 0,
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

      {/* Room floors */}
      {rooms.map((room) => (
        <RoomFloor
          key={room.id}
          room={room}
          isSelected={selectedElement?.type === 'room' && selectedElement?.id === room.id}
          viewMode={viewMode}
          lengthUnit={lengthUnit}
          isSelectMode={activeBuildTool === BUILD_TOOLS.SELECT}
          onSelect={() => setSelectedElement?.({ type: 'room', id: room.id })}
        />
      ))}

      {/* Walls */}
      {walls.map((wall) => (
        <WallSegment
          key={wall.id}
          wall={wall}
          lengthUnit={lengthUnit}
          viewMode={viewMode}
          isSelected={selectedElement?.type === 'wall' && selectedElement?.id === wall.id}
          onSelect={activeBuildTool === BUILD_TOOLS.SELECT ? () => {
            setSelectedElement?.({ type: 'wall', id: wall.id })
          } : undefined}
          isDeleteMode={activeBuildTool === BUILD_TOOLS.DELETE}
          onDelete={activeBuildTool === BUILD_TOOLS.DELETE ? () => {
            deleteWall?.(wall.id)
          } : undefined}
          isOpeningMode={effectiveOpeningMode !== 'none'}
          openingType={effectiveOpeningMode}
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
      ))}

      {/* Buildings (placed floor plans) */}
      {buildings.map((building) => (
        <group
          key={building.id}
          position={[building.position.x, 0, building.position.z]}
          rotation={[0, building.rotation || 0, 0]}
        >
          {building.walls.map((wall, wallIndex) => (
            <WallSegment
              key={`${building.id}-wall-${wallIndex}`}
              wall={wall}
              lengthUnit={lengthUnit}
              viewMode={viewMode}
              isSelected={selectedBuildingId === building.id}
              onSelect={() => setSelectedBuildingId?.(building.id)}
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
            const len = Math.sqrt(dx * dx + dz * dz)
            if (len < 0.1) return null

            const angle = Math.atan2(dx, dz)
            const midX = (lastPoint.x + wallPreviewPos.x) / 2
            const midZ = (lastPoint.z + wallPreviewPos.z) / 2
            const is2D = viewMode === '2d'
            const wallHeight = 2.7

            return (
              <group>
                {/* 3D wall box preview (1P/3D only) */}
                {!is2D && (
                  <mesh position={[midX, wallHeight / 2, midZ]} rotation={[0, angle, 0]}>
                    <boxGeometry args={[0.15, wallHeight, len]} />
                    <meshBasicMaterial color={PREVIEW_COLOR_VALID} transparent opacity={PREVIEW_OPACITY} />
                  </mesh>
                )}

                {/* Base line (visible in all modes) */}
                <line>
                  <bufferGeometry>
                    <bufferAttribute
                      attach="attributes-position"
                      count={2}
                      array={new Float32Array([
                        lastPoint.x, is2D ? 0.06 : 0.15, lastPoint.z,
                        wallPreviewPos.x, is2D ? 0.06 : 0.15, wallPreviewPos.z
                      ])}
                      itemSize={3}
                    />
                  </bufferGeometry>
                  <lineDashedMaterial color={PREVIEW_COLOR_VALID} dashSize={0.5} gapSize={0.3} linewidth={2} />
                </line>

                {/* End point marker */}
                <mesh position={[wallPreviewPos.x, 0.1, wallPreviewPos.z]}>
                  <sphereGeometry args={[0.12]} />
                  <meshBasicMaterial color={PREVIEW_COLOR_VALID} />
                </mesh>

                {/* Length dimension label */}
                <PreviewDimensionLabel
                  position={[midX, is2D ? 0.5 : wallHeight + 0.3, midZ]}
                  text={`${len.toFixed(1)}m`}
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
        enabled={isExploring && !selectedBuilding && viewMode === 'firstPerson'}
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
      />

      {/* Orbit controls (when orbit mode enabled) */}
      {orbitEnabled && (
        <OrbitControls
          ref={orbitControlsRef}
          target={orbitTarget}
          enablePan={true}
          minDistance={3}
          maxDistance={MAX_DISTANCE}
          maxPolarAngle={Math.PI / 2 - 0.1}
          mouseButtons={{
            LEFT: THREE.MOUSE.ROTATE,
            MIDDLE: THREE.MOUSE.PAN,
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
            enableRotate={false}
            enableDamping={false}
            minZoom={1}
            maxZoom={100}
            maxPolarAngle={0}
            minPolarAngle={0}
            minAzimuthAngle={0}
            maxAzimuthAngle={0}
            screenSpacePanning={true}
            mouseButtons={{
              LEFT: THREE.MOUSE.PAN,
              MIDDLE: THREE.MOUSE.PAN,
              RIGHT: null
            }}
            touches={{
              ONE: THREE.TOUCH.PAN,
              TWO: THREE.TOUCH.DOLLY_PAN
            }}
          />
        </>
      )}

      {/* Animated player mesh (visible in TP mode only, hidden in orbit and 2D) */}
      <AnimatedPlayerMesh
        visible={cameraMode === CAMERA_MODE.THIRD_PERSON && viewMode === 'firstPerson'}
        position={playerState.position}
        rotation={playerState.rotation}
        velocity={playerState.velocity}
      />

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

      {/* Postprocessing effects */}
      <PostProcessing quality={quality} />
    </>
  )
}

export default function LandScene({ length, width, isExploring, comparisonObjects = [], polygonPoints, placedBuildings = [], selectedBuilding, selectedBuildingType, onPlaceBuilding, onDeleteBuilding, joystickInput, lengthUnit = 'm', onCameraUpdate, buildingRotation = 0, snapInfo, onPointerMove, setbacksEnabled = false, setbackDistanceM = 0, placementValid = true, overlappingBuildingIds = new Set(), labels = {}, canEdit = true, analyticsMode = 'example', cameraMode, setCameraMode, followDistance, setFollowDistance, orbitEnabled, setOrbitEnabled, viewMode = 'firstPerson', fitToLandTrigger = 0, quality = QUALITY.MEDIUM, comparisonPositions = {}, onComparisonPositionChange, comparisonRotations = {}, onComparisonRotationChange, gridSnapEnabled = false, gridSize = 1, walls = [], wallDrawingMode = false, setWallDrawingMode, wallDrawingPoints = [], setWallDrawingPoints, addWallFromPoints, openingPlacementMode = 'none', setOpeningPlacementMode, addOpeningToWall, activeBuildTool = 'none', setActiveBuildTool, selectedElement, setSelectedElement, BUILD_TOOLS = {}, deleteWall, doorWidth = 0.9, doorHeight = 2.1, windowWidth = 1.2, windowHeight = 1.2, windowSillHeight = 0.9, rooms = [], floorPlanImage = null, floorPlanSettings = {}, buildings = [], floorPlanPlacementMode = false, pendingFloorPlan = null, buildingPreviewPosition = { x: 0, z: 0 }, setBuildingPreviewPosition, buildingPreviewRotation = 0, placeFloorPlanBuilding, selectedBuildingId = null, setSelectedBuildingId, moveSelectedBuilding }) {
  const qualitySettings = QUALITY_SETTINGS[quality]

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
    <Canvas
      dpr={dpr}
      shadows={qualitySettings.shadowsEnabled ? qualitySettings.shadowType : false}
      camera={{ fov: 60, near: 0.1, far: 1000 }}
      style={{ background: bgColor, cursor: viewMode === '2d' ? 'crosshair' : 'default' }}
      gl={{
        preserveDrawingBuffer: true
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
        windowWidth={windowWidth}
        windowHeight={windowHeight}
        windowSillHeight={windowSillHeight}
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
      />
    </Canvas>
  )
}

// Export constants for use in App.jsx
export { CAMERA_MODE, DEFAULT_TP_DISTANCE, ORBIT_START_DISTANCE, QUALITY }
