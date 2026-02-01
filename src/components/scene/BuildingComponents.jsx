import { useState, useRef, useEffect, useMemo, useCallback } from 'react'
import { useThree } from '@react-three/fiber'
import { Text, Billboard, Line } from '@react-three/drei'
import * as THREE from 'three'
import { formatDimension, formatDimensions } from '../../constants/landSceneConstants'
import { computeEdgeLabelData, formatEdgeLength } from '../../utils/labels'

/**
 * PlacedBuilding - renders a placed building in 2D and 3D modes
 * Supports various building types with detailed models (houses, barns, garages, etc.)
 */
export function PlacedBuilding({ building, onDelete, onMove, onSelect, isSelected = false, isDeleteMode = false, lengthUnit = 'm', isOverlapping = false, showLabels = false, showBuildingDimensions = false, canEdit = true, viewMode = 'firstPerson' }) {
  const { camera, gl } = useThree()
  const { type, position, rotationY = 0 } = building
  const [hovered, setHovered] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [dragOffset, setDragOffset] = useState({ x: 0, z: 0 })
  const dragStartRef = useRef(null)
  const originalPosRef = useRef(null)
  const is2D = viewMode === '2d'
  const isPool = type.height < 0
  const height = Math.abs(type.height)
  const yPos = isPool ? -height / 2 + 0.03 : height / 2

  // Ground plane for raycasting during drag
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

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

  // Reset dragOffset when parent position updates after move
  useEffect(() => {
    if (originalPosRef.current &&
        (position.x !== originalPosRef.current.x || position.z !== originalPosRef.current.z)) {
      setDragOffset({ x: 0, z: 0 })
      originalPosRef.current = null
    }
  }, [position.x, position.z])

  // Handle pointer up to commit drag
  useEffect(() => {
    if (!isDragging) return
    const handlePointerUp = () => {
      if (dragOffset.x !== 0 || dragOffset.z !== 0) {
        onMove?.(building.id, { x: position.x + dragOffset.x, z: position.z + dragOffset.z })
      }
      setIsDragging(false)
      // Don't reset dragOffset here - wait for position to update from parent
      document.body.style.cursor = 'default'
    }
    const handlePointerMove = (e) => {
      const groundPos = raycastToGround(e.clientX, e.clientY)
      if (groundPos && dragStartRef.current) {
        const dx = groundPos.x - dragStartRef.current.x
        const dz = groundPos.z - dragStartRef.current.z
        setDragOffset({ x: dx, z: dz })
      }
    }
    window.addEventListener('pointerup', handlePointerUp)
    window.addEventListener('pointermove', handlePointerMove)
    return () => {
      window.removeEventListener('pointerup', handlePointerUp)
      window.removeEventListener('pointermove', handlePointerMove)
    }
  }, [isDragging, dragOffset, building.id, position, onMove, raycastToGround])

  // Actual display position (with drag offset)
  const displayPos = {
    x: position.x + dragOffset.x,
    z: position.z + dragOffset.z
  }

  // Color logic
  const baseColor = isOverlapping ? '#ff9955' : type.color
  const displayColor = isDeleteMode && hovered ? '#ff4444' : (isSelected ? type.color : (hovered ? '#ffaa66' : baseColor))

  // Show dimensions only when labels enabled AND hovered
  const showDimensions = showLabels && hovered

  // 2D rendering
  if (is2D) {
    return (
      <group position={[displayPos.x, 0.05, displayPos.z]} rotation={[0, rotationY * Math.PI / 180, 0]}>
        <mesh
          rotation={[-Math.PI / 2, 0, 0]}
          onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
          onPointerOut={() => setHovered(false)}
          onClick={(e) => {
            e.stopPropagation()
            if (!canEdit) return
            if (isDeleteMode) {
              onDelete?.(building.id)
            } else {
              onSelect?.(building.id)
            }
          }}
        >
          <planeGeometry args={[type.width, type.length]} />
          <meshBasicMaterial color={displayColor} transparent opacity={hovered ? 0.9 : 0.7} />
        </mesh>
        <line rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <bufferGeometry>
            <bufferAttribute attach="attributes-position" count={5}
              array={new Float32Array([
                -type.width / 2, -type.length / 2, 0, type.width / 2, -type.length / 2, 0,
                type.width / 2, type.length / 2, 0, -type.width / 2, type.length / 2, 0,
                -type.width / 2, -type.length / 2, 0,
              ])} itemSize={3} />
          </bufferGeometry>
          <lineBasicMaterial color={isSelected ? '#22d3ee' : (hovered ? '#ffaa66' : '#ffffff')} />
        </line>
        {hovered && (
          <Text position={[0, 0.15, 0]} rotation={[-Math.PI / 2, 0, 0]} fontSize={0.6}
            color={isSelected ? '#22d3ee' : '#ffffff'} anchorX="center" anchorY="middle">
            {type.name}
          </Text>
        )}
      </group>
    )
  }

  // Event handlers for 3D
  const handlePointerOver = (e) => { e.stopPropagation(); setHovered(true) }
  const handlePointerOut = () => setHovered(false)
  const handlePointerDown = (e) => {
    e.stopPropagation()
    if (!canEdit) return

    // Delete mode - delete immediately
    if (isDeleteMode) {
      onDelete?.(building.id)
      return
    }

    // Select first
    onSelect?.(building.id)

    // If already selected, start drag
    if (isSelected) {
      setIsDragging(true)
      dragStartRef.current = { x: e.point.x, z: e.point.z }
      originalPosRef.current = { x: position.x, z: position.z }
      document.body.style.cursor = 'grabbing'
    }
  }

  // Material props with selection highlight
  const materialProps = {
    color: displayColor,
    transparent: isPool || hovered || isOverlapping || isSelected,
    opacity: isPool ? 0.7 : (hovered ? 0.85 : (isOverlapping ? 0.9 : 1)),
    emissive: isSelected ? '#22d3ee' : (isDeleteMode && hovered ? '#ff0000' : (hovered ? '#ff6600' : (isOverlapping ? '#ff6600' : '#000000'))),
    emissiveIntensity: isSelected ? 0.3 : (hovered ? 0.2 : (isOverlapping ? 0.1 : 0))
  }

  // Roof color
  const roofColor = isDeleteMode && hovered ? '#cc4444' : (isSelected ? '#666666' : (hovered ? '#777777' : (isOverlapping ? '#cc7744' : '#555555')))

  // Render building based on type
  const renderBuilding = () => {
    const buildingId = type.id

    // Houses - box with pitched roof
    if (buildingId === 'smallHouse' || buildingId === 'mediumHouse' || buildingId === 'largeHouse') {
      const wallHeight = height * 0.7
      const roofHeight = height * 0.3
      return (
        <group>
          {/* Walls */}
          <mesh castShadow receiveShadow position={[0, wallHeight / 2 - height / 2, 0]}
            onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown}>
            <boxGeometry args={[type.width, wallHeight, type.length]} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          {/* Roof (triangular prism) */}
          <mesh castShadow position={[0, wallHeight + roofHeight / 2 - height / 2, 0]}>
            <boxGeometry args={[type.width + 0.4, roofHeight, type.length + 0.4]} />
            <meshStandardMaterial color={roofColor} />
          </mesh>
          {/* Door with frame and details */}
          <group position={[0, 1 - height / 2, type.length / 2]}>
            {/* Door frame (outer) */}
            <mesh position={[0, 0, 0.02]}>
              <boxGeometry args={[1.4, 2.2, 0.08]} />
              <meshStandardMaterial color="#2d1f14" />
            </mesh>
            {/* Door recess */}
            <mesh position={[0, 0, 0.04]}>
              <boxGeometry args={[1.2, 2, 0.06]} />
              <meshStandardMaterial color="#1a1108" />
            </mesh>
            {/* Door panel */}
            <mesh position={[0, 0, 0.08]}>
              <boxGeometry args={[1.1, 1.9, 0.04]} />
              <meshStandardMaterial color="#5a3d28" />
            </mesh>
            {/* Top panel detail */}
            <mesh position={[0, 0.5, 0.11]}>
              <boxGeometry args={[0.9, 0.6, 0.02]} />
              <meshStandardMaterial color="#4a3020" />
            </mesh>
            {/* Bottom panel detail */}
            <mesh position={[0, -0.4, 0.11]}>
              <boxGeometry args={[0.9, 0.8, 0.02]} />
              <meshStandardMaterial color="#4a3020" />
            </mesh>
            {/* Door handle */}
            <mesh position={[0.4, 0, 0.14]}>
              <boxGeometry args={[0.08, 0.2, 0.06]} />
              <meshStandardMaterial color="#c4a000" metalness={0.8} roughness={0.2} />
            </mesh>
            {/* Door handle knob */}
            <mesh position={[0.4, 0, 0.18]}>
              <sphereGeometry args={[0.05, 8, 8]} />
              <meshStandardMaterial color="#d4b000" metalness={0.9} roughness={0.1} />
            </mesh>
          </group>
          {/* Windows with frame and panes */}
          {[-type.width / 4, type.width / 4].map((xPos, idx) => (
            <group key={idx} position={[xPos, wallHeight / 2 - height / 2 + 0.5, type.length / 2]}>
              {/* Window frame (outer) */}
              <mesh position={[0, 0, 0.02]}>
                <boxGeometry args={[1.2, 1.2, 0.08]} />
                <meshStandardMaterial color="#f5f5f5" />
              </mesh>
              {/* Window sill */}
              <mesh position={[0, -0.65, 0.08]}>
                <boxGeometry args={[1.3, 0.08, 0.15]} />
                <meshStandardMaterial color="#e8e8e8" />
              </mesh>
              {/* Glass background */}
              <mesh position={[0, 0, 0.04]}>
                <boxGeometry args={[1, 1, 0.02]} />
                <meshStandardMaterial color="#1a3a5c" transparent opacity={0.7} />
              </mesh>
              {/* Glass reflection */}
              <mesh position={[0, 0, 0.06]}>
                <planeGeometry args={[1, 1]} />
                <meshStandardMaterial color="#87CEEB" transparent opacity={0.4} />
              </mesh>
              {/* Window cross frame (vertical) */}
              <mesh position={[0, 0, 0.07]}>
                <boxGeometry args={[0.06, 1, 0.03]} />
                <meshStandardMaterial color="#f5f5f5" />
              </mesh>
              {/* Window cross frame (horizontal) */}
              <mesh position={[0, 0, 0.07]}>
                <boxGeometry args={[1, 0.06, 0.03]} />
                <meshStandardMaterial color="#f5f5f5" />
              </mesh>
            </group>
          ))}
        </group>
      )
    }

    // Barn - tall with gambrel-style roof
    if (buildingId === 'barn') {
      const wallHeight = height * 0.6
      return (
        <group>
          <mesh castShadow receiveShadow position={[0, wallHeight / 2 - height / 2, 0]}
            onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown}>
            <boxGeometry args={[type.width, wallHeight, type.length]} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          {/* Barn roof */}
          <mesh castShadow position={[0, wallHeight + (height - wallHeight) / 2 - height / 2, 0]}>
            <boxGeometry args={[type.width + 0.5, height - wallHeight, type.length + 0.3]} />
            <meshStandardMaterial color={roofColor} />
          </mesh>
          {/* Large barn door with details */}
          <group position={[0, wallHeight / 3 - height / 2, type.length / 2]}>
            {/* Door frame */}
            <mesh position={[0, 0, 0.02]}>
              <boxGeometry args={[3.3, wallHeight * 0.85, 0.1]} />
              <meshStandardMaterial color="#2a1a0a" />
            </mesh>
            {/* Left door panel */}
            <mesh position={[-0.8, 0, 0.08]}>
              <boxGeometry args={[1.4, wallHeight * 0.78, 0.08]} />
              <meshStandardMaterial color="#5a3018" />
            </mesh>
            {/* Right door panel */}
            <mesh position={[0.8, 0, 0.08]}>
              <boxGeometry args={[1.4, wallHeight * 0.78, 0.08]} />
              <meshStandardMaterial color="#5a3018" />
            </mesh>
            {/* Cross braces - left door */}
            <mesh position={[-0.8, 0, 0.13]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[0.15, wallHeight * 0.9, 0.04]} />
              <meshStandardMaterial color="#3d2010" />
            </mesh>
            <mesh position={[-0.8, 0, 0.13]} rotation={[0, 0, -Math.PI / 4]}>
              <boxGeometry args={[0.15, wallHeight * 0.9, 0.04]} />
              <meshStandardMaterial color="#3d2010" />
            </mesh>
            {/* Cross braces - right door */}
            <mesh position={[0.8, 0, 0.13]} rotation={[0, 0, Math.PI / 4]}>
              <boxGeometry args={[0.15, wallHeight * 0.9, 0.04]} />
              <meshStandardMaterial color="#3d2010" />
            </mesh>
            <mesh position={[0.8, 0, 0.13]} rotation={[0, 0, -Math.PI / 4]}>
              <boxGeometry args={[0.15, wallHeight * 0.9, 0.04]} />
              <meshStandardMaterial color="#3d2010" />
            </mesh>
            {/* Door handles */}
            <mesh position={[-0.15, 0, 0.15]}>
              <boxGeometry args={[0.08, 0.3, 0.08]} />
              <meshStandardMaterial color="#333333" metalness={0.7} roughness={0.3} />
            </mesh>
            <mesh position={[0.15, 0, 0.15]}>
              <boxGeometry args={[0.08, 0.3, 0.08]} />
              <meshStandardMaterial color="#333333" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        </group>
      )
    }

    // Greenhouse - transparent walls
    if (buildingId === 'greenhouse') {
      return (
        <group>
          <mesh castShadow receiveShadow onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown}>
            <boxGeometry args={[type.width, height, type.length]} />
            <meshStandardMaterial color="#98FB98" transparent opacity={0.3} />
          </mesh>
          {/* Frame */}
          <mesh>
            <boxGeometry args={[type.width + 0.05, height + 0.05, type.length + 0.05]} />
            <meshBasicMaterial color="#ffffff" wireframe />
          </mesh>
          {/* Roof */}
          <mesh position={[0, height / 2 + 0.15, 0]}>
            <boxGeometry args={[type.width + 0.3, 0.3, type.length + 0.3]} />
            <meshStandardMaterial color="#f0f0f0" />
          </mesh>
        </group>
      )
    }

    // Gazebo - open structure with roof
    if (buildingId === 'gazebo') {
      const postHeight = height * 0.8
      return (
        <group>
          {/* Invisible click target */}
          <mesh onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown}>
            <boxGeometry args={[type.width, height, type.length]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>
          {/* Corner posts */}
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
            <mesh key={i} position={[x * (type.width / 2 - 0.1), postHeight / 2 - height / 2, z * (type.length / 2 - 0.1)]} castShadow>
              <cylinderGeometry args={[0.1, 0.1, postHeight, 8]} />
              <meshStandardMaterial color={displayColor} />
            </mesh>
          ))}
          {/* Roof */}
          <mesh position={[0, postHeight + 0.3 - height / 2, 0]} castShadow>
            <coneGeometry args={[type.width * 0.8, height - postHeight, 4]} />
            <meshStandardMaterial color={roofColor} />
          </mesh>
          {/* Floor */}
          <mesh position={[0, 0.05 - height / 2, 0]} rotation={[-Math.PI / 2, 0, 0]}>
            <planeGeometry args={[type.width, type.length]} />
            <meshStandardMaterial color="#DEB887" />
          </mesh>
        </group>
      )
    }

    // Carport - open with flat roof
    if (buildingId === 'carport') {
      const postHeight = height * 0.9
      return (
        <group>
          <mesh onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown}>
            <boxGeometry args={[type.width, height, type.length]} />
            <meshStandardMaterial transparent opacity={0} />
          </mesh>
          {/* Corner posts */}
          {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([x, z], i) => (
            <mesh key={i} position={[x * (type.width / 2 - 0.1), postHeight / 2 - height / 2, z * (type.length / 2 - 0.1)]} castShadow>
              <boxGeometry args={[0.15, postHeight, 0.15]} />
              <meshStandardMaterial color={displayColor} />
            </mesh>
          ))}
          {/* Flat roof */}
          <mesh position={[0, postHeight - height / 2 + 0.1, 0]} castShadow>
            <boxGeometry args={[type.width + 0.4, 0.2, type.length + 0.4]} />
            <meshStandardMaterial color={roofColor} />
          </mesh>
        </group>
      )
    }

    // Garage - box with large door
    if (buildingId === 'garage') {
      const doorWidth = type.width * 0.8
      const doorHeight = height * 0.75
      const numSections = 4
      const sectionHeight = doorHeight / numSections
      return (
        <group>
          <mesh castShadow receiveShadow onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown}>
            <boxGeometry args={[type.width, height, type.length]} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          {/* Garage door frame */}
          <mesh position={[0, doorHeight / 2 - height / 2 + 0.05, type.length / 2 + 0.02]}>
            <boxGeometry args={[doorWidth + 0.2, doorHeight + 0.15, 0.1]} />
            <meshStandardMaterial color="#2a2a2a" />
          </mesh>
          {/* Garage door sections */}
          {Array.from({ length: numSections }).map((_, i) => (
            <group key={i}>
              {/* Door panel */}
              <mesh position={[0, (i + 0.5) * sectionHeight - height / 2 + 0.05, type.length / 2 + 0.06]}>
                <boxGeometry args={[doorWidth - 0.08, sectionHeight - 0.04, 0.06]} />
                <meshStandardMaterial color="#e8e8e8" />
              </mesh>
              {/* Panel indent */}
              <mesh position={[0, (i + 0.5) * sectionHeight - height / 2 + 0.05, type.length / 2 + 0.1]}>
                <boxGeometry args={[doorWidth - 0.3, sectionHeight - 0.15, 0.02]} />
                <meshStandardMaterial color="#d0d0d0" />
              </mesh>
              {/* Section divider line */}
              {i < numSections - 1 && (
                <mesh position={[0, (i + 1) * sectionHeight - height / 2 + 0.05, type.length / 2 + 0.11]}>
                  <boxGeometry args={[doorWidth, 0.03, 0.02]} />
                  <meshStandardMaterial color="#888888" />
                </mesh>
              )}
            </group>
          ))}
          {/* Garage door handle */}
          <mesh position={[0, height * 0.12 - height / 2, type.length / 2 + 0.12]}>
            <boxGeometry args={[0.4, 0.06, 0.04]} />
            <meshStandardMaterial color="#333333" metalness={0.6} roughness={0.4} />
          </mesh>
        </group>
      )
    }

    // Shed - small structure with door
    if (buildingId === 'shed') {
      return (
        <group>
          <mesh castShadow receiveShadow onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown}>
            <boxGeometry args={[type.width, height, type.length]} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          {/* Shed roof (slight pitch) */}
          <mesh position={[0, height / 2 + 0.15, 0]} castShadow>
            <boxGeometry args={[type.width + 0.3, 0.2, type.length + 0.3]} />
            <meshStandardMaterial color={roofColor} />
          </mesh>
          {/* Shed door */}
          <group position={[0, 0.9 - height / 2, type.length / 2]}>
            <mesh position={[0, 0, 0.02]}>
              <boxGeometry args={[0.95, 1.9, 0.06]} />
              <meshStandardMaterial color="#3d2817" />
            </mesh>
            <mesh position={[0, 0.3, 0.06]}>
              <boxGeometry args={[0.7, 0.5, 0.02]} />
              <meshStandardMaterial color="#2d1a10" />
            </mesh>
            <mesh position={[0, -0.4, 0.06]}>
              <boxGeometry args={[0.7, 0.7, 0.02]} />
              <meshStandardMaterial color="#2d1a10" />
            </mesh>
            <mesh position={[0.35, 0, 0.08]}>
              <sphereGeometry args={[0.04, 8, 8]} />
              <meshStandardMaterial color="#888888" metalness={0.7} roughness={0.3} />
            </mesh>
          </group>
        </group>
      )
    }

    // Workshop - larger shed with window
    if (buildingId === 'workshop') {
      return (
        <group>
          <mesh castShadow receiveShadow onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown}>
            <boxGeometry args={[type.width, height, type.length]} />
            <meshStandardMaterial {...materialProps} />
          </mesh>
          {/* Workshop roof */}
          <mesh position={[0, height / 2 + 0.2, 0]} castShadow>
            <boxGeometry args={[type.width + 0.4, 0.25, type.length + 0.4]} />
            <meshStandardMaterial color={roofColor} />
          </mesh>
          {/* Workshop door */}
          <group position={[-type.width / 4, 1 - height / 2, type.length / 2]}>
            <mesh position={[0, 0, 0.02]}>
              <boxGeometry args={[1.1, 2, 0.06]} />
              <meshStandardMaterial color="#4a3520" />
            </mesh>
            <mesh position={[0, 0.4, 0.05]}>
              <boxGeometry args={[0.85, 0.6, 0.02]} />
              <meshStandardMaterial color="#3a2815" />
            </mesh>
            <mesh position={[0, -0.35, 0.05]}>
              <boxGeometry args={[0.85, 0.85, 0.02]} />
              <meshStandardMaterial color="#3a2815" />
            </mesh>
            <mesh position={[0.4, 0, 0.08]}>
              <boxGeometry args={[0.06, 0.15, 0.04]} />
              <meshStandardMaterial color="#888888" metalness={0.6} roughness={0.4} />
            </mesh>
          </group>
          {/* Workshop window */}
          <group position={[type.width / 4, height * 0.25 - height / 2 + 0.5, type.length / 2]}>
            <mesh position={[0, 0, 0.02]}>
              <boxGeometry args={[1, 0.8, 0.06]} />
              <meshStandardMaterial color="#e0e0e0" />
            </mesh>
            <mesh position={[0, 0, 0.04]}>
              <boxGeometry args={[0.85, 0.65, 0.02]} />
              <meshStandardMaterial color="#1a3a5c" transparent opacity={0.7} />
            </mesh>
            <mesh position={[0, 0, 0.06]}>
              <boxGeometry args={[0.04, 0.65, 0.02]} />
              <meshStandardMaterial color="#e0e0e0" />
            </mesh>
            <mesh position={[0, 0, 0.06]}>
              <boxGeometry args={[0.85, 0.04, 0.02]} />
              <meshStandardMaterial color="#e0e0e0" />
            </mesh>
            <mesh position={[0, -0.45, 0.06]}>
              <boxGeometry args={[1.1, 0.06, 0.1]} />
              <meshStandardMaterial color="#d0d0d0" />
            </mesh>
          </group>
        </group>
      )
    }

    // Default - simple box (pool, etc.)
    return (
      <mesh castShadow receiveShadow onPointerOver={handlePointerOver} onPointerOut={handlePointerOut} onPointerDown={handlePointerDown}>
        <boxGeometry args={[type.width, height, type.length]} />
        <meshStandardMaterial {...materialProps} />
      </mesh>
    )
  }

  // 3D rendering
  return (
    <group position={[displayPos.x, yPos, displayPos.z]} rotation={[0, rotationY * Math.PI / 180, 0]}>
      {renderBuilding()}
      {/* Overlap outline */}
      {isOverlapping && !hovered && (
        <mesh>
          <boxGeometry args={[type.width + 0.1, height + 0.1, type.length + 0.1]} />
          <meshBasicMaterial color="#ff6600" wireframe transparent opacity={0.4} />
        </mesh>
      )}
      {/* Labels - show always when labels enabled, or on hover */}
      {(showLabels || hovered) && (
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
          {/* Show dimensions when labels enabled, or show interaction hint on hover */}
          {(showLabels || hovered) && (
            <Text
              position={[0, -0.6, 0]}
              fontSize={0.5}
              color={showLabels ? "#aaddff" : (canEdit ? "#ff9999" : "#aaaaaa")}
              anchorX="center"
              anchorY="middle"
              outlineWidth={0.05}
              outlineColor="#000000"
            >
              {showLabels ? formatDimensions(type.width, type.length, lengthUnit) : (canEdit ? (isSelected ? 'Drag to move' : 'Click to select') : '')}
            </Text>
          )}
        </Billboard>
      )}
      {/* Dimension lines around building */}
      {showBuildingDimensions && (
        <group rotation={[0, 0, 0]}>
          {/* Width dimension (front edge) */}
          <group position={[0, 0.1, type.length / 2 + 0.5]}>
            <Line
              points={[[-type.width / 2, 0, 0], [type.width / 2, 0, 0]]}
              color="#00ffff"
              lineWidth={2}
            />
            {/* End caps */}
            <Line points={[[-type.width / 2, -0.2, 0], [-type.width / 2, 0.2, 0]]} color="#00ffff" lineWidth={2} />
            <Line points={[[type.width / 2, -0.2, 0], [type.width / 2, 0.2, 0]]} color="#00ffff" lineWidth={2} />
            <Billboard position={[0, 0.4, 0]} follow={true}>
              <Text
                fontSize={0.4}
                color="#00ffff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.04}
                outlineColor="#000000"
              >
                {formatDimension(type.width, lengthUnit)}
              </Text>
            </Billboard>
          </group>
          {/* Length dimension (right edge) */}
          <group position={[type.width / 2 + 0.5, 0.1, 0]}>
            <Line
              points={[[0, 0, -type.length / 2], [0, 0, type.length / 2]]}
              color="#00ffff"
              lineWidth={2}
            />
            {/* End caps */}
            <Line points={[[0, -0.2, -type.length / 2], [0, 0.2, -type.length / 2]]} color="#00ffff" lineWidth={2} />
            <Line points={[[0, -0.2, type.length / 2], [0, 0.2, type.length / 2]]} color="#00ffff" lineWidth={2} />
            <Billboard position={[0.5, 0.3, 0]} follow={true}>
              <Text
                fontSize={0.4}
                color="#00ffff"
                anchorX="center"
                anchorY="middle"
                outlineWidth={0.04}
                outlineColor="#000000"
              >
                {formatDimension(type.length, lengthUnit)}
              </Text>
            </Billboard>
          </group>
        </group>
      )}
    </group>
  )
}

/**
 * BuildingPreview - ghost preview during building placement
 */
export function BuildingPreview({ buildingType, position, rotation = 0, isValid = true }) {
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

/**
 * SetbackZone - renders a shaded band along boundary for setback visualization
 */
export function SetbackZone({ polygonPoints, length, width, setbackDistance }) {
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

/**
 * SnapIndicator - snap indicator dot for building placement
 */
export function SnapIndicator({ snapInfo }) {
  if (!snapInfo || snapInfo.type === 'none') return null
  const color = snapInfo.type === 'vertex' ? '#00ff00' : snapInfo.type === 'edge' ? '#ffff00' : '#00ffff'
  return (
    <mesh position={[snapInfo.point.x, 0.1, snapInfo.point.z]}>
      <sphereGeometry args={[0.2, 16, 16]} />
      <meshBasicMaterial color={color} />
    </mesh>
  )
}

/**
 * EdgeLabels - edge dimension labels for land boundary
 */
export function EdgeLabels({ polygonPoints, length, width, lengthUnit, viewMode = 'firstPerson' }) {
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
