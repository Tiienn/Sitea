import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { formatDimension, FEET_PER_METER } from '../../constants/landSceneConstants'
import { getDragThreshold } from '../../utils/pointerUtils'

function createCanvasTexture(canvas) {
  const texture = new THREE.CanvasTexture(canvas)
  texture.colorSpace = THREE.SRGBColorSpace
  texture.anisotropy = 4
  texture.needsUpdate = true
  return texture
}

function drawCanvasSpeckles(ctx, width, height, count, color, size = 1) {
  ctx.fillStyle = color
  for (let i = 0; i < count; i++) {
    const x = (i * 73) % width
    const y = (i * 131) % height
    ctx.fillRect(x, y, size, size)
  }
}

function SurfaceLine({ x = 0, z = 0, width, depth, y = 0.085, color = '#ffffff' }) {
  return (
    <mesh position={[x, y, z]}>
      <boxGeometry args={[width, 0.024, depth]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

function SurfaceRect({ x = 0, z = 0, width, length, lineWidth, y = 0.085, color = '#ffffff' }) {
  return (
    <group position={[x, 0, z]}>
      <SurfaceLine width={width} depth={lineWidth} y={y} z={length / 2} color={color} />
      <SurfaceLine width={width} depth={lineWidth} y={y} z={-length / 2} color={color} />
      <SurfaceLine width={lineWidth} depth={length} y={y} x={width / 2} color={color} />
      <SurfaceLine width={lineWidth} depth={length} y={y} x={-width / 2} color={color} />
    </group>
  )
}

function SurfaceCircle({ x = 0, z = 0, radius, lineWidth, y = 0.09, color = '#ffffff', arc = Math.PI * 2, rotationZ = 0 }) {
  return (
    <mesh position={[x, y, z]} rotation={[Math.PI / 2, 0, rotationZ]}>
      <torusGeometry args={[radius, lineWidth / 2, 8, 96, arc]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

function SurfaceSpot({ x = 0, z = 0, radius = 0.22, y = 0.1, color = '#ffffff' }) {
  return (
    <mesh position={[x, y, z]}>
      <cylinderGeometry args={[radius, radius, 0.026, 24]} />
      <meshBasicMaterial color={color} toneMapped={false} />
    </mesh>
  )
}

// Create textures for comparison objects
function useSoccerFieldTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Turf base with alternating mow stripes
    ctx.fillStyle = '#0f6f3d'
    ctx.fillRect(0, 0, w, h)
    for (let i = 0; i < 14; i++) {
      ctx.fillStyle = i % 2 === 0 ? 'rgba(255,255,255,0.045)' : 'rgba(0,0,0,0.045)'
      ctx.fillRect(0, i * h / 14, w, h / 14)
    }
    drawCanvasSpeckles(ctx, w, h, 700, 'rgba(255,255,255,0.045)')
    drawCanvasSpeckles(ctx, w, h, 700, 'rgba(0,0,0,0.055)', 2)

    return createCanvasTexture(canvas)
  }, [width, length])
}

function useBasketballCourtTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Varnished hardwood base
    ctx.fillStyle = '#c89c5d'
    ctx.fillRect(0, 0, w, h)

    // Wood planks and grain
    for (let x = 0; x < w; x += 18) {
      ctx.fillStyle = x % 36 === 0 ? 'rgba(255,255,255,0.04)' : 'rgba(87,49,22,0.045)'
      ctx.fillRect(x, 0, 18, h)
      ctx.strokeStyle = 'rgba(87,49,22,0.16)'
      ctx.lineWidth = 1
      ctx.beginPath()
      ctx.moveTo(x, 0)
      ctx.lineTo(x, h)
      ctx.stroke()
    }
    for (let i = 0; i < 70; i++) {
      const y = (i * 37) % h
      ctx.strokeStyle = 'rgba(87,49,22,0.11)'
      ctx.beginPath()
      ctx.moveTo((i * 61) % w, y)
      ctx.lineTo(((i * 61) % w) + 40, y + 4)
      ctx.stroke()
    }

    return createCanvasTexture(canvas)
  }, [width, length])
}

function useTennisCourtTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Two-tone hard court
    ctx.fillStyle = '#1d4ed8'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#2563eb'
    ctx.fillRect(34, 34, w - 68, h - 68)
    ctx.fillStyle = 'rgba(20, 83, 45, 0.28)'
    ctx.fillRect(0, 0, w, 34)
    ctx.fillRect(0, h - 34, w, 34)
    ctx.fillRect(0, 0, 34, h)
    ctx.fillRect(w - 34, 0, 34, h)
    drawCanvasSpeckles(ctx, w, h, 420, 'rgba(255,255,255,0.035)')

    return createCanvasTexture(canvas)
  }, [width, length])
}

function useHouseTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Foundation gray
    ctx.fillStyle = '#9ca3af'
    ctx.fillRect(0, 0, w, h)

    // Slight texture
    ctx.fillStyle = 'rgba(0,0,0,0.05)'
    for (let i = 0; i < 100; i++) {
      ctx.fillRect(Math.random() * w, Math.random() * h, 3, 3)
    }

    // Roof indication (darker center)
    const gradient = ctx.createRadialGradient(w/2, h/2, 0, w/2, h/2, w/2)
    gradient.addColorStop(0, 'rgba(107, 114, 128, 0.4)')
    gradient.addColorStop(1, 'rgba(107, 114, 128, 0)')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    // Border
    ctx.strokeStyle = '#6b7280'
    ctx.lineWidth = 8
    ctx.strokeRect(4, 4, w - 8, h - 8)

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

function useParkingTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 256
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Asphalt gray
    ctx.fillStyle = '#343a40'
    ctx.fillRect(0, 0, w, h)

    // Asphalt texture
    for (let i = 0; i < 450; i++) {
      const shade = (i % 17) - 8
      const x = (i * 47) % w
      const y = (i * 83) % h
      ctx.fillStyle = `rgb(${52 + shade}, ${58 + shade}, ${64 + shade})`
      ctx.fillRect(x, y, i % 3 === 0 ? 2 : 1, i % 4 === 0 ? 2 : 1)
    }

    // White border lines
    ctx.strokeStyle = '#f8fafc'
    ctx.lineWidth = 8
    ctx.beginPath()
    ctx.moveTo(16, 12)
    ctx.lineTo(16, h - 12)
    ctx.moveTo(w - 16, 12)
    ctx.lineTo(w - 16, h - 12)
    ctx.stroke()

    // Front curb and wheel-stop marks
    ctx.strokeStyle = '#facc15'
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(28, 36)
    ctx.lineTo(w - 28, 36)
    ctx.stroke()
    ctx.fillStyle = 'rgba(248,250,252,0.28)'
    ctx.fillRect(42, h * 0.62, w - 84, 14)

    // Parking symbol (P)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.26)'
    ctx.font = 'bold 80px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('P', w / 2, h / 2)

    return createCanvasTexture(canvas)
  }, [width, length])
}

