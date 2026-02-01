import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { SQ_FEET_PER_SQ_METER } from '../../constants/landSceneConstants'
import { findWallsForRoom } from '../../utils/roomDetection'
import { createFloorTexture } from '../../utils/textureGenerators'

/**
 * RoomFloor - renders floor and area label for detected rooms
 * Supports drag-to-move functionality, floor patterns/textures, and selection states
 */
export function RoomFloor({ room, isSelected, viewMode = 'firstPerson', lengthUnit = 'm', onSelect, label = '', onLabelChange, style = {}, walls = [], moveWallsByIds, commitWallsToHistory, setRoomMoveDragState, onOpenProperties, floorYOffset = 0, isInactiveFloor = false }) {
  const { camera, gl } = useThree()
  const [isHovered, setIsHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, z: 0 }) // Local visual offset during drag
  const dragStartRef = useRef(null)
  const moveWallsByIdsRef = useRef(moveWallsByIds)
  const is2D = viewMode === '2d'

  // Manual double-click tracking (to avoid browser's persistent dblclick timing)
  const clickTracker = useRef({ lastClickTime: 0 })
  const DOUBLE_CLICK_THRESHOLD = 400 // ms

  // Reset click tracker when selection changes (e.g., after Escape closes properties)
  useEffect(() => {
    clickTracker.current = { lastClickTime: 0 }
  }, [isSelected])

  // Keep moveWallsByIds ref updated
  useEffect(() => {
    moveWallsByIdsRef.current = moveWallsByIds
  }, [moveWallsByIds])

  // Ground plane for raycasting during drag
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  // Raycast to ground plane from screen coordinates
  const raycastToGround = useCallback((clientX, clientY) => {
    const rect = gl.domElement.getBoundingClientRect()
    const mouse = new THREE.Vector2(
      ((clientX - rect.left) / rect.width) * 2 - 1,
      -((clientY - rect.top) / rect.height) * 2 + 1
    )
    raycaster.setFromCamera(mouse, camera)
    const target = new THREE.Vector3()
    const result = raycaster.ray.intersectPlane(groundPlane, target)
    return result ? { x: target.x, z: target.z } : null
  }, [camera, gl.domElement, groundPlane, raycaster])


  // Pointer down - select on first click, start drag if already selected, detect double-click
  const handlePointerDown = useCallback((e) => {
    // Only handle left mouse button (matching ComparisonObject pattern)
    if (e.button !== 0) return
    e.stopPropagation()

    // Manual double-click detection
    const now = Date.now()
    const timeSinceLastClick = now - clickTracker.current.lastClickTime
    const isDoubleClick = timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && isSelected

    // Update click tracker
    clickTracker.current = { lastClickTime: now }

    // Double-click on already-selected room → open properties
    if (isDoubleClick) {
      onOpenProperties?.()
      return
    }

    // If not selected, just select it and reset click tracker
    // (Reset synchronously to prevent race condition with useEffect)
    if (!isSelected) {
      clickTracker.current = { lastClickTime: 0 }
      onSelect?.()
      return
    }

    // If selected, start drag - compute wall IDs NOW before walls change
    const wallIds = findWallsForRoom(room, walls)

    // Start drag
    const point = raycastToGround(e.clientX, e.clientY)
    if (point) {
      dragStartRef.current = {
        mouseX: e.clientX,
        mouseY: e.clientY,
        originalStartPoint: point, // Store original point for total offset calculation
        wallIds: wallIds
      }
      gl.domElement.style.cursor = 'grabbing'
    }
  }, [isSelected, onSelect, raycastToGround, gl.domElement, room, walls])

  // Global pointer move/up for drag (like ComparisonObject)
  useEffect(() => {
    const DRAG_THRESHOLD = 5

    const handlePointerMove = (e) => {
      if (!dragStartRef.current) return

      const dx = e.clientX - dragStartRef.current.mouseX
      const dy = e.clientY - dragStartRef.current.mouseY
      const distance = Math.sqrt(dx * dx + dy * dy)

      if (distance > DRAG_THRESHOLD) {
        setIsDragging(true)
        // Inline raycast to ground
        const rect = gl.domElement.getBoundingClientRect()
        const mouse = new THREE.Vector2(
          ((e.clientX - rect.left) / rect.width) * 2 - 1,
          -((e.clientY - rect.top) / rect.height) * 2 + 1
        )
        raycaster.setFromCamera(mouse, camera)
        const target = new THREE.Vector3()
        const result = raycaster.ray.intersectPlane(groundPlane, target)

        if (result) {
          const point = { x: target.x, z: target.z }
          // Calculate offset from original start point (not incremental)
          const offset = {
            x: point.x - dragStartRef.current.originalStartPoint.x,
            z: point.z - dragStartRef.current.originalStartPoint.z
          }
          // Update local visual offset (no state updates to walls during drag)
          setDragOffset(offset)
          // Also update room drag state so walls can move visually
          const wallIds = dragStartRef.current.wallIds || []
          if (wallIds.length > 0 && setRoomMoveDragState) {
            setRoomMoveDragState({ wallIds, offset })
          }
        }
      }
    }

    const handlePointerUp = () => {
      if (dragStartRef.current) {
        // Apply the final offset to walls
        const wallIds = dragStartRef.current.wallIds || []
        if (wallIds.length > 0 && (dragOffset.x !== 0 || dragOffset.z !== 0) && moveWallsByIdsRef.current) {
          moveWallsByIdsRef.current(wallIds, dragOffset)
          // Commit to history after moving
          if (commitWallsToHistory) {
            commitWallsToHistory()
          }
        }
        // Reset
        dragStartRef.current = null
        setIsDragging(false)
        setDragOffset({ x: 0, z: 0 })
        // Reset room drag state so walls return to actual positions
        if (setRoomMoveDragState) {
          setRoomMoveDragState({ wallIds: [], offset: { x: 0, z: 0 } })
        }
        gl.domElement.style.cursor = 'auto'
      }
    }

    window.addEventListener('pointermove', handlePointerMove)
    window.addEventListener('pointerup', handlePointerUp)

    return () => {
      window.removeEventListener('pointermove', handlePointerMove)
      window.removeEventListener('pointerup', handlePointerUp)
    }
  }, [gl.domElement, camera, raycaster, groundPlane, commitWallsToHistory, dragOffset])

  // Create shape from room points
  // Note: Shape is in XY plane, then rotated to XZ plane. We negate Z
  // so that after rotation by -PI/2 around X, the floor aligns with walls.
  const shape = useMemo(() => {
    if (!room.points || room.points.length < 3) return null

    const s = new THREE.Shape()
    s.moveTo(room.points[0].x, -room.points[0].z)

    for (let i = 1; i < room.points.length; i++) {
      s.lineTo(room.points[i].x, -room.points[i].z)
    }

    s.closePath()
    return s
  }, [room.points])

  // Create floor geometry with UV coordinates for textures
  const floorGeometry = useMemo(() => {
    if (!shape) return null

    const geometry = new THREE.ShapeGeometry(shape)

    // Calculate bounds for UV mapping
    const positions = geometry.attributes.position.array
    let minX = Infinity, maxX = -Infinity
    let minY = Infinity, maxY = -Infinity

    for (let i = 0; i < positions.length; i += 3) {
      minX = Math.min(minX, positions[i])
      maxX = Math.max(maxX, positions[i])
      minY = Math.min(minY, positions[i + 1])
      maxY = Math.max(maxY, positions[i + 1])
    }

    // Generate UV coordinates based on position
    const uvs = []
    const scaleX = maxX - minX || 1
    const scaleY = maxY - minY || 1
    const uvScale = 0.5 // Controls texture repeat (smaller = more repeat)

    for (let i = 0; i < positions.length; i += 3) {
      const u = ((positions[i] - minX) / scaleX) * (scaleX * uvScale)
      const v = ((positions[i + 1] - minY) / scaleY) * (scaleY * uvScale)
      uvs.push(u, v)
    }

    geometry.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2))
    return geometry
  }, [shape])

  if (!shape || !floorGeometry) return null

  // Calculate area display (using imported constants)
  const areaDisplay = lengthUnit === 'ft'
    ? `${(room.area * SQ_FEET_PER_SQ_METER).toFixed(0)} ft²`
    : `${room.area.toFixed(1)} m²`

  // Floor pattern colors (color2D for 2D view preview, color3D for texture tint)
  const FLOOR_PATTERNS = {
    wood: { color2D: '#8B5A2B', color3D: '#FFFFFF', opacity: 0.95 },
    tile: { color2D: '#C4C4C4', color3D: '#FFFFFF', opacity: 0.9 },
    carpet: { color2D: '#4A5568', color3D: '#FFFFFF', opacity: 0.95 },
    concrete: { color2D: '#9CA3AF', color3D: '#FFFFFF', opacity: 0.9 },
    marble: { color2D: '#E8E8E6', color3D: '#FFFFFF', opacity: 0.95 },
  }

  // Get floor texture for pattern (only in 3D view)
  const floorTexture = useMemo(() => {
    if (is2D || !style?.floorPattern) return null
    return createFloorTexture(style.floorPattern)
  }, [style?.floorPattern, is2D])

  // Determine colors based on state and style
  let floorColor = is2D ? '#1E3A3A' : '#3A3A3A'
  let floorOpacity = is2D ? 0.4 : 0.8

  // Apply floor pattern if set
  if (style?.floorPattern && FLOOR_PATTERNS[style.floorPattern]) {
    const pattern = FLOOR_PATTERNS[style.floorPattern]
    floorColor = is2D ? pattern.color2D : pattern.color3D
    floorOpacity = is2D ? 0.7 : pattern.opacity
  }

  // Override for selection/hover states
  if (isSelected) {
    if (!style?.floorPattern) {
      floorColor = is2D ? '#14B8A6' : '#2A5A4A'
    }
    floorOpacity = is2D ? 0.7 : 0.95
  } else if (isHovered) {
    if (!style?.floorPattern) {
      floorColor = is2D ? '#1A4A4A' : '#4A4A4A'
    }
    floorOpacity = is2D ? 0.5 : 0.85
  }

  // Create outline geometry for selection
  const outlineGeometry = useMemo(() => {
    if (!room.points || room.points.length < 3) return null
    const points = []
    for (const pt of room.points) {
      points.push(pt.x, is2D ? 0.03 : 0.05, pt.z)
    }
    // Close the loop
    points.push(room.points[0].x, is2D ? 0.03 : 0.05, room.points[0].z)
    return new Float32Array(points)
  }, [room.points, is2D])

  // Inactive floor opacity
  const inactiveOpacity = 0.4

  return (
    <group
      position={[dragOffset.x, floorYOffset, dragOffset.z]} // Apply floor offset and visual drag offset
      onPointerDown={handlePointerDown}
      onPointerEnter={() => {
        setIsHovered(true)
        if (!isDragging) {
          gl.domElement.style.cursor = isSelected ? 'grab' : 'pointer'
        }
      }}
      onPointerLeave={() => {
        setIsHovered(false)
        if (!isDragging) {
          gl.domElement.style.cursor = 'auto'
        }
      }}
    >
      {/* Floor surface */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, is2D ? 0.01 : 0.02, 0]}
        receiveShadow
        geometry={floorGeometry}
      >
        <meshStandardMaterial
          color={floorColor}
          transparent
          opacity={isInactiveFloor ? floorOpacity * inactiveOpacity : floorOpacity}
          map={floorTexture}
        />
      </mesh>

      {/* Selection outline */}
      {isSelected && outlineGeometry && (
        <line>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={outlineGeometry.length / 3}
              array={outlineGeometry}
              itemSize={3}
            />
          </bufferGeometry>
          <lineBasicMaterial color="#22D3EE" linewidth={2} />
        </line>
      )}

      {/* Room label and area */}
      <>
          {is2D ? (
            <group>
              {/* Custom label (if set) */}
              {label && (
                <Text
                  position={[room.center.x, 0.06, room.center.z - 0.8]}
                  rotation={[-Math.PI / 2, 0, 0]}
                  fontSize={0.8}
                  color={isSelected ? '#F0F0F0' : '#E0E0E0'}
                  anchorX="center"
                  anchorY="middle"
                  fontWeight="bold"
                >
                  {label}
                </Text>
              )}
              {/* Area display */}
              <Text
                position={[room.center.x, 0.05, room.center.z + (label ? 0.5 : 0)]}
                rotation={[-Math.PI / 2, 0, 0]}
                fontSize={1.0}
                color={isSelected ? '#22D3EE' : '#00FFFF'}
                anchorX="center"
                anchorY="middle"
              >
                {areaDisplay}
              </Text>
            </group>
          ) : (
            <Billboard position={[room.center.x, 0.5, room.center.z]} follow={true}>
              <group>
                {/* Custom label (if set) */}
                {label && (
                  <Text
                    position={[0, 0.4, 0]}
                    fontSize={0.5}
                    color="#F0F0F0"
                    anchorX="center"
                    anchorY="middle"
                    outlineWidth={0.03}
                    outlineColor="#000000"
                    fontWeight="bold"
                  >
                    {label}
                  </Text>
                )}
                {/* Area display */}
                <Text
                  position={[0, label ? -0.1 : 0, 0]}
                  fontSize={0.6}
                  color="#FFFFFF"
                  anchorX="center"
                  anchorY="middle"
                  outlineWidth={0.04}
                  outlineColor="#000000"
                >
                  {areaDisplay}
                </Text>
              </group>
            </Billboard>
          )}
        </>
    </group>
  )
}
