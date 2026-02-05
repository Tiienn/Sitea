import { useState, useRef, useEffect } from 'react'
import { useThree } from '@react-three/fiber'
import * as THREE from 'three'
import { createDeckTexture, createFoundationTexture, createStairsTexture, createRoofTexture } from '../../utils/textureGenerators'

// Double-click thresholds
const DOUBLE_CLICK_THRESHOLD = 400

/**
 * PoolItem - renders a single pool with water, floor, walls, and coping
 * Manages its own drag state and click tracking
 */
export function PoolItem({
  pool,
  isSelected,
  isDeleteMode,
  onDelete,
  onUpdate,
  onSelect,
  onOpenProperties
}) {
  const { gl } = useThree()

  // Internal drag state
  const [dragState, setDragState] = useState({
    isDragging: false,
    startPoint: null,
    offset: { x: 0, z: 0 }
  })

  // Click tracking for double-click detection
  const clickTracker = useRef({ lastClickTime: 0 })

  // Reset click tracker when selection changes
  useEffect(() => {
    clickTracker.current = { lastClickTime: 0 }
  }, [isSelected])

  // Window-level pointer up for drag completion
  useEffect(() => {
    if (!dragState.isDragging) return

    const handlePointerUp = () => {
      const offset = dragState.offset
      if (Math.abs(offset.x) > 0.01 || Math.abs(offset.z) > 0.01) {
        const newPoints = pool.points.map(pt => ({
          x: pt.x + offset.x,
          z: pt.z + offset.z
        }))
        onUpdate?.(pool.id, { points: newPoints })
      }

      setDragState({ isDragging: false, startPoint: null, offset: { x: 0, z: 0 } })
      gl.domElement.style.cursor = 'auto'
    }

    window.addEventListener('pointerup', handlePointerUp)
    return () => window.removeEventListener('pointerup', handlePointerUp)
  }, [dragState.isDragging, dragState.offset, pool.id, pool.points, onUpdate, gl.domElement])

  const rawPoints = pool.points
  if (!rawPoints || rawPoints.length < 3) return null

  const depth = pool.depth || 1.5
  const isDraggingThis = dragState.isDragging

  // Apply drag offset to points if dragging
  const dragOffset = isDraggingThis ? dragState.offset : { x: 0, z: 0 }
  const points = rawPoints.map(pt => ({
    x: pt.x + dragOffset.x,
    z: pt.z + dragOffset.z
  }))

  // Create shape from polygon points
  const shape = new THREE.Shape()
  shape.moveTo(points[0].x, -points[0].z)
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, -points[i].z)
  }
  shape.closePath()

  // Get deck texture
  const deckTexture = createDeckTexture(pool.deckMaterial || 'concrete')

  // Pointer handlers
  const handlePointerDown = (e) => {
    e.stopPropagation()

    if (isDeleteMode) {
      onDelete?.(pool.id)
      return
    }

    // Manual double-click detection
    const now = Date.now()
    const timeSinceLastClick = now - clickTracker.current.lastClickTime
    const isDoubleClick = timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && isSelected

    clickTracker.current = { lastClickTime: now }

    if (isDoubleClick) {
      onOpenProperties?.()
      return
    }

    if (!isSelected) {
      clickTracker.current = { lastClickTime: 0 }
      onSelect?.(pool.id)
      return
    }

    // Already selected, start dragging
    setDragState({
      isDragging: true,
      startPoint: { x: e.point.x, z: e.point.z },
      offset: { x: 0, z: 0 }
    })
    gl.domElement.style.cursor = 'grabbing'
  }

  const handlePointerMove = (e) => {
    if (!dragState.isDragging || !isSelected) return
    e.stopPropagation()

    const dx = e.point.x - dragState.startPoint.x
    const dz = e.point.z - dragState.startPoint.z
    setDragState(prev => ({ ...prev, offset: { x: dx, z: dz } }))
  }

  const handlePointerUp = (e) => {
    if (!dragState.isDragging || !isSelected) return
    e.stopPropagation()

    const offset = dragState.offset
    if (Math.abs(offset.x) > 0.01 || Math.abs(offset.z) > 0.01) {
      const newPoints = rawPoints.map(pt => ({
        x: pt.x + offset.x,
        z: pt.z + offset.z
      }))
      onUpdate?.(pool.id, { points: newPoints })
    }

    setDragState({ isDragging: false, startPoint: null, offset: { x: 0, z: 0 } })
    gl.domElement.style.cursor = 'auto'
  }

  return (
    <group>
      {/* Water surface */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, 0.02, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
        onPointerUp={handlePointerUp}
        onPointerLeave={handlePointerUp}
        renderOrder={1}
      >
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial
          color={pool.waterColor || '#00CED1'}
          transparent
          opacity={isSelected ? 0.85 : 0.7}
          side={THREE.DoubleSide}
          depthWrite={false}
        />
      </mesh>

      {/* Pool floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -depth, 0]}>
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial color="#4A90A4" />
      </mesh>

      {/* Pool walls */}
      {points.map((pt, i) => {
        const nextPt = points[(i + 1) % points.length]
        const dx = nextPt.x - pt.x
        const dz = nextPt.z - pt.z
        const length = Math.sqrt(dx * dx + dz * dz)
        const angle = Math.atan2(dx, dz)
        const midX = (pt.x + nextPt.x) / 2
        const midZ = (pt.z + nextPt.z) / 2

        return (
          <mesh key={`wall-${i}`} position={[midX, -depth / 2, midZ]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.15, depth, length]} />
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.4} />
          </mesh>
        )
      })}

      {/* Pool edge/coping */}
      {points.map((pt, i) => {
        const nextPt = points[(i + 1) % points.length]
        const dx = nextPt.x - pt.x
        const dz = nextPt.z - pt.z
        const length = Math.sqrt(dx * dx + dz * dz)
        const angle = Math.atan2(dx, dz)
        const midX = (pt.x + nextPt.x) / 2
        const midZ = (pt.z + nextPt.z) / 2

        const segmentTexture = deckTexture.clone()
        segmentTexture.needsUpdate = true
        segmentTexture.repeat.set(Math.max(1, length / 2), 1)

        return (
          <mesh key={`coping-${i}`} position={[midX, 0.05, midZ]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.4, 0.1, length]} />
            <meshStandardMaterial map={segmentTexture} />
          </mesh>
        )
      })}

      {/* Selection highlight */}
      {(isSelected || isDeleteMode) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.12, 0]}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial
            color={isDeleteMode ? '#FF4444' : '#22d3ee'}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  )
}

