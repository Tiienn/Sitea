import { useState, useMemo } from 'react'
import { Text, Billboard, Line } from '@react-three/drei'
import { FEET_PER_METER } from '../../constants/landSceneConstants'
import { createWallTexture } from '../../utils/textureGenerators'

/**
 * WallSegment - renders a single wall between two points, with openings (doors/windows)
 * Supports both 2D (floor plan view) and 3D rendering modes
 * Handles regular walls and various fence styles
 */
export function WallSegment({ wall, lengthUnit = 'm', viewMode = 'firstPerson', isSelected = false, onSelect, isDeleteMode = false, onDelete, isOpeningMode = false, openingType = 'door', onPlaceOpening, showDimensions = true, roomMoveDragState, wallColor, onOpenProperties, floorYOffset = 0, isInactiveFloor = false }) {
  const [isHovered, setIsHovered] = useState(false)
  const { start: rawStart, end: rawEnd, height = 2.7, thickness = 0.15, openings = [] } = wall
  const is2D = viewMode === '2d'

  // Opacity for inactive floors (walls on different floor than current)
  const inactiveOpacity = 0.4

  // Apply drag offset if this wall is being dragged as part of a room
  const isDragging = roomMoveDragState?.wallIds?.includes(wall.id)
  const dragOffset = isDragging ? roomMoveDragState.offset : { x: 0, z: 0 }
  const start = { x: rawStart.x + dragOffset.x, z: rawStart.z + dragOffset.z }
  const end = { x: rawEnd.x + dragOffset.x, z: rawEnd.z + dragOffset.z }

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

  // Get wall texture for pattern (only in 3D view)
  const wallTexture = useMemo(() => {
    if (is2D || !wall.pattern) return null
    const texture = createWallTexture(wall.pattern)
    if (texture) {
      // Clone texture to set unique repeat per wall based on size
      const clonedTexture = texture.clone()
      clonedTexture.needsUpdate = true
      // Repeat based on wall length and height (more tiles for larger walls)
      clonedTexture.repeat.set(Math.max(1, wallLength), Math.max(1, height))
      return clonedTexture
    }
    return null
  }, [wall.pattern, is2D, wallLength, height])

  // 2D rendering: flat rectangles from above (gaps for openings)
  if (is2D) {
    // Fence 2D: render based on fence type
    if (wall.isFence) {
      const fenceStyle = wall.fenceType || 'picket'
      const postSpacing = fenceStyle === 'ranch' ? 2.0 : 1.0
      const numPosts = Math.max(2, Math.ceil(wallLength / postSpacing) + 1)
      const actualSpacing = wallLength / (numPosts - 1)
      const posts = []
      for (let i = 0; i < numPosts; i++) {
        posts.push(i * actualSpacing)
      }

      // Get color based on fence type
      const fenceColors = {
        picket: '#8B4513',
        privacy: '#D2691E',
        chainLink: '#708090',
        iron: '#2F2F2F',
        ranch: '#8B7355'
      }
      const fenceColor = fenceColors[fenceStyle] || '#8B4513'

      // Privacy fence: solid line (no gaps)
      if (fenceStyle === 'privacy') {
        return (
          <group>
            <mesh position={[midX, 0.1, midZ]} rotation={[-Math.PI / 2, 0, -angle]}>
              <planeGeometry args={[0.04, wallLength]} />
              <meshBasicMaterial color={fenceColor} />
            </mesh>
            {showDimensions && (
              <Text position={[midX, 0.2, midZ]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.5} color={fenceColor} anchorX="center" anchorY="middle">{lengthLabel}</Text>
            )}
          </group>
        )
      }

      // Chain link & Iron: dashed line with small posts
      if (fenceStyle === 'chainLink' || fenceStyle === 'iron') {
        return (
          <group>
            {posts.map((dist, i) => {
              const pos = getWorldPos(dist)
              return (
                <mesh key={i} position={[pos.x, 0.1, pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
                  <circleGeometry args={[0.03, 8]} />
                  <meshBasicMaterial color={fenceColor} />
                </mesh>
              )
            })}
            <Line points={[[start.x, 0.1, start.z], [end.x, 0.1, end.z]]} color={fenceColor} lineWidth={1} dashed dashSize={0.1} gapSize={0.05} />
            {showDimensions && (
              <Text position={[midX, 0.2, midZ]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.5} color={fenceColor} anchorX="center" anchorY="middle">{lengthLabel}</Text>
            )}
          </group>
        )
      }

      // Default (picket, ranch): posts with solid line
      return (
        <group>
          {posts.map((dist, i) => {
            const pos = getWorldPos(dist)
            return (
              <mesh key={i} position={[pos.x, 0.1, pos.z]} rotation={[-Math.PI / 2, 0, 0]}>
                <circleGeometry args={[fenceStyle === 'ranch' ? 0.06 : 0.04, 8]} />
                <meshBasicMaterial color={fenceColor} />
              </mesh>
            )
          })}
          <Line points={[[start.x, 0.1, start.z], [end.x, 0.1, end.z]]} color={fenceColor} lineWidth={fenceStyle === 'ranch' ? 3 : 2} />
          {showDimensions && (
            <Text position={[midX, 0.2, midZ]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.5} color={fenceColor} anchorX="center" anchorY="middle">{lengthLabel}</Text>
          )}
        </group>
      )
    }

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

        {/* 2D Door symbols */}
        {openings.filter(o => o.type === 'door').map(opening => {
          const pos = getWorldPos(opening.position)
          const doorWidth = opening.width || 0.9
          const dType = opening.doorType || 'single'
          const halfWidth = doorWidth / 2
          const arcSegments = 16

          // Sliding door: show two overlapping panels
          if (dType === 'sliding') {
            return (
              <group key={`door2d-${opening.id}`} position={[pos.x, 0, pos.z]} rotation={[0, angle, 0]}>
                {/* Fixed panel (left) */}
                <Line points={[[0.05, 0.12, -halfWidth], [0.05, 0.12, 0]]} color="#00ffff" lineWidth={2} />
                {/* Sliding panel (right, slightly offset) */}
                <Line points={[[-0.05, 0.12, 0], [-0.05, 0.12, halfWidth]]} color="#00ffff" lineWidth={2} />
                {/* Track line */}
                <Line points={[[0, 0.12, -halfWidth], [0, 0.12, halfWidth]]} color="#00ffff" lineWidth={1} dashed dashSize={0.1} gapSize={0.05} />
              </group>
            )
          }

          // Garage door: show sectional rectangle with lines
          if (dType === 'garage') {
            return (
              <group key={`door2d-${opening.id}`} position={[pos.x, 0, pos.z]} rotation={[0, angle, 0]}>
                {/* Garage door outline */}
                <Line points={[[-0.15, 0.12, -halfWidth], [-0.15, 0.12, halfWidth], [0.15, 0.12, halfWidth], [0.15, 0.12, -halfWidth], [-0.15, 0.12, -halfWidth]]} color="#00ffff" lineWidth={2} />
                {/* Section lines (3 horizontal lines) */}
                <Line points={[[-0.05, 0.12, -halfWidth], [-0.05, 0.12, halfWidth]]} color="#00ffff" lineWidth={1} />
                <Line points={[[0.05, 0.12, -halfWidth], [0.05, 0.12, halfWidth]]} color="#00ffff" lineWidth={1} />
              </group>
            )
          }

          // Double door: two swing arcs forming butterfly pattern (from center outward)
          if (dType === 'double') {
            const leafWidth = doorWidth / 2
            const leftArcPoints = []
            const rightArcPoints = []
            for (let i = 0; i <= arcSegments; i++) {
              const a = (i / arcSegments) * (Math.PI / 2)
              // Left arc: hinge at -halfWidth, swings outward (negative X direction)
              leftArcPoints.push([-Math.sin(a) * leafWidth, 0.12, -halfWidth + (1 - Math.cos(a)) * leafWidth])
              // Right arc: hinge at +halfWidth, swings outward (negative X direction)
              rightArcPoints.push([-Math.sin(a) * leafWidth, 0.12, halfWidth - (1 - Math.cos(a)) * leafWidth])
            }
            return (
              <group key={`door2d-${opening.id}`} position={[pos.x, 0, pos.z]} rotation={[0, angle, 0]}>
                {/* Left door swing arc */}
                <Line points={leftArcPoints} color="#00ffff" lineWidth={1} />
                {/* Right door swing arc */}
                <Line points={rightArcPoints} color="#00ffff" lineWidth={1} />
                {/* Left door leaf (closed position) */}
                <Line points={[[0, 0.12, -halfWidth], [0, 0.12, 0]]} color="#00ffff" lineWidth={2} />
                {/* Right door leaf (closed position) */}
                <Line points={[[0, 0.12, 0], [0, 0.12, halfWidth]]} color="#00ffff" lineWidth={2} />
              </group>
            )
          }

          // Single door: one swing arc (hinge at left edge, swings outward)
          const arcPoints = []
          for (let i = 0; i <= arcSegments; i++) {
            const a = (i / arcSegments) * (Math.PI / 2)
            // Hinge at -halfWidth, door swings outward (negative X direction)
            arcPoints.push([-Math.sin(a) * doorWidth, 0.12, -halfWidth + (1 - Math.cos(a)) * doorWidth])
          }
          return (
            <group key={`door2d-${opening.id}`} position={[pos.x, 0, pos.z]} rotation={[0, angle, 0]}>
              {/* Door swing arc */}
              <Line points={arcPoints} color="#00ffff" lineWidth={1} />
              {/* Door leaf (closed position - spans full opening) */}
              <Line points={[[0, 0.12, -halfWidth], [0, 0.12, halfWidth]]} color="#00ffff" lineWidth={2} />
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
        {showDimensions && (
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
        )}
      </group>
    )
  }

  // 3D rendering: fence with posts and rails
  if (wall.isFence) {
    const fenceHeight = height
    const fenceStyle = wall.fenceType || 'picket'
    const postSpacing = fenceStyle === 'ranch' ? 2.0 : 1.0
    const numPosts = Math.max(2, Math.ceil(wallLength / postSpacing) + 1)
    const actualSpacing = wallLength / (numPosts - 1)

    // Generate post positions
    const posts = []
    for (let i = 0; i < numPosts; i++) {
      posts.push(i * actualSpacing)
    }

    // Common click handler for all fence parts
    const handleClick = (e) => {
      e.stopPropagation()
      if (isDeleteMode && onDelete) onDelete()
      else if (onSelect) onSelect()
    }

    // Double-click handler to open properties panel
    const handleDoubleClick = (e) => {
      e.stopPropagation()
      onOpenProperties?.()
    }

    // Get colors based on fence type and state
    const getColor = (baseColor) => {
      if (isDeleteMode && isHovered) return '#FF4444'
      if (isSelected) return '#FFD700'
      return baseColor
    }

    // PICKET fence: wooden posts with 3 horizontal rails
    if (fenceStyle === 'picket') {
      const postSize = 0.08
      const railHeight = 0.04
      const railDepth = 0.02
      const woodColor = '#8B4513'
      return (
        <group>
          {posts.map((dist, i) => {
            const pos = getWorldPos(dist)
            return (
              <mesh key={`post-${i}`} position={[pos.x, fenceHeight / 2, pos.z]} rotation={[0, angle, 0]} castShadow receiveShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}>
                <boxGeometry args={[postSize, fenceHeight, postSize]} />
                <meshStandardMaterial color={getColor(woodColor)} roughness={0.8} />
              </mesh>
            )
          })}
          <mesh position={[midX, fenceHeight - railHeight / 2, midZ]} rotation={[0, angle, 0]} castShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}><boxGeometry args={[railDepth, railHeight, wallLength]} /><meshStandardMaterial color={getColor(woodColor)} roughness={0.8} /></mesh>
          <mesh position={[midX, fenceHeight * 0.5, midZ]} rotation={[0, angle, 0]} castShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}><boxGeometry args={[railDepth, railHeight, wallLength]} /><meshStandardMaterial color={getColor(woodColor)} roughness={0.8} /></mesh>
          <mesh position={[midX, 0.1, midZ]} rotation={[0, angle, 0]} castShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}><boxGeometry args={[railDepth, railHeight, wallLength]} /><meshStandardMaterial color={getColor(woodColor)} roughness={0.8} /></mesh>
        </group>
      )
    }

    // PRIVACY fence: solid vertical boards
    if (fenceStyle === 'privacy') {
      const boardWidth = 0.15
      const boardThickness = 0.02
      const numBoards = Math.ceil(wallLength / boardWidth)
      const woodColor = '#D2691E'
      return (
        <group>
          {/* Solid boards */}
          <mesh position={[midX, fenceHeight / 2, midZ]} rotation={[0, angle, 0]} castShadow receiveShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}>
            <boxGeometry args={[boardThickness, fenceHeight, wallLength]} />
            <meshStandardMaterial color={getColor(woodColor)} roughness={0.7} />
          </mesh>
          {/* Vertical board lines (decorative) */}
          {Array.from({ length: numBoards }).map((_, i) => {
            const boardDist = i * boardWidth
            const pos = getWorldPos(boardDist)
            return (
              <mesh key={`line-${i}`} position={[pos.x, fenceHeight / 2, pos.z]} rotation={[0, angle, 0]}>
                <boxGeometry args={[boardThickness + 0.01, fenceHeight, 0.01]} />
                <meshStandardMaterial color={getColor('#A0522D')} roughness={0.9} />
              </mesh>
            )
          })}
          {/* Top cap rail */}
          <mesh position={[midX, fenceHeight + 0.02, midZ]} rotation={[0, angle, 0]} castShadow>
            <boxGeometry args={[0.06, 0.04, wallLength]} />
            <meshStandardMaterial color={getColor('#A0522D')} roughness={0.7} />
          </mesh>
        </group>
      )
    }

    // CHAIN LINK fence: metal posts with mesh
    if (fenceStyle === 'chainLink') {
      const postSize = 0.05
      const metalColor = '#708090'
      return (
        <group>
          {/* Metal posts (using box for consistency) */}
          {posts.map((dist, i) => {
            const pos = getWorldPos(dist)
            return (
              <mesh key={`post-${i}`} position={[pos.x, fenceHeight / 2, pos.z]} rotation={[0, angle, 0]} castShadow receiveShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}>
                <boxGeometry args={[postSize, fenceHeight, postSize]} />
                <meshStandardMaterial color={getColor(metalColor)} metalness={0.6} roughness={0.3} />
              </mesh>
            )
          })}
          {/* Top rail (using box geometry for correct orientation) */}
          <mesh position={[midX, fenceHeight - 0.02, midZ]} rotation={[0, angle, 0]} castShadow>
            <boxGeometry args={[0.03, 0.03, wallLength]} />
            <meshStandardMaterial color={getColor(metalColor)} metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Bottom rail */}
          <mesh position={[midX, 0.15, midZ]} rotation={[0, angle, 0]} castShadow>
            <boxGeometry args={[0.03, 0.03, wallLength]} />
            <meshStandardMaterial color={getColor(metalColor)} metalness={0.6} roughness={0.3} />
          </mesh>
          {/* Chain link mesh (simplified as semi-transparent panel) */}
          <mesh position={[midX, fenceHeight / 2, midZ]} rotation={[0, angle, 0]} onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}>
            <boxGeometry args={[0.01, fenceHeight - 0.2, wallLength]} />
            <meshStandardMaterial color={getColor('#A9A9A9')} transparent opacity={0.3} side={2} />
          </mesh>
        </group>
      )
    }

    // IRON fence: decorative wrought iron with vertical bars
    if (fenceStyle === 'iron') {
      const barSpacing = 0.12
      const numBars = Math.ceil(wallLength / barSpacing)
      const ironColor = '#2F2F2F'
      return (
        <group>
          {/* Main posts */}
          {posts.map((dist, i) => {
            const pos = getWorldPos(dist)
            return (
              <mesh key={`post-${i}`} position={[pos.x, fenceHeight / 2, pos.z]} rotation={[0, angle, 0]} castShadow receiveShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}>
                <boxGeometry args={[0.06, fenceHeight, 0.06]} />
                <meshStandardMaterial color={getColor(ironColor)} metalness={0.7} roughness={0.2} />
              </mesh>
            )
          })}
          {/* Vertical bars */}
          {Array.from({ length: numBars }).map((_, i) => {
            const barDist = i * barSpacing
            if (barDist > wallLength) return null
            const pos = getWorldPos(barDist)
            return (
              <mesh key={`bar-${i}`} position={[pos.x, fenceHeight / 2, pos.z]} rotation={[0, angle, 0]} castShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}>
                <boxGeometry args={[0.015, fenceHeight - 0.1, 0.015]} />
                <meshStandardMaterial color={getColor(ironColor)} metalness={0.7} roughness={0.2} />
              </mesh>
            )
          })}
          {/* Top rail */}
          <mesh position={[midX, fenceHeight - 0.03, midZ]} rotation={[0, angle, 0]} castShadow>
            <boxGeometry args={[0.04, 0.04, wallLength]} />
            <meshStandardMaterial color={getColor(ironColor)} metalness={0.7} roughness={0.2} />
          </mesh>
          {/* Bottom rail */}
          <mesh position={[midX, 0.08, midZ]} rotation={[0, angle, 0]} castShadow>
            <boxGeometry args={[0.04, 0.04, wallLength]} />
            <meshStandardMaterial color={getColor(ironColor)} metalness={0.7} roughness={0.2} />
          </mesh>
          {/* Decorative spear tops */}
          {Array.from({ length: numBars }).map((_, i) => {
            const barDist = i * barSpacing
            if (barDist > wallLength) return null
            const pos = getWorldPos(barDist)
            return (
              <mesh key={`spear-${i}`} position={[pos.x, fenceHeight + 0.03, pos.z]} rotation={[0, angle, 0]}>
                <coneGeometry args={[0.02, 0.06, 4]} />
                <meshStandardMaterial color={getColor(ironColor)} metalness={0.7} roughness={0.2} />
              </mesh>
            )
          })}
        </group>
      )
    }

    // RANCH fence: split rail horizontal design
    if (fenceStyle === 'ranch') {
      const postSize = 0.12
      const railSize = 0.08
      const woodColor = '#8B7355'
      return (
        <group>
          {/* Thick wooden posts */}
          {posts.map((dist, i) => {
            const pos = getWorldPos(dist)
            return (
              <mesh key={`post-${i}`} position={[pos.x, fenceHeight / 2, pos.z]} rotation={[0, angle, 0]} castShadow receiveShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}>
                <boxGeometry args={[postSize, fenceHeight, postSize]} />
                <meshStandardMaterial color={getColor(woodColor)} roughness={0.9} />
              </mesh>
            )
          })}
          {/* Top rail */}
          <mesh position={[midX, fenceHeight * 0.85, midZ]} rotation={[0, angle, 0]} castShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}>
            <boxGeometry args={[railSize, railSize, wallLength]} />
            <meshStandardMaterial color={getColor(woodColor)} roughness={0.9} />
          </mesh>
          {/* Middle rail */}
          <mesh position={[midX, fenceHeight * 0.5, midZ]} rotation={[0, angle, 0]} castShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}>
            <boxGeometry args={[railSize, railSize, wallLength]} />
            <meshStandardMaterial color={getColor(woodColor)} roughness={0.9} />
          </mesh>
          {/* Bottom rail */}
          <mesh position={[midX, fenceHeight * 0.15, midZ]} rotation={[0, angle, 0]} castShadow onClick={handleClick} onDoubleClick={handleDoubleClick} onPointerEnter={() => setIsHovered(true)} onPointerLeave={() => setIsHovered(false)}>
            <boxGeometry args={[railSize, railSize, wallLength]} />
            <meshStandardMaterial color={getColor(woodColor)} roughness={0.9} />
          </mesh>
        </group>
      )
    }

    // Default fallback to picket
    return null
  }

  // 3D rendering: wall segments with openings
  return (
    <group position={[0, floorYOffset, 0]}>
      {segments.map((seg, i) => {
        const segLength = seg.endDist - seg.startDist
        const segHeight = seg.topY - seg.bottomY
        const centerDist = (seg.startDist + seg.endDist) / 2
        const centerY = (seg.bottomY + seg.topY) / 2
        const pos = getWorldPos(centerDist)

        // Determine wall color based on state, custom color, and texture
        // When texture is applied, use white color so texture is not tinted
        let segmentColor = wallTexture ? '#FFFFFF' : (wallColor || '#E5E5E5')
        let emissiveColor = '#000000'
        let emissiveInt = 0

        if (isDeleteMode && isHovered) {
          segmentColor = '#FF4444'
          emissiveColor = '#FF0000'
          emissiveInt = 0.4
        } else if (isSelected) {
          segmentColor = '#FFD700'
          emissiveColor = '#FFD700'
          emissiveInt = 0.3
        }

        return (
          <mesh
            key={`${i}-${wall.pattern || 'none'}`}
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
            onDoubleClick={(e) => {
              e.stopPropagation()
              onOpenProperties?.()
            }}
          >
            <boxGeometry args={[thickness, segHeight, segLength]} />
            {wallTexture ? (
              <meshStandardMaterial
                color="#FFFFFF"
                roughness={0.8}
                emissive={emissiveColor}
                emissiveIntensity={emissiveInt}
                map={wallTexture}
                transparent={isInactiveFloor}
                opacity={isInactiveFloor ? inactiveOpacity : 1}
              />
            ) : (
              <meshStandardMaterial
                color={segmentColor}
                roughness={0.8}
                emissive={emissiveColor}
                emissiveIntensity={emissiveInt}
                transparent={isInactiveFloor}
                opacity={isInactiveFloor ? inactiveOpacity : 1}
              />
            )}
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
        const dType = opening.doorType || 'single'

        // Sliding door: aluminum frame with glass panels and handle
        if (dType === 'sliding') {
          const frameColor = '#707070' // Dark aluminum gray
          const panelWidth = doorWidth / 2
          const glassFrameThick = 0.03
          return (
            <group key={`door-${opening.id}`} position={[pos.x, 0, pos.z]} rotation={[0, angle, 0]}>
              {/* Frame - left */}
              <mesh position={[0, doorHeight / 2, -doorWidth / 2 - frameThickness / 2]} castShadow>
                <boxGeometry args={[frameDepth, doorHeight, frameThickness]} />
                <meshStandardMaterial color={frameColor} metalness={0.6} roughness={0.2} />
              </mesh>
              {/* Frame - right */}
              <mesh position={[0, doorHeight / 2, doorWidth / 2 + frameThickness / 2]} castShadow>
                <boxGeometry args={[frameDepth, doorHeight, frameThickness]} />
                <meshStandardMaterial color={frameColor} metalness={0.6} roughness={0.2} />
              </mesh>
              {/* Frame - top */}
              <mesh position={[0, doorHeight + frameThickness / 2, 0]} castShadow>
                <boxGeometry args={[frameDepth, frameThickness, doorWidth + frameThickness * 2]} />
                <meshStandardMaterial color={frameColor} metalness={0.6} roughness={0.2} />
              </mesh>
              {/* Track - bottom (double track) */}
              <mesh position={[0, 0.02, 0]} castShadow>
                <boxGeometry args={[frameDepth + 0.02, 0.04, doorWidth]} />
                <meshStandardMaterial color={frameColor} metalness={0.6} roughness={0.2} />
              </mesh>
              {/* Left panel - fixed (with frame around glass) */}
              <group position={[0.02, doorHeight / 2, -panelWidth / 2]}>
                {/* Glass */}
                <mesh rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[panelWidth - 0.08, doorHeight - 0.12]} />
                  <meshStandardMaterial color="#A8D8EA" transparent opacity={0.4} side={2} roughness={0} metalness={0.2} />
                </mesh>
                {/* Panel frame - top */}
                <mesh position={[0, doorHeight / 2 - glassFrameThick, 0]}>
                  <boxGeometry args={[glassFrameThick, glassFrameThick * 2, panelWidth - 0.04]} />
                  <meshStandardMaterial color={frameColor} metalness={0.6} roughness={0.2} />
                </mesh>
                {/* Panel frame - bottom */}
                <mesh position={[0, -doorHeight / 2 + glassFrameThick + 0.04, 0]}>
                  <boxGeometry args={[glassFrameThick, glassFrameThick * 2, panelWidth - 0.04]} />
                  <meshStandardMaterial color={frameColor} metalness={0.6} roughness={0.2} />
                </mesh>
              </group>
              {/* Right panel - sliding (overlaps, with handle) */}
              <group position={[-0.02, doorHeight / 2, panelWidth / 2]}>
                {/* Glass */}
                <mesh rotation={[0, Math.PI / 2, 0]}>
                  <planeGeometry args={[panelWidth - 0.08, doorHeight - 0.12]} />
                  <meshStandardMaterial color="#A8D8EA" transparent opacity={0.4} side={2} roughness={0} metalness={0.2} />
                </mesh>
                {/* Panel frame - top */}
                <mesh position={[0, doorHeight / 2 - glassFrameThick, 0]}>
                  <boxGeometry args={[glassFrameThick, glassFrameThick * 2, panelWidth - 0.04]} />
                  <meshStandardMaterial color={frameColor} metalness={0.6} roughness={0.2} />
                </mesh>
                {/* Panel frame - bottom */}
                <mesh position={[0, -doorHeight / 2 + glassFrameThick + 0.04, 0]}>
                  <boxGeometry args={[glassFrameThick, glassFrameThick * 2, panelWidth - 0.04]} />
                  <meshStandardMaterial color={frameColor} metalness={0.6} roughness={0.2} />
                </mesh>
                {/* Handle bar (vertical) */}
                <mesh position={[-0.04, 0, -panelWidth / 2 + 0.15]} castShadow>
                  <boxGeometry args={[0.03, 0.25, 0.02]} />
                  <meshStandardMaterial color="#404040" metalness={0.8} roughness={0.1} />
                </mesh>
              </group>
            </group>
          )
        }

        // Garage door: sectional panels
        if (dType === 'garage') {
          const panelColor = '#E8E8E8' // Light gray
          const sectionCount = 4
          const sectionHeight = doorHeight / sectionCount
          return (
            <group key={`door-${opening.id}`} position={[pos.x, 0, pos.z]} rotation={[0, angle, 0]}>
              {/* Frame - left */}
              <mesh position={[0, doorHeight / 2, -doorWidth / 2 - frameThickness / 2]} castShadow>
                <boxGeometry args={[frameDepth, doorHeight, frameThickness]} />
                <meshStandardMaterial color="#505050" />
              </mesh>
              {/* Frame - right */}
              <mesh position={[0, doorHeight / 2, doorWidth / 2 + frameThickness / 2]} castShadow>
                <boxGeometry args={[frameDepth, doorHeight, frameThickness]} />
                <meshStandardMaterial color="#505050" />
              </mesh>
              {/* Frame - top */}
              <mesh position={[0, doorHeight + frameThickness / 2, 0]} castShadow>
                <boxGeometry args={[frameDepth, frameThickness, doorWidth + frameThickness * 2]} />
                <meshStandardMaterial color="#505050" />
              </mesh>
              {/* Garage door sections */}
              {Array.from({ length: sectionCount }).map((_, i) => (
                <mesh key={`section-${i}`} position={[0, sectionHeight * (i + 0.5), 0]} castShadow>
                  <boxGeometry args={[frameDepth - 0.01, sectionHeight - 0.02, doorWidth - 0.02]} />
                  <meshStandardMaterial color={panelColor} roughness={0.6} />
                </mesh>
              ))}
              {/* Horizontal lines between sections */}
              {Array.from({ length: sectionCount - 1 }).map((_, i) => (
                <mesh key={`line-${i}`} position={[0, sectionHeight * (i + 1), 0]} castShadow>
                  <boxGeometry args={[frameDepth, 0.02, doorWidth]} />
                  <meshStandardMaterial color="#909090" />
                </mesh>
              ))}
            </group>
          )
        }

        // Single or Double door: wood frame
        const isDoubleDoor = dType === 'double'
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
      {showDimensions && (
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
      )}
    </group>
  )
}
