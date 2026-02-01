import { useMemo, useState, useRef, useCallback, useEffect } from 'react'
import { useThree, useFrame } from '@react-three/fiber'
import { Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'
import { formatDimension, FEET_PER_METER } from '../../constants/landSceneConstants'

// Create textures for comparison objects
function useSoccerFieldTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Green grass base
    ctx.fillStyle = '#2d8a2d'
    ctx.fillRect(0, 0, w, h)

    // Grass stripes
    ctx.fillStyle = '#259925'
    for (let i = 0; i < h; i += h / 12) {
      ctx.fillRect(0, i, w, h / 24)
    }

    // White lines
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 4

    // Outer boundary
    ctx.strokeRect(20, 20, w - 40, h - 40)

    // Center line
    ctx.beginPath()
    ctx.moveTo(20, h / 2)
    ctx.lineTo(w - 20, h / 2)
    ctx.stroke()

    // Center circle
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w * 0.15, 0, Math.PI * 2)
    ctx.stroke()

    // Center dot
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, 4, 0, Math.PI * 2)
    ctx.fillStyle = '#ffffff'
    ctx.fill()

    // Penalty areas
    const penaltyW = w * 0.6, penaltyH = h * 0.15
    ctx.strokeRect((w - penaltyW) / 2, 20, penaltyW, penaltyH)
    ctx.strokeRect((w - penaltyW) / 2, h - 20 - penaltyH, penaltyW, penaltyH)

    // Goal areas
    const goalW = w * 0.3, goalH = h * 0.05
    ctx.strokeRect((w - goalW) / 2, 20, goalW, goalH)
    ctx.strokeRect((w - goalW) / 2, h - 20 - goalH, goalW, goalH)

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

function useBasketballCourtTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Tan court
    ctx.fillStyle = '#c4a66a'
    ctx.fillRect(0, 0, w, h)

    // Wood grain effect
    ctx.strokeStyle = 'rgba(139, 90, 43, 0.15)'
    ctx.lineWidth = 1
    for (let i = 0; i < w; i += 8) {
      ctx.beginPath()
      ctx.moveTo(i, 0)
      ctx.lineTo(i, h)
      ctx.stroke()
    }

    // White lines
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3

    // Outer boundary
    ctx.strokeRect(15, 15, w - 30, h - 30)

    // Center line
    ctx.beginPath()
    ctx.moveTo(15, h / 2)
    ctx.lineTo(w - 15, h / 2)
    ctx.stroke()

    // Center circle
    ctx.beginPath()
    ctx.arc(w / 2, h / 2, w * 0.12, 0, Math.PI * 2)
    ctx.stroke()

    // Keys/paint areas
    const keyW = w * 0.25, keyH = h * 0.18
    ctx.fillStyle = 'rgba(139, 69, 19, 0.3)'
    ctx.fillRect((w - keyW) / 2, 15, keyW, keyH)
    ctx.fillRect((w - keyW) / 2, h - 15 - keyH, keyW, keyH)
    ctx.strokeRect((w - keyW) / 2, 15, keyW, keyH)
    ctx.strokeRect((w - keyW) / 2, h - 15 - keyH, keyW, keyH)

    // Three-point arcs
    ctx.beginPath()
    ctx.arc(w / 2, 15, w * 0.35, 0, Math.PI)
    ctx.stroke()
    ctx.beginPath()
    ctx.arc(w / 2, h - 15, w * 0.35, Math.PI, Math.PI * 2)
    ctx.stroke()

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

function useTennisCourtTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Blue court
    ctx.fillStyle = '#2563eb'
    ctx.fillRect(0, 0, w, h)

    // White lines
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 3

    // Outer boundary
    ctx.strokeRect(20, 20, w - 40, h - 40)

    // Service boxes
    const serviceH = h * 0.35
    ctx.beginPath()
    ctx.moveTo(20, h / 2 - serviceH / 2)
    ctx.lineTo(w - 20, h / 2 - serviceH / 2)
    ctx.moveTo(20, h / 2 + serviceH / 2)
    ctx.lineTo(w - 20, h / 2 + serviceH / 2)
    ctx.stroke()

    // Center service line
    ctx.beginPath()
    ctx.moveTo(w / 2, h / 2 - serviceH / 2)
    ctx.lineTo(w / 2, h / 2 + serviceH / 2)
    ctx.stroke()

    // Center mark
    ctx.beginPath()
    ctx.moveTo(w / 2, 20)
    ctx.lineTo(w / 2, 35)
    ctx.moveTo(w / 2, h - 20)
    ctx.lineTo(w / 2, h - 35)
    ctx.stroke()

    // Net line
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 2
    ctx.setLineDash([8, 4])
    ctx.beginPath()
    ctx.moveTo(15, h / 2)
    ctx.lineTo(w - 15, h / 2)
    ctx.stroke()
    ctx.setLineDash([])

    return new THREE.CanvasTexture(canvas)
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
    ctx.fillStyle = '#374151'
    ctx.fillRect(0, 0, w, h)

    // Asphalt texture
    for (let i = 0; i < 200; i++) {
      const shade = Math.random() * 20 - 10
      ctx.fillStyle = `rgb(${55 + shade}, ${65 + shade}, ${81 + shade})`
      ctx.fillRect(Math.random() * w, Math.random() * h, 2, 2)
    }

    // White border lines
    ctx.strokeStyle = '#ffffff'
    ctx.lineWidth = 6
    ctx.strokeRect(10, 10, w - 20, h - 20)

    // Parking symbol (P)
    ctx.fillStyle = 'rgba(255, 255, 255, 0.3)'
    ctx.font = 'bold 80px sans-serif'
    ctx.textAlign = 'center'
    ctx.textBaseline = 'middle'
    ctx.fillText('P', w / 2, h / 2)

    return new THREE.CanvasTexture(canvas)
  }, [width, length])
}