/**
 * FoundationItem - renders a single foundation with top surface and sides
 * Manages its own drag state and click tracking
 */
export function FoundationItem({
  foundation,
  isSelected,
  isDeleteMode,
  onDelete,
  onUpdate,
  onSelect,
  onOpenProperties
}) {
  // Internal drag state
  const [dragState, setDragState] = useState({
    isDragging: false,
    startPoint: null,
    offset: { x: 0, z: 0 }
  })

  // Click tracking
  const clickTracker = useRef({ lastClickTime: 0 })

  // Reset click tracker when selection changes
  useEffect(() => {
    clickTracker.current = { lastClickTime: 0 }
  }, [isSelected])

  // Window-level pointer up for drag completion
  useEffect(() => {
    if (!dragState.isDragging) return

    const handlePointerUp = () => {
      const offset = dragState.offset
      if (Math.abs(offset.x) > 0.01 || Math.abs(offset.z) > 0.01) {
        const newPoints = foundation.points.map(pt => ({
          x: pt.x + offset.x,
          z: pt.z + offset.z
        }))
        onUpdate?.(foundation.id, { points: newPoints })
      }

      setDragState({ isDragging: false, startPoint: null, offset: { x: 0, z: 0 } })
      document.body.style.cursor = 'auto'
    }

    window.addEventListener('pointerup', handlePointerUp)
    return () => window.removeEventListener('pointerup', handlePointerUp)
  }, [dragState.isDragging, dragState.offset, foundation.id, foundation.points, onUpdate])

  const rawPoints = foundation.points
  if (!rawPoints || rawPoints.length < 3) return null

  const height = foundation.height || 0.6
  const materialType = foundation.material || 'concrete'

  // Apply drag offset
  const dragOffset = dragState.isDragging ? dragState.offset : { x: 0, z: 0 }
  const points = rawPoints.map(pt => ({
    x: pt.x + dragOffset.x,
    z: pt.z + dragOffset.z
  }))

  // Create shape
  const shape = new THREE.Shape()
  shape.moveTo(points[0].x, -points[0].z)
  for (let i = 1; i < points.length; i++) {
    shape.lineTo(points[i].x, -points[i].z)
  }
  shape.closePath()

  // Get texture
  const foundationTexture = createFoundationTexture(materialType)
  const minX = Math.min(...points.map(p => p.x))
  const maxX = Math.max(...points.map(p => p.x))
  const minZ = Math.min(...points.map(p => p.z))
  const maxZ = Math.max(...points.map(p => p.z))
  const sizeX = maxX - minX
  const sizeZ = maxZ - minZ
  const textureRepeat = Math.max(sizeX, sizeZ) / 2

  const topTexture = foundationTexture.clone()
  topTexture.repeat.set(textureRepeat, textureRepeat)
  topTexture.needsUpdate = true

  // Side colors
  const sideColors = {
    concrete: '#808080',
    wood: '#6B5344',
    brick: '#654321',
    stone: '#5a6a7a'
  }
  const sideColor = sideColors[materialType] || '#808080'

  // Pointer handlers
  const handlePointerDown = (e) => {
    e.stopPropagation()

    if (isDeleteMode) {
      onDelete?.(foundation.id)
      return
    }

    // Manual double-click detection
    const now = Date.now()
    const timeSinceLastClick = now - clickTracker.current.lastClickTime
    const isDoubleClick = timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && isSelected

    clickTracker.current = { lastClickTime: now }

    if (isDoubleClick) {
      onOpenProperties?.()
      return
    }

    // Select and start dragging
    onSelect?.(foundation.id)
    setDragState({
      isDragging: true,
      startPoint: { x: e.point.x, z: e.point.z },
      offset: { x: 0, z: 0 }
    })
    document.body.style.cursor = 'grabbing'
  }

  const handlePointerMove = (e) => {
    if (!dragState.isDragging) return
    e.stopPropagation()

    const dx = e.point.x - dragState.startPoint.x
    const dz = e.point.z - dragState.startPoint.z
    setDragState(prev => ({ ...prev, offset: { x: dx, z: dz } }))
  }

  return (
    <group>
      {/* Foundation top surface */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[0, height, 0]}
        onPointerDown={handlePointerDown}
        onPointerMove={handlePointerMove}
      >
        <shapeGeometry args={[shape]} />
        <meshStandardMaterial map={topTexture} />
      </mesh>

      {/* Foundation sides */}
      {points.map((pt, i) => {
        const nextPt = points[(i + 1) % points.length]
        const dx = nextPt.x - pt.x
        const dz = nextPt.z - pt.z
        const length = Math.sqrt(dx * dx + dz * dz)
        const angle = Math.atan2(dx, dz)
        const midX = (pt.x + nextPt.x) / 2
        const midZ = (pt.z + nextPt.z) / 2

        return (
          <mesh key={`side-${i}`} position={[midX, height / 2, midZ]} rotation={[0, angle, 0]}>
            <boxGeometry args={[0.15, height, length]} />
            <meshStandardMaterial color={sideColor} />
          </mesh>
        )
      })}

      {/* Selection highlight */}
      {(isSelected || isDeleteMode) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, height + 0.02, 0]}>
          <shapeGeometry args={[shape]} />
          <meshBasicMaterial
            color={isDeleteMode ? '#FF4444' : '#22d3ee'}
            transparent
            opacity={0.3}
          />
        </mesh>
      )}
    </group>
  )
}

