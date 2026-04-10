// src/components/scene/BuildingInterior.jsx
// Renders floor, furniture, and stairs inside a placed building

import { useMemo } from 'react'

export function BuildingInterior({ walls = [], rooms = [], stairs = [] }) {
  // Calculate building bounds from walls
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity
    let minZ = Infinity, maxZ = -Infinity

    for (const wall of walls) {
      minX = Math.min(minX, wall.start.x, wall.end.x)
      maxX = Math.max(maxX, wall.start.x, wall.end.x)
      minZ = Math.min(minZ, wall.start.z, wall.end.z)
      maxZ = Math.max(maxZ, wall.start.z, wall.end.z)
    }

    if (!isFinite(minX)) return null

    return {
      centerX: (minX + maxX) / 2,
      centerZ: (minZ + maxZ) / 2,
      width: maxX - minX + 0.3,
      depth: maxZ - minZ + 0.3,
    }
  }, [walls])

  if (!bounds) return null

  return (
    <group>
      {/* Building floor */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[bounds.centerX, 0.005, bounds.centerZ]}
        receiveShadow
      >
        <planeGeometry args={[bounds.width, bounds.depth]} />
        <meshStandardMaterial color="#C8B898" roughness={0.6} metalness={0.02} />
      </mesh>

      {/* Stairs */}
      {stairs.map((stair, i) => (
        <Staircase key={`stair-${i}`} stair={stair} />
      ))}
    </group>
  )
}

// ─── Staircase ─────────────────────────────────────────────────────────────────

function Staircase({ stair }) {
  const stepCount = 12
  const totalWidth = 1.0
  const totalDepth = 2.5
  const totalHeight = 2.7
  const stepHeight = totalHeight / stepCount
  const stepDepth = totalDepth / stepCount

  return (
    <group position={[stair.center.x, 0, stair.center.z]}>
      {Array.from({ length: stepCount }).map((_, i) => (
        <mesh
          key={i}
          position={[0, stepHeight * (i + 0.5), -totalDepth / 2 + stepDepth * (i + 0.5)]}
          castShadow
          receiveShadow
        >
          <boxGeometry args={[totalWidth, stepHeight, stepDepth]} />
          <meshStandardMaterial color="#B0A090" roughness={0.6} />
        </mesh>
      ))}
      {/* Side rails */}
      <mesh position={[-totalWidth / 2 - 0.02, totalHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.04, totalHeight, totalDepth]} />
        <meshStandardMaterial color="#8B7355" roughness={0.5} />
      </mesh>
      <mesh position={[totalWidth / 2 + 0.02, totalHeight / 2, 0]} castShadow>
        <boxGeometry args={[0.04, totalHeight, totalDepth]} />
        <meshStandardMaterial color="#8B7355" roughness={0.5} />
      </mesh>
      {/* Handrails */}
      <mesh position={[-totalWidth / 2 - 0.02, totalHeight + 0.45, 0]} castShadow>
        <boxGeometry args={[0.06, 0.06, totalDepth]} />
        <meshStandardMaterial color="#6B5B4A" roughness={0.4} />
      </mesh>
      <mesh position={[totalWidth / 2 + 0.02, totalHeight + 0.45, 0]} castShadow>
        <boxGeometry args={[0.06, 0.06, totalDepth]} />
        <meshStandardMaterial color="#6B5B4A" roughness={0.4} />
      </mesh>
    </group>
  )
}

