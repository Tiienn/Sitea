/**
 * Unified Camera Controller
 * Handles first-person, third-person, and zoom switching
 * Includes WASD movement, jumping, wall collision, and touch support
 */

import { useRef, useEffect } from 'react'
import { useFrame, useThree } from '@react-three/fiber'
import * as THREE from 'three'
import {
  CAMERA_MODE,
  MIN_DISTANCE,
  SWITCH_OUT_DISTANCE,
  SWITCH_IN_DISTANCE,
  MAX_DISTANCE,
  DEFAULT_TP_DISTANCE,
  FOLLOW_SMOOTH,
  WALK_SPEED,
  RUN_SPEED,
  ZOOM_SPEED,
  PINCH_SPEED,
  CAMERA_BOB_WALK,
  CAMERA_BOB_RUN,
  CAMERA_BOB_SPEED,
  JUMP_FORCE,
  GRAVITY,
  PLAYER_HEIGHT
} from '../../constants/landSceneConstants'
import {
  trackFirstMovement,
  trackWalk5sCompleted,
  accumulateWalkTime,
} from '../../services/analytics'

export function CameraController({
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
  walls = [],
  mobileRunning = false,
  mobileJumpTrigger = 0
}) {
  const { camera, gl } = useThree()

  // Player state (separate from camera in TP mode)
  const playerPosition = useRef(new THREE.Vector3(0, PLAYER_HEIGHT, 0))
  const playerYaw = useRef(0) // Y-axis rotation

  // Jump state
  const verticalVelocity = useRef(0)
  const isGrounded = useRef(true)

  // Input state
  const moveState = useRef({ forward: false, backward: false, left: false, right: false })
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const isLocked = useRef(false)
  const isTouchDevice = useRef(false)
  const touchLookActive = useRef(false)
  const lastTouch = useRef({ x: 0, y: 0 })
  const shiftHeld = useRef(false)
  const lastMobileJumpTrigger = useRef(0)

  // Pinch zoom state
  const lastPinchDistance = useRef(0)

  // Analytics
  const hasTrackedFirstMove = useRef(false)

  // Movement speed with acceleration
  const currentSpeed = useRef(0)
  const accelerationTime = 0.25  // Smoother acceleration
  const decelerationTime = 0.35  // Momentum when stopping

  // Camera bob time accumulator
  const bobTimeRef = useRef(0)

  // Initialize player position from camera on mount
  useEffect(() => {
    playerPosition.current.copy(camera.position)
    playerPosition.current.y = PLAYER_HEIGHT
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

    // Desktop: pointer lock for look (only when camera control is enabled)
    const lockPointer = () => {
      if (!isTouchDevice.current && !orbitEnabled && enabled) {
        canvas.requestPointerLock()
      }
    }

    const onPointerLockChange = () => {
      isLocked.current = document.pointerLockElement === canvas
    }

    const onMouseMove = (e) => {
      if (!isLocked.current || orbitEnabled) return

      // Update euler directly (don't read from camera - TP mode's lookAt overwrites it)
      euler.current.y -= e.movementX * 0.002
      euler.current.x -= e.movementY * 0.002
      euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x))

      // Only set camera quaternion directly in FP mode
      // TP mode handles camera orientation in useFrame via lookAt
      if (cameraMode === CAMERA_MODE.FIRST_PERSON) {
        camera.quaternion.setFromEuler(euler.current)
      }

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
        case 'Space':
          // Jump when grounded
          if (isGrounded.current) {
            verticalVelocity.current = JUMP_FORCE
            isGrounded.current = false
          }
          break
        case 'KeyV':
          // Cycle camera modes: FP -> TP -> Orbit -> FP
          if (cameraMode === CAMERA_MODE.FIRST_PERSON) {
            setFollowDistance(DEFAULT_TP_DISTANCE)
            setCameraMode(CAMERA_MODE.THIRD_PERSON)
          } else if (cameraMode === CAMERA_MODE.THIRD_PERSON) {
            // Note: Orbit mode requires orbitEnabled which is managed externally
            // For now, cycle back to FP
            setFollowDistance(0)
            setCameraMode(CAMERA_MODE.FIRST_PERSON)
          }
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

    // Note: Pointer lock must be triggered by user gesture (click), not on mount
    // The click handler on line 268 handles this

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

    // Speed calculation with smooth acceleration and momentum
    const targetSpeed = ((shiftHeld.current || mobileRunning) && isMoving) ? RUN_SPEED : WALK_SPEED
    if (isMoving) {
      // Smooth eased acceleration
      const accelRate = (targetSpeed / accelerationTime) * delta
      currentSpeed.current = Math.min(targetSpeed, currentSpeed.current + accelRate)
    } else {
      // Slower deceleration for momentum/slide feel
      const decelRate = (WALK_SPEED / decelerationTime) * delta
      currentSpeed.current = Math.max(0, currentSpeed.current - decelRate)
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

    // Mobile jump trigger
    if (mobileJumpTrigger !== lastMobileJumpTrigger.current) {
      lastMobileJumpTrigger.current = mobileJumpTrigger
      if (isGrounded.current) {
        verticalVelocity.current = JUMP_FORCE
        isGrounded.current = false
      }
    }

    // Apply gravity and jumping physics
    if (!isGrounded.current) {
      verticalVelocity.current -= GRAVITY * delta
      playerPosition.current.y += verticalVelocity.current * delta

      // Ground check
      if (playerPosition.current.y <= PLAYER_HEIGHT) {
        playerPosition.current.y = PLAYER_HEIGHT
        verticalVelocity.current = 0
        isGrounded.current = true
      }
    }

    // Update camera based on mode
    if (cameraMode === CAMERA_MODE.FIRST_PERSON) {
      // FP: camera at player position with subtle bob
      camera.position.copy(playerPosition.current)

      // Camera bob when moving (paused during jump for better feel)
      if (currentSpeed.current > 0.1 && isGrounded.current) {
        bobTimeRef.current += delta * CAMERA_BOB_SPEED * (currentSpeed.current / WALK_SPEED)
        const isRunning = currentSpeed.current > WALK_SPEED * 1.2
        const bobAmplitude = isRunning ? CAMERA_BOB_RUN : CAMERA_BOB_WALK
        // Vertical bob - use abs(sin) for double-frequency (one per footstep)
        const verticalBob = Math.abs(Math.sin(bobTimeRef.current)) * bobAmplitude
        camera.position.y += verticalBob
        // Subtle lateral sway (half frequency of vertical)
        const lateralSway = Math.sin(bobTimeRef.current * 0.5) * bobAmplitude * 0.3
        camera.position.x += lateralSway * Math.cos(playerYaw.current)
        camera.position.z -= lateralSway * Math.sin(playerYaw.current)
      }
    } else if (cameraMode === CAMERA_MODE.THIRD_PERSON) {
      // TP: camera behind and above player
      // Invert pitch so mouse-up = look up (consistent with FP mode)
      const pitch = -euler.current.x
      const yaw = playerYaw.current

      // Calculate camera offset (behind player based on yaw and pitch)
      const offsetX = Math.sin(yaw) * Math.cos(pitch) * followDistance
      const offsetY = Math.sin(pitch) * followDistance + PLAYER_HEIGHT
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
      // Determine movement type from raw input (before yaw rotation)
      const ms = moveState.current
      const jx = joystickInput?.current?.x || 0
      const jy = joystickInput?.current?.y || 0
      const hasForward = ms.forward || jy > 0.1
      const hasBackward = ms.backward || jy < -0.1
      const hasStrafeLeft = ms.left || jx < -0.1
      const hasStrafeRight = ms.right || jx > 0.1

      const isRunning = shiftHeld.current || mobileRunning

      let moveType = 'idle'
      if (currentSpeed.current > 0.1) {
        if (!isGrounded.current) moveType = 'jump'
        else if (hasBackward && !hasForward) moveType = 'walkback'
        else if (hasStrafeLeft && !hasForward && !hasBackward) moveType = isRunning ? 'straferunleft' : 'strafe'
        else if (hasStrafeRight && !hasForward && !hasBackward) moveType = isRunning ? 'straferunright' : 'straferight'
        else if (isRunning) moveType = 'run'
        else moveType = 'walk'
      }
      if (isGrounded.current === false && verticalVelocity.current !== 0) moveType = 'jump'

      onPlayerPositionUpdate({
        position: { x: playerPosition.current.x, y: playerPosition.current.y, z: playerPosition.current.z },
        rotation: playerYaw.current,
        velocity: currentSpeed.current,
        moveType
      })
    }
  })

  return null
}