/**
 * StairsItem - renders a single staircase (straight or L-shaped)
 * Manages its own drag state and click tracking
 */
export function StairsItem({
  stair,
  isSelected,
  isDeleteMode,
  onDelete,
  onUpdate,
  onSelect,
  onOpenProperties
}) {
  // Internal drag state
  const [dragState, setDragState] = useState({
    isDragging: false,
    startPoint: null,
    offset: { x: 0, z: 0 }
  })

  // Click tracking
  const clickTracker = useRef({ lastClickTime: 0 })

  // Reset click tracker when selection changes
  useEffect(() => {
    clickTracker.current = { lastClickTime: 0 }
  }, [isSelected])

  // Window-level pointer up for drag completion
  useEffect(() => {
    if (!dragState.isDragging) return

    const handlePointerUp = () => {
      const offset = dragState.offset
      if (Math.abs(offset.x) > 0.01 || Math.abs(offset.z) > 0.01) {
        const updates = {
          start: { x: stair.start.x + offset.x, z: stair.start.z + offset.z },
          end: { x: stair.end.x + offset.x, z: stair.end.z + offset.z }
        }
        if (stair.mid) {
          updates.mid = { x: stair.mid.x + offset.x, z: stair.mid.z + offset.z }
        }
        if (stair.mid2) {
          updates.mid2 = { x: stair.mid2.x + offset.x, z: stair.mid2.z + offset.z }
        }
        onUpdate?.(stair.id, updates)
      }

      setDragState({ isDragging: false, startPoint: null, offset: { x: 0, z: 0 } })
      document.body.style.cursor = 'auto'
    }

    window.addEventListener('pointerup', handlePointerUp)
    return () => window.removeEventListener('pointerup', handlePointerUp)
  }, [dragState.isDragging, dragState.offset, stair, onUpdate])

  const start = stair.start
  const end = stair.end
  const mid = stair.mid
  if (!start || !end) return null

  const bottomY = stair.bottomY || 0
  const topY = stair.topY || 2.7
  const width = stair.width || 1.0
  const dragOffset = dragState.isDragging ? dragState.offset : { x: 0, z: 0 }

  // Material
  const materialColors = {
    wood: '#8B4513',
    concrete: '#808080',
    metal: '#4A4A4A',
    stone: '#696969'
  }
  const baseColor = materialColors[stair.material] || '#8B4513'
  const stepTexture = createStairsTexture(stair.material || 'wood')
  const useOverrideColor = isDeleteMode || isSelected
  const stepColor = isDeleteMode ? '#FF4444' : isSelected ? '#22d3ee' : baseColor

  // Pointer handlers
  const handlePointerDown = (e) => {
    e.stopPropagation()

    if (isDeleteMode) {
      onDelete?.(stair.id)
      return
    }

    // Manual double-click detection
    const now = Date.now()
    const timeSinceLastClick = now - clickTracker.current.lastClickTime
    const isDoubleClick = timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && isSelected

    clickTracker.current = { lastClickTime: now }

    if (isDoubleClick) {
      onOpenProperties?.()
      return
    }

    // Select and start dragging
    onSelect?.(stair.id)
    setDragState({
      isDragging: true,
      startPoint: { x: e.point.x, z: e.point.z },
      offset: { x: 0, z: 0 }
    })
    document.body.style.cursor = 'grabbing'
  }

  const handlePointerMove = (e) => {
    if (!dragState.isDragging) return
    e.stopPropagation()

    const dx = e.point.x - dragState.startPoint.x
    const dz = e.point.z - dragState.startPoint.z
    setDragState(prev => ({ ...prev, offset: { x: dx, z: dz } }))
  }

  // Helper to render a stair segment
  const renderSegment = (segStart, segEnd, startY, endY, keyPrefix) => {
    const dx = segEnd.x - segStart.x
    const dz = segEnd.z - segStart.z
    const length = Math.sqrt(dx * dx + dz * dz)
    const angle = Math.atan2(dx, dz)
    const heightDiff = endY - startY
    const stepCount = Math.max(1, Math.floor(heightDiff / 0.18))
    const stepHeight = heightDiff / stepCount
    const stepDepth = length / stepCount

    return (
      <group key={keyPrefix} position={[segStart.x + dragOffset.x, startY, segStart.z + dragOffset.z]} rotation={[0, angle, 0]}>
        {Array.from({ length: stepCount }, (_, i) => (
          <mesh
            key={`${keyPrefix}-step-${i}`}
            position={[0, stepHeight * (i + 0.5), stepDepth * (i + 0.5)]}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
          >
            <boxGeometry args={[width, stepHeight, stepDepth]} />
            <meshStandardMaterial
              map={useOverrideColor ? null : stepTexture}
              color={useOverrideColor ? stepColor : '#ffffff'}
            />
          </mesh>
        ))}
        {/* Railings */}
        {stair.railings !== false && (
          <>
            {/* Vertical posts */}
            {Array.from({ length: Math.max(2, Math.ceil(length / 0.5) + 1) }, (_, i) => {
              const postZ = (length / Math.max(1, Math.ceil(length / 0.5))) * i
              const postY = (heightDiff / length) * postZ
              return (
                <group key={`${keyPrefix}-post-${i}`}>
                  <mesh position={[-width / 2 - 0.025, postY + 0.45, postZ]}>
                    <boxGeometry args={[0.04, 0.9, 0.04]} />
                    <meshStandardMaterial color="#4A4A4A" metalness={0.6} />
                  </mesh>
                  <mesh position={[width / 2 + 0.025, postY + 0.45, postZ]}>
                    <boxGeometry args={[0.04, 0.9, 0.04]} />
                    <meshStandardMaterial color="#4A4A4A" metalness={0.6} />
                  </mesh>
                </group>
              )
            })}
            {/* Handrails */}
            <mesh position={[-width / 2 - 0.025, heightDiff / 2 + 0.9, length / 2]} rotation={[-Math.atan2(heightDiff, length), 0, 0]}>
              <boxGeometry args={[0.05, 0.05, Math.sqrt(length * length + heightDiff * heightDiff)]} />
              <meshStandardMaterial color="#3A3A3A" metalness={0.7} />
            </mesh>
            <mesh position={[width / 2 + 0.025, heightDiff / 2 + 0.9, length / 2]} rotation={[-Math.atan2(heightDiff, length), 0, 0]}>
              <boxGeometry args={[0.05, 0.05, Math.sqrt(length * length + heightDiff * heightDiff)]} />
              <meshStandardMaterial color="#3A3A3A" metalness={0.7} />
            </mesh>
          </>
        )}
      </group>
    )
  }

  // L-shaped stairs
  if (mid) {
    const mid2 = stair.mid2 || mid
    const midY = bottomY + (topY - bottomY) / 2
    return (
      <group>
        {renderSegment(start, mid, bottomY, midY, `${stair.id}-seg1`)}
        {/* Landing platform */}
        <mesh
          position={[mid.x + dragOffset.x, midY, mid.z + dragOffset.z]}
          onPointerDown={handlePointerDown}
          onPointerMove={handlePointerMove}
        >
          <boxGeometry args={[width, 0.1, width]} />
          <meshStandardMaterial
            map={useOverrideColor ? null : stepTexture}
            color={useOverrideColor ? stepColor : '#ffffff'}
          />
        </mesh>
        {renderSegment(mid2, end, midY, topY, `${stair.id}-seg2`)}
      </group>
    )
  }

  // Straight stairs
  return renderSegment(start, end, bottomY, topY, stair.id)
}