// Soccer Field with goal posts
function SoccerField3D({ obj }) {
  const texture = useSoccerFieldTexture(obj.width, obj.length)
  const goalWidth = 7.32, goalHeight = 2.44, goalDepth = 2
  const lineWidth = 0.22
  const penaltyWidth = Math.min(40.3, obj.width * 0.62)
  const penaltyDepth = Math.min(16.5, obj.length * 0.18)
  const goalAreaWidth = Math.min(18.32, obj.width * 0.32)
  const goalAreaDepth = Math.min(5.5, obj.length * 0.07)
  const centerCircleRadius = Math.min(9.15, obj.width * 0.14)
  const penaltySpotOffset = Math.min(11, obj.length * 0.12)

  return (
    <group>
      <mesh position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[obj.width + 0.6, 0.04, obj.length + 0.6]} />
        <meshStandardMaterial color="#0c5f36" roughness={0.88} />
      </mesh>

      {/* Field surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} roughness={0.78} />
      </mesh>

      {/* Raised pitch markings stay visible even when the texture is filtered from distance */}
      <SurfaceRect width={obj.width} length={obj.length} lineWidth={lineWidth} y={0.085} />
      <SurfaceLine width={obj.width} depth={lineWidth} y={0.088} />
      <SurfaceCircle radius={centerCircleRadius} lineWidth={lineWidth} y={0.092} />
      <SurfaceSpot radius={0.28} y={0.105} />
      {[-1, 1].map((side) => (
        <group key={`pitch-markings-${side}`}>
          <SurfaceRect
            width={penaltyWidth}
            length={penaltyDepth}
            lineWidth={lineWidth}
            y={0.09}
            z={side * (obj.length / 2 - penaltyDepth / 2)}
          />
          <SurfaceRect
            width={goalAreaWidth}
            length={goalAreaDepth}
            lineWidth={lineWidth}
            y={0.095}
            z={side * (obj.length / 2 - goalAreaDepth / 2)}
          />
          <SurfaceSpot z={side * (obj.length / 2 - penaltySpotOffset)} radius={0.24} y={0.11} />
        </group>
      ))}

      {/* Subtle turf edge trim */}
      <mesh position={[0, 0.06, obj.length / 2 + 0.1]}>
        <boxGeometry args={[obj.width + 0.35, 0.08, 0.2]} />
        <meshStandardMaterial color="#0a4d2d" roughness={0.7} />
      </mesh>
      <mesh position={[0, 0.06, -obj.length / 2 - 0.1]}>
        <boxGeometry args={[obj.width + 0.35, 0.08, 0.2]} />
        <meshStandardMaterial color="#0a4d2d" roughness={0.7} />
      </mesh>
      <mesh position={[obj.width / 2 + 0.1, 0.06, 0]}>
        <boxGeometry args={[0.2, 0.08, obj.length]} />
        <meshStandardMaterial color="#0a4d2d" roughness={0.7} />
      </mesh>
      <mesh position={[-obj.width / 2 - 0.1, 0.06, 0]}>
        <boxGeometry args={[0.2, 0.08, obj.length]} />
        <meshStandardMaterial color="#0a4d2d" roughness={0.7} />
      </mesh>

      {/* Goal posts - both ends */}
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, side * (obj.length / 2)]}>
          {/* Left post */}
          <mesh position={[-goalWidth / 2, goalHeight / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, goalHeight, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Right post */}
          <mesh position={[goalWidth / 2, goalHeight / 2, 0]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, goalHeight, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Crossbar */}
          <mesh position={[0, goalHeight, 0]} rotation={[0, 0, Math.PI / 2]} castShadow>
            <cylinderGeometry args={[0.06, 0.06, goalWidth, 8]} />
            <meshStandardMaterial color="#ffffff" />
          </mesh>
          {/* Net (simple back frame) */}
          <mesh position={[0, goalHeight / 2, side * goalDepth / 2]}>
            <boxGeometry args={[goalWidth, goalHeight, 0.05]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.24} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[-goalWidth / 2, goalHeight / 2, side * goalDepth / 2]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.04, goalHeight, goalDepth]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.18} side={THREE.DoubleSide} />
          </mesh>
          <mesh position={[goalWidth / 2, goalHeight / 2, side * goalDepth / 2]} rotation={[0, 0, 0]}>
            <boxGeometry args={[0.04, goalHeight, goalDepth]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.18} side={THREE.DoubleSide} />
          </mesh>
          {[-1, 1].map((sx) => (
            <mesh key={`flag-${sx}`} position={[sx * (obj.width / 2 + 0.28), 0.75, -side * 0.28]} castShadow>
              <cylinderGeometry args={[0.03, 0.03, 1.5, 8]} />
              <meshStandardMaterial color="#facc15" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// Basketball Court with hoops
function BasketballCourt3D({ obj }) {
  const texture = useBasketballCourtTexture(obj.width, obj.length)
  const poleHeight = 3, rimHeight = 3.05, backboardWidth = 1.8, backboardHeight = 1.05
  const lineWidth = 0.09
  const keyWidth = Math.min(4.9, obj.width * 0.38)
  const keyDepth = Math.min(5.8, obj.length * 0.23)
  const circleRadius = Math.min(1.8, obj.width * 0.14)
  const threePointRadius = Math.min(6.75, obj.width / 2 - 0.35)
  const basketOffset = Math.min(1.575, obj.length * 0.06)

  return (
    <group>
      <mesh position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[obj.width + 0.35, 0.05, obj.length + 0.35]} />
        <meshStandardMaterial color="#8a5a2b" roughness={0.65} />
      </mesh>

      {/* Court surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} roughness={0.44} metalness={0.02} />
      </mesh>

      {/* Raised court markings */}
      <SurfaceRect width={obj.width} length={obj.length} lineWidth={lineWidth} y={0.085} />
      <SurfaceLine width={obj.width} depth={lineWidth} y={0.088} />
      <SurfaceCircle radius={circleRadius} lineWidth={lineWidth} y={0.092} />
      {[-1, 1].map((side) => {
        const keyZ = side * (obj.length / 2 - keyDepth / 2)
        const basketZ = side * (obj.length / 2 - basketOffset)
        const freeThrowZ = side * (obj.length / 2 - keyDepth)

        return (
          <group key={`basketball-markings-${side}`}>
            <SurfaceRect width={keyWidth} length={keyDepth} lineWidth={lineWidth} y={0.092} z={keyZ} />
            <SurfaceCircle radius={circleRadius} lineWidth={lineWidth} y={0.096} z={freeThrowZ} />
            <SurfaceCircle
              radius={threePointRadius}
              lineWidth={lineWidth}
              y={0.098}
              z={basketZ}
              arc={Math.PI}
              rotationZ={side > 0 ? Math.PI : 0}
            />
            <SurfaceLine
              x={-threePointRadius}
              z={side * (obj.length / 2 - keyDepth / 2)}
              width={lineWidth}
              depth={keyDepth}
              y={0.1}
            />
            <SurfaceLine
              x={threePointRadius}
              z={side * (obj.length / 2 - keyDepth / 2)}
              width={lineWidth}
              depth={keyDepth}
              y={0.1}
            />
          </group>
        )
      })}

      {/* Hoops at each end */}
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, side * (obj.length / 2 - 1.2)]}>
          {/* Pole */}
          <mesh position={[0, poleHeight / 2, side * 0.5]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, poleHeight, 8]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          {/* Support arm */}
          <mesh position={[0, rimHeight + 0.1, side * 0.24]} castShadow>
            <boxGeometry args={[0.16, 0.16, 0.68]} />
            <meshStandardMaterial color="#333333" roughness={0.52} />
          </mesh>
          {/* Backboard */}
          <mesh position={[0, rimHeight + backboardHeight / 2 - 0.15, 0]} castShadow>
            <boxGeometry args={[backboardWidth, backboardHeight, 0.05]} />
            <meshStandardMaterial color="#e0f2fe" transparent opacity={0.68} roughness={0.18} />
          </mesh>
          {/* Backboard frame */}
          <mesh position={[0, rimHeight + backboardHeight / 2 - 0.15, -side * 0.03]}>
            <boxGeometry args={[backboardWidth + 0.1, backboardHeight + 0.1, 0.02]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          {/* Shooter square */}
          <mesh position={[0, rimHeight + 0.18, side * 0.04]}>
            <boxGeometry args={[0.62, 0.42, 0.025]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.3} />
          </mesh>
          {/* Rim */}
          <mesh position={[0, rimHeight, side * 0.25]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.23, 0.02, 8, 24]} />
            <meshStandardMaterial color="#ff6600" />
          </mesh>
          {/* Simple net */}
          <mesh position={[0, rimHeight - 0.18, side * 0.25]}>
            <cylinderGeometry args={[0.2, 0.14, 0.36, 12, 1, true]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.42} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Tennis Court with net
function TennisCourt3D({ obj }) {
  const texture = useTennisCourtTexture(obj.width, obj.length)
  const lineWidth = 0.07
  const singlesWidth = Math.min(8.23, obj.width - lineWidth * 4)
  const serviceDepth = Math.min(6.4, obj.length * 0.28)

  return (
    <group>
      <mesh position={[0, 0.005, 0]} receiveShadow>
        <boxGeometry args={[obj.width + 0.35, 0.04, obj.length + 0.35]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.72} />
      </mesh>

      {/* Court surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} roughness={0.62} />
      </mesh>

      {/* Raised tennis markings */}
      <SurfaceRect width={obj.width} length={obj.length} lineWidth={lineWidth} y={0.085} />
      <SurfaceLine x={-singlesWidth / 2} width={lineWidth} depth={obj.length} y={0.09} />
      <SurfaceLine x={singlesWidth / 2} width={lineWidth} depth={obj.length} y={0.09} />
      <SurfaceLine width={singlesWidth} depth={lineWidth} z={-serviceDepth} y={0.092} />
      <SurfaceLine width={singlesWidth} depth={lineWidth} z={serviceDepth} y={0.092} />
      <SurfaceLine width={lineWidth} depth={serviceDepth * 2} y={0.095} />
      {[-1, 1].map((side) => (
        <SurfaceLine
          key={`center-mark-${side}`}
          width={lineWidth}
          depth={0.72}
          z={side * (obj.length / 2 - 0.36)}
          y={0.098}
        />
      ))}

      {/* Net posts */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (obj.width / 2 + 0.2), 0.535, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, 1.07, 8]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}

      {/* Net */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[obj.width, 0.91, 0.02]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.34} side={THREE.DoubleSide} />
      </mesh>
      <mesh position={[0, 0.96, 0]}>
        <boxGeometry args={[obj.width + 0.2, 0.06, 0.04]} />
        <meshStandardMaterial color="#f8fafc" roughness={0.35} />
      </mesh>
      {[-0.36, -0.24, -0.12, 0, 0.12, 0.24, 0.36].map((xRatio) => (
        <mesh key={xRatio} position={[obj.width * xRatio, 0.5, 0.018]}>
          <boxGeometry args={[0.015, 0.78, 0.015]} />
          <meshStandardMaterial color="#f8fafc" transparent opacity={0.38} />
        </mesh>
      ))}
      <mesh position={[0, 0.04, obj.length / 2 + 0.12]}>
        <boxGeometry args={[obj.width + 0.2, 0.08, 0.24]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.6} />
      </mesh>
      <mesh position={[0, 0.04, -obj.length / 2 - 0.12]}>
        <boxGeometry args={[obj.width + 0.2, 0.08, 0.24]} />
        <meshStandardMaterial color="#1e3a8a" roughness={0.6} />
      </mesh>
    </group>
  )
}

// Boxing Ring texture
function useBoxingRingTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Blue apron
    ctx.fillStyle = '#1A3A6A'
    ctx.fillRect(0, 0, w, h)

    // Canvas (ring floor)
    const pad = 40
    ctx.fillStyle = '#E8E0D0'
    ctx.fillRect(pad, pad, w - pad * 2, h - pad * 2)

    // Corner pads
    const cp = 50
    ctx.fillStyle = '#C0392B' // Red corner
    ctx.fillRect(pad, pad, cp, cp)
    ctx.fillStyle = '#2980B9' // Blue corner
    ctx.fillRect(w - pad - cp, pad, cp, cp)
    ctx.fillStyle = '#ECF0F1' // White neutral
    ctx.fillRect(pad, h - pad - cp, cp, cp)
    ctx.fillStyle = '#ECF0F1'
    ctx.fillRect(w - pad - cp, h - pad - cp, cp, cp)

    // Ropes (3 lines)
    ctx.strokeStyle = '#C8B898'
    for (let i = 0; i < 3; i++) {
      ctx.lineWidth = 3 - i
      const offset = pad - 5 - i * 6
      ctx.strokeRect(offset, offset, w - offset * 2, h - offset * 2)
    }

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

// Boxing Ring 3D
function BoxingRing3D({ obj }) {
  const texture = useBoxingRingTexture(obj.width, obj.length)
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.53, 0]}>
        <planeGeometry args={[obj.width + 1.2, obj.length + 1.2]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      {/* Raised platform */}
      <mesh position={[0, 0.25, 0]}>
        <boxGeometry args={[obj.width + 1.2, 0.5, obj.length + 1.2]} />
        <meshStandardMaterial color="#1A3A6A" />
      </mesh>
      {/* Corner posts */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={`post-${i}`} position={[sx * obj.width / 2, 0.9, sz * obj.length / 2]}>
          <cylinderGeometry args={[0.04, 0.04, 0.8, 8]} />
          <meshStandardMaterial color="#888" metalness={0.6} />
        </mesh>
      ))}
      {/* Ropes - 3 levels per side */}
      {[0.7, 0.9, 1.1].map((y, ri) => (
        <group key={`rope-${ri}`}>
          {/* Front & back */}
          {[-1, 1].map(sz => (
            <mesh key={`fb-${sz}`} position={[0, y, sz * obj.length / 2]}>
              <boxGeometry args={[obj.width, 0.02, 0.02]} />
              <meshStandardMaterial color="#C8B898" />
            </mesh>
          ))}
          {/* Left & right */}
          {[-1, 1].map(sx => (
            <mesh key={`lr-${sx}`} position={[sx * obj.width / 2, y, 0]}>
              <boxGeometry args={[0.02, 0.02, obj.length]} />
              <meshStandardMaterial color="#C8B898" />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

// Volleyball Court texture
function useVolleyballCourtTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Court halves - two colors
    ctx.fillStyle = '#E67E22'
    ctx.fillRect(0, 0, w, h)
    ctx.fillStyle = '#D35400'
    ctx.fillRect(0, h / 2, w, h / 2)

    // White lines
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4

    // Boundary
    ctx.strokeRect(20, 20, w - 40, h - 40)

    // Center line
    ctx.lineWidth = 5
    ctx.beginPath()
    ctx.moveTo(20, h / 2)
    ctx.lineTo(w - 20, h / 2)
    ctx.stroke()

    // Attack lines (3m from center on each side = 1/3 of half)
    ctx.lineWidth = 3
    const attackOffset = (h - 40) / 6
    ctx.beginPath()
    ctx.moveTo(20, h / 2 - attackOffset)
    ctx.lineTo(w - 20, h / 2 - attackOffset)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(20, h / 2 + attackOffset)
    ctx.lineTo(w - 20, h / 2 + attackOffset)
    ctx.stroke()

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

// Volleyball Court 3D
function VolleyballCourt3D({ obj }) {
  const texture = useVolleyballCourtTexture(obj.width, obj.length)
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      {/* Net posts */}
      {[-1, 1].map(side => (
        <mesh key={side} position={[side * (obj.width / 2 + 0.3), 1.22, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 2.44, 8]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}
      {/* Net */}
      <mesh position={[0, 1.8, 0]}>
        <boxGeometry args={[obj.width, 1, 0.02]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.5} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// American Football Field texture
function useFootballFieldTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Green field
    ctx.fillStyle = '#2E7D32'
    ctx.fillRect(0, 0, w, h)

    // Grass stripes
    ctx.fillStyle = '#276E2A'
    const stripeH = h / 24
    for (let i = 0; i < 24; i += 2) {
      ctx.fillRect(0, i * stripeH, w, stripeH)
    }

    // End zones (10 yards each out of 120 total)
    const ezH = h * (10 / 120)
    ctx.fillStyle = '#1B5E20'
    ctx.fillRect(0, 0, w, ezH)
    ctx.fillRect(0, h - ezH, w, ezH)

    // White lines
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3

    // Yard lines every 5 yards (10 lines between end zones)
    const fieldH = h - ezH * 2
    for (let i = 0; i <= 20; i++) {
      const y = ezH + (i / 20) * fieldH
      ctx.lineWidth = i % 2 === 0 ? 3 : 1.5
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.lineTo(w, y)
      ctx.stroke()
    }

    // Yard numbers
    ctx.fillStyle = '#ffffff'
    ctx.font = 'bold 24px sans-serif'
    ctx.textAlign = 'center'
    const numbers = [10, 20, 30, 40, 50, 40, 30, 20, 10]
    numbers.forEach((num, i) => {
      const y = ezH + ((i + 1) / 10) * fieldH * 0.5 * 2
      ctx.fillText(num.toString(), w * 0.15, y + 8)
      ctx.fillText(num.toString(), w * 0.85, y + 8)
    })

    // Hash marks
    ctx.lineWidth = 1.5
    for (let i = 0; i <= 20; i++) {
      const y = ezH + (i / 20) * fieldH
      ctx.beginPath()
      ctx.moveTo(w * 0.4, y - 4)
      ctx.lineTo(w * 0.4, y + 4)
      ctx.stroke()
      ctx.beginPath()
      ctx.moveTo(w * 0.6, y - 4)
      ctx.lineTo(w * 0.6, y + 4)
      ctx.stroke()
    }

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

// American Football Field 3D
function FootballField3D({ obj }) {
  const texture = useFootballFieldTexture(obj.width, obj.length)
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      {/* Goal posts at each end */}
      {[-1, 1].map(side => (
        <group key={side} position={[0, 0, side * (obj.length / 2)]}>
          {/* Base post */}
          <mesh position={[0, 1.5, 0]}>
            <cylinderGeometry args={[0.08, 0.08, 3, 8]} />
            <meshStandardMaterial color="#FFD700" />
          </mesh>
          {/* Crossbar */}
          <mesh position={[0, 3.05, 0]} rotation={[0, 0, Math.PI / 2]}>
            <cylinderGeometry args={[0.06, 0.06, 5.64, 8]} />
            <meshStandardMaterial color="#FFD700" />
          </mesh>
          {/* Uprights */}
          <mesh position={[-2.82, 5.5, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 5, 8]} />
            <meshStandardMaterial color="#FFD700" />
          </mesh>
          <mesh position={[2.82, 5.5, 0]}>
            <cylinderGeometry args={[0.05, 0.05, 5, 8]} />
            <meshStandardMaterial color="#FFD700" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Padel Court texture
function usePadelCourtTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Blue court
    ctx.fillStyle = '#1565C0'
    ctx.fillRect(0, 0, w, h)

    // White lines
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3

    // Boundary
    ctx.strokeRect(10, 10, w - 20, h - 20)

    // Center / net line
    ctx.lineWidth = 4
    ctx.beginPath()
    ctx.moveTo(10, h / 2)
    ctx.lineTo(w - 10, h / 2)
    ctx.stroke()

    // Service lines (6.95m from net = ~34.75% of half)
    ctx.lineWidth = 3
    const serviceOffset = (h - 20) * 0.3475
    ctx.beginPath()
    ctx.moveTo(10, h / 2 - serviceOffset)
    ctx.lineTo(w - 10, h / 2 - serviceOffset)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(10, h / 2 + serviceOffset)
    ctx.lineTo(w - 10, h / 2 + serviceOffset)
    ctx.stroke()

    // Center service lines
    ctx.lineWidth = 2
    ctx.beginPath()
    ctx.moveTo(w / 2, h / 2 - serviceOffset)
    ctx.lineTo(w / 2, h / 2)
    ctx.stroke()
    ctx.beginPath()
    ctx.moveTo(w / 2, h / 2)
    ctx.lineTo(w / 2, h / 2 + serviceOffset)
    ctx.stroke()

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

// Padel Court 3D
function PadelCourt3D({ obj }) {
  const texture = usePadelCourtTexture(obj.width, obj.length)
  const wallH = 3, backWallH = 4
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
      </mesh>
      {/* Glass back walls */}
      {[-1, 1].map(side => (
        <mesh key={`bw-${side}`} position={[0, backWallH / 2, side * obj.length / 2]}>
          <boxGeometry args={[obj.width, backWallH, 0.1]} />
          <meshStandardMaterial color="#B0BEC5" transparent opacity={0.3} side={THREE.DoubleSide} />
        </mesh>
      ))}
      {/* Side walls - glass portion (back 2m) + mesh fence */}
      {[-1, 1].map(sx => (
        <group key={`sw-${sx}`}>
          {/* Back glass sections */}
          {[-1, 1].map(sz => (
            <mesh key={`sg-${sx}-${sz}`} position={[sx * obj.width / 2, wallH / 2, sz * (obj.length / 2 - 1)]}>
              <boxGeometry args={[0.1, wallH, 2]} />
              <meshStandardMaterial color="#B0BEC5" transparent opacity={0.25} side={THREE.DoubleSide} />
            </mesh>
          ))}
          {/* Mesh fence - rest of sides */}
          <mesh position={[sx * obj.width / 2, wallH / 2, 0]}>
            <boxGeometry args={[0.05, wallH, obj.length - 4]} />
            <meshStandardMaterial color="#78909C" transparent opacity={0.15} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
      {/* Net */}
      <mesh position={[0, 0.45, 0]}>
        <boxGeometry args={[obj.width, 0.88, 0.02]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>
      {/* Net posts */}
      {[-1, 1].map(side => (
        <mesh key={`np-${side}`} position={[side * (obj.width / 2), 0.46, 0]}>
          <cylinderGeometry args={[0.03, 0.03, 0.92, 8]} />
          <meshStandardMaterial color="#333" />
        </mesh>
      ))}
    </group>
  )
}

// 3D House with pitched roof
function House3D({ obj }) {
  const wallHeight = 3, roofHeight = 1.8
  const roofOverhang = 0.4
  const roofAngle = Math.atan2(roofHeight, obj.width / 2)
  const roofSlope = Math.sqrt(roofHeight * roofHeight + (obj.width / 2) * (obj.width / 2))
  const roofY = wallHeight + roofHeight / 2

  return (
    <group>
      {/* Foundation */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[obj.width + 0.6, 0.1, obj.length + 0.6]} />
        <meshStandardMaterial color="#808080" />
      </mesh>

      {/* Main walls */}
      <mesh position={[0, wallHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[obj.width, wallHeight, obj.length]} />
        <meshStandardMaterial color="#f5f0e6" />
      </mesh>

      {/* Roof - left slope */}
      <mesh
        position={[-obj.width / 4, roofY, 0]}
        rotation={[0, 0, roofAngle]}
        castShadow
      >
        <boxGeometry args={[roofSlope + 0.3, 0.12, obj.length + roofOverhang * 2]} />
        <meshStandardMaterial color="#7c2d12" roughness={0.72} />
      </mesh>

      {/* Roof - right slope */}
      <mesh
        position={[obj.width / 4, roofY, 0]}
        rotation={[0, 0, -roofAngle]}
        castShadow
      >
        <boxGeometry args={[roofSlope + 0.3, 0.12, obj.length + roofOverhang * 2]} />
        <meshStandardMaterial color="#7c2d12" roughness={0.72} />
      </mesh>

      {/* Roof ridge cap */}
      <mesh position={[0, wallHeight + roofHeight + 0.05, 0]} castShadow>
        <boxGeometry args={[0.2, 0.1, obj.length + roofOverhang * 2]} />
        <meshStandardMaterial color="#6B3A1F" />
      </mesh>

      {/* Roof shingle ribs and gutters */}
      {[-0.28, -0.14, 0, 0.14, 0.28].map((offset) => (
        <mesh
          key={`shingle-left-${offset}`}
          position={[-obj.width / 4, roofY + 0.08, obj.length * offset]}
          rotation={[0, 0, roofAngle]}
        >
          <boxGeometry args={[roofSlope + 0.25, 0.025, 0.035]} />
          <meshStandardMaterial color="#5f2711" roughness={0.8} />
        </mesh>
      ))}
      {[-0.28, -0.14, 0, 0.14, 0.28].map((offset) => (
        <mesh
          key={`shingle-right-${offset}`}
          position={[obj.width / 4, roofY + 0.08, obj.length * offset]}
          rotation={[0, 0, -roofAngle]}
        >
          <boxGeometry args={[roofSlope + 0.25, 0.025, 0.035]} />
          <meshStandardMaterial color="#5f2711" roughness={0.8} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`gutter-${side}`} position={[side * (obj.width / 2 + 0.04), wallHeight + 0.05, 0]}>
          <boxGeometry args={[0.08, 0.08, obj.length + roofOverhang]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.3} roughness={0.35} />
        </mesh>
      ))}
      <mesh position={[obj.width * 0.32, wallHeight + roofHeight * 0.52, -obj.length * 0.24]} castShadow>
        <boxGeometry args={[0.55, 1.2, 0.55]} />
        <meshStandardMaterial color="#7f1d1d" roughness={0.78} />
      </mesh>
      <mesh position={[obj.width * 0.32, wallHeight + roofHeight + 0.16, -obj.length * 0.24]}>
        <boxGeometry args={[0.7, 0.2, 0.7]} />
        <meshStandardMaterial color="#4b1d1d" roughness={0.72} />
      </mesh>

      {/* Gable ends (triangular fill) - front */}
      <mesh position={[0, wallHeight, obj.length / 2 + 0.01]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={3}
            array={new Float32Array([
              -obj.width / 2, 0, 0,
              obj.width / 2, 0, 0,
              0, roofHeight, 0
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <meshStandardMaterial color="#f5f0e6" side={THREE.DoubleSide} />
      </mesh>

      {/* Gable ends - back */}
      <mesh position={[0, wallHeight, -obj.length / 2 - 0.01]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={3}
            array={new Float32Array([
              -obj.width / 2, 0, 0,
              obj.width / 2, 0, 0,
              0, roofHeight, 0
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <meshStandardMaterial color="#f5f0e6" side={THREE.DoubleSide} />
      </mesh>

      {/* Door frame */}
      <mesh position={[0, 1.1, obj.length / 2 + 0.06]}>
        <boxGeometry args={[1.4, 2.4, 0.08]} />
        <meshStandardMaterial color="#4a3728" />
      </mesh>

      {/* Door */}
      <mesh position={[0, 1.1, obj.length / 2 + 0.11]}>
        <boxGeometry args={[1.1, 2.2, 0.05]} />
        <meshStandardMaterial color="#8B5A2B" />
      </mesh>

      {/* Door handle */}
      <mesh position={[0.4, 1.1, obj.length / 2 + 0.15]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Porch, steps, and path */}
      <mesh position={[0, 0.18, obj.length / 2 + 0.8]}>
        <boxGeometry args={[3.2, 0.18, 1.2]} />
        <meshStandardMaterial color="#c8b89b" roughness={0.82} />
      </mesh>
      {[0.35, 0.7].map((z, i) => (
        <mesh key={`step-${i}`} position={[0, 0.08 + i * 0.08, obj.length / 2 + 1.25 + z]}>
          <boxGeometry args={[2.2 - i * 0.3, 0.12, 0.38]} />
          <meshStandardMaterial color="#a8a29e" roughness={0.8} />
        </mesh>
      ))}
      <mesh position={[0, 0.025, obj.length / 2 + 2.8]}>
        <boxGeometry args={[1.4, 0.05, 2.2]} />
        <meshStandardMaterial color="#b6a17a" roughness={0.88} />
      </mesh>

      {/* Windows - front */}
      {[-obj.width / 3, obj.width / 3].map((x, i) => (
        <group key={`front-${i}`} position={[x, wallHeight / 2 + 0.3, obj.length / 2 + 0.06]}>
          {/* Window frame */}
          <mesh position={[0, 0, 0]}>
            <boxGeometry args={[1.2, 1.2, 0.08]} />
            <meshStandardMaterial color="#4a3728" />
          </mesh>
          {/* Window glass */}
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[1.0, 1.0, 0.02]} />
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} />
          </mesh>
          <mesh position={[0, -0.72, 0.07]}>
            <boxGeometry args={[1.28, 0.1, 0.08]} />
            <meshStandardMaterial color="#f8fafc" roughness={0.5} />
          </mesh>
          {/* Window cross bars */}
          <mesh position={[0, 0, 0.07]}>
            <boxGeometry args={[0.05, 1.0, 0.02]} />
            <meshStandardMaterial color="#4a3728" />
          </mesh>
          <mesh position={[0, 0, 0.07]}>
            <boxGeometry args={[1.0, 0.05, 0.02]} />
            <meshStandardMaterial color="#4a3728" />
          </mesh>
        </group>
      ))}

      {/* Windows - sides */}
      {[-1, 1].map((side) => (
        <group key={`side-${side}`} position={[side * (obj.width / 2 + 0.06), wallHeight / 2 + 0.3, 0]}>
          {/* Window frame */}
          <mesh rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[1.2, 1.2, 0.08]} />
            <meshStandardMaterial color="#4a3728" />
          </mesh>
          {/* Window glass */}
          <mesh position={[side * 0.05, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[1.0, 1.0, 0.02]} />
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} />
          </mesh>
        </group>
      ))}

    </group>
  )
}

// Parking Space (flat)
function ParkingSpace3D({ obj }) {
  const texture = useParkingTexture(obj.width, obj.length)

  return (
    <group>
      <mesh position={[0, -0.005, 0]} receiveShadow>
        <boxGeometry args={[obj.width + 0.18, 0.04, obj.length + 0.18]} />
        <meshStandardMaterial color="#222831" roughness={0.92} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} roughness={0.86} />
      </mesh>
      <mesh position={[0, 0.12, -obj.length * 0.3]}>
        <boxGeometry args={[obj.width * 0.72, 0.2, 0.18]} />
        <meshStandardMaterial color="#d1d5db" roughness={0.68} />
      </mesh>
      <mesh position={[0, 0.08, obj.length / 2 + 0.06]}>
        <boxGeometry args={[obj.width + 0.15, 0.16, 0.12]} />
        <meshStandardMaterial color="#facc15" roughness={0.5} />
      </mesh>
    </group>
  )
}

// ============================================
// LANDMARK 3D COMPONENTS
// ============================================

// Eiffel Tower - Four legs with cross bracing
function EiffelTower3D({ obj }) {
  const w = obj.width, l = obj.length
  const iron = '#8B7355'
  const ironDk = '#6B5344'
  const plat = '#7A6345'
  const floor1 = 57, floor2 = 115

  // Leg sections: tapered cylinders tilted inward
  const legs = [
    { y0: 0, y1: 20, off0: 48, off1: 41, r0: 4, r1: 3.7 },
    { y0: 20, y1: 40, off0: 41, off1: 33, r0: 3.7, r1: 3.4 },
    { y0: 40, y1: 57, off0: 33, off1: 26, r0: 3.4, r1: 3 },
    { y0: 57, y1: 78, off0: 26, off1: 17, r0: 3, r1: 2.7 },
    { y0: 78, y1: 98, off0: 17, off1: 9, r0: 2.7, r1: 2.3 },
    { y0: 98, y1: 115, off0: 9, off1: 5, r0: 2.3, r1: 2 },
  ]

  return (
    <group>
      {/* Ground esplanade */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[w, 0.1, l]} />
        <meshStandardMaterial color="#D4C4A8" />
      </mesh>

      {/* === 4 LEGS — tapered cylinders tilted inward === */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dz], li) => (
        <group key={`leg${li}`}>
          {legs.map((s, si) => {
            const dy = s.y1 - s.y0
            const dOff = s.off0 - s.off1
            const segLen = Math.sqrt(dy * dy + 2 * dOff * dOff)
            const tilt = Math.atan2(dOff, dy)
            return (
              <mesh
                key={si}
                position={[dx * (s.off0 + s.off1) / 2, (s.y0 + s.y1) / 2, dz * (s.off0 + s.off1) / 2]}
                rotation={[-dz * tilt, 0, dx * tilt]}
              >
                <cylinderGeometry args={[s.r1, s.r0, segLen, 8]} />
                <meshStandardMaterial color={iron} />
              </mesh>
            )
          })}
        </group>
      ))}

      {/* === HORIZONTAL CROSS-BRACES at 2 heights === */}
      {[28, 82].map((y, bi) => {
        const t = y / 115
        const off = 48 * (1 - t) + 5 * t
        return (
          <group key={`xb${bi}`}>
            <mesh position={[0, y, off]}><boxGeometry args={[off * 2, 1.5, 2]} /><meshStandardMaterial color={ironDk} /></mesh>
            <mesh position={[0, y, -off]}><boxGeometry args={[off * 2, 1.5, 2]} /><meshStandardMaterial color={ironDk} /></mesh>
            <mesh position={[off, y, 0]}><boxGeometry args={[2, 1.5, off * 2]} /><meshStandardMaterial color={ironDk} /></mesh>
            <mesh position={[-off, y, 0]}><boxGeometry args={[2, 1.5, off * 2]} /><meshStandardMaterial color={ironDk} /></mesh>
          </group>
        )
      })}

      {/* === ARCHES under 1st floor (4 faces) === */}
      {[
        { ax: 'x', f: 1 },
        { ax: 'x', f: -1 },
        { ax: 'z', f: 1 },
        { ax: 'z', f: -1 },
      ].map(({ ax, f }, ai) => (
        <group key={`ar${ai}`}>
          {Array.from({ length: 12 }, (_, i) => {
            const t = i / 11
            const span = -26 + 52 * t
            const ay = floor1 - 18 + 13 * Math.sin(Math.PI * t)
            return ax === 'x' ? (
              <mesh key={i} position={[span, ay, f * 26]} rotation={[0, 0, 0]}>
                <cylinderGeometry args={[0.8, 0.8, 5.5, 6]} />
                <meshStandardMaterial color={ironDk} />
              </mesh>
            ) : (
              <mesh key={i} position={[f * 26, ay, span]} rotation={[0, 0, 0]}>
                <cylinderGeometry args={[0.8, 0.8, 5.5, 6]} />
                <meshStandardMaterial color={ironDk} />
              </mesh>
            )
          })}
        </group>
      ))}

      {/* === 1ST FLOOR PLATFORM === */}
      <mesh position={[0, floor1, 0]}>
        <boxGeometry args={[56, 2.5, 56]} />
        <meshStandardMaterial color={plat} />
      </mesh>
      <mesh position={[0, floor1 + 2, 0]}>
        <boxGeometry args={[58, 1, 58]} />
        <meshStandardMaterial color={ironDk} transparent opacity={0.25} />
      </mesh>

      {/* === 2ND FLOOR PLATFORM === */}
      <mesh position={[0, floor2, 0]}>
        <boxGeometry args={[18, 2, 18]} />
        <meshStandardMaterial color={plat} />
      </mesh>
      <mesh position={[0, floor2 + 1.5, 0]}>
        <boxGeometry args={[20, 0.8, 20]} />
        <meshStandardMaterial color={ironDk} transparent opacity={0.25} />
      </mesh>

      {/* === UPPER TOWER — tapered cylinders === */}
      <mesh position={[0, 145, 0]}>
        <cylinderGeometry args={[3, 4, 60, 8]} />
        <meshStandardMaterial color={iron} />
      </mesh>
      <mesh position={[0, 200, 0]}>
        <cylinderGeometry args={[2.5, 3, 50, 8]} />
        <meshStandardMaterial color={iron} />
      </mesh>
      <mesh position={[0, 250, 0]}>
        <cylinderGeometry args={[1.5, 2.5, 50, 8]} />
        <meshStandardMaterial color={iron} />
      </mesh>
      <mesh position={[0, 287, 0]}>
        <cylinderGeometry args={[1, 1.5, 24, 8]} />
        <meshStandardMaterial color={iron} />
      </mesh>

      {/* Upper tower horizontal rings */}
      {[140, 170, 200, 230, 260].map((y, i) => {
        const r = 4.5 - i * 0.6
        return (
          <mesh key={`ub${i}`} position={[0, y, 0]}>
            <cylinderGeometry args={[r, r, 0.8, 12]} />
            <meshStandardMaterial color={ironDk} />
          </mesh>
        )
      })}

      {/* Summit observation deck */}
      <mesh position={[0, 276, 0]}>
        <cylinderGeometry args={[3.5, 3.5, 1.5, 12]} />
        <meshStandardMaterial color={plat} />
      </mesh>

      {/* Antenna / spire */}
      <mesh position={[0, 312, 0]}>
        <cylinderGeometry args={[0.3, 1.2, 24, 6]} />
        <meshStandardMaterial color={ironDk} metalness={0.3} />
      </mesh>

      {/* Beacon light */}
      <mesh position={[0, 325, 0]}>
        <sphereGeometry args={[0.6, 8, 8]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

// Statue of Liberty — Fort Wood, pedestal, robed figure with crown and torch
function StatueOfLiberty3D({ obj }) {
  const w = obj.width, l = obj.length
  const green = '#4A7C59'
  const greenDk = '#3D5C4A'
  const stone = '#B8AFA0'
  const stoneLt = '#C8C0B0'
  const fortH = 12, pedH = 28
  const sBase = fortH + pedH  // statue starts at y=40
  const sH = 46               // statue height

  return (
    <group>
      {/* Island ground */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[w / 2, w / 2 + 1, 0.1, 24]} />
        <meshStandardMaterial color="#7A9A6A" />
      </mesh>

      {/* === STAR-SHAPED FORT WOOD (11-point) === */}
      <mesh position={[0, fortH / 2, 0]}>
        <cylinderGeometry args={[w * 0.4, w * 0.45, fortH, 11]} />
        <meshStandardMaterial color="#8A8070" roughness={0.9} />
      </mesh>
      {/* Fort parapet walls */}
      <mesh position={[0, fortH - 1, 0]}>
        <cylinderGeometry args={[w * 0.44, w * 0.44, 2.5, 11, 1, true]} />
        <meshStandardMaterial color={stone} side={2} />
      </mesh>

      {/* === PEDESTAL === */}
      {/* Base plinth */}
      <mesh position={[0, fortH + 2.5, 0]}>
        <boxGeometry args={[18, 5, 18]} />
        <meshStandardMaterial color={stone} />
      </mesh>
      {/* Main pedestal column — tapered */}
      <mesh position={[0, fortH + pedH / 2, 0]}>
        <cylinderGeometry args={[6.5, 9, pedH - 5, 4]} />
        <meshStandardMaterial color={stoneLt} />
      </mesh>
      {/* Pedestal top cornice */}
      <mesh position={[0, sBase - 1.5, 0]}>
        <boxGeometry args={[15, 2, 15]} />
        <meshStandardMaterial color={stoneLt} />
      </mesh>
      {/* Observation balcony */}
      <mesh position={[0, sBase, 0]}>
        <cylinderGeometry args={[8, 8, 1.5, 16]} />
        <meshStandardMaterial color={stone} />
      </mesh>

      {/* === STATUE FIGURE === */}
      {/* Flowing robes — tapered */}
      <mesh position={[0, sBase + sH * 0.32, 0]}>
        <cylinderGeometry args={[4.5, 7, sH * 0.64, 12]} />
        <meshStandardMaterial color={green} />
      </mesh>
      {/* Upper torso */}
      <mesh position={[0, sBase + sH * 0.68, 0]}>
        <cylinderGeometry args={[3, 4.5, sH * 0.12, 10]} />
        <meshStandardMaterial color={green} />
      </mesh>
      {/* Neck */}
      <mesh position={[0, sBase + sH * 0.76, 0]}>
        <cylinderGeometry args={[1.5, 2, 2, 8]} />
        <meshStandardMaterial color={green} />
      </mesh>
      {/* Head */}
      <mesh position={[0, sBase + sH * 0.82, 0]}>
        <sphereGeometry args={[2.5, 12, 12]} />
        <meshStandardMaterial color={green} />
      </mesh>

      {/* === CROWN — 7 rays === */}
      {Array.from({ length: 7 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 7
        const headY = sBase + sH * 0.82
        const tilt = 0.35
        return (
          <mesh
            key={`ray${i}`}
            position={[Math.sin(a) * 3, headY + 3, Math.cos(a) * 3]}
            rotation={[Math.cos(a) * tilt, 0, -Math.sin(a) * tilt]}
          >
            <boxGeometry args={[0.4, 4, 0.15]} />
            <meshStandardMaterial color={greenDk} />
          </mesh>
        )
      })}

      {/* === RIGHT ARM — raised holding torch === */}
      <mesh position={[3, sBase + sH * 0.78, 0]} rotation={[0, 0, -0.25]}>
        <cylinderGeometry args={[1, 1.5, sH * 0.28, 8]} />
        <meshStandardMaterial color={green} />
      </mesh>
      {/* Torch handle */}
      <mesh position={[5.5, sBase + sH * 0.94, 0]}>
        <cylinderGeometry args={[0.6, 0.9, 4, 6]} />
        <meshStandardMaterial color={greenDk} />
      </mesh>
      {/* Torch flame — 24k gold */}
      <mesh position={[5.5, sBase + sH + 2, 0]}>
        <coneGeometry args={[1.3, 4, 8]} />
        <meshStandardMaterial color="#FFD700" emissive="#FFD700" emissiveIntensity={0.6} />
      </mesh>

      {/* === LEFT ARM — holding tablet === */}
      <mesh position={[-3, sBase + sH * 0.5, 1.5]} rotation={[0.15, 0, 0.25]}>
        <cylinderGeometry args={[1.2, 1.5, sH * 0.15, 8]} />
        <meshStandardMaterial color={green} />
      </mesh>
      {/* Tablet (tabula ansata) */}
      <mesh position={[-4, sBase + sH * 0.45, 2.5]} rotation={[0.3, 0, 0.35]}>
        <boxGeometry args={[1, 6, 4]} />
        <meshStandardMaterial color={greenDk} />
      </mesh>
    </group>
  )
}

// Great Pyramid of Giza — truncated pyramid with block courses and queen's pyramids
function GreatPyramid3D({ obj }) {
  const w = obj.width // 230
  const pyH = 138     // current height (capstone missing)
  const baseR = w * 0.707  // circumradius for square base = w / sqrt(2)

  return (
    <group>
      {/* Desert sand base */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[w * 1.3, 0.1, w * 1.3]} />
        <meshStandardMaterial color="#E8D9B5" />
      </mesh>

      {/* === MAIN PYRAMID — truncated (flat top, capstone lost) === */}
      <mesh position={[0, pyH / 2, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[2, baseR, pyH, 4]} />
        <meshStandardMaterial color="#D4A84B" roughness={0.85} />
      </mesh>

      {/* Block course lines — horizontal rings suggesting stone layers */}
      {[0.1, 0.2, 0.3, 0.4, 0.5, 0.6, 0.7, 0.8, 0.9].map((t, i) => {
        const y = t * pyH
        const r = baseR * (1 - t) + 2 * t  // interpolate from base to top
        return (
          <mesh key={`cl${i}`} position={[0, y, 0]} rotation={[0, Math.PI / 4, 0]}>
            <cylinderGeometry args={[r * 0.98, r, 0.6, 4, 1, true]} />
            <meshStandardMaterial color="#C49A3C" side={2} />
          </mesh>
        )
      })}

      {/* Remaining casing stones at base (lighter limestone) */}
      <mesh position={[0, 3, 0]} rotation={[0, Math.PI / 4, 0]}>
        <cylinderGeometry args={[baseR * 0.96, baseR * 1.01, 6, 4, 1, true]} />
        <meshStandardMaterial color="#E8DCC0" side={2} />
      </mesh>

      {/* === QUEEN'S PYRAMIDS (3 smaller ones) === */}
      {[
        { x: w * 0.45, z: w * 0.3, s: 0.18 },
        { x: w * 0.45, z: 0, s: 0.15 },
        { x: w * 0.45, z: -w * 0.3, s: 0.13 },
      ].map((qp, i) => {
        const qH = pyH * qp.s
        const qR = baseR * qp.s
        return (
          <mesh key={`qp${i}`} position={[qp.x, qH / 2, qp.z]} rotation={[0, Math.PI / 4, 0]}>
            <coneGeometry args={[qR, qH, 4]} />
            <meshStandardMaterial color="#C9A040" roughness={0.9} />
          </mesh>
        )
      })}

      {/* Desert path / causeway hint */}
      <mesh position={[-w * 0.3, 0.1, w * 0.45]}>
        <boxGeometry args={[w * 0.5, 0.08, 4]} />
        <meshStandardMaterial color="#D0C098" />
      </mesh>
    </group>
  )
}

// Taj Mahal — white marble mausoleum with dome, minarets, and gardens
function TajMahal3D({ obj }) {
  const w = obj.width, l = obj.length  // 57x57
  const marble = '#F8F6F0'
  const marbleDk = '#E0DDD5'
  const red = '#B85C3A'
  const platH = 7        // raised platform
  const bldgH = 25       // main building
  const bldgW = 30       // building width
  const domeR = 10       // dome radius
  const minOff = w * 0.43 // minaret offset from center
  const minR = 1.5
  const minH = 40

  return (
    <group>
      {/* Garden and reflecting pool area */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[w, 0.1, l]} />
        <meshStandardMaterial color="#4A7A4A" />
      </mesh>
      {/* Reflecting pool / water channel */}
      <mesh position={[0, 0.12, l * 0.2]}>
        <boxGeometry args={[3, 0.06, l * 0.5]} />
        <meshStandardMaterial color="#6BA4C9" metalness={0.3} roughness={0.1} />
      </mesh>
      {/* Garden pathways */}
      {[-1, 1].map((side, i) => (
        <mesh key={`gp${i}`} position={[side * w * 0.2, 0.1, l * 0.15]}>
          <boxGeometry args={[2, 0.06, l * 0.6]} />
          <meshStandardMaterial color="#C9B896" />
        </mesh>
      ))}

      {/* === RAISED MARBLE PLATFORM === */}
      <mesh position={[0, platH / 2, -l * 0.15]}>
        <boxGeometry args={[w * 0.75, platH, w * 0.6]} />
        <meshStandardMaterial color={marbleDk} />
      </mesh>

      {/* === MAIN BUILDING === */}
      <mesh position={[0, platH + bldgH / 2, -l * 0.15]}>
        <boxGeometry args={[bldgW, bldgH, bldgW]} />
        <meshStandardMaterial color={marble} />
      </mesh>
      {/* Arched recesses on 4 faces */}
      {[
        [0, 0, bldgW / 2 + 0.08, 0],
        [0, 0, -bldgW / 2 - 0.08, 0],
        [bldgW / 2 + 0.08, 0, 0, Math.PI / 2],
        [-bldgW / 2 - 0.08, 0, 0, Math.PI / 2],
      ].map(([dx, _, dz, ry], i) => (
        <group key={`ar${i}`}>
          {/* Large central arch (iwan) */}
          <mesh position={[dx, platH + bldgH * 0.5, -l * 0.15 + dz]} rotation={[0, ry, 0]}>
            <boxGeometry args={[10, bldgH * 0.7, 0.5]} />
            <meshStandardMaterial color="#D0CCC5" />
          </mesh>
          {/* Arch top (half-cylinder hint) */}
          <mesh position={[dx, platH + bldgH * 0.8, -l * 0.15 + dz]} rotation={[Math.PI / 2, 0, ry]}>
            <cylinderGeometry args={[5, 5, 0.5, 12, 1, false, 0, Math.PI]} />
            <meshStandardMaterial color="#D0CCC5" />
          </mesh>
        </group>
      ))}

      {/* === CENTRAL DOME === */}
      {/* Dome drum (cylinder base) */}
      <mesh position={[0, platH + bldgH + 2, -l * 0.15]}>
        <cylinderGeometry args={[domeR + 0.5, domeR + 1, 4, 16]} />
        <meshStandardMaterial color={marble} />
      </mesh>
      {/* Main dome (half sphere) */}
      <mesh position={[0, platH + bldgH + 4, -l * 0.15]}>
        <sphereGeometry args={[domeR, 20, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={marble} />
      </mesh>
      {/* Finial (spire on top of dome) */}
      <mesh position={[0, platH + bldgH + 4 + domeR + 1.5, -l * 0.15]}>
        <cylinderGeometry args={[0.2, 0.5, 3, 8]} />
        <meshStandardMaterial color="#D4A84B" />
      </mesh>

      {/* Small corner domes (chattris) */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dz], i) => (
        <group key={`cd${i}`}>
          <mesh position={[dx * bldgW * 0.42, platH + bldgH + 2, -l * 0.15 + dz * bldgW * 0.42]}>
            <cylinderGeometry args={[2, 2.2, 3, 8]} />
            <meshStandardMaterial color={marble} />
          </mesh>
          <mesh position={[dx * bldgW * 0.42, platH + bldgH + 4, -l * 0.15 + dz * bldgW * 0.42]}>
            <sphereGeometry args={[2.5, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={marble} />
          </mesh>
        </group>
      ))}

      {/* === FOUR MINARETS === */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dz], i) => (
        <group key={`min${i}`}>
          {/* Minaret shaft */}
          <mesh position={[dx * minOff, platH + minH / 2, -l * 0.15 + dz * minOff]}>
            <cylinderGeometry args={[minR * 0.8, minR, minH, 10]} />
            <meshStandardMaterial color={marble} />
          </mesh>
          {/* Minaret balconies */}
          {[0.5, 0.7, 0.88].map((t, bi) => (
            <mesh key={`mb${bi}`} position={[dx * minOff, platH + minH * t, -l * 0.15 + dz * minOff]}>
              <cylinderGeometry args={[minR + 0.5, minR + 0.5, 0.6, 10]} />
              <meshStandardMaterial color={marbleDk} />
            </mesh>
          ))}
          {/* Minaret top dome */}
          <mesh position={[dx * minOff, platH + minH + 1, -l * 0.15 + dz * minOff]}>
            <sphereGeometry args={[minR * 0.9, 8, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
            <meshStandardMaterial color={marble} />
          </mesh>
        </group>
      ))}

      {/* === ENTRY GATE (red sandstone) === */}
      <mesh position={[0, 8, l * 0.35]}>
        <boxGeometry args={[18, 16, 5]} />
        <meshStandardMaterial color={red} />
      </mesh>
      <mesh position={[0, 14, l * 0.35]}>
        <sphereGeometry args={[3, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={marble} />
      </mesh>
    </group>
  )
}

// Colosseum — Elliptical amphitheater with arched tiers and arena floor
function Colosseum3D({ obj }) {
  const w = obj.width, l = obj.length  // 156x189
  const wallH = 48    // real height ~48m
  const outerR = w / 2 // 78
  const scaleZ = l / w  // 189/156 ≈ 1.21 (ellipse)
  const tiers = 4       // 4 levels of arches
  const stone = '#C9B896'
  const stoneDk = '#A89878'
  const arenaColor = '#E8D8B8'

  return (
    <group scale={[1, 1, scaleZ]}>
      {/* Ground */}
      <mesh position={[0, 0.06, 0]}>
        <cylinderGeometry args={[outerR + 5, outerR + 5, 0.1, 32]} />
        <meshStandardMaterial color="#D4C8A8" />
      </mesh>

      {/* === OUTER WALL — 4 tiered levels === */}
      {Array.from({ length: tiers }, (_, i) => {
        const tierH = wallH / tiers
        const y = i * tierH + tierH / 2
        const rBot = outerR - i * 1.5
        const rTop = outerR - (i + 1) * 1.5
        return (
          <mesh key={`tier${i}`} position={[0, y, 0]}>
            <cylinderGeometry args={[rTop, rBot, tierH, 40, 1, true]} />
            <meshStandardMaterial color={i < 3 ? stone : stoneDk} side={2} />
          </mesh>
        )
      })}

      {/* Tier separation bands (horizontal cornices) */}
      {[0, 1, 2, 3].map((i) => {
        const y = i * (wallH / tiers)
        const r = outerR - i * 1.5
        return (
          <mesh key={`band${i}`} position={[0, y, 0]}>
            <cylinderGeometry args={[r + 0.5, r + 0.5, 1.2, 40]} />
            <meshStandardMaterial color={stoneDk} />
          </mesh>
        )
      })}
      {/* Top cornice */}
      <mesh position={[0, wallH, 0]}>
        <cylinderGeometry args={[outerR - 5.5, outerR - 5, 1.5, 40]} />
        <meshStandardMaterial color={stoneDk} />
      </mesh>

      {/* Arch columns — vertical pillars around exterior (lower 3 tiers) */}
      {Array.from({ length: 40 }, (_, i) => {
        const a = (Math.PI * 2 * i) / 40
        const x = Math.sin(a) * (outerR + 0.3)
        const z = Math.cos(a) * (outerR + 0.3)
        return (
          <mesh key={`col${i}`} position={[x, wallH * 0.375, z]}>
            <cylinderGeometry args={[0.8, 1, wallH * 0.75, 6]} />
            <meshStandardMaterial color={stone} />
          </mesh>
        )
      })}

      {/* === INNER WALL === */}
      <mesh position={[0, wallH * 0.4, 0]}>
        <cylinderGeometry args={[outerR * 0.65, outerR * 0.7, wallH * 0.8, 32, 1, true]} />
        <meshStandardMaterial color={stoneDk} side={2} />
      </mesh>

      {/* === ARENA FLOOR === */}
      <mesh position={[0, 2, 0]}>
        <cylinderGeometry args={[outerR * 0.45, outerR * 0.45, 0.3, 32]} />
        <meshStandardMaterial color={arenaColor} />
      </mesh>

      {/* Hypogeum (underground structure visible) — cross pattern */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[outerR * 0.8, 0.8, 3]} />
        <meshStandardMaterial color="#8A7860" />
      </mesh>
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[3, 0.8, outerR * 0.8]} />
        <meshStandardMaterial color="#8A7860" />
      </mesh>

      {/* Collapsed south wall section — partial wall */}
      <mesh position={[outerR * 0.35, wallH * 0.6, -outerR * 0.6]} rotation={[0, 0.8, 0]}>
        <boxGeometry args={[outerR * 0.4, wallH * 0.4, 4]} />
        <meshStandardMaterial color={stone} />
      </mesh>
    </group>
  )
}

// Big Ben (Elizabeth Tower) — Gothic tower with clock faces and spire
function BigBen3D({ obj }) {
  const w = obj.width, l = obj.length  // 12x12
  const towerSz = w * 0.7   // 8.4m tower width
  const totalH = 96          // real height 96m
  const clockH = 70          // clock level
  const stone = '#C9B896'
  const stoneDk = '#A89070'
  const cream = '#E8E0D0'

  return (
    <group>
      {/* Ground area */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[w, 0.1, l]} />
        <meshStandardMaterial color="#D4D0C8" />
      </mesh>

      {/* === TOWER BASE (lower 2/3) === */}
      <mesh position={[0, clockH / 2, 0]}>
        <boxGeometry args={[towerSz, clockH, towerSz]} />
        <meshStandardMaterial color={stone} roughness={0.85} />
      </mesh>

      {/* Gothic vertical ribs on each face */}
      {[
        [towerSz / 2 + 0.06, 0],
        [-towerSz / 2 - 0.06, 0],
        [0, towerSz / 2 + 0.06],
        [0, -towerSz / 2 - 0.06],
      ].map(([dx, dz], i) => (
        <group key={`ribs${i}`}>
          {[-towerSz * 0.3, 0, towerSz * 0.3].map((offset, ri) => {
            const px = dx !== 0 ? dx : offset
            const pz = dz !== 0 ? dz : offset
            return (
              <mesh key={`rib${ri}`} position={[px, clockH / 2, pz]}>
                <boxGeometry args={[dx !== 0 ? 0.3 : 0.5, clockH - 2, dz !== 0 ? 0.3 : 0.5]} />
                <meshStandardMaterial color={stoneDk} />
              </mesh>
            )
          })}
        </group>
      ))}

      {/* Horizontal band details */}
      {[15, 30, 45, 60].map((y, i) => (
        <mesh key={`hb${i}`} position={[0, y, 0]}>
          <boxGeometry args={[towerSz + 0.3, 0.8, towerSz + 0.3]} />
          <meshStandardMaterial color={stoneDk} />
        </mesh>
      ))}

      {/* === CLOCK SECTION === */}
      <mesh position={[0, clockH + 4, 0]}>
        <boxGeometry args={[towerSz + 1, 8, towerSz + 1]} />
        <meshStandardMaterial color={cream} />
      </mesh>

      {/* Clock faces — 4 sides */}
      {[
        [0, 0, towerSz / 2 + 0.58, 0],
        [0, 0, -towerSz / 2 - 0.58, 0],
        [towerSz / 2 + 0.58, 0, 0, Math.PI / 2],
        [-towerSz / 2 - 0.58, 0, 0, Math.PI / 2],
      ].map(([dx, _, dz, ry], i) => (
        <group key={`clock${i}`}>
          {/* Clock face background */}
          <mesh position={[dx, clockH + 4, dz]} rotation={[0, ry || 0, 0]}>
            <cylinderGeometry args={[3, 3, 0.3, 24]} />
            <meshStandardMaterial color="#F5F0E6" />
          </mesh>
          {/* Clock rim */}
          <mesh position={[dx, clockH + 4, dz]} rotation={[0, ry || 0, 0]}>
            <cylinderGeometry args={[3.2, 3.2, 0.15, 24, 1, true]} />
            <meshStandardMaterial color="#222222" side={2} />
          </mesh>
        </group>
      ))}

      {/* === BELFRY (above clock) === */}
      <mesh position={[0, clockH + 11, 0]}>
        <boxGeometry args={[towerSz + 0.5, 6, towerSz + 0.5]} />
        <meshStandardMaterial color={stone} />
      </mesh>
      {/* Belfry openings (dark arches on each side) */}
      {[
        [0, towerSz / 2 + 0.34],
        [0, -towerSz / 2 - 0.34],
        [towerSz / 2 + 0.34, 0],
        [-towerSz / 2 - 0.34, 0],
      ].map(([dx, dz], i) => (
        <mesh key={`bel${i}`} position={[dx, clockH + 11, dz]}>
          <boxGeometry args={[dx !== 0 ? 0.4 : 3, 4, dz !== 0 ? 0.4 : 3]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}

      {/* === PYRAMIDAL ROOF === */}
      <mesh position={[0, clockH + 17, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[towerSz * 0.7, 8, 4]} />
        <meshStandardMaterial color="#5A6A5A" metalness={0.2} />
      </mesh>

      {/* === SPIRE === */}
      <mesh position={[0, clockH + 24, 0]}>
        <coneGeometry args={[1, 12, 8]} />
        <meshStandardMaterial color="#5A6A5A" metalness={0.3} />
      </mesh>

      {/* Gold finial */}
      <mesh position={[0, clockH + 30.5, 0]}>
        <sphereGeometry args={[0.6, 8, 8]} />
        <meshStandardMaterial color="#D4A84B" emissive="#D4A84B" emissiveIntensity={0.3} />
      </mesh>

      {/* === ATTACHED PARLIAMENT BUILDING (low wing) === */}
      <mesh position={[w * 0.3, 8, 0]}>
        <boxGeometry args={[w * 0.4, 16, l * 0.8]} />
        <meshStandardMaterial color={stone} />
      </mesh>
    </group>
  )
}

// ============================================
// COMMERCIAL 3D COMPONENTS
// ============================================

// 7-Eleven convenience store
function SevenEleven3D({ obj }) {
  const w = obj.width, l = obj.length
  const wallH = 3.5
  const bd = l - 4       // building depth (13m for l=17)
  const bz = -2          // building center shifted back
  const fz = bz + bd / 2 // front face z (4.5 for l=17)
  const canopyDepth = l / 2 - fz // 4m canopy area

  return (
    <group>
      {/* Concrete sidewalk in front */}
      <mesh position={[0, 0.06, fz + canopyDepth / 2]}>
        <boxGeometry args={[w, 0.1, canopyDepth]} />
        <meshStandardMaterial color="#B0B0B0" />
      </mesh>

      {/* Main building body - white lower */}
      <mesh position={[0, wallH * 0.35, bz]}>
        <boxGeometry args={[w, wallH * 0.7, bd]} />
        <meshStandardMaterial color="#F0EDE5" />
      </mesh>
      {/* Upper wall - 7-Eleven green */}
      <mesh position={[0, wallH * 0.85, bz]}>
        <boxGeometry args={[w, wallH * 0.3, bd]} />
        <meshStandardMaterial color="#00703C" />
      </mesh>

      {/* Concrete base strip */}
      <mesh position={[0, 0.2, bz]}>
        <boxGeometry args={[w + 0.1, 0.4, bd + 0.1]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>

      {/* Flat roof with overhang */}
      <mesh position={[0, wallH + 0.1, bz]}>
        <boxGeometry args={[w + 0.6, 0.2, bd + 0.6]} />
        <meshStandardMaterial color="#C8C8C8" />
      </mesh>

      {/* === ICONIC STRIPE BAND (green-orange-red) on front === */}
      <mesh position={[0, wallH - 0.55, fz + 0.06]}>
        <boxGeometry args={[w + 0.1, 0.25, 0.1]} />
        <meshStandardMaterial color="#FF7E00" />
      </mesh>
      <mesh position={[0, wallH - 0.8, fz + 0.06]}>
        <boxGeometry args={[w + 0.1, 0.2, 0.1]} />
        <meshStandardMaterial color="#EE2737" />
      </mesh>

      {/* === FACADE SIGNAGE (matches logo: orange 7 top, red 7 stem, green ELEVEn, red square) === */}
      {/* White sign background */}
      <mesh position={[0, wallH - 0.1, fz + 0.07]}>
        <boxGeometry args={[w * 0.5, 0.8, 0.08]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* "7" - orange horizontal top bar */}
      <mesh position={[-w * 0.06, wallH + 0.12, fz + 0.12]}>
        <boxGeometry args={[1.6, 0.28, 0.06]} />
        <meshStandardMaterial color="#FF7E00" emissive="#FF7E00" emissiveIntensity={0.3} />
      </mesh>
      {/* "7" - red diagonal stem (approximated vertical) */}
      <mesh position={[w * 0.01, wallH - 0.22, fz + 0.12]}>
        <boxGeometry args={[0.3, 0.7, 0.06]} />
        <meshStandardMaterial color="#EE2737" emissive="#EE2737" emissiveIntensity={0.3} />
      </mesh>
      {/* "ELEVEn" - green text bar */}
      <mesh position={[w * 0.01, wallH - 0.42, fz + 0.12]}>
        <boxGeometry args={[2.8, 0.22, 0.06]} />
        <meshStandardMaterial color="#00703C" emissive="#00703C" emissiveIntensity={0.2} />
      </mesh>
      {/* Red square below stem */}
      <mesh position={[w * 0.01, wallH - 0.62, fz + 0.12]}>
        <boxGeometry args={[0.3, 0.22, 0.06]} />
        <meshStandardMaterial color="#EE2737" emissive="#EE2737" emissiveIntensity={0.3} />
      </mesh>

      {/* === POLE SIGN near entrance === */}
      {/* Pole */}
      <mesh position={[w * 0.4, 2.5, l / 2 - 0.5]}>
        <cylinderGeometry args={[0.12, 0.12, 5, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.4} />
      </mesh>
      {/* Sign box on pole - white background */}
      <mesh position={[w * 0.4, 4.8, l / 2 - 0.5]}>
        <boxGeometry args={[2.5, 1.8, 0.4]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Green border on sign */}
      <mesh position={[w * 0.4, 4.8, l / 2 - 0.28]}>
        <boxGeometry args={[2.6, 1.9, 0.06]} />
        <meshStandardMaterial color="#00703C" />
      </mesh>
      {/* Pole sign inner white face */}
      <mesh position={[w * 0.4, 4.8, l / 2 - 0.24]}>
        <boxGeometry args={[2.3, 1.6, 0.06]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Pole sign - orange "7" top bar */}
      <mesh position={[w * 0.4 - 0.2, 5.25, l / 2 - 0.2]}>
        <boxGeometry args={[1.1, 0.22, 0.08]} />
        <meshStandardMaterial color="#FF7E00" emissive="#FF7E00" emissiveIntensity={0.4} />
      </mesh>
      {/* Pole sign - red "7" stem */}
      <mesh position={[w * 0.4, 4.9, l / 2 - 0.2]}>
        <boxGeometry args={[0.22, 0.55, 0.08]} />
        <meshStandardMaterial color="#EE2737" emissive="#EE2737" emissiveIntensity={0.4} />
      </mesh>
      {/* Pole sign - green "ELEVEn" bar */}
      <mesh position={[w * 0.4, 4.55, l / 2 - 0.2]}>
        <boxGeometry args={[1.8, 0.18, 0.08]} />
        <meshStandardMaterial color="#00703C" emissive="#00703C" emissiveIntensity={0.2} />
      </mesh>
      {/* Pole sign - red square below */}
      <mesh position={[w * 0.4, 4.35, l / 2 - 0.2]}>
        <boxGeometry args={[0.22, 0.2, 0.08]} />
        <meshStandardMaterial color="#EE2737" emissive="#EE2737" emissiveIntensity={0.4} />
      </mesh>

      {/* === STOREFRONT GLASS WINDOWS === */}
      {/* Left glass section */}
      <mesh position={[-w * 0.27, 1.3, fz + 0.06]}>
        <boxGeometry args={[w * 0.35, 2.2, 0.08]} />
        <meshStandardMaterial color="#88C8E8" transparent opacity={0.45} metalness={0.1} roughness={0.1} />
      </mesh>
      {/* Right glass section */}
      <mesh position={[w * 0.27, 1.3, fz + 0.06]}>
        <boxGeometry args={[w * 0.35, 2.2, 0.08]} />
        <meshStandardMaterial color="#88C8E8" transparent opacity={0.45} metalness={0.1} roughness={0.1} />
      </mesh>

      {/* Window mullions (vertical dividers) */}
      {[-w * 0.45, -w * 0.27, -w * 0.09, w * 0.09, w * 0.27, w * 0.45].map((x, i) => (
        <mesh key={`m${i}`} position={[x, 1.3, fz + 0.11]}>
          <boxGeometry args={[0.1, 2.2, 0.06]} />
          <meshStandardMaterial color="#444444" />
        </mesh>
      ))}
      {/* Horizontal bar across windows */}
      <mesh position={[-w * 0.27, 1.8, fz + 0.11]}>
        <boxGeometry args={[w * 0.36, 0.06, 0.06]} />
        <meshStandardMaterial color="#444444" />
      </mesh>
      <mesh position={[w * 0.27, 1.8, fz + 0.11]}>
        <boxGeometry args={[w * 0.36, 0.06, 0.06]} />
        <meshStandardMaterial color="#444444" />
      </mesh>

      {/* === ENTRANCE DOOR === */}
      {/* Door recess */}
      <mesh position={[0, 1.2, fz + 0.06]}>
        <boxGeometry args={[2.0, 2.4, 0.15]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Double glass door panels */}
      <mesh position={[-0.5, 1.3, fz + 0.15]}>
        <boxGeometry args={[0.85, 2.1, 0.06]} />
        <meshStandardMaterial color="#7AB8D8" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0.5, 1.3, fz + 0.15]}>
        <boxGeometry args={[0.85, 2.1, 0.06]} />
        <meshStandardMaterial color="#7AB8D8" transparent opacity={0.5} />
      </mesh>
      {/* Door handles */}
      <mesh position={[-0.12, 1.2, fz + 0.2]}>
        <boxGeometry args={[0.06, 0.4, 0.06]} />
        <meshStandardMaterial color="#888888" metalness={0.5} />
      </mesh>
      <mesh position={[0.12, 1.2, fz + 0.2]}>
        <boxGeometry args={[0.06, 0.4, 0.06]} />
        <meshStandardMaterial color="#888888" metalness={0.5} />
      </mesh>

      {/* === FRONT CANOPY (within footprint) === */}
      <mesh position={[0, 3.2, fz + canopyDepth / 2]}>
        <boxGeometry args={[w, 0.15, canopyDepth]} />
        <meshStandardMaterial color="#F5F5F5" />
      </mesh>
      {/* Canopy edge trim - green */}
      <mesh position={[0, 3.12, l / 2]}>
        <boxGeometry args={[w, 0.08, 0.12]} />
        <meshStandardMaterial color="#00703C" />
      </mesh>
      {/* Canopy underside green stripe */}
      <mesh position={[0, 3.11, fz + canopyDepth / 2]}>
        <boxGeometry args={[w - 0.5, 0.04, canopyDepth - 0.3]} />
        <meshStandardMaterial color="#008C4A" />
      </mesh>
      {/* Canopy support poles */}
      {[-w * 0.45, w * 0.45].map((x, i) => (
        <mesh key={`pole${i}`} position={[x, 1.6, l / 2 - 0.5]}>
          <cylinderGeometry args={[0.1, 0.1, 3.2, 8]} />
          <meshStandardMaterial color="#888888" metalness={0.3} />
        </mesh>
      ))}

      {/* === SIDE DETAILS === */}
      {/* Green band wraps around sides */}
      <mesh position={[-w / 2 - 0.06, wallH * 0.85, bz]}>
        <boxGeometry args={[0.08, wallH * 0.3, bd]} />
        <meshStandardMaterial color="#00703C" />
      </mesh>
      <mesh position={[w / 2 + 0.06, wallH * 0.85, bz]}>
        <boxGeometry args={[0.08, wallH * 0.3, bd]} />
        <meshStandardMaterial color="#00703C" />
      </mesh>
      {/* Side window - left */}
      <mesh position={[-w / 2 - 0.06, 1.8, bz]}>
        <boxGeometry args={[0.08, 1.2, 2]} />
        <meshStandardMaterial color="#88C8E8" transparent opacity={0.4} />
      </mesh>
      {/* Side window - right */}
      <mesh position={[w / 2 + 0.06, 1.8, bz]}>
        <boxGeometry args={[0.08, 1.2, 2]} />
        <meshStandardMaterial color="#88C8E8" transparent opacity={0.4} />
      </mesh>

      {/* === ROOF DETAILS === */}
      {/* AC unit */}
      <mesh position={[w * 0.25, wallH + 0.55, bz - bd * 0.2]}>
        <boxGeometry args={[1.8, 0.7, 1.2]} />
        <meshStandardMaterial color="#909090" metalness={0.3} roughness={0.6} />
      </mesh>
      {/* Roof vent */}
      <mesh position={[-w * 0.2, wallH + 0.4, bz - bd * 0.25]}>
        <boxGeometry args={[0.8, 0.5, 0.8]} />
        <meshStandardMaterial color="#808080" metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  )
}

// McDonald's restaurant
function McDonalds3D({ obj }) {
  const w = obj.width, l = obj.length
  const wallH = 4.0
  const bd = l - 3        // building depth
  const bz = -1.5         // building center shifted back
  const fz = bz + bd / 2  // front face z
  const brickH = 1.2      // dark brick base height

  return (
    <group>
      {/* Concrete sidewalk */}
      <mesh position={[0, 0.06, fz + 1.5]}>
        <boxGeometry args={[w, 0.1, 3]} />
        <meshStandardMaterial color="#B0B0B0" />
      </mesh>

      {/* === BUILDING BODY === */}
      {/* Dark brick base */}
      <mesh position={[0, brickH / 2, bz]}>
        <boxGeometry args={[w, brickH, bd]} />
        <meshStandardMaterial color="#3D2B1F" roughness={0.9} />
      </mesh>
      {/* Upper walls - dark charcoal with panel look */}
      <mesh position={[0, brickH + (wallH - brickH) / 2, bz]}>
        <boxGeometry args={[w, wallH - brickH, bd]} />
        <meshStandardMaterial color="#4A4A4A" roughness={0.7} />
      </mesh>
      {/* Horizontal panel lines on front upper wall */}
      {[0, 0.5, 1.0, 1.5, 2.0].map((dy, i) => (
        <mesh key={`fl${i}`} position={[0, brickH + 0.3 + dy, fz + 0.06]}>
          <boxGeometry args={[w + 0.1, 0.04, 0.06]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
      ))}

      {/* Flat roof / parapet */}
      <mesh position={[0, wallH + 0.15, bz]}>
        <boxGeometry args={[w + 0.4, 0.3, bd + 0.4]} />
        <meshStandardMaterial color="#3A3A3A" />
      </mesh>
      {/* Roof cap */}
      <mesh position={[0, wallH + 0.35, bz]}>
        <boxGeometry args={[w + 0.6, 0.1, bd + 0.6]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* === WOOD-TONE VERTICAL ACCENT PANELS === */}
      {/* Left corner accent */}
      <mesh position={[-w / 2 + 0.4, wallH / 2, fz + 0.07]}>
        <boxGeometry args={[0.8, wallH, 0.1]} />
        <meshStandardMaterial color="#8B5E3C" roughness={0.8} />
      </mesh>
      {/* Vertical slat lines on left accent */}
      {[-0.25, -0.1, 0.05, 0.2, 0.35].map((dx, i) => (
        <mesh key={`la${i}`} position={[-w / 2 + 0.4 + dx, wallH / 2, fz + 0.13]}>
          <boxGeometry args={[0.04, wallH - 0.2, 0.04]} />
          <meshStandardMaterial color="#6B4226" />
        </mesh>
      ))}
      {/* Right corner accent */}
      <mesh position={[w / 2 - 0.4, wallH / 2, fz + 0.07]}>
        <boxGeometry args={[0.8, wallH, 0.1]} />
        <meshStandardMaterial color="#8B5E3C" roughness={0.8} />
      </mesh>
      {[-0.25, -0.1, 0.05, 0.2, 0.35].map((dx, i) => (
        <mesh key={`ra${i}`} position={[w / 2 - 0.4 + dx, wallH / 2, fz + 0.13]}>
          <boxGeometry args={[0.04, wallH - 0.2, 0.04]} />
          <meshStandardMaterial color="#6B4226" />
        </mesh>
      ))}

      {/* === LARGE GLASS STOREFRONT WINDOWS === */}
      {/* Left window */}
      <mesh position={[-w * 0.22, wallH * 0.45, fz + 0.06]}>
        <boxGeometry args={[w * 0.28, wallH * 0.6, 0.08]} />
        <meshStandardMaterial color="#5A7A8A" transparent opacity={0.5} metalness={0.2} roughness={0.1} />
      </mesh>
      {/* Center window */}
      <mesh position={[0, wallH * 0.45, fz + 0.06]}>
        <boxGeometry args={[w * 0.18, wallH * 0.6, 0.08]} />
        <meshStandardMaterial color="#5A7A8A" transparent opacity={0.5} metalness={0.2} roughness={0.1} />
      </mesh>
      {/* Right window */}
      <mesh position={[w * 0.22, wallH * 0.45, fz + 0.06]}>
        <boxGeometry args={[w * 0.28, wallH * 0.6, 0.08]} />
        <meshStandardMaterial color="#5A7A8A" transparent opacity={0.5} metalness={0.2} roughness={0.1} />
      </mesh>
      {/* Window frames - dark */}
      {[-w * 0.36, -w * 0.08, w * 0.08, w * 0.36].map((x, i) => (
        <mesh key={`wf${i}`} position={[x, wallH * 0.45, fz + 0.11]}>
          <boxGeometry args={[0.12, wallH * 0.62, 0.06]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      ))}
      {/* Window top frame */}
      <mesh position={[0, wallH * 0.77, fz + 0.11]}>
        <boxGeometry args={[w * 0.75, 0.1, 0.06]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      {/* Window bottom frame */}
      <mesh position={[0, brickH + 0.05, fz + 0.11]}>
        <boxGeometry args={[w * 0.75, 0.1, 0.06]} />
        <meshStandardMaterial color="#222222" />
      </mesh>

      {/* === GOLDEN AWNINGS above windows === */}
      <mesh position={[-w * 0.22, wallH * 0.8, fz + 0.3]}>
        <boxGeometry args={[w * 0.3, 0.08, 0.5]} />
        <meshStandardMaterial color="#FFC72C" />
      </mesh>
      <mesh position={[w * 0.22, wallH * 0.8, fz + 0.3]}>
        <boxGeometry args={[w * 0.3, 0.08, 0.5]} />
        <meshStandardMaterial color="#FFC72C" />
      </mesh>

      {/* === ENTRANCE DOOR === */}
      <mesh position={[0, 1.3, fz + 0.06]}>
        <boxGeometry args={[2.2, 2.6, 0.15]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[-0.5, 1.4, fz + 0.15]}>
        <boxGeometry args={[0.9, 2.2, 0.06]} />
        <meshStandardMaterial color="#5A7A8A" transparent opacity={0.5} />
      </mesh>
      <mesh position={[0.5, 1.4, fz + 0.15]}>
        <boxGeometry args={[0.9, 2.2, 0.06]} />
        <meshStandardMaterial color="#5A7A8A" transparent opacity={0.5} />
      </mesh>
      {/* Door handles */}
      <mesh position={[-0.12, 1.3, fz + 0.2]}>
        <boxGeometry args={[0.06, 0.5, 0.06]} />
        <meshStandardMaterial color="#888888" metalness={0.5} />
      </mesh>
      <mesh position={[0.12, 1.3, fz + 0.2]}>
        <boxGeometry args={[0.06, 0.5, 0.06]} />
        <meshStandardMaterial color="#888888" metalness={0.5} />
      </mesh>

      {/* === BIG GOLDEN ARCHES "M" — on top of building === */}
      {/* Legs start at roof top (4.35), arches curve above */}
      {/* Left arch curve (12 segments) */}
      {Array.from({length: 12}, (_, i) => {
        const a = -Math.PI / 2 + (i + 0.5) * Math.PI / 12
        return (
          <mesh key={`la${i}`} position={[
            -0.95 + 0.95 * Math.sin(a),
            5.55 + 0.95 * Math.cos(a),
            fz + 0.15
          ]} rotation={[0, 0, a + Math.PI / 2]}>
            <boxGeometry args={[0.35, 0.3, 0.15]} />
            <meshStandardMaterial color="#FFC72C" emissive="#FFC72C" emissiveIntensity={0.6} />
          </mesh>
        )
      })}
      {/* Right arch curve (12 segments) */}
      {Array.from({length: 12}, (_, i) => {
        const a = -Math.PI / 2 + (i + 0.5) * Math.PI / 12
        return (
          <mesh key={`ra${i}`} position={[
            0.95 + 0.95 * Math.sin(a),
            5.55 + 0.95 * Math.cos(a),
            fz + 0.15
          ]} rotation={[0, 0, a + Math.PI / 2]}>
            <boxGeometry args={[0.35, 0.3, 0.15]} />
            <meshStandardMaterial color="#FFC72C" emissive="#FFC72C" emissiveIntensity={0.6} />
          </mesh>
        )
      })}
      {/* M straight legs — from roof (4.35) up to arch bottom (5.55) */}
      {/* Far left leg */}
      <mesh position={[-1.9, 4.95, fz + 0.15]}>
        <boxGeometry args={[0.35, 1.2, 0.15]} />
        <meshStandardMaterial color="#FFC72C" emissive="#FFC72C" emissiveIntensity={0.6} />
      </mesh>
      {/* Center inner legs (shared) */}
      <mesh position={[0, 4.95, fz + 0.15]}>
        <boxGeometry args={[0.35, 1.2, 0.15]} />
        <meshStandardMaterial color="#FFC72C" emissive="#FFC72C" emissiveIntensity={0.6} />
      </mesh>
      {/* Far right leg */}
      <mesh position={[1.9, 4.95, fz + 0.15]}>
        <boxGeometry args={[0.35, 1.2, 0.15]} />
        <meshStandardMaterial color="#FFC72C" emissive="#FFC72C" emissiveIntensity={0.6} />
      </mesh>

      {/* === SIDE DETAILS === */}
      {/* Side windows - left */}
      <mesh position={[-w / 2 - 0.06, wallH * 0.45, bz + bd * 0.15]}>
        <boxGeometry args={[0.08, 1.5, 3]} />
        <meshStandardMaterial color="#5A7A8A" transparent opacity={0.45} />
      </mesh>
      {/* Side windows - right */}
      <mesh position={[w / 2 + 0.06, wallH * 0.45, bz + bd * 0.15]}>
        <boxGeometry args={[0.08, 1.5, 3]} />
        <meshStandardMaterial color="#5A7A8A" transparent opacity={0.45} />
      </mesh>
      {/* Drive-through window on left side */}
      <mesh position={[-w / 2 - 0.06, 1.5, bz - bd * 0.15]}>
        <boxGeometry args={[0.08, 1.0, 1.2]} />
        <meshStandardMaterial color="#5A7A8A" transparent opacity={0.45} />
      </mesh>
      {/* Drive-through awning */}
      <mesh position={[-w / 2 - 0.5, 2.2, bz - bd * 0.15]}>
        <boxGeometry args={[1, 0.08, 2]} />
        <meshStandardMaterial color="#FFC72C" />
      </mesh>

      {/* === ROOF DETAILS === */}
      <mesh position={[w * 0.2, wallH + 0.65, bz - bd * 0.2]}>
        <boxGeometry args={[2, 0.8, 1.5]} />
        <meshStandardMaterial color="#666666" metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  )
}

// Gas Station with canopy
function GasStation3D({ obj }) {
  const w = obj.width, l = obj.length
  // Layout: store at back, canopy + pumps in front
  const storeW = 16, storeD = 10, storeH = 4.5
  const storeZ = -l / 2 + storeD / 2 + 2  // near back edge
  const canopyW = 28, canopyD = 16, canopyH = 5
  const canopyZ = storeZ + storeD / 2 + canopyD / 2 + 3 // in front of store

  return (
    <group>
      {/* === CONCRETE FORECOURT === */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[w - 2, 0.1, l - 2]} />
        <meshStandardMaterial color="#B8B8B8" />
      </mesh>

      {/* === CONVENIENCE STORE BUILDING === */}
      {/* Brick base */}
      <mesh position={[0, 1.0, storeZ]}>
        <boxGeometry args={[storeW, 2.0, storeD]} />
        <meshStandardMaterial color="#8B4513" roughness={0.9} />
      </mesh>
      {/* Upper walls */}
      <mesh position={[0, storeH * 0.7, storeZ]}>
        <boxGeometry args={[storeW, storeH * 0.45, storeD]} />
        <meshStandardMaterial color="#E8E0D0" />
      </mesh>
      {/* Store roof */}
      <mesh position={[0, storeH + 0.1, storeZ]}>
        <boxGeometry args={[storeW + 0.8, 0.25, storeD + 0.8]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      {/* Store front windows */}
      {[-4, -1.5, 1.5, 4].map((dx, i) => (
        <mesh key={`sw${i}`} position={[dx, 2.2, storeZ + storeD / 2 + 0.06]}>
          <boxGeometry args={[2.2, 2.5, 0.08]} />
          <meshStandardMaterial color="#6A9AB8" transparent opacity={0.5} metalness={0.2} roughness={0.1} />
        </mesh>
      ))}
      {/* Window frames */}
      {[-5.1, -2.6, -0.4, 0.4, 2.6, 5.1].map((dx, i) => (
        <mesh key={`wf${i}`} position={[dx, 2.2, storeZ + storeD / 2 + 0.1]}>
          <boxGeometry args={[0.1, 2.6, 0.06]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}
      {/* Store entrance door */}
      <mesh position={[0, 1.4, storeZ + storeD / 2 + 0.06]}>
        <boxGeometry args={[2.0, 2.8, 0.12]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh position={[0, 1.5, storeZ + storeD / 2 + 0.14]}>
        <boxGeometry args={[1.6, 2.4, 0.06]} />
        <meshStandardMaterial color="#6A9AB8" transparent opacity={0.5} />
      </mesh>

      {/* === FUEL CANOPY === */}
      {/* Canopy roof */}
      <mesh position={[0, canopyH, canopyZ]}>
        <boxGeometry args={[canopyW, 0.4, canopyD]} />
        <meshStandardMaterial color="#E8E8E8" />
      </mesh>
      {/* Canopy edge fascia band */}
      <mesh position={[0, canopyH - 0.25, canopyZ]}>
        <boxGeometry args={[canopyW + 0.2, 0.15, canopyD + 0.2]} />
        <meshStandardMaterial color="#DD0000" />
      </mesh>
      {/* Canopy support columns (6 columns — 3 per side) */}
      {[-canopyW * 0.35, 0, canopyW * 0.35].map((dx, i) => (
        [-canopyD * 0.4, canopyD * 0.4].map((dz, j) => (
          <mesh key={`col${i}${j}`} position={[dx, canopyH / 2, canopyZ + dz]}>
            <boxGeometry args={[0.5, canopyH, 0.5]} />
            <meshStandardMaterial color="#AAAAAA" metalness={0.3} />
          </mesh>
        ))
      ))}

      {/* === FUEL PUMP ISLANDS (3 islands, 2 pumps each) === */}
      {[-canopyW * 0.3, 0, canopyW * 0.3].map((dx, i) => (
        <group key={`island${i}`}>
          {/* Island platform */}
          <mesh position={[dx, 0.12, canopyZ]}>
            <boxGeometry args={[1.8, 0.2, canopyD * 0.6]} />
            <meshStandardMaterial color="#D0D000" />
          </mesh>
          {/* Two pumps per island */}
          {[-canopyD * 0.15, canopyD * 0.15].map((dz, j) => (
            <group key={`pump${i}${j}`}>
              {/* Pump body */}
              <mesh position={[dx, 1.0, canopyZ + dz]}>
                <boxGeometry args={[0.8, 1.6, 0.5]} />
                <meshStandardMaterial color="#E0E0E0" />
              </mesh>
              {/* Pump screen */}
              <mesh position={[dx, 1.3, canopyZ + dz + 0.26]}>
                <boxGeometry args={[0.5, 0.35, 0.06]} />
                <meshStandardMaterial color="#111111" />
              </mesh>
              {/* Pump nozzle holder */}
              <mesh position={[dx + 0.35, 0.9, canopyZ + dz]}>
                <boxGeometry args={[0.15, 0.6, 0.12]} />
                <meshStandardMaterial color="#333333" />
              </mesh>
              <mesh position={[dx - 0.35, 0.9, canopyZ + dz]}>
                <boxGeometry args={[0.15, 0.6, 0.12]} />
                <meshStandardMaterial color="#333333" />
              </mesh>
              {/* Pump top */}
              <mesh position={[dx, 1.85, canopyZ + dz]}>
                <boxGeometry args={[0.85, 0.1, 0.55]} />
                <meshStandardMaterial color="#DD0000" />
              </mesh>
            </group>
          ))}
          {/* Bollards at island ends */}
          <mesh position={[dx, 0.4, canopyZ - canopyD * 0.28]}>
            <cylinderGeometry args={[0.15, 0.15, 0.7, 8]} />
            <meshStandardMaterial color="#FFD700" />
          </mesh>
          <mesh position={[dx, 0.4, canopyZ + canopyD * 0.28]}>
            <cylinderGeometry args={[0.15, 0.15, 0.7, 8]} />
            <meshStandardMaterial color="#FFD700" />
          </mesh>
        </group>
      ))}

      {/* === PRICE SIGN POLE === */}
      <mesh position={[w / 2 - 3, 4, l / 2 - 3]}>
        <cylinderGeometry args={[0.2, 0.2, 8, 8]} />
        <meshStandardMaterial color="#666666" metalness={0.4} />
      </mesh>
      {/* Price sign box */}
      <mesh position={[w / 2 - 3, 7.5, l / 2 - 3]}>
        <boxGeometry args={[3, 3.5, 0.5]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Sign brand strip */}
      <mesh position={[w / 2 - 3, 8.8, l / 2 - 2.73]}>
        <boxGeometry args={[2.8, 0.8, 0.08]} />
        <meshStandardMaterial color="#DD0000" />
      </mesh>
      {/* Price rows */}
      {[0, -0.7, -1.4].map((dy, i) => (
        <mesh key={`pr${i}`} position={[w / 2 - 3, 8.0 + dy, l / 2 - 2.73]}>
          <boxGeometry args={[2.5, 0.4, 0.08]} />
          <meshStandardMaterial color="#111111" />
        </mesh>
      ))}

      {/* === AIR/VACUUM STATION (side) === */}
      <mesh position={[-w / 2 + 3, 0.6, storeZ]}>
        <boxGeometry args={[1.2, 1.2, 0.8]} />
        <meshStandardMaterial color="#4488CC" />
      </mesh>
      <mesh position={[-w / 2 + 3, 1.3, storeZ]}>
        <boxGeometry args={[1.3, 0.15, 0.9]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* === DUMPSTER ENCLOSURE (back corner) === */}
      <mesh position={[w / 2 - 3, 1.0, -l / 2 + 2]}>
        <boxGeometry args={[3, 2, 2.5]} />
        <meshStandardMaterial color="#556B2F" />
      </mesh>
    </group>
  )
}

// Supermarket
function Supermarket3D({ obj }) {
  const w = obj.width, l = obj.length
  // Layout: building at back, parking in front
  const bldgW = w - 4, bldgD = l * 0.6, bldgH = 7
  const bldgZ = -l / 2 + bldgD / 2 + 2 // shifted to back
  const fz = bldgZ + bldgD / 2           // front face of building
  const parkZ = fz + (l / 2 - fz) / 2    // parking lot center

  return (
    <group>
      {/* === PARKING LOT === */}
      <mesh position={[0, 0.06, parkZ]}>
        <boxGeometry args={[w - 2, 0.1, l / 2 - fz - 1]} />
        <meshStandardMaterial color="#555555" />
      </mesh>
      {/* Parking lines (rows of white stripes) */}
      {[-2, 2].map((rowZ, ri) => (
        Array.from({length: 10}, (_, i) => (
          <mesh key={`pl${ri}${i}`} position={[-w * 0.4 + i * (w * 0.8 / 9), 0.12, parkZ + rowZ]}>
            <boxGeometry args={[0.12, 0.06, 2.5]} />
            <meshStandardMaterial color="#FFFFFF" />
          </mesh>
        ))
      ))}
      {/* Sidewalk in front of store */}
      <mesh position={[0, 0.08, fz + 1.5]}>
        <boxGeometry args={[bldgW + 2, 0.12, 3]} />
        <meshStandardMaterial color="#C0C0C0" />
      </mesh>

      {/* === MAIN BUILDING === */}
      {/* Full building body — cream upper color */}
      <mesh position={[0, bldgH / 2, bldgZ]}>
        <boxGeometry args={[bldgW, bldgH, bldgD]} />
        <meshStandardMaterial color="#E8E0D0" />
      </mesh>
      {/* Brick base wrap — slightly larger so it covers the lower portion */}
      <mesh position={[0, 1.5, bldgZ]}>
        <boxGeometry args={[bldgW + 0.1, 3.0, bldgD + 0.1]} />
        <meshStandardMaterial color="#C8B89A" roughness={0.85} />
      </mesh>
      {/* Roof */}
      <mesh position={[0, bldgH + 0.15, bldgZ]}>
        <boxGeometry args={[bldgW + 1, 0.3, bldgD + 1]} />
        <meshStandardMaterial color="#555555" />
      </mesh>

      {/* === FRONT FACADE DETAIL === */}
      {/* Green brand band across top of front */}
      <mesh position={[0, bldgH - 0.3, fz + 0.06]}>
        <boxGeometry args={[bldgW + 0.1, 1.0, 0.12]} />
        <meshStandardMaterial color="#2E8B57" />
      </mesh>
      {/* Signage panel on green band */}
      <mesh position={[0, bldgH - 0.3, fz + 0.14]}>
        <boxGeometry args={[12, 0.6, 0.08]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.2} />
      </mesh>

      {/* Large storefront windows */}
      {[-bldgW * 0.35, -bldgW * 0.15, bldgW * 0.15, bldgW * 0.35].map((dx, i) => (
        <mesh key={`win${i}`} position={[dx, 2.8, fz + 0.06]}>
          <boxGeometry args={[bldgW * 0.16, 3.5, 0.08]} />
          <meshStandardMaterial color="#6A9AB8" transparent opacity={0.45} metalness={0.2} roughness={0.1} />
        </mesh>
      ))}
      {/* Window mullions */}
      {[-bldgW * 0.43, -bldgW * 0.27, -bldgW * 0.07, bldgW * 0.07, bldgW * 0.27, bldgW * 0.43].map((dx, i) => (
        <mesh key={`mul${i}`} position={[dx, 2.8, fz + 0.11]}>
          <boxGeometry args={[0.15, 3.6, 0.06]} />
          <meshStandardMaterial color="#444444" />
        </mesh>
      ))}
      {/* Window bottom frame */}
      <mesh position={[0, 0.95, fz + 0.11]}>
        <boxGeometry args={[bldgW * 0.88, 0.12, 0.06]} />
        <meshStandardMaterial color="#444444" />
      </mesh>

      {/* === ENTRANCE AREA (center) === */}
      {/* Entrance recess */}
      <mesh position={[0, 2.2, fz + 0.3]}>
        <boxGeometry args={[6, 4.4, 0.6]} />
        <meshStandardMaterial color="#3A3A3A" />
      </mesh>
      {/* Entrance glass doors */}
      {[-1.2, 1.2].map((dx, i) => (
        <mesh key={`door${i}`} position={[dx, 1.8, fz + 0.65]}>
          <boxGeometry args={[2.0, 3.2, 0.06]} />
          <meshStandardMaterial color="#6A9AB8" transparent opacity={0.5} />
        </mesh>
      ))}
      {/* Entrance canopy */}
      <mesh position={[0, 4.5, fz + 2.5]}>
        <boxGeometry args={[10, 0.2, 5]} />
        <meshStandardMaterial color="#E8E8E8" />
      </mesh>
      {/* Canopy edge — green */}
      <mesh position={[0, 4.39, fz + 5]}>
        <boxGeometry args={[10, 0.1, 0.15]} />
        <meshStandardMaterial color="#2E8B57" />
      </mesh>
      {/* Canopy support columns */}
      {[-4.5, 4.5].map((dx, i) => (
        <mesh key={`ec${i}`} position={[dx, 2.3, fz + 4.5]}>
          <cylinderGeometry args={[0.15, 0.15, 4.4, 8]} />
          <meshStandardMaterial color="#888888" metalness={0.3} />
        </mesh>
      ))}

      {/* === CART CORRAL (near entrance) === */}
      {[-8, 8].map((dx, i) => (
        <group key={`corral${i}`}>
          <mesh position={[dx, 0.5, fz + 4]}>
            <boxGeometry args={[3, 1.0, 1.5]} />
            <meshStandardMaterial color="#888888" metalness={0.4} roughness={0.5} />
          </mesh>
        </group>
      ))}

      {/* === LOADING DOCK (back of building) === */}
      {/* Dock platform — pushed out from back wall */}
      <mesh position={[bldgW * 0.25, 0.6, bldgZ - bldgD / 2 - 1.5]}>
        <boxGeometry args={[12, 1.2, 3]} />
        <meshStandardMaterial color="#999999" />
      </mesh>
      {/* Dock bay doors — offset 0.15 from back wall face */}
      {[bldgW * 0.2, bldgW * 0.3].map((dx, i) => (
        <mesh key={`dock${i}`} position={[dx, 2.5, bldgZ - bldgD / 2 - 0.15]}>
          <boxGeometry args={[3.5, 3.8, 0.2]} />
          <meshStandardMaterial color="#777777" metalness={0.3} />
        </mesh>
      ))}

      {/* === ROOFTOP HVAC UNITS === */}
      {[-bldgW * 0.25, 0, bldgW * 0.25].map((dx, i) => (
        <mesh key={`hvac${i}`} position={[dx, bldgH + 0.7, bldgZ - bldgD * 0.15]}>
          <boxGeometry args={[2.5, 1.0, 2]} />
          <meshStandardMaterial color="#808080" metalness={0.3} roughness={0.6} />
        </mesh>
      ))}
    </group>
  )
}

// Starbucks coffee shop
function Starbucks3D({ obj }) {
  const w = obj.width, l = obj.length
  const wallH = 3.8
  const bd = l - 3          // building depth
  const bz = -1.5           // building center shifted back
  const fz = bz + bd / 2    // front face z
  const patioD = l / 2 - fz // patio area in front

  return (
    <group>
      {/* === PATIO AREA === */}
      <mesh position={[0, 0.06, fz + patioD / 2]}>
        <boxGeometry args={[w, 0.1, patioD]} />
        <meshStandardMaterial color="#B0A898" />
      </mesh>
      {/* Patio tables (2 small tables) */}
      {[-2.5, 2.5].map((dx, i) => (
        <group key={`pt${i}`}>
          {/* Table top */}
          <mesh position={[dx, 0.75, fz + patioD * 0.5]}>
            <cylinderGeometry args={[0.5, 0.5, 0.06, 12]} />
            <meshStandardMaterial color="#8B7355" />
          </mesh>
          {/* Table leg */}
          <mesh position={[dx, 0.38, fz + patioD * 0.5]}>
            <cylinderGeometry args={[0.06, 0.06, 0.7, 6]} />
            <meshStandardMaterial color="#555555" metalness={0.4} />
          </mesh>
          {/* Chairs */}
          {[-0.6, 0.6].map((cdz, ci) => (
            <mesh key={`ch${i}${ci}`} position={[dx, 0.4, fz + patioD * 0.5 + cdz]}>
              <boxGeometry args={[0.35, 0.8, 0.35]} />
              <meshStandardMaterial color="#666666" />
            </mesh>
          ))}
        </group>
      ))}

      {/* === MAIN BUILDING === */}
      {/* Building body — warm cream */}
      <mesh position={[0, wallH / 2, bz]}>
        <boxGeometry args={[w, wallH, bd]} />
        <meshStandardMaterial color="#E0D5C3" />
      </mesh>
      {/* Green accent band along top — sits just above cream body */}
      <mesh position={[0, wallH + 0.06, bz]}>
        <boxGeometry args={[w + 0.02, 0.1, bd + 0.02]} />
        <meshStandardMaterial color="#00704A" />
      </mesh>

      {/* Flat roof with slight overhang */}
      <mesh position={[0, wallH + 0.1, bz]}>
        <boxGeometry args={[w + 0.5, 0.2, bd + 0.5]} />
        <meshStandardMaterial color="#2A2A2A" />
      </mesh>

      {/* === WOOD ACCENT PANELS === */}
      {/* Warm wood vertical slat panel — left side of front */}
      <mesh position={[-w / 2 + 0.8, wallH / 2, fz + 0.06]}>
        <boxGeometry args={[1.5, wallH - 0.2, 0.1]} />
        <meshStandardMaterial color="#A0714F" roughness={0.8} />
      </mesh>
      {/* Wood slat lines */}
      {[-0.5, -0.25, 0, 0.25, 0.5].map((dx, i) => (
        <mesh key={`wsl${i}`} position={[-w / 2 + 0.8 + dx, wallH / 2, fz + 0.12]}>
          <boxGeometry args={[0.04, wallH - 0.4, 0.04]} />
          <meshStandardMaterial color="#7A5535" />
        </mesh>
      ))}
      {/* Wood panel — right side */}
      <mesh position={[w / 2 - 0.8, wallH / 2, fz + 0.06]}>
        <boxGeometry args={[1.5, wallH - 0.2, 0.1]} />
        <meshStandardMaterial color="#A0714F" roughness={0.8} />
      </mesh>
      {[-0.5, -0.25, 0, 0.25, 0.5].map((dx, i) => (
        <mesh key={`wsr${i}`} position={[w / 2 - 0.8 + dx, wallH / 2, fz + 0.12]}>
          <boxGeometry args={[0.04, wallH - 0.4, 0.04]} />
          <meshStandardMaterial color="#7A5535" />
        </mesh>
      ))}

      {/* === LARGE GLASS STOREFRONT === */}
      {/* Left glass section */}
      <mesh position={[-w * 0.17, wallH * 0.45, fz + 0.06]}>
        <boxGeometry args={[w * 0.3, wallH * 0.7, 0.08]} />
        <meshStandardMaterial color="#5A8070" transparent opacity={0.45} metalness={0.2} roughness={0.1} />
      </mesh>
      {/* Right glass section */}
      <mesh position={[w * 0.17, wallH * 0.45, fz + 0.06]}>
        <boxGeometry args={[w * 0.3, wallH * 0.7, 0.08]} />
        <meshStandardMaterial color="#5A8070" transparent opacity={0.45} metalness={0.2} roughness={0.1} />
      </mesh>
      {/* Window frames */}
      {[-w * 0.32, -w * 0.02, w * 0.02, w * 0.32].map((dx, i) => (
        <mesh key={`sf${i}`} position={[dx, wallH * 0.45, fz + 0.11]}>
          <boxGeometry args={[0.1, wallH * 0.72, 0.06]} />
          <meshStandardMaterial color="#222222" />
        </mesh>
      ))}
      {/* Top frame */}
      <mesh position={[0, wallH * 0.82, fz + 0.11]}>
        <boxGeometry args={[w * 0.65, 0.08, 0.06]} />
        <meshStandardMaterial color="#222222" />
      </mesh>

      {/* === ENTRANCE DOOR === */}
      <mesh position={[0, 1.4, fz + 0.06]}>
        <boxGeometry args={[1.8, 2.8, 0.12]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[0, 1.5, fz + 0.14]}>
        <boxGeometry args={[1.5, 2.4, 0.06]} />
        <meshStandardMaterial color="#5A8070" transparent opacity={0.5} />
      </mesh>
      {/* Door handle */}
      <mesh position={[0.55, 1.4, fz + 0.2]}>
        <boxGeometry args={[0.06, 0.4, 0.06]} />
        <meshStandardMaterial color="#888888" metalness={0.5} />
      </mesh>

      {/* === STARBUCKS CIRCULAR LOGO ON ROOF === */}
      {/* Pole mount */}
      <mesh position={[0, wallH + 0.7, fz - 0.5]}>
        <cylinderGeometry args={[0.06, 0.06, 1.2, 6]} />
        <meshStandardMaterial color="#555555" metalness={0.4} />
      </mesh>
      {/* Outer green circle — on roof, facing front */}
      <mesh position={[0, wallH + 1.3, fz - 0.5]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.9, 0.9, 0.1, 24]} />
        <meshStandardMaterial color="#00704A" emissive="#00704A" emissiveIntensity={0.4} />
      </mesh>
      {/* White ring */}
      <mesh position={[0, wallH + 1.3, fz - 0.44]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.72, 0.72, 0.06, 24]} />
        <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.2} />
      </mesh>
      {/* Inner green circle */}
      <mesh position={[0, wallH + 1.3, fz - 0.4]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.55, 0.55, 0.06, 24]} />
        <meshStandardMaterial color="#00704A" emissive="#00704A" emissiveIntensity={0.3} />
      </mesh>

      {/* === DRIVE-THROUGH SIDE === */}
      {/* Drive-through window — left side */}
      <mesh position={[-w / 2 - 0.06, 1.5, bz + bd * 0.1]}>
        <boxGeometry args={[0.08, 1.2, 1.5]} />
        <meshStandardMaterial color="#5A8070" transparent opacity={0.45} />
      </mesh>
      {/* Drive-through menu board */}
      <mesh position={[-w / 2 - 1.5, 1.5, bz - bd * 0.2]}>
        <boxGeometry args={[0.15, 2.0, 1.5]} />
        <meshStandardMaterial color="#00704A" />
      </mesh>
      <mesh position={[-w / 2 - 1.53, 1.6, bz - bd * 0.2]}>
        <boxGeometry args={[0.08, 1.5, 1.2]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Menu board pole */}
      <mesh position={[-w / 2 - 1.5, 0.3, bz - bd * 0.2]}>
        <cylinderGeometry args={[0.08, 0.08, 0.6, 6]} />
        <meshStandardMaterial color="#555555" metalness={0.3} />
      </mesh>
      {/* Drive-through awning */}
      <mesh position={[-w / 2 - 0.5, 2.3, bz + bd * 0.1]}>
        <boxGeometry args={[1.0, 0.08, 2.0]} />
        <meshStandardMaterial color="#00704A" />
      </mesh>

      {/* === SIDE WINDOWS === */}
      <mesh position={[w / 2 + 0.06, wallH * 0.45, bz + bd * 0.15]}>
        <boxGeometry args={[0.08, 1.8, 3]} />
        <meshStandardMaterial color="#5A8070" transparent opacity={0.4} />
      </mesh>

      {/* === ROOF DETAILS === */}
      <mesh position={[w * 0.2, wallH + 0.45, bz - bd * 0.2]}>
        <boxGeometry args={[1.2, 0.5, 0.8]} />
        <meshStandardMaterial color="#777777" metalness={0.3} roughness={0.6} />
      </mesh>
    </group>
  )
}

// Walmart Supercenter
function Walmart3D({ obj }) {
  const w = obj.width, l = obj.length
  const wallH = 7
  const bldgD = l * 0.6           // building depth ~78m
  const bldgZ = -l / 2 + l * 0.7  // building shifted back, front face ~+0.05*l
  const fz = bldgZ + bldgD / 2    // front face z
  const bk = bldgZ - bldgD / 2    // back face z
  const parkD = l / 2 - fz        // parking lot depth in front

  return (
    <group>
      {/* === PARKING LOT === */}
      <mesh position={[0, 0.04, fz + parkD / 2]}>
        <boxGeometry args={[w, 0.06, parkD]} />
        <meshStandardMaterial color="#3A3A3A" />
      </mesh>
      {/* Parking lines — rows */}
      {[-2, -1, 0, 1, 2].map((row, ri) => {
        const rz = fz + parkD * 0.2 + row * (parkD * 0.15)
        return Array.from({ length: 18 }, (_, si) => {
          const sx = -w * 0.42 + si * (w * 0.84 / 17)
          return (
            <mesh key={`pl${ri}${si}`} position={[sx, 0.08, rz]}>
              <boxGeometry args={[0.15, 0.02, 2.5]} />
              <meshStandardMaterial color="#CCCCCC" />
            </mesh>
          )
        })
      })}
      {/* Cart corrals */}
      {[-w * 0.2, w * 0.2].map((cx, i) => (
        <mesh key={`cc${i}`} position={[cx, 0.4, fz + parkD * 0.4]}>
          <boxGeometry args={[3, 0.8, 1.5]} />
          <meshStandardMaterial color="#888888" metalness={0.3} />
        </mesh>
      ))}
      {/* Light poles */}
      {[-w * 0.35, -w * 0.1, w * 0.1, w * 0.35].map((px, i) => (
        <group key={`lp${i}`}>
          <mesh position={[px, 4, fz + parkD * 0.5]}>
            <cylinderGeometry args={[0.12, 0.15, 8, 6]} />
            <meshStandardMaterial color="#777777" metalness={0.3} />
          </mesh>
          <mesh position={[px, 8.2, fz + parkD * 0.5]}>
            <boxGeometry args={[2, 0.3, 0.8]} />
            <meshStandardMaterial color="#AAAAAA" />
          </mesh>
        </group>
      ))}

      {/* === MAIN BUILDING BODY === */}
      {/* Cream/beige walls */}
      <mesh position={[0, wallH / 2, bldgZ]}>
        <boxGeometry args={[w, wallH, bldgD]} />
        <meshStandardMaterial color="#E8E0D0" />
      </mesh>
      {/* Brown brick wainscot — lower 2m accent wrap */}
      <mesh position={[0, 1, bldgZ]}>
        <boxGeometry args={[w + 0.04, 2, bldgD + 0.04]} />
        <meshStandardMaterial color="#8B7355" roughness={0.9} />
      </mesh>

      {/* === BLUE SIGN BAND (parapet) === */}
      <mesh position={[0, wallH + 0.4, bldgZ]}>
        <boxGeometry args={[w + 0.5, 0.8, bldgD + 0.5]} />
        <meshStandardMaterial color="#0071CE" />
      </mesh>
      {/* Flat roof */}
      <mesh position={[0, wallH + 0.85, bldgZ]}>
        <boxGeometry args={[w + 0.3, 0.1, bldgD + 0.3]} />
        <meshStandardMaterial color="#555555" />
      </mesh>

      {/* === WALMART TEXT ON FRONT SIGN BAND === */}
      {/* White letter blocks spelling W-A-L-M-A-R-T */}
      {['W','A','L','M','A','R','T'].map((ch, i) => (
        <mesh key={`wt${i}`} position={[-9 + i * 3, wallH + 0.4, fz + 0.3]}>
          <boxGeometry args={[2, 0.5, 0.12]} />
          <meshStandardMaterial color="#FFFFFF" emissive="#FFFFFF" emissiveIntensity={0.3} />
        </mesh>
      ))}

      {/* === SPARK LOGO — rooftop sign === */}
      {/* Pole mount */}
      <mesh position={[15, wallH + 1.5, fz - 2]}>
        <cylinderGeometry args={[0.15, 0.15, 2.2, 6]} />
        <meshStandardMaterial color="#555555" metalness={0.4} />
      </mesh>
      {/* Spark — 3 rotated boxes forming 6-point starburst */}
      {[0, Math.PI / 3, -Math.PI / 3].map((rot, i) => (
        <mesh key={`sp${i}`} position={[15, wallH + 2.8, fz - 2]} rotation={[0, 0, rot]}>
          <boxGeometry args={[0.6, 2.8, 0.15]} />
          <meshStandardMaterial color="#FFC220" emissive="#FFC220" emissiveIntensity={0.5} />
        </mesh>
      ))}

      {/* === ENTRANCE VESTIBULE — center === */}
      {/* Vestibule structure */}
      <mesh position={[0, wallH * 0.55, fz + 3]}>
        <boxGeometry args={[20, wallH * 0.9, 6]} />
        <meshStandardMaterial color="#E8E0D0" />
      </mesh>
      {/* Vestibule glass front */}
      <mesh position={[0, wallH * 0.45, fz + 6.06]}>
        <boxGeometry args={[18, wallH * 0.7, 0.12]} />
        <meshStandardMaterial color="#6BA4C9" transparent opacity={0.4} metalness={0.2} roughness={0.1} />
      </mesh>
      {/* Vestibule glass frames */}
      {[-9, -4.5, 0, 4.5, 9].map((dx, i) => (
        <mesh key={`vf${i}`} position={[dx, wallH * 0.45, fz + 6.12]}>
          <boxGeometry args={[0.15, wallH * 0.72, 0.08]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}
      {/* Vestibule canopy */}
      <mesh position={[0, wallH * 0.92, fz + 4.5]}>
        <boxGeometry args={[22, 0.2, 9]} />
        <meshStandardMaterial color="#DDDDDD" />
      </mesh>
      {/* Canopy blue edge trim */}
      <mesh position={[0, wallH * 0.92, fz + 9.05]}>
        <boxGeometry args={[22, 0.25, 0.1]} />
        <meshStandardMaterial color="#0071CE" />
      </mesh>
      {/* Canopy support columns */}
      {[-9, -4.5, 4.5, 9].map((dx, i) => (
        <mesh key={`cc${i}`} position={[dx, wallH * 0.45, fz + 8.5]}>
          <boxGeometry args={[0.4, wallH * 0.9, 0.4]} />
          <meshStandardMaterial color="#CCCCCC" metalness={0.2} />
        </mesh>
      ))}
      {/* Entrance doors */}
      {[-3, 3].map((dx, i) => (
        <group key={`ed${i}`}>
          <mesh position={[dx, 1.5, fz + 6.08]}>
            <boxGeometry args={[2.5, 3, 0.15]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          <mesh position={[dx, 1.6, fz + 6.16]}>
            <boxGeometry args={[2.2, 2.5, 0.08]} />
            <meshStandardMaterial color="#6BA4C9" transparent opacity={0.45} />
          </mesh>
        </group>
      ))}

      {/* === GARDEN CENTER — right side === */}
      {/* Open-air fenced area */}
      <mesh position={[w / 2 - 8, 0.06, fz + 4]}>
        <boxGeometry args={[16, 0.1, 8]} />
        <meshStandardMaterial color="#7A9A6A" />
      </mesh>
      {/* Garden center fence — front */}
      <mesh position={[w / 2 - 8, 1.2, fz + 8.06]}>
        <boxGeometry args={[16, 2.4, 0.12]} />
        <meshStandardMaterial color="#AAAAAA" transparent opacity={0.3} metalness={0.3} />
      </mesh>
      {/* Fence — side */}
      <mesh position={[w / 2 - 0.06, 1.2, fz + 4]}>
        <boxGeometry args={[0.12, 2.4, 8]} />
        <meshStandardMaterial color="#AAAAAA" transparent opacity={0.3} metalness={0.3} />
      </mesh>

      {/* === LARGE GLASS STOREFRONT (front wall) === */}
      {/* Glass sections flanking entrance */}
      {[-1, 1].map((side, si) => (
        <mesh key={`gf${si}`} position={[side * 22, wallH * 0.42, fz + 0.07]}>
          <boxGeometry args={[18, wallH * 0.6, 0.12]} />
          <meshStandardMaterial color="#6BA4C9" transparent opacity={0.35} metalness={0.2} roughness={0.1} />
        </mesh>
      ))}
      {/* Window mullions */}
      {[-34, -28, -22, -16, 16, 22, 28, 34].map((dx, i) => (
        <mesh key={`wm${i}`} position={[dx, wallH * 0.42, fz + 0.14]}>
          <boxGeometry args={[0.15, wallH * 0.62, 0.08]} />
          <meshStandardMaterial color="#555555" />
        </mesh>
      ))}

      {/* === SIDE DETAILS === */}
      {/* Side windows — left */}
      {[-2, -1, 0, 1, 2].map((row, i) => (
        <mesh key={`sw${i}`} position={[-w / 2 - 0.07, wallH * 0.5, bldgZ + row * 12]}>
          <boxGeometry args={[0.12, 2, 5]} />
          <meshStandardMaterial color="#6BA4C9" transparent opacity={0.3} />
        </mesh>
      ))}

      {/* === LOADING DOCKS — back === */}
      {[-w * 0.3, -w * 0.1, w * 0.1, w * 0.3].map((dx, i) => (
        <group key={`ld${i}`}>
          {/* Dock door recess */}
          <mesh position={[dx, 2.2, bk - 0.15]}>
            <boxGeometry args={[4, 4.4, 0.2]} />
            <meshStandardMaterial color="#444444" />
          </mesh>
          {/* Dock bumpers */}
          <mesh position={[dx - 1.5, 1.5, bk - 0.3]}>
            <boxGeometry args={[0.3, 0.6, 0.2]} />
            <meshStandardMaterial color="#222222" />
          </mesh>
          <mesh position={[dx + 1.5, 1.5, bk - 0.3]}>
            <boxGeometry args={[0.3, 0.6, 0.2]} />
            <meshStandardMaterial color="#222222" />
          </mesh>
        </group>
      ))}
      {/* Loading dock platform */}
      <mesh position={[0, 0.6, bk - 0.8]}>
        <boxGeometry args={[w * 0.8, 1.2, 1.4]} />
        <meshStandardMaterial color="#777777" />
      </mesh>

      {/* === ROOF DETAILS === */}
      {/* HVAC units */}
      {[[-w * 0.25, bldgZ - 10], [w * 0.15, bldgZ + 5], [-w * 0.05, bldgZ - 5], [w * 0.3, bldgZ - 15]].map(([rx, rz], i) => (
        <mesh key={`hv${i}`} position={[rx, wallH + 1.3, rz]}>
          <boxGeometry args={[3, 1.5, 2.5]} />
          <meshStandardMaterial color="#888888" metalness={0.3} roughness={0.6} />
        </mesh>
      ))}

      {/* === SIDEWALK around building === */}
      <mesh position={[0, 0.08, fz + 1]}>
        <boxGeometry args={[w + 4, 0.04, 2]} />
        <meshStandardMaterial color="#C0B8A8" />
      </mesh>
    </group>
  )
}

// Gaming buildings — Pokémon Center (Gen 4 Sinnoh style)
function PokemonCenter3D({ obj }) {
  const w = obj.width, l = obj.length
  const wallH = 5
  const roofH = 1.2
  const fz = l / 2

  return (
    <group>
      {/* === GROUND — paved area === */}
      <mesh position={[0, 0.05, 0]} rotation={[-Math.PI / 2, 0, 0]}>
        <planeGeometry args={[w + 5, l + 5]} />
        <meshStandardMaterial color="#808880" />
      </mesh>

      {/* === MAIN WALLS — white/light gray === */}
      <mesh position={[0, wallH / 2, 0]}>
        <boxGeometry args={[w, wallH, l]} />
        <meshStandardMaterial color="#E8E8E8" />
      </mesh>
      {/* Gray base strip */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[w + 0.06, 0.6, l + 0.06]} />
        <meshStandardMaterial color="#A8A8A8" />
      </mesh>

      {/* === ORANGE ROOF — flat with overhang === */}
      <mesh position={[0, wallH + roofH / 2, 0]}>
        <boxGeometry args={[w + 1.5, roofH, l + 1.5]} />
        <meshStandardMaterial color="#E07030" />
      </mesh>
      {/* White trim on left and right roof edges */}
      <mesh position={[-(w / 2 + 0.75), wallH + roofH / 2, 0]}>
        <boxGeometry args={[0.5, roofH + 0.06, l + 1.6]} />
        <meshStandardMaterial color="#F5F5F0" />
      </mesh>
      <mesh position={[(w / 2 + 0.75), wallH + roofH / 2, 0]}>
        <boxGeometry args={[0.5, roofH + 0.06, l + 1.6]} />
        <meshStandardMaterial color="#F5F5F0" />
      </mesh>

      {/* === ENTRANCE CANOPY — small awning over the door === */}
      <mesh position={[0, wallH * 0.7, fz + 1.8]}>
        <boxGeometry args={[6, 0.25, 3.2]} />
        <meshStandardMaterial color="#E07030" />
      </mesh>
      {/* Canopy white trim */}
      <mesh position={[0, wallH * 0.7 - 0.08, fz + 3.35]}>
        <boxGeometry args={[6.2, 0.1, 0.15]} />
        <meshStandardMaterial color="#F5F5F0" />
      </mesh>

      {/* === POKÉBALL — on front face of the roof === */}
      {/* White disc background */}
      <mesh position={[0, wallH + roofH / 2, fz + 0.76]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.5, 2.5, 0.12, 32]} />
        <meshStandardMaterial color="#F0F0F0" />
      </mesh>
      {/* Red top half */}
      <mesh position={[0, wallH + roofH / 2, fz + 0.83]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.06, 32, 1, false, Math.PI * 0.5, Math.PI]} />
        <meshStandardMaterial color="#CC2222" />
      </mesh>
      {/* White bottom half */}
      <mesh position={[0, wallH + roofH / 2, fz + 0.83]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[2.2, 2.2, 0.06, 32, 1, false, Math.PI * 1.5, Math.PI]} />
        <meshStandardMaterial color="#F0F0F0" />
      </mesh>
      {/* Black horizontal band */}
      <mesh position={[0, wallH + roofH / 2, fz + 0.86]}>
        <boxGeometry args={[5, 0.28, 0.04]} />
        <meshStandardMaterial color="#222" />
      </mesh>
      {/* Center button */}
      <mesh position={[0, wallH + roofH / 2, fz + 0.88]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.6, 0.6, 0.06, 20]} />
        <meshStandardMaterial color="#F8F8F8" />
      </mesh>
      {/* Button center dot */}
      <mesh position={[0, wallH + roofH / 2, fz + 0.91]} rotation={[Math.PI / 2, 0, 0]}>
        <cylinderGeometry args={[0.25, 0.25, 0.04, 16]} />
        <meshStandardMaterial color="#333" />
      </mesh>

      {/* === AUTOMATIC SLIDING DOORS — center front === */}
      <mesh position={[0, 1.5, fz + 0.06]}>
        <boxGeometry args={[3.4, 3, 0.1]} />
        <meshStandardMaterial color="#404040" />
      </mesh>
      <mesh position={[-0.75, 1.5, fz + 0.12]}>
        <boxGeometry args={[1.3, 2.7, 0.04]} />
        <meshStandardMaterial color="#6CB4D8" transparent opacity={0.55} metalness={0.2} roughness={0.1} />
      </mesh>
      <mesh position={[0.75, 1.5, fz + 0.12]}>
        <boxGeometry args={[1.3, 2.7, 0.04]} />
        <meshStandardMaterial color="#6CB4D8" transparent opacity={0.55} metalness={0.2} roughness={0.1} />
      </mesh>

      {/* === FRONT WINDOWS — flanking door, ground floor === */}
      {[-1, 1].map((side) => (
        <group key={`fw${side}`}>
          <mesh position={[side * w * 0.34, 2, fz + 0.06]}>
            <boxGeometry args={[3.2, 2.2, 0.08]} />
            <meshStandardMaterial color="#6CB4D8" transparent opacity={0.45} metalness={0.15} roughness={0.1} />
          </mesh>
          {/* Frame */}
          <mesh position={[side * w * 0.34, 2, fz + 0.11]}>
            <boxGeometry args={[3.4, 0.12, 0.04]} />
            <meshStandardMaterial color="#505050" />
          </mesh>
          {[-1, 0, 1].map((d) => (
            <mesh key={d} position={[side * w * 0.34 + d * 1.1, 2, fz + 0.11]}>
              <boxGeometry args={[0.08, 2.3, 0.04]} />
              <meshStandardMaterial color="#505050" />
            </mesh>
          ))}
        </group>
      ))}

      {/* === SECOND FLOOR WINDOWS — smaller, evenly spaced === */}
      {[-w * 0.34, -w * 0.12, w * 0.12, w * 0.34].map((wx, i) => (
        <mesh key={`2f${i}`} position={[wx, wallH * 0.8, fz + 0.06]}>
          <boxGeometry args={[1.8, 1.2, 0.08]} />
          <meshStandardMaterial color="#6CB4D8" transparent opacity={0.4} />
        </mesh>
      ))}

      {/* === SIDE WINDOWS === */}
      {[-1, 1].map((side) => (
        <group key={`sd${side}`}>
          {[-l * 0.3, 0, l * 0.3].map((sz, si) => (
            <mesh key={si} position={[side * (w / 2 + 0.06), wallH * 0.45, sz]}>
              <boxGeometry args={[0.08, 1.8, 2.2]} />
              <meshStandardMaterial color="#6CB4D8" transparent opacity={0.35} />
            </mesh>
          ))}
        </group>
      ))}
    </group>
  )
}

function MinecraftHouse3D({ obj }) {
  const w = obj.width   // 7
  const l = obj.length  // 7
  const wallH = 4       // wall height in blocks/meters
  const fz = l / 2      // front z

  // Colors - authentic Minecraft palette
  const oakLog = '#6B5130'
  const oakPlank = '#BC9036'
  const cobble = '#7A7A7A'
  const cobbleDark = '#636363'
  const darkOak = '#3E2912'
  const glass = '#A8D8EA'
  const glassBorder = '#5C4033'
  const doorColor = '#5C3A1E'
  const dirt = '#6B4226'
  const grass = '#5B8C32'

  return (
    <group>
      {/* Grass ground - slightly below foundation to avoid z-fighting */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[w + 4, l + 4]} />
        <meshStandardMaterial color={grass} />
      </mesh>

      {/* Cobblestone foundation - 1 block tall */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[w, 1, l]} />
        <meshStandardMaterial color={cobble} />
      </mesh>

      {/* Oak plank walls - front */}
      <mesh position={[0, 1 + wallH / 2, fz - 0.5]}>
        <boxGeometry args={[w - 2, wallH, 1]} />
        <meshStandardMaterial color={oakPlank} />
      </mesh>
      {/* Oak plank walls - back */}
      <mesh position={[0, 1 + wallH / 2, -fz + 0.5]}>
        <boxGeometry args={[w - 2, wallH, 1]} />
        <meshStandardMaterial color={oakPlank} />
      </mesh>
      {/* Oak plank walls - left */}
      <mesh position={[-w / 2 + 0.5, 1 + wallH / 2, 0]}>
        <boxGeometry args={[1, wallH, l - 2]} />
        <meshStandardMaterial color={oakPlank} />
      </mesh>
      {/* Oak plank walls - right */}
      <mesh position={[w / 2 - 0.5, 1 + wallH / 2, 0]}>
        <boxGeometry args={[1, wallH, l - 2]} />
        <meshStandardMaterial color={oakPlank} />
      </mesh>

      {/* Oak log pillars at 4 corners */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={`pillar-${i}`} position={[sx * (w / 2 - 0.5), 1 + wallH / 2, sz * (l / 2 - 0.5)]}>
          <boxGeometry args={[1, wallH, 1]} />
          <meshStandardMaterial color={oakLog} />
        </mesh>
      ))}

      {/* Stepped roof - dark oak, 4 layers */}
      {[0, 1, 2, 3].map(i => (
        <mesh key={`roof-${i}`} position={[0, wallH + 1 + i, 0]}>
          <boxGeometry args={[w + 2 - i * 2, 1, l + 2 - i * 2]} />
          <meshStandardMaterial color={i < 2 ? darkOak : oakLog} />
        </mesh>
      ))}

      {/* Roof ridge cap */}
      <mesh position={[0, wallH + 5, 0]}>
        <boxGeometry args={[1, 0.5, l]} />
        <meshStandardMaterial color={darkOak} />
      </mesh>

      {/* Front door - 1 wide, 2 tall */}
      <mesh position={[0, 2, fz - 0.4]}>
        <boxGeometry args={[1, 2, 0.3]} />
        <meshStandardMaterial color={doorColor} />
      </mesh>
      {/* Door handle */}
      <mesh position={[0.3, 2, fz - 0.2]}>
        <boxGeometry args={[0.15, 0.15, 0.15]} />
        <meshStandardMaterial color="#888" metalness={0.8} />
      </mesh>

      {/* Front windows - 2 panes, left and right of door */}
      {[-2, 2].map((xOff, i) => (
        <group key={`fwin-${i}`}>
          <mesh position={[xOff, 3, fz - 0.4]}>
            <boxGeometry args={[1, 1, 0.2]} />
            <meshStandardMaterial color={glass} transparent opacity={0.6} />
          </mesh>
          <mesh position={[xOff, 3, fz - 0.3]}>
            <boxGeometry args={[1.2, 1.2, 0.1]} />
            <meshStandardMaterial color={glassBorder} />
          </mesh>
        </group>
      ))}

      {/* Side windows - left wall */}
      {[-1.5, 1.5].map((zOff, i) => (
        <group key={`lwin-${i}`}>
          <mesh position={[-w / 2 + 0.4, 3, zOff]}>
            <boxGeometry args={[0.2, 1, 1]} />
            <meshStandardMaterial color={glass} transparent opacity={0.6} />
          </mesh>
          <mesh position={[-w / 2 + 0.3, 3, zOff]}>
            <boxGeometry args={[0.1, 1.2, 1.2]} />
            <meshStandardMaterial color={glassBorder} />
          </mesh>
        </group>
      ))}

      {/* Side windows - right wall */}
      {[-1.5, 1.5].map((zOff, i) => (
        <group key={`rwin-${i}`}>
          <mesh position={[w / 2 - 0.4, 3, zOff]}>
            <boxGeometry args={[0.2, 1, 1]} />
            <meshStandardMaterial color={glass} transparent opacity={0.6} />
          </mesh>
          <mesh position={[w / 2 - 0.3, 3, zOff]}>
            <boxGeometry args={[0.1, 1.2, 1.2]} />
            <meshStandardMaterial color={glassBorder} />
          </mesh>
        </group>
      ))}

      {/* Torches - front wall, flanking door */}
      {[-1.2, 1.2].map((xOff, i) => (
        <group key={`torch-${i}`}>
          {/* Torch stick */}
          <mesh position={[xOff, 3.2, fz + 0.1]}>
            <boxGeometry args={[0.15, 0.6, 0.15]} />
            <meshStandardMaterial color={oakLog} />
          </mesh>
          {/* Flame */}
          <mesh position={[xOff, 3.6, fz + 0.1]}>
            <boxGeometry args={[0.2, 0.25, 0.2]} />
            <meshStandardMaterial color="#FFAA00" emissive="#FF8800" emissiveIntensity={1.5} />
          </mesh>
        </group>
      ))}

      {/* Chimney - back right corner */}
      <mesh position={[w / 2 - 1, wallH + 3.5, -l / 2 + 1]}>
        <boxGeometry args={[1, 3, 1]} />
        <meshStandardMaterial color={cobbleDark} />
      </mesh>

      {/* Floor - oak planks inside */}
      <mesh position={[0, 1.01, 0]}>
        <boxGeometry args={[w - 2, 0.02, l - 2]} />
        <meshStandardMaterial color={oakPlank} />
      </mesh>
    </group>
  )
}

function ACHouse3D({ obj }) {
  const w = obj.width   // 5
  const l = obj.length  // 4
  const wallH = 2.5
  const fz = l / 2

  // ACNH palette - soft, pastel, toylike
  const wallColor = '#F5E6D0'    // cream/beige plaster
  const roofColor = '#C0392B'    // classic red tile roof
  const roofEdge = '#A93226'     // darker roof trim
  const doorWood = '#A0724A'     // warm wood door
  const doorArch = '#8B5E3C'     // arch trim
  const windowGlass = '#B5D8F0'  // soft blue glass
  const windowFrame = '#F0E0CC'  // cream frame
  const stoneStep = '#C8BEB4'    // light stone
  const chimney = '#B0A090'      // warm gray stone
  const grassColor = '#7EC850'   // AC green
  const mailboxWood = '#8B6F50'  // rustic wood
  const mailboxFlag = '#4A90D9'  // blue flag

  return (
    <group>
      {/* Grass patch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[w + 3, l + 3]} />
        <meshStandardMaterial color={grassColor} />
      </mesh>

      {/* Stone foundation / porch step */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[w + 0.3, 0.3, l + 0.3]} />
        <meshStandardMaterial color={stoneStep} />
      </mesh>
      {/* Front porch step */}
      <mesh position={[0, 0.1, fz + 0.3]}>
        <boxGeometry args={[w * 0.6, 0.2, 0.6]} />
        <meshStandardMaterial color={stoneStep} />
      </mesh>

      {/* Main walls - cream plaster */}
      <mesh position={[0, 0.3 + wallH / 2, 0]}>
        <boxGeometry args={[w, wallH, l]} />
        <meshStandardMaterial color={wallColor} />
      </mesh>

      {/* Gable roof - steeply pitched, oversized (AC signature) */}
      {/* Left slope */}
      <mesh position={[-w * 0.28, wallH + 0.3 + 1.0, 0]} rotation={[0, 0, Math.PI * 0.22]}>
        <boxGeometry args={[w * 0.65, 0.25, l + 0.6]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Right slope */}
      <mesh position={[w * 0.28, wallH + 0.3 + 1.0, 0]} rotation={[0, 0, -Math.PI * 0.22]}>
        <boxGeometry args={[w * 0.65, 0.25, l + 0.6]} />
        <meshStandardMaterial color={roofColor} />
      </mesh>
      {/* Ridge cap */}
      <mesh position={[0, wallH + 0.3 + 1.65, 0]}>
        <boxGeometry args={[0.3, 0.2, l + 0.8]} />
        <meshStandardMaterial color={roofEdge} />
      </mesh>
      {/* Roof fill layers - stacked to fill the gable */}
      {[0.3, 0.6, 0.9, 1.2].map((yOff, i) => (
        <mesh key={`rfill-${i}`} position={[0, wallH + 0.3 + yOff, 0]}>
          <boxGeometry args={[w * (1 - i * 0.2) + 0.4, 0.32, l + 0.5]} />
          <meshStandardMaterial color={i % 2 === 0 ? roofColor : roofEdge} />
        </mesh>
      ))}

      {/* Front door - rounded top (AC signature) */}
      {/* Door body */}
      <mesh position={[0, 0.3 + wallH * 0.35, fz + 0.02]}>
        <boxGeometry args={[1, wallH * 0.65, 0.15]} />
        <meshStandardMaterial color={doorWood} />
      </mesh>
      {/* Rounded top - sphere slice peeking above door */}
      <mesh position={[0, 0.3 + wallH * 0.68, fz + 0.02]}>
        <sphereGeometry args={[0.5, 16, 8, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color={doorWood} />
      </mesh>
      {/* Door window pane */}
      <mesh position={[0, 0.3 + wallH * 0.55, fz + 0.08]}>
        <boxGeometry args={[0.5, 0.4, 0.05]} />
        <meshStandardMaterial color={windowGlass} transparent opacity={0.7} />
      </mesh>
      {/* Door knob */}
      <mesh position={[0.3, 0.3 + wallH * 0.35, fz + 0.1]}>
        <sphereGeometry args={[0.07, 8, 8]} />
        <meshStandardMaterial color="#D4A843" metalness={0.7} roughness={0.3} />
      </mesh>

      {/* Front windows - divided pane style */}
      {[-1.4, 1.4].map((xOff, i) => (
        <group key={`fwin-${i}`}>
          {/* Window frame */}
          <mesh position={[xOff, 0.3 + wallH * 0.55, fz + 0.02]}>
            <boxGeometry args={[0.9, 0.9, 0.12]} />
            <meshStandardMaterial color={windowFrame} />
          </mesh>
          {/* Glass panes - 2x2 grid */}
          {[[-0.15, 0.15], [-0.15, -0.15], [0.15, 0.15], [0.15, -0.15]].map(([dx, dy], j) => (
            <mesh key={`pane-${i}-${j}`} position={[xOff + dx, 0.3 + wallH * 0.55 + dy, fz + 0.06]}>
              <boxGeometry args={[0.25, 0.25, 0.05]} />
              <meshStandardMaterial color={windowGlass} transparent opacity={0.6} />
            </mesh>
          ))}
        </group>
      ))}

      {/* Side windows - left */}
      <group>
        <mesh position={[-w / 2 - 0.02, 0.3 + wallH * 0.55, 0]}>
          <boxGeometry args={[0.12, 0.8, 0.8]} />
          <meshStandardMaterial color={windowFrame} />
        </mesh>
        {[[-0.15, 0.15], [-0.15, -0.15], [0.15, 0.15], [0.15, -0.15]].map(([dz, dy], j) => (
          <mesh key={`lp-${j}`} position={[-w / 2 - 0.06, 0.3 + wallH * 0.55 + dy, dz]}>
            <boxGeometry args={[0.05, 0.25, 0.25]} />
            <meshStandardMaterial color={windowGlass} transparent opacity={0.6} />
          </mesh>
        ))}
      </group>
      {/* Side windows - right */}
      <group>
        <mesh position={[w / 2 + 0.02, 0.3 + wallH * 0.55, 0]}>
          <boxGeometry args={[0.12, 0.8, 0.8]} />
          <meshStandardMaterial color={windowFrame} />
        </mesh>
        {[[-0.15, 0.15], [-0.15, -0.15], [0.15, 0.15], [0.15, -0.15]].map(([dz, dy], j) => (
          <mesh key={`rp-${j}`} position={[w / 2 + 0.06, 0.3 + wallH * 0.55 + dy, dz]}>
            <boxGeometry args={[0.05, 0.25, 0.25]} />
            <meshStandardMaterial color={windowGlass} transparent opacity={0.6} />
          </mesh>
        ))}
      </group>

      {/* Chimney - warm gray stone */}
      <mesh position={[w * 0.3, wallH + 1.8, -l * 0.2]}>
        <boxGeometry args={[0.5, 1.2, 0.5]} />
        <meshStandardMaterial color={chimney} />
      </mesh>
      {/* Chimney top cap */}
      <mesh position={[w * 0.3, wallH + 2.45, -l * 0.2]}>
        <boxGeometry args={[0.6, 0.1, 0.6]} />
        <meshStandardMaterial color="#9A8A7A" />
      </mesh>

      {/* Mailbox - right side of door */}
      <group position={[w * 0.45, 0, fz + 0.8]}>
        {/* Post */}
        <mesh position={[0, 0.5, 0]}>
          <boxGeometry args={[0.12, 1, 0.12]} />
          <meshStandardMaterial color={mailboxWood} />
        </mesh>
        {/* Box */}
        <mesh position={[0, 1, 0]}>
          <boxGeometry args={[0.35, 0.25, 0.2]} />
          <meshStandardMaterial color={mailboxWood} />
        </mesh>
        {/* Blue flag */}
        <mesh position={[0.2, 1.2, 0]}>
          <boxGeometry args={[0.05, 0.3, 0.15]} />
          <meshStandardMaterial color={mailboxFlag} />
        </mesh>
      </group>
    </group>
  )
}

function Fortnite1x13D({ obj }) {
  const w = obj.width   // 5
  const l = obj.length  // 5
  const wallH = 3.84
  const thick = 0.24

  // Fortnite wood palette
  const plank = '#C4973B'       // golden-brown planks
  const plankDark = '#A07830'   // darker plank variation
  const stud = '#8B6528'        // vertical studs / cross-braces
  const rampColor = '#B8882E'   // ramp surface
  const frame = '#6B4E20'       // outer frame edges

  // Helper: build a wood wall panel at given position/rotation
  // Shows horizontal planks, vertical studs, diagonal X braces on OUTSIDE
  const d = -(thick / 2 + 0.01) // detail offset — negative Z = outward face
  const WoodWall = ({ position, rotation }) => (
    <group position={position} rotation={rotation || [0, 0, 0]}>
      {/* Main plank face */}
      <mesh>
        <boxGeometry args={[w, wallH, thick]} />
        <meshStandardMaterial color={plank} />
      </mesh>
      {/* Outer frame - top & bottom rails */}
      <mesh position={[0, wallH / 2 - 0.06, d]}>
        <boxGeometry args={[w, 0.12, 0.02]} />
        <meshStandardMaterial color={frame} />
      </mesh>
      <mesh position={[0, -wallH / 2 + 0.06, d]}>
        <boxGeometry args={[w, 0.12, 0.02]} />
        <meshStandardMaterial color={frame} />
      </mesh>
      {/* Vertical studs - edges and center */}
      {[-w / 2 + 0.06, 0, w / 2 - 0.06].map((x, i) => (
        <mesh key={`stud-${i}`} position={[x, 0, d]}>
          <boxGeometry args={[0.12, wallH, 0.02]} />
          <meshStandardMaterial color={stud} />
        </mesh>
      ))}
      {/* Horizontal plank lines - 3 rows visible */}
      {[-wallH / 3, 0, wallH / 3].map((y, i) => (
        <mesh key={`hline-${i}`} position={[0, y, d]}>
          <boxGeometry args={[w, 0.06, 0.02]} />
          <meshStandardMaterial color={plankDark} />
        </mesh>
      ))}
      {/* Diagonal X cross-braces - left panel */}
      <mesh position={[-w / 4, 0, d - 0.01]} rotation={[0, 0, 0.62]}>
        <boxGeometry args={[0.08, wallH * 0.85, 0.02]} />
        <meshStandardMaterial color={stud} />
      </mesh>
      <mesh position={[-w / 4, 0, d - 0.01]} rotation={[0, 0, -0.62]}>
        <boxGeometry args={[0.08, wallH * 0.85, 0.02]} />
        <meshStandardMaterial color={stud} />
      </mesh>
      {/* Diagonal X cross-braces - right panel */}
      <mesh position={[w / 4, 0, d - 0.01]} rotation={[0, 0, 0.62]}>
        <boxGeometry args={[0.08, wallH * 0.85, 0.02]} />
        <meshStandardMaterial color={stud} />
      </mesh>
      <mesh position={[w / 4, 0, d - 0.01]} rotation={[0, 0, -0.62]}>
        <boxGeometry args={[0.08, wallH * 0.85, 0.02]} />
        <meshStandardMaterial color={stud} />
      </mesh>
    </group>
  )

  return (
    <group>
      {/* Floor platform */}
      <mesh position={[0, thick / 2, 0]}>
        <boxGeometry args={[w, thick, l]} />
        <meshStandardMaterial color={plankDark} />
      </mesh>
      {/* Floor plank lines */}
      {[-1.5, 0, 1.5].map((z, i) => (
        <mesh key={`fline-${i}`} position={[0, thick + 0.01, z]}>
          <boxGeometry args={[w, 0.01, 0.06]} />
          <meshStandardMaterial color={frame} />
        </mesh>
      ))}

      {/* 4 walls - rotated so detail (negative local Z) faces outward */}
      <WoodWall position={[0, thick + wallH / 2, l / 2]} rotation={[0, Math.PI, 0]} />
      <WoodWall position={[0, thick + wallH / 2, -l / 2]} />
      <WoodWall position={[-w / 2, thick + wallH / 2, 0]} rotation={[0, Math.PI / 2, 0]} />
      <WoodWall position={[w / 2, thick + wallH / 2, 0]} rotation={[0, -Math.PI / 2, 0]} />

      {/* Ramp inside - spans full tile, ground to top */}
      <mesh position={[0, thick + wallH / 2, 0]} rotation={[Math.atan2(wallH, l), 0, 0]}>
        <boxGeometry args={[w * 0.92, 0.15, Math.sqrt(l * l + wallH * wallH)]} />
        <meshStandardMaterial color={rampColor} />
      </mesh>
      {/* Ramp support struts */}
      {[-w * 0.35, w * 0.35].map((x, i) => (
        <mesh key={`rstrut-${i}`} position={[x, thick + wallH / 2, 0]} rotation={[Math.atan2(wallH, l), 0, 0]}>
          <boxGeometry args={[0.1, 0.18, Math.sqrt(l * l + wallH * wallH)]} />
          <meshStandardMaterial color={stud} />
        </mesh>
      ))}
    </group>
  )
}

function ZeldaHouse3D({ obj }) {
  const w = obj.width   // 8
  const l = obj.length  // 10
  const wallH = 3.5
  const fz = l / 2

  // BOTW Hateno palette
  const stucco = '#E0CFA8'      // warm cream stucco walls
  const stone = '#7A7060'        // grey-brown foundation/quoins
  const stoneDark = '#5C5245'    // darker stone accent
  const roof = '#8B4520'         // red-brown shingles
  const roofDark = '#6E3518'     // darker roof row
  const wood = '#4A3528'         // dark weathered wood
  const shutterBlue = '#4A6A8A'  // muted blue shutters
  const glass = '#C8D8E8'        // pale window glass
  const grass = '#4A7A30'        // Hyrule field green
  const ivy = '#2E5E2E'          // vine green

  return (
    <group>
      {/* Grass ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[w + 5, l + 5]} />
        <meshStandardMaterial color={grass} />
      </mesh>

      {/* Rough stone foundation */}
      <mesh position={[0, 0.4, 0]}>
        <boxGeometry args={[w + 0.2, 0.8, l + 0.2]} />
        <meshStandardMaterial color={stone} />
      </mesh>

      {/* Stucco walls */}
      <mesh position={[0, 0.8 + wallH / 2, 0]}>
        <boxGeometry args={[w, wallH, l]} />
        <meshStandardMaterial color={stucco} />
      </mesh>

      {/* Stone quoins at 4 corners */}
      {[[-1, -1], [-1, 1], [1, -1], [1, 1]].map(([sx, sz], i) => (
        <mesh key={`quoin-${i}`} position={[sx * (w / 2), 0.8 + wallH / 2, sz * (l / 2)]}>
          <boxGeometry args={[0.5, wallH, 0.5]} />
          <meshStandardMaterial color={stoneDark} />
        </mesh>
      ))}

      {/* Gable roof - red-brown shingles */}
      {/* Stacked layers forming the gable */}
      {[0, 1, 2, 3, 4].map(i => (
        <mesh key={`roof-${i}`} position={[0, 0.8 + wallH + 0.4 + i * 0.55, 0]}>
          <boxGeometry args={[w + 1.2 - i * (w / 4.5), 0.5, l + 0.8]} />
          <meshStandardMaterial color={i % 2 === 0 ? roof : roofDark} />
        </mesh>
      ))}
      {/* Ridge cap */}
      <mesh position={[0, 0.8 + wallH + 3.2, 0]}>
        <boxGeometry args={[0.4, 0.3, l + 1]} />
        <meshStandardMaterial color={roofDark} />
      </mesh>

      {/* Tall stone chimney - BOTW signature */}
      <mesh position={[w * 0.35, 0.8 + wallH + 1.5, -l * 0.3]}>
        <boxGeometry args={[1.2, wallH + 3, 1.2]} />
        <meshStandardMaterial color={stone} />
      </mesh>
      {/* Chimney cap */}
      <mesh position={[w * 0.35, 0.8 + wallH + 3.2, -l * 0.3]}>
        <boxGeometry args={[1.5, 0.25, 1.5]} />
        <meshStandardMaterial color={stoneDark} />
      </mesh>
      {/* Chimney wooden support brace */}
      <mesh position={[w * 0.35 + 0.7, 0.8 + wallH, -l * 0.3]} rotation={[0, 0, 0.4]}>
        <boxGeometry args={[0.15, 2.5, 0.15]} />
        <meshStandardMaterial color={wood} />
      </mesh>

      {/* Front door - dark wood plank */}
      <mesh position={[0, 0.8 + wallH * 0.38, fz + 0.02]}>
        <boxGeometry args={[1.4, wallH * 0.7, 0.15]} />
        <meshStandardMaterial color={wood} />
      </mesh>

      {/* Front windows with blue shutters */}
      {[-2.2, 2.2].map((xOff, i) => (
        <group key={`fwin-${i}`}>
          {/* Glass */}
          <mesh position={[xOff, 0.8 + wallH * 0.6, fz + 0.02]}>
            <boxGeometry args={[1, 1, 0.12]} />
            <meshStandardMaterial color={glass} transparent opacity={0.6} />
          </mesh>
          {/* Window frame */}
          <mesh position={[xOff, 0.8 + wallH * 0.6, fz + 0.06]}>
            <boxGeometry args={[1.15, 1.15, 0.05]} />
            <meshStandardMaterial color={wood} />
          </mesh>
          {/* Left shutter */}
          <mesh position={[xOff - 0.65, 0.8 + wallH * 0.6, fz + 0.08]}>
            <boxGeometry args={[0.3, 1.1, 0.06]} />
            <meshStandardMaterial color={shutterBlue} />
          </mesh>
          {/* Right shutter */}
          <mesh position={[xOff + 0.65, 0.8 + wallH * 0.6, fz + 0.08]}>
            <boxGeometry args={[0.3, 1.1, 0.06]} />
            <meshStandardMaterial color={shutterBlue} />
          </mesh>
        </group>
      ))}

      {/* Side windows - left wall */}
      {[-2, 2].map((zOff, i) => (
        <group key={`lwin-${i}`}>
          <mesh position={[-w / 2 - 0.02, 0.8 + wallH * 0.6, zOff]}>
            <boxGeometry args={[0.12, 0.9, 0.9]} />
            <meshStandardMaterial color={glass} transparent opacity={0.6} />
          </mesh>
          <mesh position={[-w / 2 - 0.06, 0.8 + wallH * 0.6, zOff - 0.55]}>
            <boxGeometry args={[0.06, 0.85, 0.25]} />
            <meshStandardMaterial color={shutterBlue} />
          </mesh>
          <mesh position={[-w / 2 - 0.06, 0.8 + wallH * 0.6, zOff + 0.55]}>
            <boxGeometry args={[0.06, 0.85, 0.25]} />
            <meshStandardMaterial color={shutterBlue} />
          </mesh>
        </group>
      ))}

      {/* Ivy patch on right wall */}
      <mesh position={[w / 2 + 0.02, 0.8 + wallH * 0.45, -1]}>
        <boxGeometry args={[0.05, 2, 2.5]} />
        <meshStandardMaterial color={ivy} />
      </mesh>

      {/* Wooden front fence */}
      {[-3, -1.5, 1.5, 3].map((xOff, i) => (
        <mesh key={`fpost-${i}`} position={[xOff, 0.5, fz + 1.5]}>
          <boxGeometry args={[0.15, 1, 0.15]} />
          <meshStandardMaterial color={wood} />
        </mesh>
      ))}
      {/* Fence rail */}
      <mesh position={[0, 0.7, fz + 1.5]}>
        <boxGeometry args={[6.5, 0.1, 0.1]} />
        <meshStandardMaterial color={wood} />
      </mesh>
      <mesh position={[0, 0.35, fz + 1.5]}>
        <boxGeometry args={[6.5, 0.1, 0.1]} />
        <meshStandardMaterial color={wood} />
      </mesh>

      {/* Porch lantern */}
      <mesh position={[1.2, 0.8 + wallH * 0.75, fz + 0.15]}>
        <boxGeometry args={[0.2, 0.3, 0.2]} />
        <meshStandardMaterial color="#D4A843" emissive="#FF9933" emissiveIntensity={0.8} />
      </mesh>
    </group>
  )
}

function SimsHouse3D({ obj }) {
  const w = obj.width   // 10
  const l = obj.length  // 12
  const wallH = 3
  const fz = l / 2

  // Classic Sims palette
  const wall = '#F0E8D8'        // light beige/cream siding
  const foundation = '#B8B0A8'  // concrete gray
  const roofColor = '#3D4F5F'   // dark blue-gray shingles
  const roofDark = '#2E3E4E'    // darker roof accent
  const door = '#8B6528'        // warm wood door
  const windowGlass = '#B0D4E8' // light blue glass
  const windowFrame = '#E8E4E0' // white frame
  const lawn = '#4CAF50'        // bright Sims green
  const plumbob = '#44CC44'     // iconic green

  return (
    <group>
      {/* Bright green lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.05, 0]}>
        <planeGeometry args={[w + 6, l + 6]} />
        <meshStandardMaterial color={lawn} />
      </mesh>

      {/* Concrete foundation */}
      <mesh position={[0, 0.2, 0]}>
        <boxGeometry args={[w + 0.3, 0.4, l + 0.3]} />
        <meshStandardMaterial color={foundation} />
      </mesh>

      {/* Main walls - clean beige siding */}
      <mesh position={[0, 0.4 + wallH / 2, 0]}>
        <boxGeometry args={[w, wallH, l]} />
        <meshStandardMaterial color={wall} />
      </mesh>

      {/* Gable roof - stacked layers */}
      {[0, 1, 2, 3].map(i => (
        <mesh key={`roof-${i}`} position={[0, 0.4 + wallH + 0.3 + i * 0.5, 0]}>
          <boxGeometry args={[w + 1 - i * (w / 4), 0.45, l + 0.8]} />
          <meshStandardMaterial color={i % 2 === 0 ? roofColor : roofDark} />
        </mesh>
      ))}
      {/* Ridge cap */}
      <mesh position={[0, 0.4 + wallH + 2.4, 0]}>
        <boxGeometry args={[0.4, 0.25, l + 1]} />
        <meshStandardMaterial color={roofDark} />
      </mesh>

      {/* Front door */}
      <mesh position={[0, 0.4 + wallH * 0.38, fz + 0.02]}>
        <boxGeometry args={[1.2, wallH * 0.7, 0.15]} />
        <meshStandardMaterial color={door} />
      </mesh>
      {/* Door handle */}
      <mesh position={[0.4, 0.4 + wallH * 0.35, fz + 0.1]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#C0B090" metalness={0.5} />
      </mesh>

      {/* Front windows - evenly spaced */}
      {[-3, -1.5, 1.5, 3].map((xOff, i) => (
        <group key={`fwin-${i}`}>
          <mesh position={[xOff, 0.4 + wallH * 0.55, fz + 0.02]}>
            <boxGeometry args={[1, 1.2, 0.12]} />
            <meshStandardMaterial color={windowGlass} transparent opacity={0.5} />
          </mesh>
          <mesh position={[xOff, 0.4 + wallH * 0.55, fz + 0.06]}>
            <boxGeometry args={[1.15, 1.35, 0.04]} />
            <meshStandardMaterial color={windowFrame} />
          </mesh>
          {/* Mullion - horizontal divider */}
          <mesh position={[xOff, 0.4 + wallH * 0.55, fz + 0.08]}>
            <boxGeometry args={[1, 0.05, 0.02]} />
            <meshStandardMaterial color={windowFrame} />
          </mesh>
        </group>
      ))}

      {/* Side windows - left */}
      {[-3, 0, 3].map((zOff, i) => (
        <group key={`lwin-${i}`}>
          <mesh position={[-w / 2 - 0.02, 0.4 + wallH * 0.55, zOff]}>
            <boxGeometry args={[0.12, 1.2, 1]} />
            <meshStandardMaterial color={windowGlass} transparent opacity={0.5} />
          </mesh>
          <mesh position={[-w / 2 - 0.06, 0.4 + wallH * 0.55, zOff]}>
            <boxGeometry args={[0.04, 1.35, 1.15]} />
            <meshStandardMaterial color={windowFrame} />
          </mesh>
        </group>
      ))}

      {/* Side windows - right */}
      {[-3, 0, 3].map((zOff, i) => (
        <group key={`rwin-${i}`}>
          <mesh position={[w / 2 + 0.02, 0.4 + wallH * 0.55, zOff]}>
            <boxGeometry args={[0.12, 1.2, 1]} />
            <meshStandardMaterial color={windowGlass} transparent opacity={0.5} />
          </mesh>
          <mesh position={[w / 2 + 0.06, 0.4 + wallH * 0.55, zOff]}>
            <boxGeometry args={[0.04, 1.35, 1.15]} />
            <meshStandardMaterial color={windowFrame} />
          </mesh>
        </group>
      ))}

      {/* Front step */}
      <mesh position={[0, 0.15, fz + 0.5]}>
        <boxGeometry args={[1.8, 0.3, 0.6]} />
        <meshStandardMaterial color={foundation} />
      </mesh>

      {/* Green plumbob - THE Sims icon, floating above house */}
      <group position={[0, wallH + 4.5, 0]}>
        {/* Top pyramid */}
        <mesh position={[0, 0.35, 0]}>
          <coneGeometry args={[0.5, 0.7, 6]} />
          <meshStandardMaterial color={plumbob} emissive={plumbob} emissiveIntensity={0.6} transparent opacity={0.85} />
        </mesh>
        {/* Bottom pyramid (inverted) */}
        <mesh position={[0, -0.35, 0]} rotation={[Math.PI, 0, 0]}>
          <coneGeometry args={[0.5, 0.7, 6]} />
          <meshStandardMaterial color={plumbob} emissive={plumbob} emissiveIntensity={0.6} transparent opacity={0.85} />
        </mesh>
      </group>

      {/* Backyard pool */}
      <mesh position={[0, 0.05, -fz - 2]}>
        <boxGeometry args={[4, 0.3, 2.5]} />
        <meshStandardMaterial color="#3498DB" />
      </mesh>
      {/* Pool water surface */}
      <mesh position={[0, 0.15, -fz - 2]}>
        <boxGeometry args={[3.6, 0.05, 2.1]} />
        <meshStandardMaterial color="#5DADE2" transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

function StudioApartment3D({ obj }) {
  const wallHeight = 3
  const z = obj.length * 0.501
  return (
    <group>
      {/* Floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial color="#C4A882" />
      </mesh>

      {/* Main walls - cream/beige color */}
      <mesh position={[0, wallHeight / 2, 0]}>
        <boxGeometry args={[obj.width, wallHeight, obj.length]} />
        <meshStandardMaterial color="#F5F0E6" />
      </mesh>

      {/* Flat roof */}
      <mesh position={[0, wallHeight + 0.1, 0]}>
        <boxGeometry args={[obj.width + 0.2, 0.2, obj.length + 0.2]} />
        <meshStandardMaterial color="#808080" />
      </mesh>

      {/* Front door */}
      <mesh position={[-obj.width * 0.25, 1.1, z]}>
        <planeGeometry args={[0.9, 2.2]} />
        <meshStandardMaterial color="#6B4423" />
      </mesh>
      {/* Door frame */}
      <mesh position={[-obj.width * 0.25, 1.1, z - 0.01]}>
        <planeGeometry args={[1.1, 2.4]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>

      {/* Large window */}
      <mesh position={[obj.width * 0.15, 1.5, z]}>
        <planeGeometry args={[1.8, 1.6]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
      </mesh>
      {/* Window frame */}
      <mesh position={[obj.width * 0.15, 1.5, z - 0.01]}>
        <planeGeometry args={[2.0, 1.8]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Window dividers */}
      <mesh position={[obj.width * 0.15, 1.5, z + 0.01]}>
        <planeGeometry args={[0.08, 1.6]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      <mesh position={[obj.width * 0.15, 1.5, z + 0.01]}>
        <planeGeometry args={[1.8, 0.08]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>

      {/* Side window frame */}
      <mesh position={[obj.width * 0.5 + 0.06, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.4, 1.4, 0.08]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Side window glass */}
      <mesh position={[obj.width * 0.5 + 0.11, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.2, 1.2, 0.02]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
      </mesh>

      {/* AC unit on side */}
      <mesh position={[obj.width * 0.52, 2.5, obj.length * 0.3]}>
        <boxGeometry args={[0.3, 0.5, 0.8]} />
        <meshStandardMaterial color="#E0E0E0" />
      </mesh>

      {/* Small balcony railing */}
      <mesh position={[obj.width * 0.15, 0.5, obj.length * 0.55]}>
        <boxGeometry args={[2.2, 0.05, 0.1]} />
        <meshStandardMaterial color="#404040" />
      </mesh>
      <mesh position={[obj.width * 0.15 - 1.05, 0.3, obj.length * 0.55]}>
        <boxGeometry args={[0.05, 0.5, 0.1]} />
        <meshStandardMaterial color="#404040" />
      </mesh>
      <mesh position={[obj.width * 0.15 + 1.05, 0.3, obj.length * 0.55]}>
        <boxGeometry args={[0.05, 0.5, 0.1]} />
        <meshStandardMaterial color="#404040" />
      </mesh>

      {/* Door number */}
      <mesh position={[-obj.width * 0.25, 2, z + 0.01]}>
        <planeGeometry args={[0.3, 0.2]} />
        <meshStandardMaterial color="#C0A060" />
      </mesh>

      {/* Welcome mat */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[-obj.width * 0.25, 0.03, obj.length * 0.55]}>
        <planeGeometry args={[0.8, 0.5]} />
        <meshStandardMaterial color="#8B6914" />
      </mesh>
    </group>
  )
}

function VehicleWheel({ x, z, radius = 0.28, tireWidth = 0.16, hub = '#cbd5e1' }) {
  const side = x >= 0 ? 1 : -1
  return (
    <group>
      <mesh position={[x, radius + 0.08, z]} rotation={[0, 0, Math.PI / 2]} castShadow>
        <cylinderGeometry args={[radius, radius, tireWidth, 18]} />
        <meshStandardMaterial color="#111827" roughness={0.92} />
      </mesh>
      <mesh position={[x + side * tireWidth * 0.52, radius + 0.08, z]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[radius * 0.52, radius * 0.52, 0.04, 14]} />
        <meshStandardMaterial color={hub} metalness={0.55} roughness={0.28} />
      </mesh>
    </group>
  )
}

function CarSedan3D({ obj }) {
  const w = obj.width, l = obj.length
  const body = '#4b5563', bodyDark = '#374151', glass = '#7dd3fc'
  return (
    <group>
      <mesh position={[0, 0.25, 0]} castShadow>
        <boxGeometry args={[w * 0.82, 0.18, l * 0.88]} />
        <meshStandardMaterial color="#111827" roughness={0.82} />
      </mesh>

      {/* Lower body with hood/trunk taper cues */}
      <mesh position={[0, 0.58, 0]} castShadow>
        <boxGeometry args={[w, 0.55, l * 0.9]} />
        <meshStandardMaterial color={body} roughness={0.42} metalness={0.06} />
      </mesh>
      <mesh position={[0, 0.78, l * 0.36]} castShadow>
        <boxGeometry args={[w * 0.9, 0.22, l * 0.22]} />
        <meshStandardMaterial color={bodyDark} roughness={0.45} metalness={0.05} />
      </mesh>
      <mesh position={[0, 0.78, -l * 0.38]} castShadow>
        <boxGeometry args={[w * 0.88, 0.2, l * 0.2]} />
        <meshStandardMaterial color={bodyDark} roughness={0.45} metalness={0.05} />
      </mesh>

      {/* Cabin and glass */}
      <mesh position={[0, 1.03, -l * 0.05]} castShadow>
        <boxGeometry args={[w * 0.78, 0.65, l * 0.48]} />
        <meshStandardMaterial color={bodyDark} roughness={0.36} metalness={0.08} />
      </mesh>
      <mesh position={[0, 1.05, l * 0.2]} rotation={[-0.22, 0, 0]}>
        <boxGeometry args={[w * 0.68, 0.42, 0.05]} />
        <meshStandardMaterial color={glass} transparent opacity={0.58} roughness={0.1} metalness={0.02} />
      </mesh>
      <mesh position={[0, 1.05, -l * 0.3]} rotation={[0.2, 0, 0]}>
        <boxGeometry args={[w * 0.64, 0.36, 0.05]} />
        <meshStandardMaterial color={glass} transparent opacity={0.5} roughness={0.1} metalness={0.02} />
      </mesh>

      {[-1, 1].map((side) => (
        <group key={side}>
          <mesh position={[side * (w / 2 + 0.035), 1.02, l * 0.02]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[l * 0.34, 0.38, 0.04]} />
            <meshStandardMaterial color={glass} transparent opacity={0.46} roughness={0.1} />
          </mesh>
          <mesh position={[side * (w / 2 + 0.055), 0.74, 0]} rotation={[0, Math.PI / 2, 0]}>
            <boxGeometry args={[l * 0.5, 0.04, 0.035]} />
            <meshStandardMaterial color="#9ca3af" metalness={0.35} roughness={0.3} />
          </mesh>
          <mesh position={[side * (w / 2 + 0.12), 0.94, l * 0.2]} castShadow>
            <boxGeometry args={[0.08, 0.12, 0.28]} />
            <meshStandardMaterial color={bodyDark} roughness={0.4} />
          </mesh>
        </group>
      ))}

      {/* Bumpers, lights, and plate */}
      <mesh position={[0, 0.48, l / 2 + 0.08]}>
        <boxGeometry args={[w * 0.82, 0.18, 0.12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.5} roughness={0.28} />
      </mesh>
      <mesh position={[0, 0.48, -l / 2 - 0.08]}>
        <boxGeometry args={[w * 0.78, 0.16, 0.12]} />
        <meshStandardMaterial color="#cbd5e1" metalness={0.45} roughness={0.32} />
      </mesh>
      {[-1, 1].map((side) => (
        <mesh key={`head-${side}`} position={[side * w * 0.32, 0.66, l / 2 + 0.11]}>
          <boxGeometry args={[0.24, 0.13, 0.04]} />
          <meshStandardMaterial color="#fef3c7" emissive="#fde68a" emissiveIntensity={0.42} />
        </mesh>
      ))}
      {[-1, 1].map((side) => (
        <mesh key={`tail-${side}`} position={[side * w * 0.33, 0.66, -l / 2 - 0.1]}>
          <boxGeometry args={[0.18, 0.14, 0.04]} />
          <meshStandardMaterial color="#ef4444" emissive="#dc2626" emissiveIntensity={0.22} />
        </mesh>
      ))}

      {[l * 0.31, -l * 0.31].map((z) => [-1, 1].map((side) => (
        <VehicleWheel key={`${side}-${z}`} x={side * (w * 0.51)} z={z} radius={0.28} tireWidth={0.18} />
      )))}
    </group>
  )
}

function ShippingContainer3D({ obj }) {
  return (
    <group>
      {/* Main container body */}
      <mesh position={[0, obj.width / 2, 0]}>
        <boxGeometry args={[obj.width, obj.width, obj.length]} />
        <meshStandardMaterial color="#C75B39" />
      </mesh>
      {/* Ridges on sides */}
      {[-0.4, -0.2, 0, 0.2, 0.4].map((offset, i) => (
        <mesh key={i} position={[obj.width * 0.51, obj.width / 2, obj.length * offset]}>
          <boxGeometry args={[0.05, obj.width * 0.9, 0.15]} />
          <meshStandardMaterial color="#A04830" />
        </mesh>
      ))}
      {[-0.4, -0.2, 0, 0.2, 0.4].map((offset, i) => (
        <mesh key={`l${i}`} position={[-obj.width * 0.51, obj.width / 2, obj.length * offset]}>
          <boxGeometry args={[0.05, obj.width * 0.9, 0.15]} />
          <meshStandardMaterial color="#A04830" />
        </mesh>
      ))}
      {/* Door end */}
      <mesh position={[0, obj.width / 2, obj.length * 0.501]}>
        <planeGeometry args={[obj.width * 0.95, obj.width * 0.95]} />
        <meshStandardMaterial color="#B05040" />
      </mesh>
      {/* Door handles */}
      <mesh position={[-obj.width * 0.15, obj.width / 2, obj.length * 0.51]}>
        <boxGeometry args={[0.05, 0.4, 0.05]} />
        <meshStandardMaterial color="#404040" />
      </mesh>
      <mesh position={[obj.width * 0.15, obj.width / 2, obj.length * 0.51]}>
        <boxGeometry args={[0.05, 0.4, 0.05]} />
        <meshStandardMaterial color="#404040" />
      </mesh>
    </group>
  )
}

function SchoolBus3D({ obj }) {
  const w = obj.width, l = obj.length
  const bodyH = 2.2
  const chassisH = 0.5
  const baseY = chassisH + 0.3 // clearance above wheels
  return (
    <group>
      {/* Chassis / undercarriage */}
      <mesh position={[0, baseY, 0]}>
        <boxGeometry args={[w * 0.85, chassisH, l * 0.95]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>

      {/* Main body */}
      <mesh position={[0, baseY + chassisH / 2 + bodyH / 2, 0]} castShadow>
        <boxGeometry args={[w, bodyH, l]} />
        <meshStandardMaterial color="#F7B500" />
      </mesh>

      {/* Roof */}
      <mesh position={[0, baseY + chassisH / 2 + bodyH + 0.06, 0]} castShadow>
        <boxGeometry args={[w + 0.05, 0.1, l + 0.05]} />
        <meshStandardMaterial color="#E5A400" />
      </mesh>

      {/* Black bumper — front */}
      <mesh position={[0, baseY + 0.1, l / 2 + 0.08]}>
        <boxGeometry args={[w * 0.9, 0.3, 0.12]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      {/* Black bumper — rear */}
      <mesh position={[0, baseY + 0.1, -l / 2 - 0.08]}>
        <boxGeometry args={[w * 0.9, 0.3, 0.12]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>

      {/* Black stripe — right side */}
      <mesh position={[w / 2 + 0.06, baseY + chassisH / 2 + bodyH * 0.35, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[l, 0.2, 0.06]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      {/* Black stripe — left side */}
      <mesh position={[-w / 2 - 0.06, baseY + chassisH / 2 + bodyH * 0.35, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[l, 0.2, 0.06]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>

      {/* Windows — right side */}
      {[-0.38, -0.22, -0.06, 0.1, 0.26].map((offset, i) => (
        <mesh key={`r${i}`} position={[w / 2 + 0.06, baseY + chassisH / 2 + bodyH * 0.65, l * offset]}
          rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.9, 0.7, 0.06]} />
          <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} />
        </mesh>
      ))}
      {/* Windows — left side */}
      {[-0.38, -0.22, -0.06, 0.1, 0.26].map((offset, i) => (
        <mesh key={`l${i}`} position={[-w / 2 - 0.06, baseY + chassisH / 2 + bodyH * 0.65, l * offset]}
          rotation={[0, Math.PI / 2, 0]}>
          <boxGeometry args={[0.9, 0.7, 0.06]} />
          <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} />
        </mesh>
      ))}

      {/* Front windshield */}
      <mesh position={[0, baseY + chassisH / 2 + bodyH * 0.6, l / 2 + 0.06]}>
        <boxGeometry args={[w * 0.75, 0.9, 0.06]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.5} />
      </mesh>
      {/* Rear window */}
      <mesh position={[0, baseY + chassisH / 2 + bodyH * 0.65, -l / 2 - 0.06]}>
        <boxGeometry args={[w * 0.6, 0.7, 0.06]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.5} />
      </mesh>

      {/* Headlights */}
      <mesh position={[-w * 0.35, baseY + chassisH / 2 + bodyH * 0.2, l / 2 + 0.06]}>
        <boxGeometry args={[0.25, 0.18, 0.06]} />
        <meshStandardMaterial color="#FFFFAA" emissive="#FFFF88" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[w * 0.35, baseY + chassisH / 2 + bodyH * 0.2, l / 2 + 0.06]}>
        <boxGeometry args={[0.25, 0.18, 0.06]} />
        <meshStandardMaterial color="#FFFFAA" emissive="#FFFF88" emissiveIntensity={0.3} />
      </mesh>

      {/* Tail lights */}
      <mesh position={[-w * 0.38, baseY + chassisH / 2 + bodyH * 0.2, -l / 2 - 0.06]}>
        <boxGeometry args={[0.2, 0.2, 0.06]} />
        <meshStandardMaterial color="#FF3333" emissive="#FF0000" emissiveIntensity={0.2} />
      </mesh>
      <mesh position={[w * 0.38, baseY + chassisH / 2 + bodyH * 0.2, -l / 2 - 0.06]}>
        <boxGeometry args={[0.2, 0.2, 0.06]} />
        <meshStandardMaterial color="#FF3333" emissive="#FF0000" emissiveIntensity={0.2} />
      </mesh>

      {/* Wheels — front */}
      <mesh position={[-w * 0.45, 0.35, l * 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 0.15, 12]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[w * 0.45, 0.35, l * 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 0.15, 12]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      {/* Wheels — rear */}
      <mesh position={[-w * 0.45, 0.35, -l * 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 0.15, 12]} />
        <meshStandardMaterial color="#222222" />
      </mesh>
      <mesh position={[w * 0.45, 0.35, -l * 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.35, 0.35, 0.15, 12]} />
        <meshStandardMaterial color="#222222" />
      </mesh>

      {/* Door recess — dark opening on right side front */}
      <mesh position={[w / 2 + 0.04, baseY + chassisH / 2 + bodyH * 0.35, l * 0.38]}
        rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.0, bodyH * 0.8, 0.04]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      {/* Door panel left */}
      <mesh position={[w / 2 + 0.07, baseY + chassisH / 2 + bodyH * 0.35, l * 0.38 + 0.28]}
        rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.42, bodyH * 0.78, 0.04]} />
        <meshStandardMaterial color="#2A2A2A" />
      </mesh>
      {/* Door panel right */}
      <mesh position={[w / 2 + 0.07, baseY + chassisH / 2 + bodyH * 0.35, l * 0.38 - 0.28]}
        rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.42, bodyH * 0.78, 0.04]} />
        <meshStandardMaterial color="#2A2A2A" />
      </mesh>
      {/* Door glass — left */}
      <mesh position={[w / 2 + 0.1, baseY + chassisH / 2 + bodyH * 0.58, l * 0.38 + 0.28]}
        rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.34, bodyH * 0.4, 0.02]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} />
      </mesh>
      {/* Door glass — right */}
      <mesh position={[w / 2 + 0.1, baseY + chassisH / 2 + bodyH * 0.58, l * 0.38 - 0.28]}
        rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[0.34, bodyH * 0.4, 0.02]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} />
      </mesh>
    </group>
  )
}

function SwimmingPool3D({ obj }) {
  const laneCount = 8
  return (
    <group>
      {/* Pool deck surround — raised concrete slab with hole for pool */}
      {/* Left deck */}
      <mesh position={[-(obj.width / 2 + 1), 0.15, 0]}>
        <boxGeometry args={[2, 0.3, obj.length + 4]} />
        <meshStandardMaterial color="#D4C4A8" />
      </mesh>
      {/* Right deck */}
      <mesh position={[(obj.width / 2 + 1), 0.15, 0]}>
        <boxGeometry args={[2, 0.3, obj.length + 4]} />
        <meshStandardMaterial color="#D4C4A8" />
      </mesh>
      {/* Back deck */}
      <mesh position={[0, 0.15, -(obj.length / 2 + 1)]}>
        <boxGeometry args={[obj.width, 0.3, 2]} />
        <meshStandardMaterial color="#D4C4A8" />
      </mesh>
      {/* Front deck */}
      <mesh position={[0, 0.15, (obj.length / 2 + 1)]}>
        <boxGeometry args={[obj.width, 0.3, 2]} />
        <meshStandardMaterial color="#D4C4A8" />
      </mesh>

      {/* Coping lip around the water */}
      <mesh position={[0, 0.22, obj.length / 2 + 0.18]}>
        <boxGeometry args={[obj.width + 0.5, 0.18, 0.36]} />
        <meshStandardMaterial color="#f1e7d0" roughness={0.78} />
      </mesh>
      <mesh position={[0, 0.22, -obj.length / 2 - 0.18]}>
        <boxGeometry args={[obj.width + 0.5, 0.18, 0.36]} />
        <meshStandardMaterial color="#f1e7d0" roughness={0.78} />
      </mesh>
      <mesh position={[obj.width / 2 + 0.18, 0.22, 0]}>
        <boxGeometry args={[0.36, 0.18, obj.length]} />
        <meshStandardMaterial color="#f1e7d0" roughness={0.78} />
      </mesh>
      <mesh position={[-obj.width / 2 - 0.18, 0.22, 0]}>
        <boxGeometry args={[0.36, 0.18, obj.length]} />
        <meshStandardMaterial color="#f1e7d0" roughness={0.78} />
      </mesh>

      {/* Pool basin — light blue interior */}
      <mesh position={[0, -0.75, 0]}>
        <boxGeometry args={[obj.width, 1.5, obj.length]} />
        <meshStandardMaterial color="#7CC4D6" roughness={0.62} />
      </mesh>

      {/* Water surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.08, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial color="#2CB5D6" transparent opacity={0.68} roughness={0.12} metalness={0.02} />
      </mesh>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.095, 0]}>
        <planeGeometry args={[obj.width * 0.92, obj.length * 0.92]} />
        <meshStandardMaterial color="#a7f3d0" transparent opacity={0.12} side={THREE.DoubleSide} />
      </mesh>

      {/* Lane lines — 8 lanes for Olympic pool */}
      {Array.from({ length: laneCount + 1 }, (_, i) => {
        const x = -obj.width / 2 + (obj.width / laneCount) * i
        return (
          <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[x, 0.09, 0]}>
            <planeGeometry args={[0.1, obj.length * 0.95]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.6} />
          </mesh>
        )
      })}
      {Array.from({ length: laneCount - 1 }, (_, i) => {
        const x = -obj.width / 2 + (obj.width / laneCount) * (i + 1)
        return (
          <group key={`rope-${i}`}>
            <mesh position={[x, 0.16, 0]} rotation={[Math.PI / 2, 0, 0]}>
              <cylinderGeometry args={[0.055, 0.055, obj.length * 0.92, 12]} />
              <meshStandardMaterial color={i % 2 === 0 ? '#ef4444' : '#f8fafc'} roughness={0.45} />
            </mesh>
            {[0.36, -0.36].map((zRatio) => (
              <mesh key={zRatio} position={[x, 0.2, obj.length * zRatio]}>
                <boxGeometry args={[0.22, 0.08, 0.7]} />
                <meshStandardMaterial color="#facc15" roughness={0.5} />
              </mesh>
            ))}
          </group>
        )
      })}

      {/* Starting blocks at both ends */}
      {Array.from({ length: laneCount }, (_, i) => {
        const x = -obj.width / 2 + (obj.width / laneCount) * (i + 0.5)
        return (
          <group key={i}>
            <mesh position={[x, 0.4, obj.length / 2 + 0.1]}>
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshStandardMaterial color="#E0E0E0" />
            </mesh>
            <mesh position={[x, 0.4, -obj.length / 2 - 0.1]}>
              <boxGeometry args={[0.5, 0.5, 0.5]} />
              <meshStandardMaterial color="#E0E0E0" />
            </mesh>
          </group>
        )
      })}

      {/* Ladder rails on one side */}
      {[-0.36, -0.26].map((zRatio) => (
        <mesh key={`ladder-${zRatio}`} position={[obj.width / 2 + 0.32, 0.55, obj.length * zRatio]} rotation={[0, 0, 0]}>
          <cylinderGeometry args={[0.04, 0.04, 1.05, 10]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.55} roughness={0.25} />
        </mesh>
      ))}
      {[0.24, 0.48].map((y) => (
        <mesh key={`ladder-rung-${y}`} position={[obj.width / 2 + 0.32, y, -obj.length * 0.31]} rotation={[Math.PI / 2, 0, 0]}>
          <cylinderGeometry args={[0.035, 0.035, obj.length * 0.1, 10]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.55} roughness={0.25} />
        </mesh>
      ))}
    </group>
  )
}

function KingSizeBed3D({ obj }) {
  return (
    <group>
      {/* Mattress */}
      <mesh position={[0, 0.35, 0]}>
        <boxGeometry args={[obj.width, 0.3, obj.length]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Bed frame */}
      <mesh position={[0, 0.15, 0]}>
        <boxGeometry args={[obj.width + 0.1, 0.3, obj.length + 0.1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Headboard */}
      <mesh position={[0, 0.6, -obj.length * 0.48]}>
        <boxGeometry args={[obj.width + 0.1, 0.8, 0.1]} />
        <meshStandardMaterial color="#6B3A10" />
      </mesh>
      {/* Pillows */}
      <mesh position={[-obj.width * 0.25, 0.55, -obj.length * 0.35]}>
        <boxGeometry args={[0.6, 0.15, 0.4]} />
        <meshStandardMaterial color="#F5F5F5" />
      </mesh>
      <mesh position={[obj.width * 0.25, 0.55, -obj.length * 0.35]}>
        <boxGeometry args={[0.6, 0.15, 0.4]} />
        <meshStandardMaterial color="#F5F5F5" />
      </mesh>
      {/* Blanket/comforter */}
      <mesh position={[0, 0.52, obj.length * 0.15]}>
        <boxGeometry args={[obj.width * 0.95, 0.08, obj.length * 0.6]} />
        <meshStandardMaterial color="#E8DCC8" />
      </mesh>
      {/* Bed legs */}
      <mesh position={[-obj.width * 0.45, 0.08, obj.length * 0.45]}>
        <boxGeometry args={[0.08, 0.16, 0.08]} />
        <meshStandardMaterial color="#5C3A1A" />
      </mesh>
      <mesh position={[obj.width * 0.45, 0.08, obj.length * 0.45]}>
        <boxGeometry args={[0.08, 0.16, 0.08]} />
        <meshStandardMaterial color="#5C3A1A" />
      </mesh>
      <mesh position={[-obj.width * 0.45, 0.08, -obj.length * 0.45]}>
        <boxGeometry args={[0.08, 0.16, 0.08]} />
        <meshStandardMaterial color="#5C3A1A" />
      </mesh>
      <mesh position={[obj.width * 0.45, 0.08, -obj.length * 0.45]}>
        <boxGeometry args={[0.08, 0.16, 0.08]} />
        <meshStandardMaterial color="#5C3A1A" />
      </mesh>
    </group>
  )
}

// Medium House — modern flat-roof design with two volumes
function MediumHouse3D({ obj }) {
  const w = obj.width, l = obj.length
  return (
    <group>
      {/* Foundation slab */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[w + 1, 0.2, l + 1]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>

      {/* Main volume — taller left block */}
      <mesh position={[-w * 0.15, 2.8, 0]} castShadow>
        <boxGeometry args={[w * 0.6, 5.6, l]} />
        <meshStandardMaterial color="#F5F5F5" />
      </mesh>
        {/* Main roof slab */}
        <mesh position={[-w * 0.15, 5.7, 0]} castShadow>
          <boxGeometry args={[w * 0.6 + 0.5, 0.2, l + 0.3]} />
          <meshStandardMaterial color="#404040" />
        </mesh>
        {[-1, 1].map((side) => (
          <mesh key={`main-parapet-${side}`} position={[-w * 0.15 + side * (w * 0.3 + 0.28), 5.9, 0]}>
            <boxGeometry args={[0.12, 0.35, l + 0.35]} />
            <meshStandardMaterial color="#2b2b2b" roughness={0.5} />
          </mesh>
        ))}

        {/* Secondary volume — shorter right block */}
        <mesh position={[w * 0.28, 2, 0]} castShadow>
          <boxGeometry args={[w * 0.38, 4, l * 0.85]} />
        <meshStandardMaterial color="#E8E0D0" />
      </mesh>
        {/* Secondary roof slab */}
        <mesh position={[w * 0.28, 4.1, 0]} castShadow>
          <boxGeometry args={[w * 0.38 + 0.4, 0.18, l * 0.85 + 0.3]} />
          <meshStandardMaterial color="#404040" />
        </mesh>
        <mesh position={[w * 0.28, 4.28, l * 0.43]}>
          <boxGeometry args={[w * 0.38 + 0.45, 0.18, 0.12]} />
          <meshStandardMaterial color="#2b2b2b" roughness={0.5} />
        </mesh>

      {/* Dark accent wall — front of main volume */}
      <mesh position={[-w * 0.15, 2.8, l / 2 + 0.08]}>
        <boxGeometry args={[w * 0.15, 5.6, 0.06]} />
        <meshStandardMaterial color="#2C2C2C" />
      </mesh>

      {/* Front door — glass with dark frame */}
      <mesh position={[-w * 0.02, 1.3, l / 2 + 0.08]}>
        <boxGeometry args={[1.6, 2.6, 0.08]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
        <mesh position={[-w * 0.02, 1.3, l / 2 + 0.13]}>
          <boxGeometry args={[1.3, 2.3, 0.02]} />
          <meshStandardMaterial color="#87CEEB" transparent opacity={0.4} />
        </mesh>
        <mesh position={[-w * 0.02, 2.75, l / 2 + 0.5]} castShadow>
          <boxGeometry args={[2.4, 0.16, 0.85]} />
          <meshStandardMaterial color="#333333" roughness={0.48} />
        </mesh>

      {/* Floor-to-ceiling windows — main volume front */}
      {[-w * 0.32, -w * 0.22].map((x, i) => (
        <group key={`mw${i}`} position={[x, 2.8, l / 2 + 0.08]}>
          <mesh>
            <boxGeometry args={[0.08, 5.2, 0.06]} />
            <meshStandardMaterial color="#1A1A1A" />
          </mesh>
        </group>
      ))}
        <mesh position={[-w * 0.27, 2.8, l / 2 + 0.12]}>
          <boxGeometry args={[w * 0.12, 5.2, 0.02]} />
          <meshStandardMaterial color="#87CEEB" transparent opacity={0.35} />
        </mesh>
        {[-0.31, -0.27, -0.23].map((xRatio) => (
          <mesh key={`main-window-mullion-${xRatio}`} position={[w * xRatio, 2.8, l / 2 + 0.15]}>
            <boxGeometry args={[0.035, 5.1, 0.03]} />
            <meshStandardMaterial color="#111827" roughness={0.38} />
          </mesh>
        ))}

      {/* Windows — secondary volume front (horizontal band) */}
      <mesh position={[w * 0.28, 2.8, l * 0.85 / 2 + 0.08]}>
        <boxGeometry args={[w * 0.28, 1.6, 0.08]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[w * 0.28, 2.8, l * 0.85 / 2 + 0.13]}>
        <boxGeometry args={[w * 0.25, 1.4, 0.02]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.35} />
      </mesh>

      {/* Side windows — main volume */}
      <mesh position={[-w * 0.45 - 0.08, 3.5, -l * 0.2]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[2.0, 2.0, 0.08]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[-w * 0.45 - 0.13, 3.5, -l * 0.2]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[1.8, 1.8, 0.02]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.35} />
      </mesh>

        {/* Wooden planter box at entrance */}
        <mesh position={[-w * 0.15, 0.35, l / 2 + 0.8]}>
          <boxGeometry args={[2.5, 0.5, 0.6]} />
          <meshStandardMaterial color="#8B6F4E" />
        </mesh>
        <mesh position={[w * 0.22, 0.05, l / 2 + 1.35]}>
          <boxGeometry args={[2.2, 0.1, 2.2]} />
          <meshStandardMaterial color="#b8a17a" roughness={0.82} />
        </mesh>
        <mesh position={[w * 0.22, 0.12, l / 2 + 0.35]}>
          <boxGeometry args={[2.8, 0.08, 0.24]} />
          <meshStandardMaterial color="#94a3b8" roughness={0.62} />
        </mesh>
      </group>
    )
  }

// Large House — modern luxury with three volumes and garage
function LargeHouse3D({ obj }) {
  const w = obj.width, l = obj.length
  return (
    <group>
      {/* Foundation slab */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[w + 1.5, 0.2, l + 1.5]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>

      {/* Main volume — tall center block */}
      <mesh position={[-w * 0.1, 3.5, -l * 0.1]} castShadow>
        <boxGeometry args={[w * 0.5, 7, l * 0.6]} />
        <meshStandardMaterial color="#F5F5F5" />
      </mesh>
        <mesh position={[-w * 0.1, 7.1, -l * 0.1]} castShadow>
          <boxGeometry args={[w * 0.5 + 0.6, 0.2, l * 0.6 + 0.4]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
        <mesh position={[-w * 0.1, 7.28, -l * 0.1 + l * 0.3]}>
          <boxGeometry args={[w * 0.5 + 0.7, 0.24, 0.14]} />
          <meshStandardMaterial color="#1f2937" roughness={0.5} />
        </mesh>
        {[0, 1, 2].map((i) => (
          <mesh key={`solar-${i}`} position={[-w * 0.2 + i * w * 0.09, 7.25, -l * 0.2]} rotation={[-0.05, 0, 0]}>
            <boxGeometry args={[w * 0.07, 0.04, l * 0.12]} />
            <meshStandardMaterial color="#0f172a" metalness={0.25} roughness={0.22} />
          </mesh>
        ))}

      {/* Left wing — lower living area */}
      <mesh position={[-w * 0.38, 2, l * 0.2]} castShadow>
        <boxGeometry args={[w * 0.3, 4, l * 0.5]} />
        <meshStandardMaterial color="#E8E0D0" />
      </mesh>
      <mesh position={[-w * 0.38, 4.1, l * 0.2]} castShadow>
        <boxGeometry args={[w * 0.3 + 0.5, 0.18, l * 0.5 + 0.4]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* Right wing — garage */}
      <mesh position={[w * 0.3, 1.75, l * 0.15]} castShadow>
        <boxGeometry args={[w * 0.35, 3.5, l * 0.45]} />
        <meshStandardMaterial color="#E0E0E0" />
      </mesh>
        <mesh position={[w * 0.3, 3.6, l * 0.15]} castShadow>
          <boxGeometry args={[w * 0.35 + 0.5, 0.18, l * 0.45 + 0.4]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
        <mesh position={[w * 0.3, 3.78, l * 0.15 + l * 0.225]}>
          <boxGeometry args={[w * 0.35 + 0.55, 0.2, 0.12]} />
          <meshStandardMaterial color="#1f2937" roughness={0.5} />
        </mesh>

      {/* Garage door */}
      <mesh position={[w * 0.3, 1.4, l * 0.15 + l * 0.225 + 0.08]}>
        <boxGeometry args={[w * 0.25, 2.8, 0.08]} />
        <meshStandardMaterial color="#2C2C2C" />
      </mesh>
      {/* Garage door panel lines */}
      {[0.4, 1.0, 1.6, 2.2].map((y, i) => (
        <mesh key={i} position={[w * 0.3, y, l * 0.15 + l * 0.225 + 0.13]}>
          <boxGeometry args={[w * 0.25, 0.03, 0.02]} />
          <meshStandardMaterial color="#404040" />
        </mesh>
      ))}

      {/* Dark accent wall — main volume front */}
      <mesh position={[-w * 0.1, 3.5, -l * 0.1 + l * 0.3 + 0.08]}>
        <boxGeometry args={[w * 0.12, 7, 0.06]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>

      {/* Front entry — recessed glass door */}
      <mesh position={[-w * 0.1, 1.5, -l * 0.1 + l * 0.3 + 0.08]}>
        <boxGeometry args={[2.0, 3.0, 0.1]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[-w * 0.1, 1.5, -l * 0.1 + l * 0.3 + 0.14]}>
        <boxGeometry args={[1.7, 2.7, 0.02]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.35} />
      </mesh>

      {/* Floor-to-ceiling windows — main volume front */}
      {[-w * 0.25, -w * 0.18].map((x, i) => (
        <mesh key={`mv${i}`} position={[x, 3.5, -l * 0.1 + l * 0.3 + 0.08]}>
          <boxGeometry args={[0.06, 6.5, 0.06]} />
          <meshStandardMaterial color="#1A1A1A" />
        </mesh>
      ))}
        <mesh position={[-w * 0.215, 3.5, -l * 0.1 + l * 0.3 + 0.12]}>
          <boxGeometry args={[w * 0.1, 6.5, 0.02]} />
          <meshStandardMaterial color="#87CEEB" transparent opacity={0.3} />
        </mesh>
        {[2.2, 3.5, 4.8].map((y) => (
          <mesh key={`window-floor-${y}`} position={[-w * 0.215, y, -l * 0.1 + l * 0.3 + 0.15]}>
            <boxGeometry args={[w * 0.1, 0.045, 0.03]} />
            <meshStandardMaterial color="#111827" roughness={0.38} />
          </mesh>
        ))}

      {/* Horizontal window — left wing front */}
      <mesh position={[-w * 0.38, 2.5, l * 0.2 + l * 0.25 + 0.08]}>
        <boxGeometry args={[w * 0.2, 2.0, 0.08]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[-w * 0.38, 2.5, l * 0.2 + l * 0.25 + 0.13]}>
        <boxGeometry args={[w * 0.18, 1.8, 0.02]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.3} />
      </mesh>

      {/* Side windows — main volume left */}
      <mesh position={[-w * 0.1 - w * 0.25 - 0.08, 4.0, -l * 0.15]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[2.5, 2.5, 0.08]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[-w * 0.1 - w * 0.25 - 0.13, 4.0, -l * 0.15]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[2.3, 2.3, 0.02]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.3} />
      </mesh>

        {/* Wooden deck at entrance */}
        <mesh position={[-w * 0.1, 0.25, l * 0.2 + l * 0.3]}>
          <boxGeometry args={[w * 0.4, 0.1, 2.5]} />
          <meshStandardMaterial color="#8B6F4E" />
        </mesh>
        <mesh position={[w * 0.3, 0.04, l * 0.15 + l * 0.225 + 2.2]}>
          <boxGeometry args={[w * 0.35, 0.08, 3.8]} />
          <meshStandardMaterial color="#9ca3af" roughness={0.84} />
        </mesh>
        <mesh position={[-w * 0.1, 1.08, l * 0.2 + l * 0.3 + 0.95]}>
          <boxGeometry args={[w * 0.38, 0.08, 0.08]} />
          <meshStandardMaterial color="#d1d5db" metalness={0.35} roughness={0.28} />
        </mesh>
        {[-0.25, -0.1, 0.05].map((xRatio) => (
          <mesh key={`deck-post-${xRatio}`} position={[w * xRatio, 0.62, l * 0.2 + l * 0.3 + 0.95]}>
            <boxGeometry args={[0.08, 1.0, 0.08]} />
            <meshStandardMaterial color="#d1d5db" metalness={0.35} roughness={0.28} />
          </mesh>
        ))}

        {/* Planter boxes */}
        <mesh position={[-w * 0.32, 0.4, l * 0.2 + l * 0.3 + 0.8]}>
        <boxGeometry args={[1.5, 0.6, 0.6]} />
        <meshStandardMaterial color="#606060" />
      </mesh>
      <mesh position={[w * 0.1, 0.4, l * 0.2 + l * 0.3 + 0.8]}>
        <boxGeometry args={[1.5, 0.6, 0.6]} />
        <meshStandardMaterial color="#606060" />
      </mesh>
    </group>
  )
}

// Shed — small wooden garden shed with pitched roof (same pattern as House)
function Shed3D({ obj }) {
  const w = obj.width, l = obj.length
  const wallH = 2.2
  const roofH = 0.7
  const roofAngle = Math.atan2(roofH, w / 2)
  const roofSlope = Math.sqrt(roofH * roofH + (w / 2) * (w / 2))
  return (
    <group>
      {/* Concrete pad */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[w + 0.3, 0.16, l + 0.3]} />
        <meshStandardMaterial color="#909090" />
      </mesh>

      {/* Walls */}
      <mesh position={[0, wallH / 2 + 0.16, 0]} castShadow>
        <boxGeometry args={[w, wallH, l]} />
        <meshStandardMaterial color="#A0522D" />
      </mesh>

      {/* Roof — left slope */}
      <mesh position={[-w / 4, wallH + 0.16 + roofH / 2, 0]}
        rotation={[0, 0, roofAngle]} castShadow>
        <boxGeometry args={[roofSlope + 0.3, 0.14, l + 0.3]} />
        <meshStandardMaterial color="#5C3310" />
      </mesh>
      {/* Roof — right slope */}
      <mesh position={[w / 4, wallH + 0.16 + roofH / 2, 0]}
        rotation={[0, 0, -roofAngle]} castShadow>
        <boxGeometry args={[roofSlope + 0.3, 0.14, l + 0.3]} />
        <meshStandardMaterial color="#5C3310" />
      </mesh>
      {/* Ridge cap */}
      <mesh position={[0, wallH + 0.16 + roofH + 0.05, 0]}>
        <boxGeometry args={[0.14, 0.1, l + 0.3]} />
        <meshStandardMaterial color="#4A2A0A" />
      </mesh>

      {/* Gable fill — front */}
      <mesh position={[0, wallH + 0.16, l / 2 + 0.01]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={3}
            array={new Float32Array([
              -w / 2, 0, 0,
              w / 2, 0, 0,
              0, roofH, 0
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <meshStandardMaterial color="#A0522D" side={THREE.DoubleSide} />
      </mesh>
      {/* Gable fill — back */}
      <mesh position={[0, wallH + 0.16, -l / 2 - 0.01]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={3}
            array={new Float32Array([
              -w / 2, 0, 0,
              w / 2, 0, 0,
              0, roofH, 0
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <meshStandardMaterial color="#A0522D" side={THREE.DoubleSide} />
      </mesh>

      {/* Double doors — no gap, proud of wall face */}
      <mesh position={[-0.34, 1.05, l / 2 + 0.1]}>
        <boxGeometry args={[0.66, 1.8, 0.1]} />
        <meshStandardMaterial color="#704214" />
      </mesh>
      <mesh position={[0.34, 1.05, l / 2 + 0.1]}>
        <boxGeometry args={[0.66, 1.8, 0.1]} />
        <meshStandardMaterial color="#7A4A1A" />
      </mesh>
      {/* Door handles */}
      <mesh position={[-0.1, 1.05, l / 2 + 0.18]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.8} />
      </mesh>
      <mesh position={[0.1, 1.05, l / 2 + 0.18]}>
        <sphereGeometry args={[0.03, 6, 6]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.8} />
      </mesh>
    </group>
  )
}

// Garage — with roll-up door
function Garage3D({ obj }) {
  return (
    <group>
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[obj.width + 0.2, 0.2, obj.length + 0.2]} />
        <meshStandardMaterial color="#707070" />
      </mesh>
      {/* Walls */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <boxGeometry args={[obj.width, 3, obj.length]} />
        <meshStandardMaterial color="#D0D0D0" />
      </mesh>
      {/* Flat roof */}
      <mesh position={[0, 3.1, 0]} castShadow>
        <boxGeometry args={[obj.width + 0.2, 0.15, obj.length + 0.2]} />
        <meshStandardMaterial color="#606060" />
      </mesh>
      {/* Roll-up door */}
      <mesh position={[0, 1.3, obj.length / 2 + 0.08]}>
        <boxGeometry args={[obj.width * 0.75, 2.6, 0.06]} />
        <meshStandardMaterial color="#A0A0A0" />
      </mesh>
      {/* Door lines (horizontal panels) */}
      {[0.3, 0.9, 1.5, 2.1].map((y, i) => (
        <mesh key={i} position={[0, y, obj.length / 2 + 0.12]}>
          <boxGeometry args={[obj.width * 0.75, 0.03, 0.02]} />
          <meshStandardMaterial color="#888888" />
        </mesh>
      ))}
    </group>
  )
}

// Barn — red with gambrel-style roof (simplified as double-height box + steep top)
function Barn3D({ obj }) {
  const wallH = 4
  return (
    <group>
      {/* Walls — classic red */}
      <mesh position={[0, wallH / 2, 0]} castShadow>
        <boxGeometry args={[obj.width, wallH, obj.length]} />
        <meshStandardMaterial color="#8B0000" />
      </mesh>
      {/* Upper loft section */}
      <mesh position={[0, wallH + 1, 0]} castShadow>
        <boxGeometry args={[obj.width * 0.85, 2, obj.length]} />
        <meshStandardMaterial color="#8B0000" />
      </mesh>
      {/* Roof ridge */}
      <mesh position={[0, wallH + 2.2, 0]} castShadow>
        <boxGeometry args={[obj.width * 0.4, 0.5, obj.length + 0.4]} />
        <meshStandardMaterial color="#4A2A0A" />
      </mesh>
      {/* Roof slopes */}
      <mesh position={[0, wallH + 2.1, 0]} castShadow>
        <boxGeometry args={[obj.width + 0.4, 0.15, obj.length + 0.4]} />
        <meshStandardMaterial color="#5C3310" />
      </mesh>
      {/* White trim */}
      <mesh position={[0, wallH, obj.length / 2 + 0.08]}>
        <boxGeometry args={[obj.width + 0.1, 0.15, 0.04]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Barn door — large double door */}
      <mesh position={[-0.7, 1.5, obj.length / 2 + 0.08]}>
        <boxGeometry args={[1.4, 3, 0.06]} />
        <meshStandardMaterial color="#6B3A1F" />
      </mesh>
      <mesh position={[0.7, 1.5, obj.length / 2 + 0.08]}>
        <boxGeometry args={[1.4, 3, 0.06]} />
        <meshStandardMaterial color="#704214" />
      </mesh>
      {/* Loft window */}
      <mesh position={[0, wallH + 1, obj.length / 2 + 0.08]}>
        <boxGeometry args={[1.0, 1.0, 0.06]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

// Workshop — industrial shed with pitched roof
function Workshop3D({ obj }) {
  const w = obj.width, l = obj.length
  const wallH = 3.2
  const roofH = 0.8
  const roofAngle = Math.atan2(roofH, w / 2)
  const roofSlope = Math.sqrt(roofH * roofH + (w / 2) * (w / 2))
  return (
    <group>
      {/* Concrete slab */}
      <mesh position={[0, 0.08, 0]}>
        <boxGeometry args={[w + 0.3, 0.16, l + 0.3]} />
        <meshStandardMaterial color="#808080" />
      </mesh>

      {/* Walls */}
      <mesh position={[0, wallH / 2 + 0.16, 0]} castShadow>
        <boxGeometry args={[w, wallH, l]} />
        <meshStandardMaterial color="#556B2F" />
      </mesh>

      {/* Pitched roof — left slope */}
      <mesh position={[-w / 4, wallH + 0.16 + roofH / 2, 0]}
        rotation={[0, 0, roofAngle]} castShadow>
        <boxGeometry args={[roofSlope + 0.3, 0.12, l + 0.3]} />
        <meshStandardMaterial color="#404040" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Pitched roof — right slope */}
      <mesh position={[w / 4, wallH + 0.16 + roofH / 2, 0]}
        rotation={[0, 0, -roofAngle]} castShadow>
        <boxGeometry args={[roofSlope + 0.3, 0.12, l + 0.3]} />
        <meshStandardMaterial color="#404040" metalness={0.4} roughness={0.6} />
      </mesh>
      {/* Ridge cap */}
      <mesh position={[0, wallH + 0.16 + roofH + 0.04, 0]}>
        <boxGeometry args={[0.12, 0.08, l + 0.3]} />
        <meshStandardMaterial color="#333333" />
      </mesh>

      {/* Gable fill — front */}
      <mesh position={[0, wallH + 0.16, l / 2 + 0.01]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={3}
            array={new Float32Array([
              -w / 2, 0, 0,
              w / 2, 0, 0,
              0, roofH, 0
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <meshStandardMaterial color="#556B2F" side={THREE.DoubleSide} />
      </mesh>
      {/* Gable fill — back */}
      <mesh position={[0, wallH + 0.16, -l / 2 - 0.01]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={3}
            array={new Float32Array([
              -w / 2, 0, 0,
              w / 2, 0, 0,
              0, roofH, 0
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <meshStandardMaterial color="#556B2F" side={THREE.DoubleSide} />
      </mesh>

      {/* Large roll-up door */}
      <mesh position={[0, 1.55, l / 2 + 0.1]}>
        <boxGeometry args={[w * 0.6, 2.8, 0.1]} />
        <meshStandardMaterial color="#3A3A3A" />
      </mesh>
      {/* Door panel lines */}
      {[0.5, 1.1, 1.7, 2.3].map((y, i) => (
        <mesh key={i} position={[0, y, l / 2 + 0.16]}>
          <boxGeometry args={[w * 0.6, 0.03, 0.02]} />
          <meshStandardMaterial color="#505050" />
        </mesh>
      ))}

      {/* Side window — horizontal band */}
      <mesh position={[w / 2 + 0.08, 2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[l * 0.5, 0.8, 0.08]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[w / 2 + 0.13, 2.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <boxGeometry args={[l * 0.45, 0.6, 0.02]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.5} />
      </mesh>
    </group>
  )
}

// Greenhouse — transparent glass panels with frame
function Greenhouse3D({ obj }) {
  const h = 2.8
  return (
    <group>
      {/* Base frame */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[obj.width, 0.2, obj.length]} />
        <meshStandardMaterial color="#808080" />
      </mesh>
      {/* Glass walls — transparent green tint */}
      <mesh position={[0, h / 2 + 0.2, 0]} castShadow>
        <boxGeometry args={[obj.width, h, obj.length]} />
        <meshStandardMaterial color="#98FB98" transparent opacity={0.35} />
      </mesh>
      {/* Frame edges — vertical posts */}
      {[
        [-obj.width / 2, 0, -obj.length / 2], [obj.width / 2, 0, -obj.length / 2],
        [-obj.width / 2, 0, obj.length / 2], [obj.width / 2, 0, obj.length / 2],
        [-obj.width / 2, 0, 0], [obj.width / 2, 0, 0],
      ].map(([x, _, z], i) => (
        <mesh key={i} position={[x, h / 2 + 0.2, z]}>
          <boxGeometry args={[0.08, h, 0.08]} />
          <meshStandardMaterial color="#E0E0E0" />
        </mesh>
      ))}
      {/* Arched roof (approximated as slightly wider top box) */}
      <mesh position={[0, h + 0.35, 0]} castShadow>
        <boxGeometry args={[obj.width + 0.1, 0.3, obj.length + 0.1]} />
        <meshStandardMaterial color="#98FB98" transparent opacity={0.3} />
      </mesh>
      {/* Roof ridge */}
      <mesh position={[0, h + 0.55, 0]}>
        <boxGeometry args={[0.06, 0.12, obj.length + 0.1]} />
        <meshStandardMaterial color="#E0E0E0" />
      </mesh>
      {/* Door */}
      <mesh position={[0, 1.1, obj.length / 2 + 0.08]}>
        <boxGeometry args={[0.8, 2, 0.06]} />
        <meshStandardMaterial color="#E0E0E0" />
      </mesh>
    </group>
  )
}

// Gazebo — open structure with pitched roof and pillars
function Gazebo3D({ obj }) {
  const w = obj.width, l = obj.length
  const pillarH = 2.8
  const roofH = 0.7
  const roofAngle = Math.atan2(roofH, w / 2)
  const roofSlope = Math.sqrt(roofH * roofH + (w / 2) * (w / 2))
  return (
    <group>
      {/* Floor platform */}
      <mesh position={[0, 0.12, 0]}>
        <boxGeometry args={[w + 0.3, 0.24, l + 0.3]} />
        <meshStandardMaterial color="#D2B48C" />
      </mesh>

      {/* 4 corner pillars */}
      {[
        [-w / 2 + 0.15, 0, -l / 2 + 0.15],
        [w / 2 - 0.15, 0, -l / 2 + 0.15],
        [-w / 2 + 0.15, 0, l / 2 - 0.15],
        [w / 2 - 0.15, 0, l / 2 - 0.15],
      ].map(([x, _, z], i) => (
        <mesh key={i} position={[x, pillarH / 2 + 0.24, z]}>
          <boxGeometry args={[0.12, pillarH, 0.12]} />
          <meshStandardMaterial color="#F5F5DC" />
        </mesh>
      ))}

      {/* Pitched roof — left slope */}
      <mesh position={[-w / 4, pillarH + 0.24 + roofH / 2, 0]}
        rotation={[0, 0, roofAngle]} castShadow>
        <boxGeometry args={[roofSlope + 0.4, 0.1, l + 0.5]} />
        <meshStandardMaterial color="#8B6F4E" />
      </mesh>
      {/* Pitched roof — right slope */}
      <mesh position={[w / 4, pillarH + 0.24 + roofH / 2, 0]}
        rotation={[0, 0, -roofAngle]} castShadow>
        <boxGeometry args={[roofSlope + 0.4, 0.1, l + 0.5]} />
        <meshStandardMaterial color="#8B6F4E" />
      </mesh>
      {/* Ridge cap */}
      <mesh position={[0, pillarH + 0.24 + roofH + 0.03, 0]}>
        <boxGeometry args={[0.12, 0.06, l + 0.5]} />
        <meshStandardMaterial color="#6B4F3E" />
      </mesh>

      {/* Gable trim — front */}
      <mesh position={[0, pillarH + 0.24, l / 2 + 0.26]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={3}
            array={new Float32Array([
              -w / 2 - 0.2, 0, 0,
              w / 2 + 0.2, 0, 0,
              0, roofH, 0
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <meshStandardMaterial color="#C4A87C" side={THREE.DoubleSide} />
      </mesh>
      {/* Gable trim — back */}
      <mesh position={[0, pillarH + 0.24, -l / 2 - 0.26]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={3}
            array={new Float32Array([
              -w / 2 - 0.2, 0, 0,
              w / 2 + 0.2, 0, 0,
              0, roofH, 0
            ])}
            itemSize={3}
          />
        </bufferGeometry>
        <meshStandardMaterial color="#C4A87C" side={THREE.DoubleSide} />
      </mesh>

      {/* Low railing — front & back */}
      <mesh position={[0, 0.55, -l / 2 + 0.15]}>
        <boxGeometry args={[w - 0.3, 0.5, 0.06]} />
        <meshStandardMaterial color="#F5F5DC" />
      </mesh>
      <mesh position={[0, 0.55, l / 2 - 0.15]}>
        <boxGeometry args={[w - 0.3, 0.5, 0.06]} />
        <meshStandardMaterial color="#F5F5DC" />
      </mesh>
      {/* Low railing — sides */}
      <mesh position={[-w / 2 + 0.15, 0.55, 0]}>
        <boxGeometry args={[0.06, 0.5, l - 0.3]} />
        <meshStandardMaterial color="#F5F5DC" />
      </mesh>
      <mesh position={[w / 2 - 0.15, 0.55, 0]}>
        <boxGeometry args={[0.06, 0.5, l - 0.3]} />
        <meshStandardMaterial color="#F5F5DC" />
      </mesh>
    </group>
  )
}

// Carport — open roof structure with pillars
function Carport3D({ obj }) {
  return (
    <group>
      {/* Concrete slab */}
      <mesh position={[0, 0.06, 0]}>
        <boxGeometry args={[obj.width + 0.2, 0.12, obj.length + 0.2]} />
        <meshStandardMaterial color="#909090" />
      </mesh>
      {/* 4 metal pillars */}
      {[
        [-obj.width / 2 + 0.15, 0, -obj.length / 2 + 0.15],
        [obj.width / 2 - 0.15, 0, -obj.length / 2 + 0.15],
        [-obj.width / 2 + 0.15, 0, obj.length / 2 - 0.15],
        [obj.width / 2 - 0.15, 0, obj.length / 2 - 0.15],
      ].map(([x, _, z], i) => (
        <mesh key={i} position={[x, 1.25, z]}>
          <boxGeometry args={[0.08, 2.5, 0.08]} />
          <meshStandardMaterial color="#606060" metalness={0.5} roughness={0.4} />
        </mesh>
      ))}
      {/* Flat metal roof */}
      <mesh position={[0, 2.55, 0]} castShadow>
        <boxGeometry args={[obj.width + 0.4, 0.08, obj.length + 0.3]} />
        <meshStandardMaterial color="#505050" metalness={0.5} roughness={0.5} />
      </mesh>
    </group>
  )
}

// Placeholder for remaining 3D components - they will be rendered as simple boxes with labels
function GenericComparison3D({ obj }) {
  return (
    <group>
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial color="#9CA3AF" />
      </mesh>
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[obj.width * 0.8, 1, obj.length * 0.8]} />
        <meshStandardMaterial color="#6B7280" transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

// Utility constants and functions
const SNAP_THRESHOLD = 1.5 // meters - snap distance for edge snapping

// Check if rotation is axis-aligned (0, 90, 180, 270 degrees)
function isAxisAligned(rotation) {
  const normalized = ((rotation % 360) + 360) % 360
  return normalized < 5 || Math.abs(normalized - 90) < 5 || Math.abs(normalized - 180) < 5 || Math.abs(normalized - 270) < 5
}

// Get effective width/length after rotation (swapped for 90°/270°)
function getRotatedDimensions(width, length, rotation) {
  const normalized = ((rotation % 360) + 360) % 360
  // At 90° or 270°, width and length are swapped
  if (Math.abs(normalized - 90) < 5 || Math.abs(normalized - 270) < 5) {
    return { width: length, length: width }
  }
  return { width, length }
}

// Get object bounding box (accounts for axis-aligned rotation)
function getObjectBounds(x, z, width, length, rotation = 0) {
  const dims = getRotatedDimensions(width, length, rotation)
  return {
    left: x - dims.width / 2,
    right: x + dims.width / 2,
    top: z + dims.length / 2,
    bottom: z - dims.length / 2,
    centerX: x,
    centerZ: z,
  }
}

// Check if two objects overlap
function checkOverlap(bounds1, bounds2) {
  return !(
    bounds1.right <= bounds2.left ||
    bounds1.left >= bounds2.right ||
    bounds1.top <= bounds2.bottom ||
    bounds1.bottom >= bounds2.top
  )
}


// ============================================
// VEHICLE 3D COMPONENTS (new additions)
// ============================================

function FordF1503D({ obj }) {
  const w = obj.width, l = obj.length
  const bodyH = 1.0, cabH = 1.5, chassisY = 0.45
  const blue = "#1A3A6A", blueDk = "#142D55", chrome = "#C8C8C8", black = "#1A1A1A"
  const cabL = l * 0.45, bedL = l * 0.48
  return (
    <group>
      <mesh position={[0, chassisY * 0.4, 0]}><boxGeometry args={[w * 0.85, 0.18, l * 0.9]} /><meshStandardMaterial color={black} /></mesh>
      <mesh position={[0, chassisY + bodyH / 2, l * 0.12]} castShadow><boxGeometry args={[w, bodyH, cabL]} /><meshStandardMaterial color={blue} /></mesh>
      <mesh position={[0, chassisY + bodyH + cabH / 2, l * 0.12]} castShadow><boxGeometry args={[w * 0.9, cabH, cabL * 0.75]} /><meshStandardMaterial color={blue} /></mesh>
        <mesh position={[0, chassisY + bodyH / 2, -l * 0.27]} castShadow><boxGeometry args={[w, bodyH, bedL]} /><meshStandardMaterial color={blue} /></mesh>
        <mesh position={[0, chassisY + 0.12, -l * 0.27]}><boxGeometry args={[w * 0.88, 0.08, bedL * 0.92]} /><meshStandardMaterial color={blueDk} /></mesh>
        <mesh position={[0, chassisY + bodyH * 0.8, l * 0.42]} castShadow><boxGeometry args={[w, bodyH * 0.55, l * 0.12]} /><meshStandardMaterial color={blue} /></mesh>
        <mesh position={[0, chassisY + bodyH + 0.08, -l * 0.27]}><boxGeometry args={[w + 0.08, 0.14, bedL * 0.92]} /><meshStandardMaterial color={blueDk} roughness={0.42} /></mesh>
        {[-1, 1].map((s) => (
          <mesh key={`bed-rail-${s}`} position={[s * (w / 2 + 0.04), chassisY + bodyH + 0.18, -l * 0.27]}>
            <boxGeometry args={[0.08, 0.18, bedL * 0.9]} />
            <meshStandardMaterial color={blueDk} roughness={0.38} />
          </mesh>
        ))}
        <mesh position={[0, chassisY + bodyH * 0.55, -l / 2 - 0.06]}>
          <boxGeometry args={[w * 0.9, bodyH * 0.7, 0.08]} />
          <meshStandardMaterial color={blueDk} roughness={0.45} />
        </mesh>
        <mesh position={[0, chassisY + bodyH * 0.5, l / 2 + 0.06]}><boxGeometry args={[w * 0.8, bodyH * 0.6, 0.1]} /><meshStandardMaterial color={chrome} metalness={0.6} roughness={0.3} /></mesh>
        {[0.25, 0.5, 0.75].map((t) => (
          <mesh key={`grille-${t}`} position={[0, chassisY + bodyH * (0.22 + t * 0.42), l / 2 + 0.13]}>
            <boxGeometry args={[w * 0.72, 0.05, 0.04]} />
            <meshStandardMaterial color={black} metalness={0.25} roughness={0.4} />
          </mesh>
        ))}
        <mesh position={[0, chassisY + bodyH + cabH * 0.5, l * 0.32]} rotation={[0.25, 0, 0]}><boxGeometry args={[w * 0.85, cabH * 0.8, 0.08]} /><meshStandardMaterial color="#87CEEB" transparent opacity={0.6} /></mesh>
        <mesh position={[0, chassisY + bodyH + cabH * 0.5, -l * 0.08]} rotation={[-0.2, 0, 0]}><boxGeometry args={[w * 0.8, cabH * 0.65, 0.08]} /><meshStandardMaterial color="#87CEEB" transparent opacity={0.6} /></mesh>
        {[-1, 1].map((s) => (
          <group key={`cab-side-${s}`}>
            <mesh position={[s * (w / 2 + 0.04), chassisY + bodyH + cabH * 0.52, l * 0.18]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[cabL * 0.55, cabH * 0.48, 0.05]} />
              <meshStandardMaterial color="#87CEEB" transparent opacity={0.5} />
            </mesh>
            <mesh position={[s * (w / 2 + 0.07), chassisY + bodyH * 0.5, l * 0.14]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[cabL * 0.7, 0.05, 0.04]} />
              <meshStandardMaterial color={chrome} metalness={0.45} roughness={0.28} />
            </mesh>
          </group>
        ))}
        {[-1, 1].map((s, i) => (<mesh key={i} position={[s * w * 0.38, chassisY + bodyH * 0.7, l / 2 + 0.07]}><boxGeometry args={[0.25, 0.18, 0.06]} /><meshStandardMaterial color="#FFFFAA" emissive="#FFFF88" emissiveIntensity={0.4} /></mesh>))}
        {[-1, 1].map((s, i) => (<mesh key={i} position={[s * w * 0.38, chassisY + bodyH * 0.7, -l / 2 - 0.06]}><boxGeometry args={[0.18, 0.22, 0.06]} /><meshStandardMaterial color="#FF3333" emissive="#FF0000" emissiveIntensity={0.2} /></mesh>))}
        <mesh position={[0, chassisY + 0.18, l / 2 + 0.1]}><boxGeometry args={[w + 0.1, 0.22, 0.15]} /><meshStandardMaterial color={chrome} metalness={0.5} roughness={0.4} /></mesh>
        <mesh position={[0, chassisY + 0.18, -l / 2 - 0.1]}><boxGeometry args={[w + 0.1, 0.22, 0.15]} /><meshStandardMaterial color={chrome} metalness={0.5} roughness={0.4} /></mesh>
        {[l * 0.32, -l * 0.32].map((z) => [-1, 1].map((side) => (
          <group key={`${side}-${z}`}>
            <VehicleWheel x={side * (w * 0.52)} z={z} radius={0.42} tireWidth={0.23} />
            <mesh position={[side * (w / 2 + 0.035), 0.74, z]}>
              <boxGeometry args={[0.06, 0.45, 0.92]} />
              <meshStandardMaterial color={blueDk} roughness={0.42} />
            </mesh>
          </group>
        )))}
        {[-1, 1].map((s, i) => (<mesh key={i} position={[s * (w * 0.48), chassisY - 0.05, 0]}><boxGeometry args={[0.08, 0.06, l * 0.55]} /><meshStandardMaterial color={chrome} metalness={0.5} /></mesh>))}
      </group>
    )
  }

function SemiTruck3D({ obj }) {
  const w = obj.width, l = obj.length
  const cabL = 6, trailerL = l - cabL - 1
  const cabH = 4, trailerH = 2.8, chassisY = 0.55
  const chrome = "#C0C0C0", black = "#111", cabColor = "#C8392B", trailerColor = "#F0F0F0"
  return (
    <group>
      <mesh position={[0, chassisY + cabH / 2, (l / 2) - cabL / 2]} castShadow><boxGeometry args={[w, cabH, cabL]} /><meshStandardMaterial color={cabColor} /></mesh>
      <mesh position={[0, chassisY + cabH + 0.6, (l / 2) - cabL * 0.4]}><boxGeometry args={[w * 0.95, 1.2, cabL * 0.6]} /><meshStandardMaterial color={cabColor} /></mesh>
      <mesh position={[0, chassisY + cabH * 0.65, (l / 2) + 0.05]} rotation={[-0.1, 0, 0]}><boxGeometry args={[w * 0.8, cabH * 0.4, 0.1]} /><meshStandardMaterial color="#87CEEB" transparent opacity={0.55} /></mesh>
      <mesh position={[0, chassisY + cabH * 0.25, (l / 2) + 0.07]}><boxGeometry args={[w * 0.85, cabH * 0.45, 0.12]} /><meshStandardMaterial color={chrome} metalness={0.7} roughness={0.2} /></mesh>
      {[0.2, 0.4, 0.6, 0.8].map((t, i) => (<mesh key={i} position={[0, chassisY + cabH * 0.25 * t + 0.1, (l / 2) + 0.14]}><boxGeometry args={[w * 0.83, 0.06, 0.06]} /><meshStandardMaterial color={black} /></mesh>))}
      {[-1, 1].map((s, i) => (<mesh key={i} position={[s * w * 0.38, chassisY + cabH * 0.55, (l / 2) + 0.08]}><boxGeometry args={[0.35, 0.22, 0.07]} /><meshStandardMaterial color="#FFFFCC" emissive="#FFFF88" emissiveIntensity={0.5} /></mesh>))}
      {[-1, 1].map((s, i) => (<mesh key={i} position={[s * (w * 0.45), chassisY + cabH + 1.8, (l / 2) - cabL * 0.65]}><cylinderGeometry args={[0.12, 0.14, 3.5, 8]} /><meshStandardMaterial color={chrome} metalness={0.7} roughness={0.2} /></mesh>))}
      <mesh position={[0, chassisY + 0.4, (l / 2) - cabL - 0.2]}><cylinderGeometry args={[0.5, 0.6, 0.3, 10]} /><meshStandardMaterial color="#555" metalness={0.4} /></mesh>
      <mesh position={[0, chassisY + trailerH / 2, (l / 2) - cabL - 0.8 - trailerL / 2]} castShadow><boxGeometry args={[w, trailerH, trailerL]} /><meshStandardMaterial color={trailerColor} /></mesh>
      <mesh position={[0, chassisY + trailerH / 2, -(l / 2) + 0.08]}><boxGeometry args={[w * 0.95, trailerH * 0.95, 0.1]} /><meshStandardMaterial color="#D8D8D8" /></mesh>
      {[-1, 1].map((s, i) => (<mesh key={i} position={[s * (w * 0.52), 0.5, (l / 2) - 1.5]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.5, 0.5, 0.2, 12]} /><meshStandardMaterial color={black} /></mesh>))}
      {[-1, 1].map((s, i) => [-l * 0.08, -l * 0.14].map((z, j) => (<mesh key={i * 2 + j} position={[s * (w * 0.52), 0.5, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.5, 0.5, 0.38, 12]} /><meshStandardMaterial color={black} /></mesh>)))}
      {[-1, 1].map((s, i) => [-l * 0.38, -l * 0.44].map((z, j) => (<mesh key={i * 2 + j} position={[s * (w * 0.52), 0.5, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.5, 0.5, 0.38, 12]} /><meshStandardMaterial color={black} /></mesh>)))}
      {[-1, 1].map((s, i) => (<mesh key={i} position={[s * w * 0.35, 0.55, (l / 2) - cabL - 2]}><boxGeometry args={[0.12, 1.1, 0.12]} /><meshStandardMaterial color="#888" metalness={0.3} /></mesh>))}
    </group>
  )
}

function FireTruck3D({ obj }) {
  const w = obj.width, l = obj.length
  const bodyH = 2.2, cabH = 1.4, chassisY = 0.5
  const red = "#CC1111", redDk = "#AA0D0D", chrome = "#C8C8C8", black = "#1A1A1A", yellow = "#FFD700"
  return (
    <group>
      <mesh position={[0, chassisY * 0.4, 0]}><boxGeometry args={[w * 0.8, 0.2, l * 0.9]} /><meshStandardMaterial color={black} /></mesh>
      <mesh position={[0, chassisY + bodyH / 2, 0]} castShadow><boxGeometry args={[w, bodyH, l]} /><meshStandardMaterial color={red} /></mesh>
      <mesh position={[0, chassisY + bodyH + cabH / 2, l * 0.32]} castShadow><boxGeometry args={[w * 0.95, cabH, l * 0.32]} /><meshStandardMaterial color={red} /></mesh>
      <mesh position={[0, chassisY + bodyH + cabH * 0.55, l * 0.45]} rotation={[-0.15, 0, 0]}><boxGeometry args={[w * 0.82, cabH * 0.65, 0.08]} /><meshStandardMaterial color="#87CEEB" transparent opacity={0.55} /></mesh>
      <mesh position={[0, chassisY + bodyH + cabH + 0.12, l * 0.2]}><boxGeometry args={[w * 0.85, 0.18, l * 0.4]} /><meshStandardMaterial color={black} /></mesh>
      {[-0.3, 0, 0.3].map((dz, i) => (<mesh key={i} position={[-w * 0.35, chassisY + bodyH + cabH + 0.25, l * 0.2 + dz]}><boxGeometry args={[0.15, 0.12, 0.18]} /><meshStandardMaterial color="#FF2222" emissive="#FF0000" emissiveIntensity={0.8} /></mesh>))}
      {[-0.3, 0, 0.3].map((dz, i) => (<mesh key={i} position={[w * 0.35, chassisY + bodyH + cabH + 0.25, l * 0.2 + dz]}><boxGeometry args={[0.15, 0.12, 0.18]} /><meshStandardMaterial color="#2244FF" emissive="#0022FF" emissiveIntensity={0.8} /></mesh>))}
      <mesh position={[0, chassisY + bodyH + 0.25, -l * 0.1]}><boxGeometry args={[w * 0.6, 0.35, l * 0.55]} /><meshStandardMaterial color="#888" metalness={0.4} roughness={0.5} /></mesh>
      <mesh position={[0, chassisY + bodyH + 0.8, -l * 0.15]} rotation={[-0.3, 0, 0]}><boxGeometry args={[0.25, 0.2, l * 0.7]} /><meshStandardMaterial color={chrome} metalness={0.5} roughness={0.3} /></mesh>
      {[-1, 1].map((s, i) => (<group key={i}>{[-0.25, 0, 0.25].map((dz, j) => (<mesh key={j} position={[s * (w / 2 + 0.02), chassisY + bodyH * 0.5, dz * l * 0.5]}><boxGeometry args={[0.04, bodyH * 0.55, l * 0.2]} /><meshStandardMaterial color={redDk} /></mesh>))}{[-0.25, 0, 0.25].map((dz, j) => (<mesh key={j + 3} position={[s * (w / 2 + 0.05), chassisY + bodyH * 0.4, dz * l * 0.5]}><boxGeometry args={[0.04, 0.06, 0.25]} /><meshStandardMaterial color={chrome} metalness={0.6} /></mesh>))}</group>))}
      <mesh position={[0, chassisY + 0.2, l / 2 + 0.1]}><boxGeometry args={[w + 0.15, 0.28, 0.18]} /><meshStandardMaterial color={chrome} metalness={0.6} roughness={0.3} /></mesh>
      {[-1, 1].map((s, i) => (<mesh key={i} position={[s * w * 0.38, chassisY + bodyH * 0.6, l / 2 + 0.07]}><boxGeometry args={[0.28, 0.2, 0.07]} /><meshStandardMaterial color="#FFFFAA" emissive="#FFFF88" emissiveIntensity={0.4} /></mesh>))}
      {[-1, 1].map((s, i) => (<mesh key={i} position={[s * (w / 2 + 0.03), chassisY + bodyH * 0.35, 0]} rotation={[0, Math.PI / 2, 0]}><boxGeometry args={[l, 0.12, 0.04]} /><meshStandardMaterial color={yellow} emissive={yellow} emissiveIntensity={0.2} /></mesh>))}
      {[-1, 1].map((s, i) => (<mesh key={i} position={[s * w * 0.4, chassisY + bodyH * 0.6, -l / 2 - 0.06]}><boxGeometry args={[0.2, 0.2, 0.06]} /><meshStandardMaterial color="#FF3333" emissive="#FF0000" emissiveIntensity={0.2} /></mesh>))}
      <mesh position={[0, chassisY + 0.3, -l / 2 - 0.1]}><boxGeometry args={[w * 0.75, 0.5, 0.2]} /><meshStandardMaterial color={chrome} metalness={0.4} /></mesh>
      {[l * 0.35, -l * 0.28].map((z, j) => [-1, 1].map((s, i) => (<group key={i * 2 + j}><mesh position={[s * (w * 0.52), 0.5, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.5, 0.5, 0.25, 14]} /><meshStandardMaterial color={black} /></mesh><mesh position={[s * (w * 0.52 + 0.13), 0.5, z]} rotation={[0, 0, Math.PI / 2]}><cylinderGeometry args={[0.3, 0.3, 0.06, 12]} /><meshStandardMaterial color={chrome} metalness={0.6} roughness={0.3} /></mesh></group>)))}
    </group>
  )
}

function SUV3D({ obj }) {
  const w = obj.width, l = obj.length
  const bodyH = 1.0, roofH = 0.9, chassisY = 0.48
  const dark = "#1A2B1A", darkMid = "#243824", black = "#111", chrome = "#C0C0C0"
  return (
    <group>
      <mesh position={[0, chassisY * 0.35, 0]}><boxGeometry args={[w * 0.82, 0.2, l * 0.88]} /><meshStandardMaterial color={black} /></mesh>
      <mesh position={[0, chassisY + bodyH / 2, 0]} castShadow><boxGeometry args={[w, bodyH, l]} /><meshStandardMaterial color={dark} /></mesh>
      <mesh position={[0, chassisY + bodyH + roofH / 2, -l * 0.04]} castShadow><boxGeometry args={[w * 0.93, roofH, l * 0.72]} /><meshStandardMaterial color={dark} /></mesh>
      <mesh position={[0, chassisY + bodyH + roofH + 0.08, -l * 0.04]}><boxGeometry args={[w * 0.88, 0.05, l * 0.62]} /><meshStandardMaterial color={chrome} metalness={0.5} roughness={0.4} /></mesh>
      {[-1, 1].map((s, i) => (<mesh key={i} position={[s * w * 0.38, chassisY + bodyH + roofH + 0.14, -l * 0.04]}><boxGeometry args={[0.05, 0.14, l * 0.6]} /><meshStandardMaterial color={chrome} metalness={0.5} /></mesh>))}
      <mesh position={[0, chassisY + bodyH + roofH * 0.55, l * 0.3]} rotation={[-0.25, 0, 0]}><boxGeometry args={[w * 0.84, roofH * 0.8, 0.08]} /><meshStandardMaterial color="#87CEEB" transparent opacity={0.55} /></mesh>
      <mesh position={[0, chassisY + bodyH + roofH * 0.55, -l * 0.38]} rotation={[0.2, 0, 0]}><boxGeometry args={[w * 0.8, roofH * 0.7, 0.08]} /><meshStandardMaterial color="#87CEEB" transparent opacity={0.55} /></mesh>
      {[-1, 1].map((s, i) => (<group key={i}><mesh position={[s * (w / 2 + 0.04), chassisY + bodyH + roofH * 0.5, l * 0.1]}><boxGeometry args={[0.08, roofH * 0.65, l * 0.28]} /><meshStandardMaterial color="#87CEEB" transparent opacity={0.5} /></mesh><mesh position={[s * (w / 2 + 0.04), chassisY + bodyH + roofH * 0.5, -l * 0.22]}><boxGeometry args={[0.08, roofH * 0.6, l * 0.2]} /><meshStandardMaterial color="#87CEEB" transparent opacity={0.5} /></mesh></group>))}
        <mesh position={[0, chassisY + bodyH * 0.9, l * 0.42]}><boxGeometry args={[w, bodyH * 0.25, l * 0.15]} /><meshStandardMaterial color={darkMid} /></mesh>
        <mesh position={[0, chassisY + bodyH * 0.4, l / 2 + 0.07]}><boxGeometry args={[w * 0.75, bodyH * 0.55, 0.1]} /><meshStandardMaterial color={black} /></mesh>
        {[0.25, 0.5, 0.75].map((t, i) => (<mesh key={i} position={[0, chassisY + bodyH * 0.15 + bodyH * 0.55 * t, l / 2 + 0.13]}><boxGeometry args={[w * 0.73, 0.05, 0.05]} /><meshStandardMaterial color={chrome} metalness={0.6} /></mesh>))}
        {[-1, 1].map((s, i) => (<mesh key={i} position={[s * w * 0.38, chassisY + bodyH * 0.78, l / 2 + 0.07]}><boxGeometry args={[0.22, 0.14, 0.07]} /><meshStandardMaterial color="#FFFFCC" emissive="#FFFF99" emissiveIntensity={0.4} /></mesh>))}
        <mesh position={[0, chassisY + 0.12, l / 2 + 0.12]}><boxGeometry args={[w + 0.2, 0.35, 0.2]} /><meshStandardMaterial color={dark} /></mesh>
        <mesh position={[0, chassisY - 0.05, l / 2 + 0.12]}><boxGeometry args={[w * 0.7, 0.12, 0.2]} /><meshStandardMaterial color="#555" metalness={0.5} /></mesh>
        <mesh position={[0, chassisY + 0.12, -l / 2 - 0.1]}><boxGeometry args={[w + 0.1, 0.28, 0.16]} /><meshStandardMaterial color={dark} /></mesh>
        {[-1, 1].map((s, i) => (<mesh key={i} position={[s * w * 0.42, chassisY + bodyH * 0.6, -l / 2 - 0.06]}><boxGeometry args={[0.14, 0.3, 0.07]} /><meshStandardMaterial color="#FF3333" emissive="#FF0000" emissiveIntensity={0.2} /></mesh>))}
        {[l * 0.3, -l * 0.3].map((z) => [-1, 1].map((s) => (
          <group key={`${s}-${z}`}>
            <VehicleWheel x={s * (w * 0.52)} z={z} radius={0.46} tireWidth={0.22} />
            <mesh position={[s * (w / 2 + 0.06), chassisY + 0.3, z]}>
              <boxGeometry args={[0.1, 0.35, 0.85]} />
              <meshStandardMaterial color={darkMid} roughness={0.48} />
            </mesh>
          </group>
        )))}
        {[-1, 1].map((s) => (
          <group key={`side-detail-${s}`}>
            <mesh position={[s * (w / 2 + 0.06), chassisY + 0.1, 0]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[l * 0.72, 0.08, 0.08]} />
              <meshStandardMaterial color={chrome} metalness={0.45} roughness={0.28} />
            </mesh>
            <mesh position={[s * (w / 2 + 0.08), chassisY + bodyH * 0.68, l * 0.22]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[l * 0.18, 0.05, 0.04]} />
              <meshStandardMaterial color={chrome} metalness={0.45} roughness={0.28} />
            </mesh>
            <mesh position={[s * (w / 2 + 0.08), chassisY + bodyH * 0.68, -l * 0.12]} rotation={[0, Math.PI / 2, 0]}>
              <boxGeometry args={[l * 0.18, 0.05, 0.04]} />
              <meshStandardMaterial color={chrome} metalness={0.45} roughness={0.28} />
            </mesh>
          </group>
        ))}
        {[-1, 1].map((s, i) => (<mesh key={i} position={[s * (w * 0.52), chassisY - 0.1, 0]}><boxGeometry args={[0.08, 0.08, l * 0.45]} /><meshStandardMaterial color={black} metalness={0.3} /></mesh>))}
      </group>
    )
  }

// Render the appropriate 3D model based on object id
function render3DModel(obj) {
  switch (obj.id) {
    case 'soccerField':
      return <SoccerField3D obj={obj} />
    case 'basketballCourt':
      return <BasketballCourt3D obj={obj} />
    case 'tennisCourt':
      return <TennisCourt3D obj={obj} />
    case 'boxingRing':
      return <BoxingRing3D obj={obj} />
    case 'volleyballCourt':
      return <VolleyballCourt3D obj={obj} />
    case 'footballField':
      return <FootballField3D obj={obj} />
    case 'padelCourt':
      return <PadelCourt3D obj={obj} />
    case 'house':
      return <House3D obj={obj} />
    case 'parkingSpace':
      return <ParkingSpace3D obj={obj} />
    // Landmarks
    case 'eiffelTower':
      return <EiffelTower3D obj={obj} />
    case 'statueOfLiberty':
      return <StatueOfLiberty3D obj={obj} />
    case 'greatPyramid':
      return <GreatPyramid3D obj={obj} />
    case 'tajMahal':
      return <TajMahal3D obj={obj} />
    case 'colosseum':
      return <Colosseum3D obj={obj} />
    case 'bigBen':
      return <BigBen3D obj={obj} />
    // Commercial
    case 'sevenEleven':
      return <SevenEleven3D obj={obj} />
    case 'mcdonalds':
      return <McDonalds3D obj={obj} />
    case 'gasStation':
      return <GasStation3D obj={obj} />
    case 'supermarket':
      return <Supermarket3D obj={obj} />
    case 'starbucks':
      return <Starbucks3D obj={obj} />
    case 'walmart':
      return <Walmart3D obj={obj} />
    // Gaming
    case 'pokemonCenter':
      return <PokemonCenter3D obj={obj} />
    case 'minecraftHouse':
      return <MinecraftHouse3D obj={obj} />
    case 'acHouse':
      return <ACHouse3D obj={obj} />
    case 'fortnite1x1':
      return <Fortnite1x13D obj={obj} />
    case 'zeldaHouse':
      return <ZeldaHouse3D obj={obj} />
    case 'simsHouse':
      return <SimsHouse3D obj={obj} />
    case 'studioApartment':
      return <StudioApartment3D obj={obj} />
    // Buildings
    case 'mediumHouse':
      return <MediumHouse3D obj={obj} />
    case 'largeHouse':
      return <LargeHouse3D obj={obj} />
    case 'shed':
      return <Shed3D obj={obj} />
    case 'garage':
      return <Garage3D obj={obj} />
    case 'barn':
      return <Barn3D obj={obj} />
    case 'workshop':
      return <Workshop3D obj={obj} />
    case 'greenhouse':
      return <Greenhouse3D obj={obj} />
    case 'gazebo':
      return <Gazebo3D obj={obj} />
    case 'carport':
      return <Carport3D obj={obj} />
    case 'gtaHouse':
      return <GTAHouse3D obj={obj} />
    case 'stardewFarm':
      return <StardewFarm3D obj={obj} />
    case 'haloWarthog':
      return <HaloWarthog3D obj={obj} />
    case 'amongUsShip':
      return <AmongUsShip3D obj={obj} />
    case 'olympicTrack':
      return <OlympicTrack3D obj={obj} />
    case 'helipad':
      return <Helipad3D obj={obj} />
    case 'rooftopTerrace':
      return <RooftopTerrace3D obj={obj} />
    // Vehicles
    case 'carSedan':
      return <CarSedan3D obj={obj} />
    case 'shippingContainer':
      return <ShippingContainer3D obj={obj} />
    case 'schoolBus':
      return <SchoolBus3D obj={obj} />
    case 'fordF150':
      return <FordF1503D obj={obj} />
    case 'semiTruck':
      return <SemiTruck3D obj={obj} />
    case 'fireTruck':
      return <FireTruck3D obj={obj} />
    case 'suv':
      return <SUV3D obj={obj} />
    // Other
    case 'swimmingPool':
      return <SwimmingPool3D obj={obj} />
    case 'kingSizeBed':
      return <KingSizeBed3D obj={obj} />
    default:
      return <GenericComparison3D obj={obj} />
  }
}

// ============================================
// GAMING 3D COMPONENTS
// ============================================

function GTAHouse3D({ obj }) {
  const w = obj.width, l = obj.length
  const wallH = 4.5
  const fz = l / 2
  return (
    <group>
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.01,0]}>
        <planeGeometry args={[w+6,l+6]} />
        <meshStandardMaterial color='#8a8a72' />
      </mesh>
      {/* Driveway */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[w*0.3,0.05,fz+2]}>
        <planeGeometry args={[w*0.45,4]} />
        <meshStandardMaterial color='#5a5a5a' />
      </mesh>
      {/* Foundation */}
      <mesh position={[0,0.2,0]}>
        <boxGeometry args={[w,0.4,l]} />
        <meshStandardMaterial color='#a0957a' />
      </mesh>
      {/* Main walls - warm stucco */}
      <mesh position={[0,0.4+wallH/2,0]} castShadow>
        <boxGeometry args={[w,wallH,l]} />
        <meshStandardMaterial color='#d4c4a0' />
      </mesh>
      {/* Barrel tile roof - red-brown */}
      {[0,1,2,3].map(i=>(
        <mesh key={i} position={[0,0.4+wallH+0.3+i*0.45,0]}>
          <boxGeometry args={[w+1.2-i*(w/4.2),0.42,l+0.6]} />
          <meshStandardMaterial color={i%2===0?'#8B3A2A':'#6B2A1A'} />
        </mesh>
      ))}
      {/* Attached garage */}
      <mesh position={[w*0.35,0.4+1.8,-l*0.1]} castShadow>
        <boxGeometry args={[w*0.38,3.6,l*0.5]} />
        <meshStandardMaterial color='#c8b890' />
      </mesh>
      <mesh position={[w*0.35,0.4+3.7,-l*0.1]}>
        <boxGeometry args={[w*0.38+0.4,0.18,l*0.5+0.4]} />
        <meshStandardMaterial color='#6B2A1A' />
      </mesh>
      {/* Garage door */}
      <mesh position={[w*0.35,0.4+1.5,l*0.15+0.06]}>
        <boxGeometry args={[w*0.28,3,0.08]} />
        <meshStandardMaterial color='#888' />
      </mesh>
      {[0.5,1.2,1.9,2.6].map((y,i)=>(
        <mesh key={i} position={[w*0.35,0.4+y,l*0.15+0.12]}>
          <boxGeometry args={[w*0.26,0.04,0.04]} />
          <meshStandardMaterial color='#666' />
        </mesh>
      ))}
      {/* Front door */}
      <mesh position={[-w*0.1,0.4+1.4,fz+0.06]}>
        <boxGeometry args={[1.2,2.8,0.1]} />
        <meshStandardMaterial color='#3d2810' />
      </mesh>
      {/* Front windows */}
      {[-w*0.32,w*0.1].map((x,i)=>(
        <mesh key={i} position={[x,0.4+wallH*0.55,fz+0.06]}>
          <boxGeometry args={[1.4,1.4,0.08]} />
          <meshStandardMaterial color='#6a9ab8' transparent opacity={0.5} />
        </mesh>
      ))}
      {/* Palm tree */}
      <mesh position={[-w*0.5,1.5,fz+1]}>
        <cylinderGeometry args={[0.1,0.15,3,8]} />
        <meshStandardMaterial color='#7a5a30' />
      </mesh>
      <mesh position={[-w*0.5,3.2,fz+1]}>
        <sphereGeometry args={[0.8,8,6]} />
        <meshStandardMaterial color='#2d7a2d' />
      </mesh>
    </group>
  )
}

function StardewFarm3D({ obj }) {
  const w = obj.width, l = obj.length
  return (
    <group>
      {/* Grass base */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.05,0]}>
        <planeGeometry args={[w+4,l+4]} />
        <meshStandardMaterial color='#5a9a3a' />
      </mesh>
      {/* Plowed soil rows */}
      {Array.from({length:8},(_,i)=>(
        <mesh key={i} rotation={[-Math.PI/2,0,0]} position={[-w*0.3+i*(w*0.6/7),0.05,l*0.05]}>
          <planeGeometry args={[w*0.06,l*0.55]} />
          <meshStandardMaterial color='#6b4226' />
        </mesh>
      ))}
      {/* Crop patches - green dots on rows */}
      {Array.from({length:8},(_,i)=>
        Array.from({length:5},(_,j)=>(
          <mesh key={i*5+j} position={[-w*0.3+i*(w*0.6/7),0.08,-l*0.2+j*(l*0.5/4)]}>
            <sphereGeometry args={[0.2,6,4]} />
            <meshStandardMaterial color={['#2d8a2d','#3aaa3a','#1a6a1a','#4aba4a'][j%4]} />
          </mesh>
        ))
      )}
      {/* Small barn */}
      <mesh position={[w*0.35,1.5,-l*0.32]} castShadow>
        <boxGeometry args={[w*0.22,3,l*0.22]} />
        <meshStandardMaterial color='#8B2020' />
      </mesh>
      {/* Barn roof */}
      {[0,1,2].map(i=>(
        <mesh key={i} position={[w*0.35,3.1+i*0.45,-l*0.32]}>
          <boxGeometry args={[w*0.22+0.8-i*0.5,0.4,l*0.22+0.5]} />
          <meshStandardMaterial color='#5a1010' />
        </mesh>
      ))}
      {/* Barn door */}
      <mesh position={[w*0.35,1.2,-l*0.32+l*0.11+0.06]}>
        <boxGeometry args={[1.2,2.4,0.08]} />
        <meshStandardMaterial color='#5a3010' />
      </mesh>
      {/* Farmhouse */}
      <mesh position={[-w*0.32,1.5,l*0.3]} castShadow>
        <boxGeometry args={[w*0.25,3,l*0.22]} />
        <meshStandardMaterial color='#e8dcc8' />
      </mesh>
      {[0,1,2].map(i=>(
        <mesh key={i} position={[-w*0.32,3.1+i*0.4,l*0.3]}>
          <boxGeometry args={[w*0.25+0.8-i*0.5,0.38,l*0.22+0.5]} />
          <meshStandardMaterial color='#8B4513' />
        </mesh>
      ))}
      {/* Silo */}
      <mesh position={[w*0.44,-0.5,-l*0.15]}>
        <cylinderGeometry args={[0.8,0.8,5,12]} />
        <meshStandardMaterial color='#c8c8b0' />
      </mesh>
      <mesh position={[w*0.44,2.6,-l*0.15]}>
        <coneGeometry args={[0.85,1.2,12]} />
        <meshStandardMaterial color='#888' />
      </mesh>
      {/* Fence */}
      {Array.from({length:6},(_,i)=>(
        <mesh key={i} position={[-w*0.5+i*(w*0.9/5),0.5,l*0.48]}>
          <boxGeometry args={[0.12,1,0.12]} />
          <meshStandardMaterial color='#a07040' />
        </mesh>
      ))}
      <mesh position={[0,0.7,l*0.48]}>
        <boxGeometry args={[w*0.9,0.08,0.1]} />
        <meshStandardMaterial color='#a07040' />
      </mesh>
    </group>
  )
}

function HaloWarthog3D({ obj }) {
  const w = obj.width, l = obj.length
  const bodyH = 1.4, chassisH = 0.4
  const baseY = chassisH+0.32
  return (
    <group>
      {/* Chassis */}
      <mesh position={[0,baseY,0]}>
        <boxGeometry args={[w*0.8,chassisH,l*0.88]} />
        <meshStandardMaterial color='#4a5a3a' />
      </mesh>
      {/* Main body - olive military green */}
      <mesh position={[0,baseY+chassisH/2+bodyH*0.35,-l*0.05]} castShadow>
        <boxGeometry args={[w,bodyH*0.7,l*0.65]} />
        <meshStandardMaterial color='#5a6a4a' />
      </mesh>
      {/* Cab/windscreen area */}
      <mesh position={[0,baseY+chassisH/2+bodyH*0.8,l*0.08]} castShadow>
        <boxGeometry args={[w*0.85,bodyH*0.45,l*0.32]} />
        <meshStandardMaterial color='#4a5a3a' />
      </mesh>
      {/* Windshield */}
      <mesh position={[0,baseY+chassisH/2+bodyH*0.82,l*0.24]}>
        <boxGeometry args={[w*0.72,bodyH*0.35,0.06]} />
        <meshStandardMaterial color='#87ceeb' transparent opacity={0.45} />
      </mesh>
      {/* Roll cage bars */}
      {[-w*0.38,w*0.38].map((x,i)=>(
        <mesh key={i} position={[x,baseY+chassisH/2+bodyH*0.9,l*0.05]}>
          <boxGeometry args={[0.08,bodyH*0.6,l*0.32]} />
          <meshStandardMaterial color='#333' metalness={0.5} />
        </mesh>
      ))}
      <mesh position={[0,baseY+chassisH/2+bodyH*1.2,l*0.05]}>
        <boxGeometry args={[w*0.82,0.08,l*0.32]} />
        <meshStandardMaterial color='#333' metalness={0.5} />
      </mesh>
      {/* Rear gun mount platform */}
      <mesh position={[0,baseY+chassisH/2+bodyH*0.5,-l*0.3]}>
        <boxGeometry args={[w*0.6,0.1,l*0.28]} />
        <meshStandardMaterial color='#3a4a2a' />
      </mesh>
      {/* Gun barrel */}
      <mesh position={[0,baseY+chassisH/2+bodyH*0.9,-l*0.3]} rotation={[0.3,0,0]}>
        <cylinderGeometry args={[0.06,0.06,l*0.4,8]} />
        <meshStandardMaterial color='#222' metalness={0.5} />
      </mesh>
      {/* Gun body */}
      <mesh position={[0,baseY+chassisH/2+bodyH*0.75,-l*0.28]}>
        <boxGeometry args={[0.3,0.28,0.5]} />
        <meshStandardMaterial color='#2a2a2a' metalness={0.4} />
      </mesh>
      {/* Headlights */}
      {[-w*0.3,w*0.3].map((x,i)=>(
        <mesh key={i} position={[x,baseY+chassisH/2+bodyH*0.3,l*0.44]}>
          <boxGeometry args={[0.25,0.2,0.06]} />
          <meshStandardMaterial color='#ffffaa' emissive='#ffff88' emissiveIntensity={0.3} />
        </mesh>
      ))}
      {/* 4 big knobby wheels */}
      {[[-w*0.44,l*0.32],[w*0.44,l*0.32],[-w*0.44,-l*0.3],[w*0.44,-l*0.3]].map(([x,z],i)=>(
        <group key={i}>
          <mesh position={[x,0.32,z]} rotation={[0,0,Math.PI/2]}>
            <cylinderGeometry args={[0.32,0.32,0.22,12]} />
            <meshStandardMaterial color='#1a1a1a' />
          </mesh>
          <mesh position={[x,0.32,z]} rotation={[0,0,Math.PI/2]}>
            <cylinderGeometry args={[0.18,0.18,0.24,8]} />
            <meshStandardMaterial color='#444' metalness={0.4} />
          </mesh>
        </group>
      ))}
      {/* Front bumper */}
      <mesh position={[0,baseY+0.1,l*0.46]}>
        <boxGeometry args={[w*0.88,0.28,0.14]} />
        <meshStandardMaterial color='#333' metalness={0.4} />
      </mesh>
    </group>
  )
}

function AmongUsShip3D({ obj }) {
  const w = obj.width, l = obj.length
  const hull = '#2a2a3a'
  const hullLight = '#3a3a4a'
  const vent = '#1a1a2a'
  const glowG = '#00ff88'
  const glowR = '#ff4444'
  return (
    <group>
      {/* Main hull floor */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,-0.05,0]}>
        <planeGeometry args={[w,l]} />
        <meshStandardMaterial color={hull} />
      </mesh>
      {/* Hull walls (low) */}
      <mesh position={[0,0.3,0]}>
        <boxGeometry args={[w,0.6,l]} />
        <meshStandardMaterial color={hullLight} />
      </mesh>
      {/* Cafeteria - center rectangle */}
      <mesh position={[0,0.38,l*0.1]}>
        <boxGeometry args={[w*0.35,0.5,l*0.28]} />
        <meshStandardMaterial color='#1a3a5a' />
      </mesh>
      <mesh position={[0,0.65,l*0.1]}>
        <boxGeometry args={[w*0.37,0.08,l*0.3]} />
        <meshStandardMaterial color='#2a4a6a' />
      </mesh>
      {/* Cafeteria table */}
      <mesh position={[0,0.5,l*0.1]}>
        <boxGeometry args={[w*0.18,0.06,l*0.12]} />
        <meshStandardMaterial color='#8B6528' />
      </mesh>
      {/* Reactor - left circle */}
      <mesh position={[-w*0.38,0.38,l*0.05]}>
        <cylinderGeometry args={[l*0.12,l*0.12,0.5,16]} />
        <meshStandardMaterial color='#1a2a4a' />
      </mesh>
      <mesh position={[-w*0.38,0.65,l*0.05]}>
        <cylinderGeometry args={[l*0.1,l*0.1,0.08,16]} />
        <meshStandardMaterial color={glowG} emissive={glowG} emissiveIntensity={0.5} />
      </mesh>
      {/* Reactor core */}
      <mesh position={[-w*0.38,0.58,l*0.05]}>
        <cylinderGeometry args={[l*0.05,l*0.05,0.2,12]} />
        <meshStandardMaterial color='#00ffcc' emissive='#00ffcc' emissiveIntensity={0.6} />
      </mesh>
      {/* MedBay - right */}
      <mesh position={[w*0.35,0.38,-l*0.1]}>
        <boxGeometry args={[w*0.2,0.5,l*0.2]} />
        <meshStandardMaterial color='#1a3a2a' />
      </mesh>
      {/* Medbay cross */}
      <mesh position={[w*0.35,0.66,-l*0.1]}>
        <boxGeometry args={[0.5,0.08,0.08]} />
        <meshStandardMaterial color='#ff4444' emissive='#ff2222' emissiveIntensity={0.5} />
      </mesh>
      <mesh position={[w*0.35,0.66,-l*0.1]}>
        <boxGeometry args={[0.08,0.08,0.5]} />
        <meshStandardMaterial color='#ff4444' emissive='#ff2222' emissiveIntensity={0.5} />
      </mesh>
      {/* Electrical room - back */}
      <mesh position={[w*0.2,0.38,-l*0.35]}>
        <boxGeometry args={[w*0.28,0.5,l*0.18]} />
        <meshStandardMaterial color='#3a2a1a' />
      </mesh>
      {/* Vents */}
      {[[-w*0.1,l*0.35],[w*0.1,-l*0.3],[-w*0.3,-l*0.2]].map(([x,z],i)=>(
        <group key={i}>
          <mesh position={[x,0.65,z]}>
            <boxGeometry args={[0.6,0.2,0.6]} />
            <meshStandardMaterial color={vent} />
          </mesh>
          <mesh position={[x,0.78,z]}>
            <boxGeometry args={[0.55,0.04,0.55]} />
            <meshStandardMaterial color='#2a2a3a' />
          </mesh>
        </group>
      ))}
      {/* Emergency lights - red strip */}
      {[-w*0.45,-w*0.15,w*0.15,w*0.45].map((x,i)=>(
        <mesh key={i} position={[x,0.65,0]}>
          <boxGeometry args={[0.12,0.12,l*0.9]} />
          <meshStandardMaterial color={glowR} emissive={glowR} emissiveIntensity={0.4} />
        </mesh>
      ))}
      {/* Navigation room - front */}
      <mesh position={[0,0.38,l*0.36]}>
        <boxGeometry args={[w*0.25,0.5,l*0.12]} />
        <meshStandardMaterial color='#1a1a3a' />
      </mesh>
      {/* Nav screens */}
      {[-0.8,0,0.8].map((x,i)=>(
        <mesh key={i} position={[x,0.55,l*0.41]}>
          <boxGeometry args={[0.4,0.3,0.06]} />
          <meshStandardMaterial color='#0044ff' emissive='#0033cc' emissiveIntensity={0.4} />
        </mesh>
      ))}
    </group>
  )
}

// ============================================
// OTHER 3D COMPONENTS
// ============================================

function OlympicTrack3D({ obj }) {
  const w = obj.width, l = obj.length
  return (
    <group>
      {/* Infield grass */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.02,0]}>
        <planeGeometry args={[w*0.72,l*0.62]} />
        <meshStandardMaterial color='#3a8a3a' />
      </mesh>
      {/* Track surface - reddish rubber */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.01,0]}>
        <planeGeometry args={[w,l]} />
        <meshStandardMaterial color='#c84820' />
      </mesh>
      {/* Lane lines - 8 lanes */}
      {Array.from({length:9},(_,i)=>{
        const t = i/8
        const lw = w*0.14+t*(w*0.36)
        const ll = l*0.3+t*(l*0.3)
        return (
          <group key={i}>
            {/* Straight sides */}
            <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.03,l*(0.3-t*0.15)]}>
              <planeGeometry args={[lw*2,0.06]} />
              <meshStandardMaterial color='#fff' />
            </mesh>
            <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.03,-l*(0.3-t*0.15)]}>
              <planeGeometry args={[lw*2,0.06]} />
              <meshStandardMaterial color='#fff' />
            </mesh>
          </group>
        )
      })}
      {/* 100m straight highlighted */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.04,0]}>
        <planeGeometry args={[w*0.06,l*0.54]} />
        <meshStandardMaterial color='#e06010' />
      </mesh>
      {/* Finish line */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.05,-l*0.27]}>
        <planeGeometry args={[w*0.82,0.12]} />
        <meshStandardMaterial color='#fff' />
      </mesh>
      {/* Start line */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.05,l*0.27]}>
        <planeGeometry args={[w*0.82,0.12]} />
        <meshStandardMaterial color='#fff' />
      </mesh>
      {/* Long jump sand pit */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[w*0.42,0.04,l*0.1]}>
        <planeGeometry args={[w*0.06,l*0.1]} />
        <meshStandardMaterial color='#e8d090' />
      </mesh>
      {/* Scoreboard */}
      <mesh position={[w*0.55,3,-l*0.3]}>
        <boxGeometry args={[6,4,0.4]} />
        <meshStandardMaterial color='#111' />
      </mesh>
      <mesh position={[w*0.55,3,-l*0.3+0.22]}>
        <boxGeometry args={[5.5,3.5,0.1]} />
        <meshStandardMaterial color='#0a0a2a' emissive='#0000ff' emissiveIntensity={0.1} />
      </mesh>
      {/* Scoreboard poles */}
      {[-2,2].map((x,i)=>(
        <mesh key={i} position={[w*0.55+x,1.2,-l*0.3]}>
          <cylinderGeometry args={[0.15,0.15,2.4,8]} />
          <meshStandardMaterial color='#666' metalness={0.4} />
        </mesh>
      ))}
    </group>
  )
}

function Helipad3D({ obj }) {
  const w = obj.width
  return (
    <group>
      {/* Concrete pad */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.05,0]}>
        <planeGeometry args={[w,w]} />
        <meshStandardMaterial color='#707070' />
      </mesh>
      {/* Yellow border circle */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.06,0]}>
        <ringGeometry args={[w*0.44,w*0.5,40]} />
        <meshStandardMaterial color='#f5c842' />
      </mesh>
      {/* H marking - horizontal bar */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.07,0]}>
        <planeGeometry args={[w*0.5,w*0.1]} />
        <meshStandardMaterial color='#f5f5f5' />
      </mesh>
      {/* H marking - left vertical */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[-w*0.18,0.07,0]}>
        <planeGeometry args={[w*0.1,w*0.48]} />
        <meshStandardMaterial color='#f5f5f5' />
      </mesh>
      {/* H marking - right vertical */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[w*0.18,0.07,0]}>
        <planeGeometry args={[w*0.1,w*0.48]} />
        <meshStandardMaterial color='#f5f5f5' />
      </mesh>
      {/* Corner lights */}
      {[[-1,-1],[-1,1],[1,-1],[1,1]].map(([sx,sz],i)=>(
        <mesh key={i} position={[sx*w*0.44,0.12,sz*w*0.44]}>
          <cylinderGeometry args={[0.15,0.15,0.2,8]} />
          <meshStandardMaterial color='#ff8800' emissive='#ff6600' emissiveIntensity={0.6} />
        </mesh>
      ))}
      {/* Wind sock pole */}
      <mesh position={[w*0.45,1.5,w*0.45]}>
        <cylinderGeometry args={[0.05,0.05,3,6]} />
        <meshStandardMaterial color='#aaa' metalness={0.4} />
      </mesh>
      <mesh position={[w*0.45+0.4,3.1,w*0.45]} rotation={[0,0,-0.4]}>
        <coneGeometry args={[0.15,0.8,8,1,true]} />
        <meshStandardMaterial color='#ff8800' />
      </mesh>
    </group>
  )
}

function RooftopTerrace3D({ obj }) {
  const w = obj.width, l = obj.length
  return (
    <group>
      {/* Wooden deck */}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.08,0]}>
        <planeGeometry args={[w,l]} />
        <meshStandardMaterial color='#a07848' />
      </mesh>
      {/* Deck plank lines */}
      {Array.from({length:10},(_,i)=>(
        <mesh key={i} rotation={[-Math.PI/2,0,0]} position={[0,0.09,-l/2+i*(l/9)]}>
          <planeGeometry args={[w,0.04]} />
          <meshStandardMaterial color='#886030' />
        </mesh>
      ))}
      {/* Pergola posts */}
      {[[-w*0.35,-l*0.35],[-w*0.35,l*0.35],[w*0.35,-l*0.35],[w*0.35,l*0.35]].map(([x,z],i)=>(
        <mesh key={i} position={[x,1.5,z]}>
          <boxGeometry args={[0.12,3,0.12]} />
          <meshStandardMaterial color='#f5f5f0' />
        </mesh>
      ))}
      {/* Pergola beams - along length */}
      {[-w*0.35,w*0.35].map((x,i)=>(
        <mesh key={i} position={[x,3.02,0]}>
          <boxGeometry args={[0.1,0.12,l*0.72]} />
          <meshStandardMaterial color='#f5f5f0' />
        </mesh>
      ))}
      {/* Pergola cross slats */}
      {[-l*0.25,0,l*0.25].map((z,i)=>(
        <mesh key={i} position={[0,3.1,z]}>
          <boxGeometry args={[w*0.72,0.08,0.08]} />
          <meshStandardMaterial color='#e8e8e0' />
        </mesh>
      ))}
      {/* Sofa / seating */}
      <mesh position={[-w*0.28,0.3,l*0.25]}>
        <boxGeometry args={[w*0.3,0.35,l*0.12]} />
        <meshStandardMaterial color='#607890' />
      </mesh>
      <mesh position={[-w*0.28,0.5,l*0.31]}>
        <boxGeometry args={[w*0.3,0.4,0.08]} />
        <meshStandardMaterial color='#506880' />
      </mesh>
      {/* Coffee table */}
      <mesh position={[-w*0.28,0.28,l*0.15]}>
        <boxGeometry args={[w*0.14,0.06,l*0.08]} />
        <meshStandardMaterial color='#5a3820' />
      </mesh>
      {/* Planter boxes */}
      {[-w*0.42,-w*0.42,w*0.42,w*0.42].map((x,i)=>(
        <group key={i}>
          <mesh position={[x,0.3,(-l*0.35+i*l*0.25)]}>
            <boxGeometry args={[0.5,0.5,0.5]} />
            <meshStandardMaterial color='#5a4030' />
          </mesh>
          <mesh position={[x,0.65,(-l*0.35+i*l*0.25)]}>
            <sphereGeometry args={[0.28,8,6]} />
            <meshStandardMaterial color='#2a6a2a' />
          </mesh>
        </group>
      ))}
      {/* String lights along pergola */}
      {Array.from({length:6},(_,i)=>(
        <mesh key={i} position={[-w*0.32+i*(w*0.64/5),3.0,l*0.35]}>
          <sphereGeometry args={[0.04,4,4]} />
          <meshStandardMaterial color='#ffee88' emissive='#ffcc44' emissiveIntensity={0.8} />
        </mesh>
      ))}
      {/* Railing around perimeter */}
      {[
        [0,l/2+0.04,w,0.08],
        [0,-l/2-0.04,w,0.08],
        [w/2+0.04,0,0.08,l],
        [-w/2-0.04,0,0.08,l]
      ].map(([x,z,rw,rl],i)=>(
        <mesh key={i} position={[x,0.55,z]}>
          <boxGeometry args={[rw,0.06,rl]} />
          <meshStandardMaterial color='#c0c0c0' metalness={0.4} />
        </mesh>
      ))}
      <mesh rotation={[-Math.PI/2,0,0]} position={[0,0.56,l/2+0.04]}>
        <planeGeometry args={[w,0.5]} />
        <meshStandardMaterial color='#c0c0c0' transparent opacity={0.25} metalness={0.3} />
      </mesh>
    </group>
  )
}

// Main ComparisonObject component
export function ComparisonObject({ obj, index, totalObjects, lengthUnit = 'm', position, onPositionChange, rotation = 0, onRotationChange, polygonPoints, allObjects, allPositions, allRotations = {}, onSnapLineChange, isOverlapping, gridSnapEnabled = false, gridSize = 1, viewMode = 'firstPerson', isSelected = false, onSelect, onDeselect }) {
  const { camera, gl } = useThree()
  const groupRef = useRef()
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [snapType, setSnapType] = useState('none') // 'none', 'edge', 'object', 'center'
  const dragStartRef = useRef(null)

  // Default position: stagger objects so they don't stack
  const defaultX = (index - (totalObjects - 1) / 2) * 15
  const defaultZ = 0
  const currentPos = position || { x: defaultX, z: defaultZ }

  // Ground plane for raycasting
  const groundPlane = useMemo(() => new THREE.Plane(new THREE.Vector3(0, 1, 0), 0), [])
  const raycaster = useMemo(() => new THREE.Raycaster(), [])

  // Calculate snapped position with edge-to-edge and land boundary snapping
  const applySnap = useCallback((pos) => {
    let snappedX = pos.x
    let snappedZ = pos.z
    let snapLines = []
    let foundSnap = false

    // Get rotated dimensions for this object
    const dims = getRotatedDimensions(obj.width, obj.length, rotation)
    const draggedBounds = getObjectBounds(pos.x, pos.z, obj.width, obj.length, rotation)

    // Only do edge snapping if this object is axis-aligned
    const canEdgeSnap = isAxisAligned(rotation)

    // 1. Check edge-to-edge snap with other objects (only if axis-aligned)
    if (canEdgeSnap && allObjects && allPositions) {
      for (const other of allObjects) {
        if (other.id === obj.id) continue

        const otherDefaultX = (allObjects.indexOf(other) - (allObjects.length - 1) / 2) * 15
        const otherPos = allPositions[other.id] || { x: otherDefaultX, z: 0 }
        const otherRotation = allRotations[other.id] || 0

        // Only snap to other objects that are also axis-aligned
        if (!isAxisAligned(otherRotation)) continue

        const otherBounds = getObjectBounds(otherPos.x, otherPos.z, other.width, other.length, otherRotation)

        // Check horizontal edge snapping (left/right edges)
        // Snap dragged right edge to other left edge
        if (Math.abs(draggedBounds.right - otherBounds.left) < SNAP_THRESHOLD) {
          snappedX = otherBounds.left - dims.width / 2
          snapLines.push({ type: 'vertical', x: otherBounds.left, z1: Math.min(draggedBounds.bottom, otherBounds.bottom), z2: Math.max(draggedBounds.top, otherBounds.top) })
          foundSnap = true
        }
        // Snap dragged left edge to other right edge
        else if (Math.abs(draggedBounds.left - otherBounds.right) < SNAP_THRESHOLD) {
          snappedX = otherBounds.right + dims.width / 2
          snapLines.push({ type: 'vertical', x: otherBounds.right, z1: Math.min(draggedBounds.bottom, otherBounds.bottom), z2: Math.max(draggedBounds.top, otherBounds.top) })
          foundSnap = true
        }

        // Check vertical edge snapping (top/bottom edges)
        // Snap dragged top edge to other bottom edge
        if (Math.abs(draggedBounds.top - otherBounds.bottom) < SNAP_THRESHOLD) {
          snappedZ = otherBounds.bottom - dims.length / 2
          snapLines.push({ type: 'horizontal', z: otherBounds.bottom, x1: Math.min(draggedBounds.left, otherBounds.left), x2: Math.max(draggedBounds.right, otherBounds.right) })
          foundSnap = true
        }
        // Snap dragged bottom edge to other top edge
        else if (Math.abs(draggedBounds.bottom - otherBounds.top) < SNAP_THRESHOLD) {
          snappedZ = otherBounds.top + dims.length / 2
          snapLines.push({ type: 'horizontal', z: otherBounds.top, x1: Math.min(draggedBounds.left, otherBounds.left), x2: Math.max(draggedBounds.right, otherBounds.right) })
          foundSnap = true
        }
      }
    }

    // 2. Check land boundary snapping (if axis-aligned and we have polygon points)
    if (canEdgeSnap && !foundSnap && polygonPoints && polygonPoints.length > 0) {
      // Calculate land bounds from polygon
      const xs = polygonPoints.map(p => p.x)
      const zs = polygonPoints.map(p => p.z)
      const landBounds = {
        left: Math.min(...xs),
        right: Math.max(...xs),
        top: Math.max(...zs),
        bottom: Math.min(...zs)
      }

      // Snap to land edges
      if (Math.abs(draggedBounds.left - landBounds.left) < SNAP_THRESHOLD) {
        snappedX = landBounds.left + dims.width / 2
        snapLines.push({ type: 'vertical', x: landBounds.left, z1: landBounds.bottom, z2: landBounds.top })
        foundSnap = true
      } else if (Math.abs(draggedBounds.right - landBounds.right) < SNAP_THRESHOLD) {
        snappedX = landBounds.right - dims.width / 2
        snapLines.push({ type: 'vertical', x: landBounds.right, z1: landBounds.bottom, z2: landBounds.top })
        foundSnap = true
      }

      if (Math.abs(draggedBounds.bottom - landBounds.bottom) < SNAP_THRESHOLD) {
        snappedZ = landBounds.bottom + dims.length / 2
        snapLines.push({ type: 'horizontal', z: landBounds.bottom, x1: landBounds.left, x2: landBounds.right })
        foundSnap = true
      } else if (Math.abs(draggedBounds.top - landBounds.top) < SNAP_THRESHOLD) {
        snappedZ = landBounds.top - dims.length / 2
        snapLines.push({ type: 'horizontal', z: landBounds.top, x1: landBounds.left, x2: landBounds.right })
        foundSnap = true
      }
    }

    // 3. Grid snapping as fallback
    if (!foundSnap && gridSnapEnabled) {
      snappedX = Math.round(pos.x / gridSize) * gridSize
      snappedZ = Math.round(pos.z / gridSize) * gridSize
    }

    // Update snap type indicator
    setSnapType(snapLines.length > 0 ? 'edge' : (gridSnapEnabled ? 'grid' : 'none'))

    return { x: snappedX, z: snappedZ, snapLines }
  }, [obj, rotation, allObjects, allPositions, allRotations, polygonPoints, gridSnapEnabled, gridSize])

  // Handle pointer down - start drag
  const handlePointerDown = useCallback((e) => {
    e.stopPropagation()

    // No object interaction in first-person mode
    if (viewMode === 'firstPerson') return

    // Select on click
    if (onSelect) {
      onSelect(obj.id)
    }

    // Start drag tracking
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      pointerType: e.pointerType,
      startPos: { ...currentPos }
    }
  }, [obj.id, currentPos, onSelect, viewMode])

  // Handle pointer move - drag
  const handlePointerMove = useCallback((e) => {
    if (!dragStartRef.current) return

    // Check if we've moved past drag threshold
    const dx = e.clientX - dragStartRef.current.clientX
    const dy = e.clientY - dragStartRef.current.clientY
    const distance = Math.sqrt(dx * dx + dy * dy)

    // Use pointer-type-aware threshold
    const threshold = getDragThreshold(dragStartRef.current.pointerType)

    if (distance > threshold) {
      if (!isDragging) {
        setIsDragging(true)
        gl.domElement.style.cursor = 'grabbing'
      }

      // Raycast to ground plane
      const rect = gl.domElement.getBoundingClientRect()
      const mouse = new THREE.Vector2(
        ((e.clientX - rect.left) / rect.width) * 2 - 1,
        -((e.clientY - rect.top) / rect.height) * 2 + 1
      )
      raycaster.setFromCamera(mouse, camera)

      const intersection = new THREE.Vector3()
      if (raycaster.ray.intersectPlane(groundPlane, intersection)) {
        const snapped = applySnap({ x: intersection.x, z: intersection.z })
        onPositionChange?.(obj.id, { x: snapped.x, z: snapped.z })
        onSnapLineChange?.(snapped.snapLines)
      }
    }
  }, [isDragging, camera, gl, raycaster, groundPlane, applySnap, obj.id, onPositionChange, onSnapLineChange])

  // Handle pointer up - end drag
  const handlePointerUp = useCallback((e) => {
    if (isDragging) {
      setIsDragging(false)
      gl.domElement.style.cursor = 'auto'
      onSnapLineChange?.([])
    }
    dragStartRef.current = null
  }, [isDragging, gl, onSnapLineChange])

  // Global pointer events for drag
  useEffect(() => {
    if (dragStartRef.current) {
      window.addEventListener('pointermove', handlePointerMove)
      window.addEventListener('pointerup', handlePointerUp)
      return () => {
        window.removeEventListener('pointermove', handlePointerMove)
        window.removeEventListener('pointerup', handlePointerUp)
      }
    }
  }, [handlePointerMove, handlePointerUp])

  const is2D = viewMode === '2d'

  return (
    <group
      ref={groupRef}
      position={[currentPos.x, 0, currentPos.z]}
      rotation={[0, (rotation * Math.PI) / 180, 0]}
      onPointerDown={handlePointerDown}
      onPointerEnter={() => {
        if (viewMode === 'firstPerson') return
        setIsHovered(true)
        gl.domElement.style.cursor = 'grab'
      }}
      onPointerLeave={() => {
        setIsHovered(false)
        if (!isDragging) gl.domElement.style.cursor = 'auto'
      }}
    >
      {/* 3D Model */}
      {render3DModel(obj)}

      {/* Selection/hover outline */}
      {(isSelected || isHovered) && (
        <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
          <planeGeometry args={[obj.width + 0.4, obj.length + 0.4]} />
          <meshBasicMaterial color={isSelected ? '#14B8A6' : '#3B82F6'} transparent opacity={0.2} />
        </mesh>
      )}

      {/* Label */}
      {!is2D && (
        <Billboard position={[0, 3.5, 0]} follow={true}>
          <Text
            fontSize={0.5}
            color="#ffffff"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.05}
            outlineColor="#000000"
          >
            {obj.name}
          </Text>
          <Text
            position={[0, -0.6, 0]}
            fontSize={0.35}
            color="#d1d5db"
            anchorX="center"
            anchorY="middle"
            outlineWidth={0.03}
            outlineColor="#000000"
          >
            {formatDimension(obj.width, lengthUnit)} × {formatDimension(obj.length, lengthUnit)}
          </Text>
        </Billboard>
      )}

      {/* Snap indicator */}
      {isDragging && snapType !== 'none' && (
        <mesh position={[0, 0.15, 0]}>
          <sphereGeometry args={[0.3, 16, 16]} />
          <meshBasicMaterial color="#14B8A6" />
        </mesh>
      )}

      {/* Overlap warning indicator */}
      {isOverlapping && (
        <mesh position={[0, 0.1, 0]} rotation={[-Math.PI / 2, 0, 0]}>
          <planeGeometry args={[obj.width + 0.5, obj.length + 0.5]} />
          <meshBasicMaterial color="#EF4444" transparent opacity={0.3} />
        </mesh>
      )}
    </group>
  )
}

// Snap guide line component
export function SnapGuideLine({ line }) {
  if (line.type === 'vertical') {
    return (
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([line.x, 0.15, line.z1, line.x, 0.15, line.z2])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineDashedMaterial color="#14B8A6" dashSize={0.5} gapSize={0.3} linewidth={2} />
      </line>
    )
  } else {
    return (
      <line>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={2}
            array={new Float32Array([line.x1, 0.15, line.z, line.x2, 0.15, line.z])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineDashedMaterial color="#14B8A6" dashSize={0.5} gapSize={0.3} linewidth={2} />
      </line>
    )
  }
}

// Export utility functions for use in LandScene
export { isAxisAligned, getRotatedDimensions, getObjectBounds, checkOverlap, SNAP_THRESHOLD }
