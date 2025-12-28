// src/components/FloorPlanPreview3D.jsx

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera } from '@react-three/drei';
import { useMemo } from 'react';

export default function FloorPlanPreview3D({ walls, rooms }) {
  // Calculate bounds for camera positioning
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const wall of walls) {
      minX = Math.min(minX, wall.start.x, wall.end.x);
      maxX = Math.max(maxX, wall.start.x, wall.end.x);
      minZ = Math.min(minZ, wall.start.z, wall.end.z);
      maxZ = Math.max(maxZ, wall.start.z, wall.end.z);
    }

    // Handle empty walls
    if (!isFinite(minX)) {
      minX = -10;
      maxX = 10;
      minZ = -10;
      maxZ = 10;
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const size = Math.max(maxX - minX, maxZ - minZ, 10);

    return { centerX, centerZ, size };
  }, [walls]);

  return (
    <Canvas shadows>
      <PerspectiveCamera
        makeDefault
        position={[
          bounds.centerX + bounds.size * 0.8,
          bounds.size * 0.6,
          bounds.centerZ + bounds.size * 0.8
        ]}
        fov={50}
      />

      <ambientLight intensity={0.4} />
      <directionalLight
        position={[bounds.centerX + 20, 30, bounds.centerZ + 20]}
        intensity={0.8}
        castShadow
      />

      {/* Ground */}
      <mesh
        rotation={[-Math.PI / 2, 0, 0]}
        position={[bounds.centerX, -0.01, bounds.centerZ]}
        receiveShadow
      >
        <planeGeometry args={[bounds.size * 2, bounds.size * 2]} />
        <meshStandardMaterial color="#1a1a2e" />
      </mesh>

      {/* Grid */}
      <gridHelper
        args={[bounds.size * 2, Math.ceil(bounds.size * 2), '#333', '#222']}
        position={[bounds.centerX, 0, bounds.centerZ]}
      />

      {/* Walls */}
      {walls.map((wall, index) => (
        <PreviewWall key={index} wall={wall} />
      ))}

      {/* Room Labels */}
      {rooms.map((room, index) => (
        <RoomLabel key={index} room={room} />
      ))}

      <OrbitControls
        target={[bounds.centerX, 1, bounds.centerZ]}
        minDistance={5}
        maxDistance={bounds.size * 3}
      />
    </Canvas>
  );
}

function PreviewWall({ wall }) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const length = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const midX = (wall.start.x + wall.end.x) / 2;
  const midZ = (wall.start.z + wall.end.z) / 2;

  // Wall color based on type
  const color = wall.isExterior ? '#4a5568' : '#718096';

  return (
    <mesh
      position={[midX, wall.height / 2, midZ]}
      rotation={[0, angle, 0]}
      castShadow
      receiveShadow
    >
      <boxGeometry args={[wall.thickness || 0.15, wall.height || 2.7, length]} />
      <meshStandardMaterial color={color} />
    </mesh>
  );
}

function RoomLabel({ room }) {
  return (
    <group position={[room.center.x, 0.05, room.center.z]}>
      {/* Room floor indicator */}
      <mesh rotation={[-Math.PI / 2, 0, 0]}>
        <circleGeometry args={[1.5, 32]} />
        <meshBasicMaterial color="#14B8A6" opacity={0.2} transparent />
      </mesh>

      {/* Room name */}
      <Text
        position={[0, 0.1, 0]}
        rotation={[-Math.PI / 2, 0, 0]}
        fontSize={0.5}
        color="#14B8A6"
        anchorX="center"
        anchorY="middle"
      >
        {room.name}
      </Text>
    </group>
  );
}