/**
 * RoofItem - renders a single roof (gable, flat, hip, or shed)
 * Manages its own click tracking (no drag support)
 */
export function RoofItem({
  roof,
  room,
  isSelected,
  isDeleteMode,
  onDelete,
  onSelect,
  onOpenProperties
}) {
  // Click tracking
  const clickTracker = useRef({ lastClickTime: 0 })

  // Reset click tracker when selection changes
  useEffect(() => {
    clickTracker.current = { lastClickTime: 0 }
  }, [isSelected])

  if (!room) return null

  const points = room.points
  if (!points || points.length < 3) return null

  // Calculate bounding box
  const xs = points.map(p => p.x)
  const zs = points.map(p => p.z)
  const minX = Math.min(...xs)
  const maxX = Math.max(...xs)
  const minZ = Math.min(...zs)
  const maxZ = Math.max(...zs)
  const centerX = (minX + maxX) / 2
  const centerZ = (minZ + maxZ) / 2
  const width = maxX - minX
  const depth = maxZ - minZ

  const wallHeight = 2.7
  const overhang = roof.overhang || 0.5
  const thickness = roof.thickness || 0.15
  const pitch = (roof.pitch || 30) * Math.PI / 180
  const roofHeight = Math.tan(pitch) * (depth / 2 + overhang)

  const roofMaterial = roof.material || 'shingle'
  const roofTexture = createRoofTexture(roofMaterial)

  // Pointer handler
  const handlePointerDown = (e) => {
    if (isDeleteMode) {
      e.stopPropagation()
      onDelete?.(roof.id)
      return
    }

    // Manual double-click detection
    const now = Date.now()
    const timeSinceLastClick = now - clickTracker.current.lastClickTime
    const isDoubleClick = timeSinceLastClick < DOUBLE_CLICK_THRESHOLD && isSelected

    clickTracker.current = { lastClickTime: now }

    if (isDoubleClick) {
      e.stopPropagation()
      onSelect?.(roof.id)
      onOpenProperties?.()
      return
    }

    // Single click - just select
    onSelect?.(roof.id)
  }

  const materialProps = {
    map: roofTexture,
    color: isDeleteMode ? '#FF6666' : '#ffffff',
    emissive: isSelected ? '#22d3ee' : isDeleteMode ? '#FF0000' : '#000000',
    emissiveIntensity: isSelected || isDeleteMode ? 0.4 : 0,
    side: THREE.DoubleSide
  }

  // Gable roof (default)
  if (roof.type === 'gable' || !roof.type) {
    const halfDepth = depth / 2 + overhang
    const slopeLength = halfDepth / Math.cos(pitch)

    return (
      <group position={[centerX, wallHeight, centerZ]}>
        {/* Front slope */}
        <mesh
          position={[0, roofHeight / 2, -halfDepth / 2]}
          rotation={[Math.PI / 2 - pitch, 0, 0]}
          onPointerDown={handlePointerDown}
        >
          <planeGeometry args={[width + overhang * 2, slopeLength]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
        {/* Back slope */}
        <mesh
          position={[0, roofHeight / 2, halfDepth / 2]}
          rotation={[-Math.PI / 2 + pitch, 0, 0]}
          onPointerDown={handlePointerDown}
        >
          <planeGeometry args={[width + overhang * 2, slopeLength]} />
          <meshStandardMaterial {...materialProps} />
        </mesh>
        {/* Gable end triangles */}
        <mesh position={[-(width / 2 + overhang), roofHeight / 2, 0]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={3}
              array={new Float32Array([
                0, -roofHeight / 2, halfDepth,
                0, -roofHeight / 2, -halfDepth,
                0, roofHeight / 2, 0
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <meshStandardMaterial {...materialProps} />
        </mesh>
        <mesh position={[(width / 2 + overhang), roofHeight / 2, 0]}>
          <bufferGeometry>
            <bufferAttribute
              attach="attributes-position"
              count={3}
              array={new Float32Array([
                0, -roofHeight / 2, -halfDepth,
                0, -roofHeight / 2, halfDepth,
                0, roofHeight / 2, 0
              ])}
              itemSize={3}
            />
          </bufferGeometry>
          <meshStandardMaterial {...materialProps} />
        </mesh>
      </group>
    )
  }

  // Flat roof
  if (roof.type === 'flat') {
    return (
      <mesh
        position={[centerX, wallHeight + thickness / 2, centerZ]}
        onPointerDown={handlePointerDown}
      >
        <boxGeometry args={[width + overhang * 2, thickness, depth + overhang * 2]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
    )
  }

  // Hip roof (pyramid)
  if (roof.type === 'hip') {
    const vertices = new Float32Array([
      minX - overhang, wallHeight, minZ - overhang,
      maxX + overhang, wallHeight, minZ - overhang,
      maxX + overhang, wallHeight, maxZ + overhang,
      minX - overhang, wallHeight, maxZ + overhang,
      centerX, wallHeight + roofHeight, centerZ
    ])
    const indices = [0, 1, 4, 1, 2, 4, 2, 3, 4, 3, 0, 4]

    return (
      <mesh onPointerDown={handlePointerDown}>
        <bufferGeometry>
          <bufferAttribute attach="attributes-position" count={5} array={vertices} itemSize={3} />
          <bufferAttribute attach="index" count={12} array={new Uint16Array(indices)} itemSize={1} />
        </bufferGeometry>
        <meshStandardMaterial {...materialProps} />
      </mesh>
    )
  }

  // Shed roof (single slope)
  if (roof.type === 'shed') {
    const fullDepth = depth + overhang * 2
    const roofRise = Math.tan(pitch) * depth
    const slopeLength = fullDepth / Math.cos(pitch)

    return (
      <mesh
        position={[centerX, wallHeight + roofRise / 2, centerZ]}
        rotation={[-Math.PI / 2 - pitch, 0, 0]}
        onPointerDown={handlePointerDown}
      >
        <planeGeometry args={[width + overhang * 2, slopeLength]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
    )
  }

  return null
}
