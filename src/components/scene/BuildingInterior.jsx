// src/components/scene/BuildingInterior.jsx
// Renders floor and furniture inside a placed building

import { useMemo } from 'react'

export function BuildingInterior({ walls = [], rooms = [] }) {
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

      {/* Room furniture */}
      {rooms.map((room, i) => (
        <RoomFurniture key={`furn-${i}`} room={room} />
      ))}
    </group>
  )
}

// ─── Room Furniture ────────────────────────────────────────────────────────────

function RoomFurniture({ room }) {
  const name = (room.name || '').toLowerCase()
  const cx = room.center.x
  const cz = room.center.z

  // Bathroom
  if (name.includes('bathroom') || name.includes('toilet') || name.includes('wc')) {
    return (
      <group>
        {/* Toilet */}
        <group position={[cx + 0.6, 0, cz + 0.4]}>
          <mesh position={[0, 0.15, 0]} castShadow>
            <boxGeometry args={[0.38, 0.3, 0.55]} />
            <meshStandardMaterial color="#F0F0F0" roughness={0.2} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.35, 0.22]} castShadow>
            <boxGeometry args={[0.34, 0.25, 0.15]} />
            <meshStandardMaterial color="#F0F0F0" roughness={0.2} metalness={0.05} />
          </mesh>
        </group>
        {/* Sink */}
        <group position={[cx - 0.5, 0, cz - 0.5]}>
          <mesh position={[0, 0.35, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.08, 0.7, 8]} />
            <meshStandardMaterial color="#F0F0F0" roughness={0.2} />
          </mesh>
          <mesh position={[0, 0.72, 0]} castShadow>
            <boxGeometry args={[0.5, 0.06, 0.4]} />
            <meshStandardMaterial color="#F0F0F0" roughness={0.2} metalness={0.05} />
          </mesh>
          <mesh position={[0, 0.82, -0.12]} castShadow>
            <cylinderGeometry args={[0.015, 0.015, 0.12, 6]} />
            <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.1} />
          </mesh>
        </group>
        {/* Shower tray */}
        <mesh position={[cx - 0.3, 0.05, cz + 0.5]} castShadow>
          <boxGeometry args={[0.8, 0.1, 0.8]} />
          <meshStandardMaterial color="#E8E8E8" roughness={0.3} />
        </mesh>
      </group>
    )
  }

  // Kitchen
  if (name.includes('kitchen')) {
    return (
      <group>
        <mesh position={[cx, 0.45, cz - 0.8]} castShadow receiveShadow>
          <boxGeometry args={[2.0, 0.9, 0.6]} />
          <meshStandardMaterial color="#5C4033" roughness={0.5} />
        </mesh>
        <mesh position={[cx, 0.92, cz - 0.8]} castShadow>
          <boxGeometry args={[2.1, 0.04, 0.65]} />
          <meshStandardMaterial color="#D0C8B8" roughness={0.3} metalness={0.05} />
        </mesh>
        <mesh position={[cx + 0.3, 0.91, cz - 0.8]} castShadow>
          <boxGeometry args={[0.5, 0.08, 0.35]} />
          <meshStandardMaterial color="#C0C0C0" metalness={0.5} roughness={0.2} />
        </mesh>
      </group>
    )
  }

  // Living room
  if (name.includes('living') || name.includes('lounge') || name.includes('family')) {
    return (
      <group>
        <group position={[cx, 0, cz + 0.5]}>
          <mesh position={[0, 0.2, 0]} castShadow>
            <boxGeometry args={[1.8, 0.4, 0.8]} />
            <meshStandardMaterial color="#6B7B8D" roughness={0.8} />
          </mesh>
          <mesh position={[0, 0.5, 0.35]} castShadow>
            <boxGeometry args={[1.8, 0.5, 0.15]} />
            <meshStandardMaterial color="#6B7B8D" roughness={0.8} />
          </mesh>
          <mesh position={[-0.85, 0.35, 0]} castShadow>
            <boxGeometry args={[0.12, 0.3, 0.8]} />
            <meshStandardMaterial color="#5A6A7C" roughness={0.8} />
          </mesh>
          <mesh position={[0.85, 0.35, 0]} castShadow>
            <boxGeometry args={[0.12, 0.3, 0.8]} />
            <meshStandardMaterial color="#5A6A7C" roughness={0.8} />
          </mesh>
        </group>
        <group position={[cx, 0, cz - 0.3]}>
          <mesh position={[0, 0.4, 0]} castShadow>
            <boxGeometry args={[0.9, 0.04, 0.5]} />
            <meshStandardMaterial color="#8B6B4A" roughness={0.4} />
          </mesh>
          {[[-0.38, -0.18], [-0.38, 0.18], [0.38, -0.18], [0.38, 0.18]].map(([lx, lz], i) => (
            <mesh key={i} position={[lx, 0.19, lz]} castShadow>
              <boxGeometry args={[0.04, 0.38, 0.04]} />
              <meshStandardMaterial color="#6B5B4A" roughness={0.5} />
            </mesh>
          ))}
        </group>
      </group>
    )
  }

  // Bedroom
  if (name.includes('bedroom') || name.includes('master')) {
    return (
      <group>
        <group position={[cx, 0, cz]}>
          <mesh position={[0, 0.3, 0]} castShadow>
            <boxGeometry args={[1.6, 0.25, 2.0]} />
            <meshStandardMaterial color="#E8E0D8" roughness={0.9} />
          </mesh>
          <mesh position={[0, 0.1, 0]} castShadow>
            <boxGeometry args={[1.7, 0.2, 2.1]} />
            <meshStandardMaterial color="#8B6B4A" roughness={0.6} />
          </mesh>
          <mesh position={[0, 0.6, -1.0]} castShadow>
            <boxGeometry args={[1.7, 0.8, 0.08]} />
            <meshStandardMaterial color="#6B5040" roughness={0.5} />
          </mesh>
          <mesh position={[-0.35, 0.48, -0.7]} castShadow>
            <boxGeometry args={[0.5, 0.1, 0.35]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.9} />
          </mesh>
          <mesh position={[0.35, 0.48, -0.7]} castShadow>
            <boxGeometry args={[0.5, 0.1, 0.35]} />
            <meshStandardMaterial color="#FFFFFF" roughness={0.9} />
          </mesh>
        </group>
        <mesh position={[cx + 1.05, 0.25, cz - 0.6]} castShadow>
          <boxGeometry args={[0.45, 0.5, 0.4]} />
          <meshStandardMaterial color="#8B6B4A" roughness={0.5} />
        </mesh>
      </group>
    )
  }

  // Dining room
  if (name.includes('dining')) {
    return (
      <group>
        <mesh position={[cx, 0.38, cz]} castShadow>
          <boxGeometry args={[1.4, 0.05, 0.9]} />
          <meshStandardMaterial color="#8B6B4A" roughness={0.4} />
        </mesh>
        {[[-0.6, -0.35], [-0.6, 0.35], [0.6, -0.35], [0.6, 0.35]].map(([lx, lz], i) => (
          <mesh key={i} position={[cx + lx, 0.18, cz + lz]} castShadow>
            <boxGeometry args={[0.05, 0.36, 0.05]} />
            <meshStandardMaterial color="#6B5B4A" roughness={0.5} />
          </mesh>
        ))}
        {[[-0.5, -0.65], [0, -0.65], [0.5, -0.65], [-0.5, 0.65], [0, 0.65], [0.5, 0.65]].map(([ox, oz], i) => (
          <group key={i} position={[cx + ox, 0, cz + oz]}>
            <mesh position={[0, 0.22, 0]} castShadow>
              <boxGeometry args={[0.4, 0.04, 0.4]} />
              <meshStandardMaterial color="#A09080" roughness={0.6} />
            </mesh>
            <mesh position={[0, 0.5, oz > 0 ? -0.18 : 0.18]} castShadow>
              <boxGeometry args={[0.38, 0.5, 0.04]} />
              <meshStandardMaterial color="#A09080" roughness={0.6} />
            </mesh>
          </group>
        ))}
      </group>
    )
  }

  return null
}
