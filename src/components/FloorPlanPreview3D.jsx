// src/components/FloorPlanPreview3D.jsx

import { Canvas } from '@react-three/fiber';
import { OrbitControls, Text, PerspectiveCamera, OrthographicCamera } from '@react-three/drei';
import { useMemo, useState } from 'react';

export default function FloorPlanPreview3D({ walls, rooms }) {
  const [isTopDown, setIsTopDown] = useState(false);
  const bounds = useMemo(() => {
    let minX = Infinity, maxX = -Infinity;
    let minZ = Infinity, maxZ = -Infinity;

    for (const wall of walls) {
      minX = Math.min(minX, wall.start.x, wall.end.x);
      maxX = Math.max(maxX, wall.start.x, wall.end.x);
      minZ = Math.min(minZ, wall.start.z, wall.end.z);
      maxZ = Math.max(maxZ, wall.start.z, wall.end.z);
    }

    if (!isFinite(minX)) {
      minX = -10; maxX = 10; minZ = -10; maxZ = 10;
    }

    const centerX = (minX + maxX) / 2;
    const centerZ = (minZ + maxZ) / 2;
    const size = Math.max(maxX - minX, maxZ - minZ, 10);

    return { centerX, centerZ, size, minX, maxX, minZ, maxZ };
  }, [walls]);

  const orthoZoom = 60 / (bounds.size * 0.35);

  return (
    <div className="relative w-full h-full">
      <button
        onClick={() => setIsTopDown(!isTopDown)}
        className="absolute top-2 right-2 z-10 px-3 py-1.5 bg-[var(--color-bg-elevated)] hover:bg-[var(--color-border)] rounded-lg text-xs text-white border border-[var(--color-border)] transition-colors"
      >
        {isTopDown ? '3D View' : 'Top-Down'}
      </button>

      <Canvas shadows className="w-full h-full">
        {isTopDown ? (
          <OrthographicCamera
            makeDefault
            position={[bounds.centerX, 50, bounds.centerZ]}
            zoom={orthoZoom}
            near={0.1}
            far={200}
            up={[0, 0, -1]}
          />
        ) : (
          <PerspectiveCamera
            makeDefault
            position={[
              bounds.centerX + bounds.size * 0.8,
              bounds.size * 0.6,
              bounds.centerZ + bounds.size * 0.8
            ]}
            fov={50}
          />
        )}

        <ambientLight intensity={0.5} />
        <directionalLight
          position={[bounds.centerX + 20, 30, bounds.centerZ + 20]}
          intensity={0.8}
          castShadow
        />
        <directionalLight
          position={[bounds.centerX - 15, 20, bounds.centerZ - 15]}
          intensity={0.3}
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

        <gridHelper
          args={[bounds.size * 2, Math.ceil(bounds.size * 2), '#333', '#222']}
          position={[bounds.centerX, 0, bounds.centerZ]}
        />

        {/* Walls with openings */}
        {walls.map((wall, i) => (
          <PreviewWall key={i} wall={wall} />
        ))}

        {/* Room labels */}
        {rooms.map((room, i) => (
          <RoomLabel key={`label-${i}`} room={room} isTopDown={isTopDown} />
        ))}

        <OrbitControls
          target={[bounds.centerX, 0, bounds.centerZ]}
          minDistance={5}
          maxDistance={bounds.size * 3}
          enableRotate={!isTopDown}
          enablePan={true}
          minPolarAngle={0}
          maxPolarAngle={Math.PI / 2}
          up={isTopDown ? [0, 0, -1] : [0, 1, 0]}
          mouseButtons={{
            LEFT: isTopDown ? null : 0,
            MIDDLE: 2,
            RIGHT: 1
          }}
        />
      </Canvas>
    </div>
  );
}

// ─── Wall with Openings ────────────────────────────────────────────────────────

