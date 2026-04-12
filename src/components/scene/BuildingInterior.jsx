// src/components/scene/BuildingInterior.jsx
// Renders the floor slab inside a placed building

import { useMemo } from 'react'

export function BuildingInterior({ walls = [] }) {
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
    <mesh
      rotation={[-Math.PI / 2, 0, 0]}
      position={[bounds.centerX, 0.005, bounds.centerZ]}
      receiveShadow
    >
      <planeGeometry args={[bounds.width, bounds.depth]} />
      <meshStandardMaterial color="#C8B898" roughness={0.6} metalness={0.02} />
    </mesh>
  )
}