// Soccer Field with goal posts
function SoccerField3D({ obj }) {
  const texture = useSoccerFieldTexture(obj.width, obj.length)
  const goalWidth = 7.32, goalHeight = 2.44, goalDepth = 2

  return (
    <group>
      {/* Field surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
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
            <meshStandardMaterial color="#ffffff" transparent opacity={0.3} side={THREE.DoubleSide} />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Basketball Court with hoops
function BasketballCourt3D({ obj }) {
  const texture = useBasketballCourtTexture(obj.width, obj.length)
  const poleHeight = 3, rimHeight = 3.05, backboardWidth = 1.8, backboardHeight = 1.05

  return (
    <group>
      {/* Court surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
      </mesh>

      {/* Hoops at each end */}
      {[-1, 1].map((side) => (
        <group key={side} position={[0, 0, side * (obj.length / 2 - 1.2)]}>
          {/* Pole */}
          <mesh position={[0, poleHeight / 2, side * 0.5]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, poleHeight, 8]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          {/* Backboard */}
          <mesh position={[0, rimHeight + backboardHeight / 2 - 0.15, 0]} castShadow>
            <boxGeometry args={[backboardWidth, backboardHeight, 0.05]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
          {/* Backboard frame */}
          <mesh position={[0, rimHeight + backboardHeight / 2 - 0.15, -side * 0.03]}>
            <boxGeometry args={[backboardWidth + 0.1, backboardHeight + 0.1, 0.02]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          {/* Rim */}
          <mesh position={[0, rimHeight, side * 0.25]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.23, 0.02, 8, 24]} />
            <meshStandardMaterial color="#ff6600" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Tennis Court with net
function TennisCourt3D({ obj }) {
  const texture = useTennisCourtTexture(obj.width, obj.length)

  return (
    <group>
      {/* Court surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
      </mesh>

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
        <meshStandardMaterial color="#ffffff" transparent opacity={0.7} side={THREE.DoubleSide} />
      </mesh>
    </group>
  )
}

// 3D House with pitched roof
function House3D({ obj }) {
  const wallHeight = 3, roofHeight = 1.8
  const roofOverhang = 0.4
  const roofAngle = Math.atan2(roofHeight, obj.width / 2)
  const roofSlope = Math.sqrt(roofHeight * roofHeight + (obj.width / 2) * (obj.width / 2))

  return (
    <group>
      {/* Foundation */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width + 0.6, obj.length + 0.6]} />
        <meshStandardMaterial color="#808080" />
      </mesh>

      {/* Main walls */}
      <mesh position={[0, wallHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[obj.width, wallHeight, obj.length]} />
        <meshStandardMaterial color="#f5f0e6" />
      </mesh>

      {/* Roof - left slope */}
      <mesh
        position={[-obj.width / 4, wallHeight + roofHeight / 2, 0]}
        rotation={[0, 0, roofAngle]}
        castShadow
      >
        <boxGeometry args={[roofSlope + 0.3, 0.12, obj.length + roofOverhang * 2]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Roof - right slope */}
      <mesh
        position={[obj.width / 4, wallHeight + roofHeight / 2, 0]}
        rotation={[0, 0, -roofAngle]}
        castShadow
      >
        <boxGeometry args={[roofSlope + 0.3, 0.12, obj.length + roofOverhang * 2]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>

      {/* Roof ridge cap */}
      <mesh position={[0, wallHeight + roofHeight + 0.05, 0]} castShadow>
        <boxGeometry args={[0.2, 0.1, obj.length + roofOverhang * 2]} />
        <meshStandardMaterial color="#6B3A1F" />
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
      <mesh position={[0, 1.1, obj.length / 2 + 0.02]}>
        <boxGeometry args={[1.4, 2.4, 0.08]} />
        <meshStandardMaterial color="#4a3728" />
      </mesh>

      {/* Door */}
      <mesh position={[0, 1.1, obj.length / 2 + 0.06]}>
        <boxGeometry args={[1.1, 2.2, 0.05]} />
        <meshStandardMaterial color="#8B5A2B" />
      </mesh>

      {/* Door handle */}
      <mesh position={[0.4, 1.1, obj.length / 2 + 0.1]}>
        <sphereGeometry args={[0.06, 8, 8]} />
        <meshStandardMaterial color="#C0C0C0" metalness={0.8} roughness={0.2} />
      </mesh>

      {/* Windows - front */}
      {[-obj.width / 3, obj.width / 3].map((x, i) => (
        <group key={`front-${i}`} position={[x, wallHeight / 2 + 0.3, obj.length / 2]}>
          {/* Window frame */}
          <mesh position={[0, 0, 0.02]}>
            <boxGeometry args={[1.2, 1.2, 0.08]} />
            <meshStandardMaterial color="#4a3728" />
          </mesh>
          {/* Window glass */}
          <mesh position={[0, 0, 0.05]}>
            <boxGeometry args={[1.0, 1.0, 0.02]} />
            <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} />
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
        <group key={`side-${side}`} position={[side * obj.width / 2, wallHeight / 2 + 0.3, 0]}>
          {/* Window frame */}
          <mesh position={[side * 0.02, 0, 0]} rotation={[0, Math.PI / 2, 0]}>
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
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
      </mesh>
    </group>
  )
}

// ============================================
// LANDMARK 3D COMPONENTS
// ============================================

// Eiffel Tower - Four legs with cross bracing
function EiffelTower3D({ obj }) {
  const legOffset = obj.width * 0.35
  const legSize = obj.width * 0.12

  return (
    <group>
      {/* Base platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial color="#D4C4A8" />
      </mesh>
      {/* Four corner legs */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dz], i) => (
        <mesh key={i} position={[dx * legOffset, 0.5, dz * legOffset]}>
          <boxGeometry args={[legSize, 1, legSize]} />
          <meshStandardMaterial color="#8B7355" />
        </mesh>
      ))}
      {/* Cross bracing (X pattern) */}
      <mesh position={[0, 0.3, 0]} rotation={[0, Math.PI / 4, 0]}>
        <boxGeometry args={[obj.width * 0.7, 0.2, 0.5]} />
        <meshStandardMaterial color="#6B5344" />
      </mesh>
      <mesh position={[0, 0.3, 0]} rotation={[0, -Math.PI / 4, 0]}>
        <boxGeometry args={[obj.width * 0.7, 0.2, 0.5]} />
        <meshStandardMaterial color="#6B5344" />
      </mesh>
      {/* Center column hint */}
      <mesh position={[0, 1, 0]}>
        <cylinderGeometry args={[1, 3, 2, 8]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
    </group>
  )
}

// Statue of Liberty - Star-shaped base with pedestal
function StatueOfLiberty3D({ obj }) {
  return (
    <group>
      {/* Outer platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial color="#A8C5A8" />
      </mesh>
      {/* Star-shaped fort (11-pointed) */}
      <mesh position={[0, 0.3, 0]}>
        <cylinderGeometry args={[obj.width * 0.4, obj.width * 0.45, 0.6, 11]} />
        <meshStandardMaterial color="#4A7C59" />
      </mesh>
      {/* Pedestal base */}
      <mesh position={[0, 0.8, 0]}>
        <boxGeometry args={[obj.width * 0.25, 1, obj.width * 0.25]} />
        <meshStandardMaterial color="#5A8C69" />
      </mesh>
      {/* Statue hint */}
      <mesh position={[0, 1.8, 0]}>
        <cylinderGeometry args={[1.5, 2, 1.5, 8]} />
        <meshStandardMaterial color="#3D6B4A" />
      </mesh>
    </group>
  )
}

// Great Pyramid - Pyramid shape
function GreatPyramid3D({ obj }) {
  return (
    <group>
      {/* Sand base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width * 1.1, obj.length * 1.1]} />
        <meshStandardMaterial color="#E8D9B5" />
      </mesh>
      {/* Pyramid */}
      <mesh position={[0, 0, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[obj.width * 0.7, obj.width * 0.6, 4]} />
        <meshStandardMaterial color="#D4A84B" />
      </mesh>
    </group>
  )
}

// Taj Mahal - Square with minarets and dome
function TajMahal3D({ obj }) {
  const minaretOffset = obj.width * 0.4
  const minaretRadius = obj.width * 0.03

  return (
    <group>
      {/* Platform */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial color="#F0EDE8" />
      </mesh>
      {/* Main building */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[obj.width * 0.7, 1, obj.length * 0.7]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Central dome */}
      <mesh position={[0, 1.3, 0]}>
        <sphereGeometry args={[obj.width * 0.15, 16, 16, 0, Math.PI * 2, 0, Math.PI / 2]} />
        <meshStandardMaterial color="#FAFAFA" />
      </mesh>
      {/* Four minarets */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dz], i) => (
        <mesh key={i} position={[dx * minaretOffset, 0.8, dz * minaretOffset]}>
          <cylinderGeometry args={[minaretRadius, minaretRadius * 1.2, 1.6, 8]} />
          <meshStandardMaterial color="#F5F5F5" />
        </mesh>
      ))}
    </group>
  )
}

// Colosseum - Elliptical stadium
function Colosseum3D({ obj }) {
  // Colosseum is elliptical - use scale to create ellipse from circle
  const scaleX = 1
  const scaleZ = obj.length / obj.width

  return (
    <group scale={[scaleX, 1, scaleZ]}>
      {/* Outer ellipse footprint */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <ringGeometry args={[obj.width * 0.35, obj.width * 0.5, 32]} />
        <meshStandardMaterial color="#C9B896" side={2} />
      </mesh>
      {/* Outer wall */}
      <mesh position={[0, 0.5, 0]}>
        <cylinderGeometry args={[obj.width * 0.48, obj.width * 0.5, 1, 32, 1, true]} />
        <meshStandardMaterial color="#C9B896" side={2} />
      </mesh>
      {/* Inner arena floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.1, 0]}>
        <circleGeometry args={[obj.width * 0.2, 32]} />
        <meshStandardMaterial color="#E8D8B8" />
      </mesh>
    </group>
  )
}

// Big Ben - Square tower with clock
function BigBen3D({ obj }) {
  return (
    <group>
      {/* Ground area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width * 2, obj.length * 2]} />
        <meshStandardMaterial color="#D4D0C8" />
      </mesh>
      {/* Tower base */}
      <mesh position={[0, 1, 0]}>
        <boxGeometry args={[obj.width * 0.8, 2, obj.length * 0.8]} />
        <meshStandardMaterial color="#8B7355" />
      </mesh>
      {/* Clock face (one side) */}
      <mesh position={[0, 1.5, obj.length * 0.41]}>
        <circleGeometry args={[obj.width * 0.25, 32]} />
        <meshStandardMaterial color="#F5F0E6" />
      </mesh>
      {/* Spire hint */}
      <mesh position={[0, 2.5, 0]}>
        <coneGeometry args={[obj.width * 0.2, 1, 4]} />
        <meshStandardMaterial color="#6B5344" />
      </mesh>
    </group>
  )
}

// ============================================
// COMMERCIAL 3D COMPONENTS
// ============================================

// 7-Eleven convenience store
function SevenEleven3D({ obj }) {
  return (
    <group>
      {/* Parking lot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width * 1.5, obj.length * 1.5]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>
      {/* Building */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[obj.width, 3, obj.length]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Roof/sign band - green */}
      <mesh position={[0, 3.1, 0]}>
        <boxGeometry args={[obj.width + 0.5, 0.5, obj.length + 0.5]} />
        <meshStandardMaterial color="#00703C" />
      </mesh>
      {/* Orange stripe */}
      <mesh position={[0, 2.5, obj.length / 2 + 0.01]}>
        <planeGeometry args={[obj.width, 0.8]} />
        <meshStandardMaterial color="#FF7E00" />
      </mesh>
    </group>
  )
}

// McDonald's restaurant
function McDonalds3D({ obj }) {
  return (
    <group>
      {/* Parking lot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width * 2, obj.length * 2]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>
      {/* Main building */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[obj.width, 4, obj.length]} />
        <meshStandardMaterial color="#DA291C" />
      </mesh>
      {/* Golden roof section */}
      <mesh position={[0, 4.2, 0]}>
        <boxGeometry args={[obj.width + 1, 0.5, obj.length + 1]} />
        <meshStandardMaterial color="#FFC72C" />
      </mesh>
      {/* Drive-through lane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[obj.width * 0.7, 0.02, 0]}>
        <planeGeometry args={[3, obj.length * 1.5]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  )
}

// Gas Station with canopy
function GasStation3D({ obj }) {
  return (
    <group>
      {/* Asphalt lot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial color="#3A3A3A" />
      </mesh>
      {/* Canopy */}
      <mesh position={[-obj.width * 0.15, 4, 0]}>
        <boxGeometry args={[obj.width * 0.5, 0.3, obj.length * 0.4]} />
        <meshStandardMaterial color="#E0E0E0" />
      </mesh>
      {/* Canopy pillars */}
      {[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([dx, dz], i) => (
        <mesh key={i} position={[-obj.width * 0.15 + dx * obj.width * 0.2, 2, dz * obj.length * 0.15]}>
          <cylinderGeometry args={[0.3, 0.3, 4, 8]} />
          <meshStandardMaterial color="#999999" />
        </mesh>
      ))}
      {/* Fuel pumps */}
      {[-1, 0, 1].map((offset, i) => (
        <mesh key={i} position={[-obj.width * 0.15, 0.75, offset * obj.length * 0.1]}>
          <boxGeometry args={[1, 1.5, 0.6]} />
          <meshStandardMaterial color="#FF0000" />
        </mesh>
      ))}
      {/* Convenience store building */}
      <mesh position={[obj.width * 0.3, 2, 0]}>
        <boxGeometry args={[obj.width * 0.3, 4, obj.length * 0.4]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
    </group>
  )
}

// Supermarket
function Supermarket3D({ obj }) {
  return (
    <group>
      {/* Parking lot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, obj.length * 0.4]}>
        <planeGeometry args={[obj.width, obj.length * 0.6]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>
      {/* Main building */}
      <mesh position={[0, 3, -obj.length * 0.1]}>
        <boxGeometry args={[obj.width, 6, obj.length * 0.8]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Green accent band */}
      <mesh position={[0, 6.1, -obj.length * 0.1]}>
        <boxGeometry args={[obj.width + 1, 0.5, obj.length * 0.8 + 1]} />
        <meshStandardMaterial color="#2E8B57" />
      </mesh>
      {/* Entrance canopy */}
      <mesh position={[0, 3.5, obj.length * 0.3]}>
        <boxGeometry args={[obj.width * 0.3, 0.3, 3]} />
        <meshStandardMaterial color="#E0E0E0" />
      </mesh>
    </group>
  )
}

// Starbucks coffee shop
function Starbucks3D({ obj }) {
  return (
    <group>
      {/* Parking/patio area */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width * 1.5, obj.length * 1.5]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>
      {/* Main building */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[obj.width, 4, obj.length]} />
        <meshStandardMaterial color="#1E3932" />
      </mesh>
      {/* Green roof accent */}
      <mesh position={[0, 4.1, 0]}>
        <boxGeometry args={[obj.width + 0.5, 0.3, obj.length + 0.5]} />
        <meshStandardMaterial color="#00704A" />
      </mesh>
      {/* Drive-through lane */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[obj.width * 0.6, 0.02, 0]}>
        <planeGeometry args={[2, obj.length * 1.3]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  )
}

// Walmart Supercenter
function Walmart3D({ obj }) {
  return (
    <group>
      {/* Massive parking lot */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, obj.length * 0.3]}>
        <planeGeometry args={[obj.width * 1.2, obj.length * 0.6]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>
      {/* Main building */}
      <mesh position={[0, 4, -obj.length * 0.15]}>
        <boxGeometry args={[obj.width, 8, obj.length * 0.7]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Blue roof/sign band */}
      <mesh position={[0, 8.2, -obj.length * 0.15]}>
        <boxGeometry args={[obj.width + 2, 0.5, obj.length * 0.7 + 2]} />
        <meshStandardMaterial color="#0071CE" />
      </mesh>
      {/* Entrance area */}
      <mesh position={[0, 4, obj.length * 0.2]}>
        <boxGeometry args={[obj.width * 0.2, 8, 4]} />
        <meshStandardMaterial color="#0071CE" />
      </mesh>
    </group>
  )
}

// Gaming buildings
function PokemonCenter3D({ obj }) {
  const wallHeight = 5
  const roofHeight = 1.5
  const z = obj.length * 0.501
  return (
    <group>
      {/* Ground */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width * 1.3, obj.length * 1.3]} />
        <meshStandardMaterial color="#606080" />
      </mesh>

      {/* Main building body - white */}
      <mesh position={[0, wallHeight / 2, 0]}>
        <boxGeometry args={[obj.width, wallHeight, obj.length]} />
        <meshStandardMaterial color="#E8E8E8" />
      </mesh>

      {/* Horizontal brick lines */}
      {[0.8, 1.6, 2.4, 3.2, 4.0].map((y, i) => (
        <mesh key={i} position={[0, y, z + 0.01]}>
          <planeGeometry args={[obj.width, 0.08]} />
          <meshStandardMaterial color="#D0D0D0" />
        </mesh>
      ))}

      {/* Corner pillars */}
      <mesh position={[-obj.width * 0.48, wallHeight / 2, obj.length * 0.48]}>
        <boxGeometry args={[0.8, wallHeight, 0.8]} />
        <meshStandardMaterial color="#F0F0F0" />
      </mesh>
      <mesh position={[obj.width * 0.48, wallHeight / 2, obj.length * 0.48]}>
        <boxGeometry args={[0.8, wallHeight, 0.8]} />
        <meshStandardMaterial color="#F0F0F0" />
      </mesh>

      {/* Red roof - main */}
      <mesh position={[0, wallHeight + roofHeight / 2, 0]}>
        <boxGeometry args={[obj.width + 1, roofHeight, obj.length + 1]} />
        <meshStandardMaterial color="#B83030" />
      </mesh>
      {/* Roof edge trim */}
      <mesh position={[0, wallHeight + 0.1, 0]}>
        <boxGeometry args={[obj.width + 1.2, 0.2, obj.length + 1.2]} />
        <meshStandardMaterial color="#903030" />
      </mesh>

      {/* Pokeball emblem - white frame/background */}
      <mesh position={[0, wallHeight * 0.65, z + 0.02]}>
        <circleGeometry args={[2.2, 32]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Pokeball outer ring */}
      <mesh position={[0, wallHeight * 0.65, z + 0.03]}>
        <ringGeometry args={[1.7, 2.0, 32]} />
        <meshStandardMaterial color="#C03030" />
      </mesh>
      {/* Red top half */}
      <mesh position={[0, wallHeight * 0.65, z + 0.04]}>
        <circleGeometry args={[1.7, 32, 0, Math.PI]} />
        <meshStandardMaterial color="#C03030" />
      </mesh>
      {/* White bottom half */}
      <mesh position={[0, wallHeight * 0.65, z + 0.04]} rotation={[0, 0, Math.PI]}>
        <circleGeometry args={[1.7, 32, 0, Math.PI]} />
        <meshStandardMaterial color="#F8F8F8" />
      </mesh>
      {/* Center band */}
      <mesh position={[0, wallHeight * 0.65, z + 0.05]}>
        <planeGeometry args={[3.6, 0.35]} />
        <meshStandardMaterial color="#E8E8E8" />
      </mesh>
      {/* Center button - outer */}
      <mesh position={[0, wallHeight * 0.65, z + 0.06]}>
        <circleGeometry args={[0.7, 24]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>
      {/* Center button - red inner */}
      <mesh position={[0, wallHeight * 0.65, z + 0.07]}>
        <circleGeometry args={[0.5, 24]} />
        <meshStandardMaterial color="#C03030" />
      </mesh>
      {/* Center button - white dot */}
      <mesh position={[0, wallHeight * 0.65, z + 0.08]}>
        <circleGeometry args={[0.2, 16]} />
        <meshStandardMaterial color="#FFFFFF" />
      </mesh>

      {/* Blue windows - left side */}
      <mesh position={[-obj.width * 0.32, wallHeight * 0.55, z + 0.02]}>
        <planeGeometry args={[1.2, 2.5]} />
        <meshStandardMaterial color="#4080C0" />
      </mesh>
      <mesh position={[-obj.width * 0.2, wallHeight * 0.55, z + 0.02]}>
        <planeGeometry args={[0.8, 2.5]} />
        <meshStandardMaterial color="#4080C0" />
      </mesh>
      {/* Blue windows - right side */}
      <mesh position={[obj.width * 0.32, wallHeight * 0.55, z + 0.02]}>
        <planeGeometry args={[1.2, 2.5]} />
        <meshStandardMaterial color="#4080C0" />
      </mesh>
      <mesh position={[obj.width * 0.2, wallHeight * 0.55, z + 0.02]}>
        <planeGeometry args={[0.8, 2.5]} />
        <meshStandardMaterial color="#4080C0" />
      </mesh>

      {/* Blue double doors */}
      <mesh position={[-0.6, 1.4, z + 0.02]}>
        <planeGeometry args={[1.1, 2.8]} />
        <meshStandardMaterial color="#4080C0" />
      </mesh>
      <mesh position={[0.6, 1.4, z + 0.02]}>
        <planeGeometry args={[1.1, 2.8]} />
        <meshStandardMaterial color="#4080C0" />
      </mesh>
      {/* Door frame */}
      <mesh position={[0, 1.4, z + 0.01]}>
        <planeGeometry args={[2.6, 3.0]} />
        <meshStandardMaterial color="#505050" />
      </mesh>

      {/* P.C signage - compact on left side */}
      <group position={[-obj.width * 0.32, 1.8, z + 0.02]}>
        {/* Letter P */}
        <mesh position={[0, 0, 0]}>
          <planeGeometry args={[0.2, 0.9]} />
          <meshStandardMaterial color="#C03030" />
        </mesh>
        <mesh position={[0.2, 0.25, 0]}>
          <planeGeometry args={[0.25, 0.2]} />
          <meshStandardMaterial color="#C03030" />
        </mesh>
        <mesh position={[0.3, 0.15, 0]}>
          <planeGeometry args={[0.15, 0.35]} />
          <meshStandardMaterial color="#C03030" />
        </mesh>
        <mesh position={[0.2, 0.05, 0]}>
          <planeGeometry args={[0.25, 0.2]} />
          <meshStandardMaterial color="#C03030" />
        </mesh>

        {/* Dot */}
        <mesh position={[0.55, -0.3, 0]}>
          <circleGeometry args={[0.1, 8]} />
          <meshStandardMaterial color="#C03030" />
        </mesh>

        {/* Letter C */}
        <mesh position={[0.85, 0, 0]}>
          <planeGeometry args={[0.2, 0.9]} />
          <meshStandardMaterial color="#C03030" />
        </mesh>
        <mesh position={[1.05, 0.3, 0]}>
          <planeGeometry args={[0.3, 0.2]} />
          <meshStandardMaterial color="#C03030" />
        </mesh>
        <mesh position={[1.05, -0.3, 0]}>
          <planeGeometry args={[0.3, 0.2]} />
          <meshStandardMaterial color="#C03030" />
        </mesh>
      </group>
    </group>
  )
}

function MinecraftHouse3D({ obj }) {
  return (
    <group>
      {/* Dirt floor */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial color="#6B4423" />
      </mesh>
      {/* Oak plank walls - blocky style */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[obj.width, 4, obj.length]} />
        <meshStandardMaterial color="#8B6914" />
      </mesh>
      {/* Cobblestone base */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[obj.width + 0.2, 1, obj.length + 0.2]} />
        <meshStandardMaterial color="#808080" />
      </mesh>
      {/* Roof - stepped pyramid style */}
      <mesh position={[0, 4.5, 0]}>
        <boxGeometry args={[obj.width + 1, 1, obj.length + 1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      <mesh position={[0, 5.5, 0]}>
        <boxGeometry args={[obj.width - 1, 1, obj.length - 1]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Door opening */}
      <mesh position={[0, 1.5, obj.length * 0.51]}>
        <boxGeometry args={[1, 2, 0.3]} />
        <meshStandardMaterial color="#3B2910" />
      </mesh>
      {/* Window */}
      <mesh position={[obj.width * 0.3, 2.5, obj.length * 0.51]}>
        <boxGeometry args={[1, 1, 0.3]} />
        <meshStandardMaterial color="#87CEEB" />
      </mesh>
    </group>
  )
}

function ACHouse3D({ obj }) {
  // Animal Crossing villager house - cute cottage style
  return (
    <group>
      {/* Grass patch */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width * 1.5, obj.length * 1.5]} />
        <meshStandardMaterial color="#90EE90" />
      </mesh>
      {/* Main house body */}
      <mesh position={[0, 1.5, 0]}>
        <boxGeometry args={[obj.width, 3, obj.length]} />
        <meshStandardMaterial color="#FFEFD5" />
      </mesh>
      {/* Roof - triangular */}
      <mesh position={[0, 3.5, 0]} rotation={[0, Math.PI / 4, 0]}>
        <coneGeometry args={[obj.width * 0.8, 2, 4]} />
        <meshStandardMaterial color="#4169E1" />
      </mesh>
      {/* Door */}
      <mesh position={[0, 1, obj.length * 0.51]}>
        <boxGeometry args={[1, 2, 0.2]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Round window */}
      <mesh position={[obj.width * 0.3, 2, obj.length * 0.51]}>
        <circleGeometry args={[0.4, 16]} />
        <meshStandardMaterial color="#87CEEB" />
      </mesh>
    </group>
  )
}

function Fortnite1x13D({ obj }) {
  // Classic Fortnite 1x1 build - 4 walls
  const wallThickness = 0.2
  const wallHeight = 3
  return (
    <group>
      {/* Floor platform */}
      <mesh position={[0, 0.1, 0]}>
        <boxGeometry args={[obj.width, 0.2, obj.length]} />
        <meshStandardMaterial color="#5B7FDE" />
      </mesh>
      {/* Front wall */}
      <mesh position={[0, wallHeight / 2, obj.length / 2]}>
        <boxGeometry args={[obj.width, wallHeight, wallThickness]} />
        <meshStandardMaterial color="#5B7FDE" transparent opacity={0.8} />
      </mesh>
      {/* Back wall */}
      <mesh position={[0, wallHeight / 2, -obj.length / 2]}>
        <boxGeometry args={[obj.width, wallHeight, wallThickness]} />
        <meshStandardMaterial color="#5B7FDE" transparent opacity={0.8} />
      </mesh>
      {/* Left wall */}
      <mesh position={[-obj.width / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, obj.length]} />
        <meshStandardMaterial color="#5B7FDE" transparent opacity={0.8} />
      </mesh>
      {/* Right wall */}
      <mesh position={[obj.width / 2, wallHeight / 2, 0]}>
        <boxGeometry args={[wallThickness, wallHeight, obj.length]} />
        <meshStandardMaterial color="#5B7FDE" transparent opacity={0.8} />
      </mesh>
      {/* Ramp inside */}
      <mesh position={[0, 1.5, 0]} rotation={[Math.PI / 6, 0, 0]}>
        <boxGeometry args={[obj.width * 0.9, 0.15, obj.length * 1.2]} />
        <meshStandardMaterial color="#4A6BC7" />
      </mesh>
    </group>
  )
}

function ZeldaHouse3D({ obj }) {
  // Link's house - tree/forest cottage style
  return (
    <group>
      {/* Grass base */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width * 1.3, obj.length * 1.3]} />
        <meshStandardMaterial color="#228B22" />
      </mesh>
      {/* Stone foundation */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[obj.width, 1, obj.length]} />
        <meshStandardMaterial color="#696969" />
      </mesh>
      {/* Wooden cabin */}
      <mesh position={[0, 2.5, 0]}>
        <boxGeometry args={[obj.width * 0.9, 3, obj.length * 0.9]} />
        <meshStandardMaterial color="#8B6914" />
      </mesh>
      {/* A-frame roof */}
      <mesh position={[0, 5, 0]} rotation={[0, 0, Math.PI / 4]}>
        <boxGeometry args={[obj.width * 0.8, obj.width * 0.8, obj.length]} />
        <meshStandardMaterial color="#2F4F2F" />
      </mesh>
      {/* Chimney */}
      <mesh position={[obj.width * 0.3, 6, -obj.length * 0.2]}>
        <boxGeometry args={[1, 2, 1]} />
        <meshStandardMaterial color="#696969" />
      </mesh>
      {/* Door */}
      <mesh position={[0, 1.8, obj.length * 0.46]}>
        <boxGeometry args={[1.5, 2.5, 0.2]} />
        <meshStandardMaterial color="#4A3000" />
      </mesh>
      {/* Window */}
      <mesh position={[-obj.width * 0.25, 2.5, obj.length * 0.46]}>
        <boxGeometry args={[1, 1, 0.2]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
      </mesh>
    </group>
  )
}

function SimsHouse3D({ obj }) {
  // Classic Sims starter home
  return (
    <group>
      {/* Lot/lawn */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width * 1.4, obj.length * 1.4]} />
        <meshStandardMaterial color="#32CD32" />
      </mesh>
      {/* Foundation */}
      <mesh position={[0, 0.3, 0]}>
        <boxGeometry args={[obj.width, 0.6, obj.length]} />
        <meshStandardMaterial color="#C0C0C0" />
      </mesh>
      {/* Main floor walls */}
      <mesh position={[0, 2, 0]}>
        <boxGeometry args={[obj.width, 3.4, obj.length]} />
        <meshStandardMaterial color="#FFFAF0" />
      </mesh>
      {/* Roof */}
      <mesh position={[0, 4.2, 0]}>
        <boxGeometry args={[obj.width + 0.5, 0.8, obj.length + 0.5]} />
        <meshStandardMaterial color="#8B0000" />
      </mesh>
      {/* Front door */}
      <mesh position={[0, 1.5, obj.length * 0.51]}>
        <boxGeometry args={[1.5, 2.5, 0.2]} />
        <meshStandardMaterial color="#8B4513" />
      </mesh>
      {/* Windows */}
      <mesh position={[-obj.width * 0.3, 2, obj.length * 0.51]}>
        <boxGeometry args={[1.5, 1.5, 0.2]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} />
      </mesh>
      <mesh position={[obj.width * 0.3, 2, obj.length * 0.51]}>
        <boxGeometry args={[1.5, 1.5, 0.2]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} />
      </mesh>
      {/* Side window */}
      <mesh position={[obj.width * 0.51, 2, 0]}>
        <boxGeometry args={[0.2, 1.5, 2]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.6} />
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

      {/* Side window */}
      <mesh position={[obj.width * 0.501, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.2, 1.2]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
      </mesh>
      <mesh position={[obj.width * 0.5, 1.5, 0]} rotation={[0, Math.PI / 2, 0]}>
        <planeGeometry args={[1.4, 1.4]} />
        <meshStandardMaterial color="#FFFFFF" />
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

function CarSedan3D({ obj }) {
  return (
    <group>
      {/* Car body - main */}
      <mesh position={[0, 0.5, 0]}>
        <boxGeometry args={[obj.width, 0.5, obj.length * 0.9]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>
      {/* Car cabin */}
      <mesh position={[0, 0.9, -obj.length * 0.05]}>
        <boxGeometry args={[obj.width * 0.85, 0.5, obj.length * 0.5]} />
        <meshStandardMaterial color="#4A4A4A" />
      </mesh>
      {/* Windshield front */}
      <mesh position={[0, 0.9, obj.length * 0.18]} rotation={[0.4, 0, 0]}>
        <planeGeometry args={[obj.width * 0.8, 0.5]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
      </mesh>
      {/* Windshield rear */}
      <mesh position={[0, 0.9, -obj.length * 0.28]} rotation={[-0.4, 0, 0]}>
        <planeGeometry args={[obj.width * 0.8, 0.5]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
      </mesh>
      {/* Wheels */}
      <mesh position={[-obj.width * 0.4, 0.25, obj.length * 0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 0.15, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[obj.width * 0.4, 0.25, obj.length * 0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 0.15, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[-obj.width * 0.4, 0.25, -obj.length * 0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 0.15, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[obj.width * 0.4, 0.25, -obj.length * 0.3]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.25, 0.25, 0.15, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      {/* Headlights */}
      <mesh position={[-obj.width * 0.3, 0.5, obj.length * 0.45]}>
        <boxGeometry args={[0.2, 0.15, 0.05]} />
        <meshStandardMaterial color="#FFFFCC" emissive="#FFFFCC" emissiveIntensity={0.3} />
      </mesh>
      <mesh position={[obj.width * 0.3, 0.5, obj.length * 0.45]}>
        <boxGeometry args={[0.2, 0.15, 0.05]} />
        <meshStandardMaterial color="#FFFFCC" emissive="#FFFFCC" emissiveIntensity={0.3} />
      </mesh>
      {/* Taillights */}
      <mesh position={[-obj.width * 0.3, 0.5, -obj.length * 0.45]}>
        <boxGeometry args={[0.2, 0.1, 0.05]} />
        <meshStandardMaterial color="#FF0000" />
      </mesh>
      <mesh position={[obj.width * 0.3, 0.5, -obj.length * 0.45]}>
        <boxGeometry args={[0.2, 0.1, 0.05]} />
        <meshStandardMaterial color="#FF0000" />
      </mesh>
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
  const busHeight = 2.5
  return (
    <group>
      {/* Main body */}
      <mesh position={[0, busHeight / 2, 0]}>
        <boxGeometry args={[obj.width, busHeight, obj.length]} />
        <meshStandardMaterial color="#F7B500" />
      </mesh>
      {/* Black stripe */}
      <mesh position={[0, busHeight * 0.35, obj.length * 0.501]}>
        <planeGeometry args={[obj.width, 0.3]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      {/* Windows */}
      {[-0.35, -0.2, -0.05, 0.1, 0.25].map((offset, i) => (
        <mesh key={i} position={[obj.width * 0.501, busHeight * 0.6, obj.length * offset]} rotation={[0, Math.PI / 2, 0]}>
          <planeGeometry args={[1, 0.8]} />
          <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
        </mesh>
      ))}
      {[-0.35, -0.2, -0.05, 0.1, 0.25].map((offset, i) => (
        <mesh key={`l${i}`} position={[-obj.width * 0.501, busHeight * 0.6, obj.length * offset]} rotation={[0, -Math.PI / 2, 0]}>
          <planeGeometry args={[1, 0.8]} />
          <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
        </mesh>
      ))}
      {/* Front windshield */}
      <mesh position={[0, busHeight * 0.6, obj.length * 0.48]}>
        <planeGeometry args={[obj.width * 0.8, 1]} />
        <meshStandardMaterial color="#87CEEB" transparent opacity={0.7} />
      </mesh>
      {/* Wheels */}
      <mesh position={[-obj.width * 0.4, 0.4, obj.length * 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.4, 0.2, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[obj.width * 0.4, 0.4, obj.length * 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.4, 0.2, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[-obj.width * 0.4, 0.4, -obj.length * 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.4, 0.2, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      <mesh position={[obj.width * 0.4, 0.4, -obj.length * 0.35]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.4, 0.4, 0.2, 16]} />
        <meshStandardMaterial color="#1A1A1A" />
      </mesh>
      {/* Stop sign arm */}
      <mesh position={[-obj.width * 0.55, busHeight * 0.5, obj.length * 0.2]}>
        <boxGeometry args={[0.4, 0.4, 0.05]} />
        <meshStandardMaterial color="#FF0000" />
      </mesh>
      {/* Headlights */}
      <mesh position={[-obj.width * 0.35, busHeight * 0.25, obj.length * 0.501]}>
        <circleGeometry args={[0.15, 16]} />
        <meshStandardMaterial color="#FFFFCC" />
      </mesh>
      <mesh position={[obj.width * 0.35, busHeight * 0.25, obj.length * 0.501]}>
        <circleGeometry args={[0.15, 16]} />
        <meshStandardMaterial color="#FFFFCC" />
      </mesh>
    </group>
  )
}

function SwimmingPool3D({ obj }) {
  return (
    <group>
      {/* Pool deck/surround */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.05, 0]}>
        <planeGeometry args={[obj.width + 4, obj.length + 4]} />
        <meshStandardMaterial color="#D4C4A8" />
      </mesh>
      {/* Pool water surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial color="#00CED1" transparent opacity={0.8} />
      </mesh>
      {/* Pool walls - slightly below ground */}
      <mesh position={[0, -0.5, 0]}>
        <boxGeometry args={[obj.width, 1, obj.length]} />
        <meshStandardMaterial color="#4FA8C7" />
      </mesh>
      {/* Lane lines */}
      {[-0.375, -0.25, -0.125, 0, 0.125, 0.25, 0.375].map((offset, i) => (
        <mesh key={i} rotation={[-Math.PI / 2, 0, 0]} position={[obj.width * offset, 0.03, 0]}>
          <planeGeometry args={[0.15, obj.length * 0.95]} />
          <meshStandardMaterial color="#1A1A1A" />
        </mesh>
      ))}
      {/* Starting blocks */}
      {[-0.375, -0.25, -0.125, 0, 0.125, 0.25, 0.375].map((offset, i) => (
        <mesh key={i} position={[obj.width * offset, 0.3, obj.length * 0.52]}>
          <boxGeometry args={[0.5, 0.6, 0.6]} />
          <meshStandardMaterial color="#E8E8E8" />
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

// Render the appropriate 3D model based on object id
function render3DModel(obj) {
  switch (obj.id) {
    case 'soccerField':
      return <SoccerField3D obj={obj} />
    case 'basketballCourt':
      return <BasketballCourt3D obj={obj} />
    case 'tennisCourt':
      return <TennisCourt3D obj={obj} />
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
    // Other objects
    case 'carSedan':
      return <CarSedan3D obj={obj} />
    case 'shippingContainer':
      return <ShippingContainer3D obj={obj} />
    case 'schoolBus':
      return <SchoolBus3D obj={obj} />
    case 'swimmingPool':
      return <SwimmingPool3D obj={obj} />
    case 'kingSizeBed':
      return <KingSizeBed3D obj={obj} />
    default:
      return <GenericComparison3D obj={obj} />
  }
}

// Main ComparisonObject component
export function ComparisonObject({ obj, index, totalObjects, lengthUnit = 'm', position, onPositionChange, rotation = 0, onRotationChange, polygonPoints, allObjects, allPositions, allRotations = {}, onSnapLineChange, isOverlapping, gridSnapEnabled = false, gridSize = 1, viewMode = 'firstPerson', isSelected = false, onSelect, onDeselect }) {
  const { camera, gl } = useThree()
  const groupRef = useRef()
  const [isDragging, setIsDragging] = useState(false)
  const [isHovered, setIsHovered] = useState(false)
  const [snapType, setSnapType] = useState('none') // 'none', 'edge', 'object', 'center'
  const dragStartRef = useRef(null)
  const DRAG_THRESHOLD = 5

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

    // Select on click
    if (onSelect) {
      onSelect(obj.id)
    }

    // Start drag tracking
    dragStartRef.current = {
      clientX: e.clientX,
      clientY: e.clientY,
      startPos: { ...currentPos }
    }
  }, [obj.id, currentPos, onSelect])

  // Handle pointer move - drag
  const handlePointerMove = useCallback((e) => {
    if (!dragStartRef.current) return

    // Check if we've moved past drag threshold
    const dx = e.clientX - dragStartRef.current.clientX
    const dy = e.clientY - dragStartRef.current.clientY
    const distance = Math.sqrt(dx * dx + dy * dy)

    if (distance > DRAG_THRESHOLD) {
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