function PreviewWall({ wall }) {
  const dx = wall.end.x - wall.start.x;
  const dz = wall.end.z - wall.start.z;
  const wallLength = Math.sqrt(dx * dx + dz * dz);
  const angle = Math.atan2(dx, dz);
  const height = wall.height || 2.7;
  const thickness = wall.thickness || 0.15;
  const openings = wall.openings || [];

  const dirX = wallLength > 0 ? dx / wallLength : 0;
  const dirZ = wallLength > 0 ? dz / wallLength : 0;

  // Exterior: slightly darker with more texture; Interior: lighter, smoother
  const exteriorColor = '#D8D4CC';
  const interiorColor = '#F0EDE6';
  const color = wall.isExterior ? exteriorColor : interiorColor;
  const roughness = wall.isExterior ? 0.8 : 0.6;

  const segments = useMemo(() => {
    if (openings.length === 0) {
      return [{ startDist: 0, endDist: wallLength, bottomY: 0, topY: height }];
    }

    const sorted = [...openings].sort((a, b) => a.position - b.position);
    const segs = [];
    let currentDist = 0;

    for (const opening of sorted) {
      const openingStart = opening.position - opening.width / 2;
      const openingEnd = opening.position + opening.width / 2;

      if (openingStart > currentDist) {
        segs.push({ startDist: currentDist, endDist: openingStart, bottomY: 0, topY: height });
      }

      if (opening.type === 'window') {
        const sillHeight = opening.sillHeight || 0.9;
        const windowTop = sillHeight + (opening.height || 1.2);
        if (sillHeight > 0) {
          segs.push({ startDist: openingStart, endDist: openingEnd, bottomY: 0, topY: sillHeight });
        }
        if (windowTop < height) {
          segs.push({ startDist: openingStart, endDist: openingEnd, bottomY: windowTop, topY: height });
        }
      }

      if (opening.type === 'door') {
        const doorHeight = opening.height || 2.1;
        if (doorHeight < height) {
          segs.push({ startDist: openingStart, endDist: openingEnd, bottomY: doorHeight, topY: height });
        }
      }

      currentDist = openingEnd;
    }

    if (currentDist < wallLength) {
      segs.push({ startDist: currentDist, endDist: wallLength, bottomY: 0, topY: height });
    }

    return segs;
  }, [openings, wallLength, height]);

  const getWorldPos = (dist) => ({
    x: wall.start.x + dirX * dist,
    z: wall.start.z + dirZ * dist,
  });

  return (
    <group>
      {/* Solid wall segments */}
      {segments.map((seg, i) => {
        const segLength = seg.endDist - seg.startDist;
        const segHeight = seg.topY - seg.bottomY;
        if (segLength < 0.01 || segHeight < 0.01) return null;

        const segMid = (seg.startDist + seg.endDist) / 2;
        const pos = getWorldPos(segMid);

        return (
          <mesh
            key={`seg-${i}`}
            position={[pos.x, seg.bottomY + segHeight / 2, pos.z]}
            rotation={[0, angle, 0]}
            castShadow
            receiveShadow
          >
            <boxGeometry args={[thickness, segHeight, segLength]} />
            <meshStandardMaterial color={color} roughness={roughness} />
          </mesh>
        );
      })}

      {/* Door frames */}
      {openings.filter(o => o.type === 'door').map((opening, i) => {
        const pos = getWorldPos(opening.position);
        const frameThickness = 0.04;
        const frameDepth = thickness + 0.02;
        const doorHeight = opening.height || 2.1;
        const doorWidth = opening.width || 0.9;
        const dType = opening.doorType || 'single';
        const isDouble = dType === 'double';
        const isSliding = dType === 'sliding';
        const frameColor = isSliding ? '#707070' : '#8B6B4A';

        return (
          <group key={`door-${i}`} position={[pos.x, 0, pos.z]} rotation={[0, angle, 0]}>
            <mesh position={[0, doorHeight / 2, -doorWidth / 2 - frameThickness / 2]} castShadow>
              <boxGeometry args={[frameDepth, doorHeight, frameThickness]} />
              <meshStandardMaterial color={frameColor} roughness={0.6} />
            </mesh>
            <mesh position={[0, doorHeight / 2, doorWidth / 2 + frameThickness / 2]} castShadow>
              <boxGeometry args={[frameDepth, doorHeight, frameThickness]} />
              <meshStandardMaterial color={frameColor} roughness={0.6} />
            </mesh>
            <mesh position={[0, doorHeight + frameThickness / 2, 0]} castShadow>
              <boxGeometry args={[frameDepth, frameThickness, doorWidth + frameThickness * 2]} />
              <meshStandardMaterial color={frameColor} roughness={0.6} />
            </mesh>
            {isDouble && (
              <mesh position={[0, doorHeight / 2, 0]} castShadow>
                <boxGeometry args={[frameDepth, doorHeight, frameThickness]} />
                <meshStandardMaterial color={frameColor} roughness={0.6} />
              </mesh>
            )}
            {isSliding && (
              <>
                <mesh position={[0.01, doorHeight / 2, -doorWidth / 4]} rotation={[0, Math.PI / 2, 0]} renderOrder={2}>
                  <planeGeometry args={[doorWidth / 2 - 0.06, doorHeight - 0.1]} />
                  <meshStandardMaterial color="#A8D8EA" transparent opacity={0.3} side={2} depthWrite={false} />
                </mesh>
                <mesh position={[-0.01, doorHeight / 2, doorWidth / 4]} rotation={[0, Math.PI / 2, 0]} renderOrder={2}>
                  <planeGeometry args={[doorWidth / 2 - 0.06, doorHeight - 0.1]} />
                  <meshStandardMaterial color="#A8D8EA" transparent opacity={0.3} side={2} depthWrite={false} />
                </mesh>
              </>
            )}
          </group>
        );
      })}

      {/* Window frames + glass */}
      {openings.filter(o => o.type === 'window').map((opening, i) => {
        const pos = getWorldPos(opening.position);
        const winHeight = opening.height || 1.2;
        const winWidth = opening.width || 1.2;
        const sillHt = opening.sillHeight || 0.9;
        const windowCenterY = sillHt + winHeight / 2;
        const frameThick = 0.04;
        const frameDepth = 0.06;

        return (
          <group key={`win-${i}`} position={[pos.x, windowCenterY, pos.z]} rotation={[0, angle, 0]}>
            <mesh rotation={[0, Math.PI / 2, 0]} renderOrder={2}>
              <planeGeometry args={[winWidth - frameThick * 2, winHeight - frameThick * 2]} />
              <meshStandardMaterial color="#88CCEE" transparent opacity={0.2} side={2} roughness={0} metalness={0.1} depthWrite={false} />
            </mesh>
            <mesh position={[0, winHeight / 2 - frameThick / 2, 0]}>
              <boxGeometry args={[frameDepth, frameThick, winWidth]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[0, -winHeight / 2 + frameThick / 2, 0]}>
              <boxGeometry args={[frameDepth, frameThick, winWidth]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[0, 0, -winWidth / 2 + frameThick / 2]}>
              <boxGeometry args={[frameDepth, winHeight, frameThick]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh position={[0, 0, winWidth / 2 - frameThick / 2]}>
              <boxGeometry args={[frameDepth, winHeight, frameThick]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh>
              <boxGeometry args={[frameDepth / 2, frameThick / 2, winWidth - frameThick * 2]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
            <mesh>
              <boxGeometry args={[frameDepth / 2, winHeight - frameThick * 2, frameThick / 2]} />
              <meshStandardMaterial color="#FFFFFF" />
            </mesh>
          </group>
        );
      })}
    </group>
  );
}

// ─── Room Label ────────────────────────────────────────────────────────────────

function RoomLabel({ room, isTopDown }) {
  const areaText = room.area > 0 ? `${room.area.toFixed(1)} m²` : '';

  if (isTopDown) {
    return (
      <group position={[room.center.x, 0.02, room.center.z]}>
        <Text
          rotation={[-Math.PI / 2, 0, 0]}
          fontSize={0.3}
          color="#14B8A6"
          anchorX="center"
          anchorY="middle"
          maxWidth={3}
        >
          {room.name}
        </Text>
        {areaText && (
          <Text
            rotation={[-Math.PI / 2, 0, 0]}
            position={[0, 0, 0.4]}
            fontSize={0.2}
            color="#64748B"
            anchorX="center"
            anchorY="middle"
          >
            {areaText}
          </Text>
        )}
      </group>
    );
  }

  return (
    <group position={[room.center.x, 0.5, room.center.z]}>
      <Text
        fontSize={0.25}
        color="#FFFFFF"
        anchorX="center"
        anchorY="middle"
        outlineWidth={0.03}
        outlineColor="#000000"
      >
        {room.name}
      </Text>
      {areaText && (
        <Text
          position={[0, -0.3, 0]}
          fontSize={0.18}
          color="#94A3B8"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.02}
          outlineColor="#000000"
        >
          {areaText}
        </Text>
      )}
    </group>
  );
}
