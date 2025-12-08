import { useRef, useEffect, useMemo, useState } from 'react'
import { Canvas, useFrame, useThree } from '@react-three/fiber'
import { Grid, Text, Billboard } from '@react-three/drei'
import * as THREE from 'three'

// Create realistic grass texture
function useGrassTexture() {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 512
    const ctx = canvas.getContext('2d')

    // Base with natural color variation
    for (let y = 0; y < 512; y++) {
      for (let x = 0; x < 512; x++) {
        const noise = (Math.random() - 0.5) * 25
        const r = Math.min(255, Math.max(0, 58 + noise * 0.4))
        const g = Math.min(255, Math.max(0, 110 + noise))
        const b = Math.min(255, Math.max(0, 40 + noise * 0.3))
        ctx.fillStyle = `rgb(${r},${g},${b})`
        ctx.fillRect(x, y, 1, 1)
      }
    }

    // Darker patches (shadows/clumps)
    for (let i = 0; i < 80; i++) {
      const x = Math.random() * 512
      const y = Math.random() * 512
      const radius = Math.random() * 35 + 15
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, 'rgba(35, 75, 30, 0.35)')
      gradient.addColorStop(1, 'rgba(35, 75, 30, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // Lighter sun patches
    for (let i = 0; i < 40; i++) {
      const x = Math.random() * 512
      const y = Math.random() * 512
      const radius = Math.random() * 45 + 20
      const gradient = ctx.createRadialGradient(x, y, 0, x, y, radius)
      gradient.addColorStop(0, 'rgba(95, 150, 65, 0.3)')
      gradient.addColorStop(1, 'rgba(95, 150, 65, 0)')
      ctx.fillStyle = gradient
      ctx.beginPath()
      ctx.arc(x, y, radius, 0, Math.PI * 2)
      ctx.fill()
    }

    // Grass blade strokes
    for (let i = 0; i < 4000; i++) {
      const x = Math.random() * 512
      const y = Math.random() * 512
      const length = Math.random() * 10 + 4
      const shade = Math.random() * 35 - 15
      ctx.strokeStyle = `rgba(${50 + shade}, ${95 + shade}, ${35 + shade}, 0.5)`
      ctx.lineWidth = Math.random() * 1.5 + 0.5
      ctx.beginPath()
      ctx.moveTo(x, y)
      ctx.quadraticCurveTo(x + (Math.random() - 0.5) * 4, y - length / 2, x + (Math.random() - 0.5) * 5, y - length)
      ctx.stroke()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.wrapT = THREE.RepeatWrapping
    texture.repeat.set(25, 25)
    return texture
  }, [])
}

// Realistic sky with clouds
function RealisticSky() {
  const uniforms = useMemo(() => ({
    topColor: { value: new THREE.Color('#4a90c2') },
    horizonColor: { value: new THREE.Color('#b8d4e8') },
    bottomColor: { value: new THREE.Color('#e8f0f5') },
  }), [])

  const vertexShader = `
    varying vec3 vWorldPosition;
    void main() {
      vec4 worldPosition = modelMatrix * vec4(position, 1.0);
      vWorldPosition = worldPosition.xyz;
      gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
    }
  `

  const fragmentShader = `
    uniform vec3 topColor;
    uniform vec3 horizonColor;
    uniform vec3 bottomColor;
    varying vec3 vWorldPosition;

    // Simple noise for clouds
    float hash(vec2 p) {
      return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453);
    }

    float noise(vec2 p) {
      vec2 i = floor(p);
      vec2 f = fract(p);
      f = f * f * (3.0 - 2.0 * f);
      return mix(
        mix(hash(i), hash(i + vec2(1.0, 0.0)), f.x),
        mix(hash(i + vec2(0.0, 1.0)), hash(i + vec2(1.0, 1.0)), f.x),
        f.y
      );
    }

    float fbm(vec2 p) {
      float v = 0.0;
      v += noise(p) * 0.5;
      v += noise(p * 2.0) * 0.25;
      v += noise(p * 4.0) * 0.125;
      return v;
    }

    void main() {
      vec3 dir = normalize(vWorldPosition);
      float h = dir.y;

      // Sky gradient
      vec3 skyColor;
      if (h > 0.0) {
        float t = pow(h, 0.7);
        skyColor = mix(horizonColor, topColor, t);
      } else {
        skyColor = bottomColor;
      }

      // Add clouds in upper sky
      if (h > 0.05) {
        vec2 cloudUV = dir.xz / (h + 0.1) * 2.0;
        float cloudNoise = fbm(cloudUV + vec2(0.0, 0.0));
        float clouds = smoothstep(0.35, 0.65, cloudNoise);
        clouds *= smoothstep(0.0, 0.3, h) * 0.6;
        skyColor = mix(skyColor, vec3(1.0), clouds);
      }

      gl_FragColor = vec4(skyColor, 1.0);
    }
  `

  return (
    <mesh scale={[500, 500, 500]}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

// Distant treeline for horizon
function DistantTreeline() {
  const treelineTexture = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = 64
    const ctx = canvas.getContext('2d')

    // Gradient background (transparent to tree color)
    ctx.fillStyle = 'rgba(0,0,0,0)'
    ctx.fillRect(0, 0, 512, 64)

    // Draw simple tree silhouettes
    for (let x = 0; x < 512; x += 3) {
      const height = 20 + Math.random() * 35
      const shade = Math.floor(Math.random() * 30)
      ctx.fillStyle = `rgb(${30 + shade}, ${50 + shade}, ${35 + shade})`

      // Tree shape
      ctx.beginPath()
      ctx.moveTo(x, 64)
      ctx.lineTo(x + 1.5, 64 - height)
      ctx.lineTo(x + 3, 64)
      ctx.fill()
    }

    const texture = new THREE.CanvasTexture(canvas)
    texture.wrapS = THREE.RepeatWrapping
    texture.repeat.set(8, 1)
    return texture
  }, [])

  return (
    <mesh position={[0, 15, -200]} rotation={[0, 0, 0]}>
      <planeGeometry args={[800, 40]} />
      <meshBasicMaterial map={treelineTexture} transparent alphaTest={0.1} fog={true} />
    </mesh>
  )
}

function FirstPersonControls({ enabled }) {
  const { camera, gl } = useThree()
  const moveState = useRef({ forward: false, backward: false, left: false, right: false })
  const euler = useRef(new THREE.Euler(0, 0, 0, 'YXZ'))
  const isLocked = useRef(false)

  useEffect(() => {
    if (!enabled) {
      document.exitPointerLock?.()
      isLocked.current = false
      return
    }

    const canvas = gl.domElement

    const lockPointer = () => {
      canvas.requestPointerLock()
    }

    const onPointerLockChange = () => {
      isLocked.current = document.pointerLockElement === canvas
    }

    const onMouseMove = (e) => {
      if (!isLocked.current) return

      euler.current.setFromQuaternion(camera.quaternion)
      euler.current.y -= e.movementX * 0.002
      euler.current.x -= e.movementY * 0.002
      euler.current.x = Math.max(-Math.PI / 2, Math.min(Math.PI / 2, euler.current.x))
      camera.quaternion.setFromEuler(euler.current)
    }

    const onKeyDown = (e) => {
      if (!enabled) return
      switch (e.code) {
        case 'KeyW': moveState.current.forward = true; break
        case 'KeyS': moveState.current.backward = true; break
        case 'KeyA': moveState.current.left = true; break
        case 'KeyD': moveState.current.right = true; break
      }
    }

    const onKeyUp = (e) => {
      switch (e.code) {
        case 'KeyW': moveState.current.forward = false; break
        case 'KeyS': moveState.current.backward = false; break
        case 'KeyA': moveState.current.left = false; break
        case 'KeyD': moveState.current.right = false; break
      }
    }

    canvas.addEventListener('click', lockPointer)
    document.addEventListener('pointerlockchange', onPointerLockChange)
    document.addEventListener('mousemove', onMouseMove)
    document.addEventListener('keydown', onKeyDown)
    document.addEventListener('keyup', onKeyUp)

    // Start locked
    lockPointer()

    return () => {
      canvas.removeEventListener('click', lockPointer)
      document.removeEventListener('pointerlockchange', onPointerLockChange)
      document.removeEventListener('mousemove', onMouseMove)
      document.removeEventListener('keydown', onKeyDown)
      document.removeEventListener('keyup', onKeyUp)
      moveState.current = { forward: false, backward: false, left: false, right: false }
    }
  }, [enabled, camera, gl])

  useFrame((_, delta) => {
    if (!enabled) return

    const speed = 5
    const direction = new THREE.Vector3()

    if (moveState.current.forward) direction.z -= 1
    if (moveState.current.backward) direction.z += 1
    if (moveState.current.left) direction.x -= 1
    if (moveState.current.right) direction.x += 1

    if (direction.length() > 0) {
      direction.normalize()
      direction.applyQuaternion(camera.quaternion)
      direction.y = 0 // Keep movement horizontal
      direction.normalize()
      camera.position.addScaledVector(direction, speed * delta)
    }
  })

  return null
}

function LandPlot({ length, width, polygonPoints, onClick }) {
  // Create shape geometry for polygon or rectangle
  const shapeGeometry = useMemo(() => {
    const shape = new THREE.Shape()

    if (polygonPoints && polygonPoints.length >= 3) {
      // Polygon mode
      shape.moveTo(polygonPoints[0].x, polygonPoints[0].y)
      for (let i = 1; i < polygonPoints.length; i++) {
        shape.lineTo(polygonPoints[i].x, polygonPoints[i].y)
      }
      shape.closePath()
    } else {
      // Rectangle mode
      const hw = width / 2
      const hl = length / 2
      shape.moveTo(-hw, -hl)
      shape.lineTo(hw, -hl)
      shape.lineTo(hw, hl)
      shape.lineTo(-hw, hl)
      shape.closePath()
    }

    return new THREE.ShapeGeometry(shape)
  }, [length, width, polygonPoints])

  // Get corner points for posts
  const corners = useMemo(() => {
    if (polygonPoints && polygonPoints.length >= 3) {
      return polygonPoints.map(p => [p.x, p.y])
    }
    return [
      [-width / 2, length / 2],
      [width / 2, length / 2],
      [-width / 2, -length / 2],
      [width / 2, -length / 2],
    ]
  }, [length, width, polygonPoints])

  return (
    <group>
      {/* Main land surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]} receiveShadow geometry={shapeGeometry} onClick={onClick}>
        <meshStandardMaterial color="#4a7c59" />
      </mesh>

      {/* Border outline */}
      <line rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <bufferGeometry>
          <bufferAttribute
            attach="attributes-position"
            count={corners.length + 1}
            array={new Float32Array([...corners.flatMap(([x, z]) => [x, z, 0]), corners[0][0], corners[0][1], 0])}
            itemSize={3}
          />
        </bufferGeometry>
        <lineBasicMaterial color="#ffffff" linewidth={2} />
      </line>

      {/* Corner posts */}
      {corners.map(([x, z], i) => (
        <mesh key={i} position={[x, 0.5, z]} castShadow>
          <cylinderGeometry args={[0.1, 0.1, 1, 8]} />
          <meshStandardMaterial color="#8b4513" />
        </mesh>
      ))}
    </group>
  )
}

function HumanFigure({ position = [0, 0, 0] }) {
  // Standard human figure ~1.75m tall
  return (
    <group position={position}>
      {/* Body */}
      <mesh position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.25, 0.7, 4, 8]} />
        <meshStandardMaterial color="#3366cc" />
      </mesh>

      {/* Head */}
      <mesh position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#ffcc99" />
      </mesh>

      {/* Legs */}
      <mesh position={[-0.12, 0.1, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.6, 4, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      <mesh position={[0.12, 0.1, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.6, 4, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
    </group>
  )
}

function PlacedBuilding({ building, onDelete }) {
  const { type, position } = building
  const [hovered, setHovered] = useState(false)
  const isPool = type.height < 0
  const height = Math.abs(type.height)
  // For pools: top surface just above ground (visible), rest below
  // For buildings: bottom at ground level (box centered above ground)
  const yPos = isPool ? -height / 2 + 0.03 : height / 2

  return (
    <group position={[position.x, yPos, position.z]}>
      <mesh
        castShadow
        receiveShadow
        onPointerOver={(e) => { e.stopPropagation(); setHovered(true) }}
        onPointerOut={() => setHovered(false)}
        onClick={(e) => {
          e.stopPropagation()
          onDelete(building.id)
        }}
      >
        <boxGeometry args={[type.width, height, type.length]} />
        <meshStandardMaterial
          color={hovered ? '#ff6666' : type.color}
          transparent={isPool || hovered}
          opacity={isPool ? 0.7 : (hovered ? 0.85 : 1)}
          emissive={hovered ? '#ff0000' : '#000000'}
          emissiveIntensity={hovered ? 0.2 : 0}
        />
      </mesh>
      <Billboard position={[0, height / 2 + 1, 0]} follow={true}>
        <Text
          fontSize={0.8}
          color={hovered ? '#ff6666' : '#ffffff'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.08}
          outlineColor="#000000"
        >
          {type.name}
        </Text>
        <Text
          position={[0, -0.6, 0]}
          fontSize={0.5}
          color={hovered ? '#ff9999' : '#cccccc'}
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.05}
          outlineColor="#000000"
        >
          {hovered ? 'Click to remove' : `${type.width}m × ${type.length}m`}
        </Text>
      </Billboard>
    </group>
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

function usePoolTexture(width, length) {
  return useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 512
    canvas.height = Math.round(512 * (length / width))
    const ctx = canvas.getContext('2d')
    const w = canvas.width, h = canvas.height

    // Pool water
    const gradient = ctx.createLinearGradient(0, 0, w, h)
    gradient.addColorStop(0, '#0891b2')
    gradient.addColorStop(0.5, '#06b6d4')
    gradient.addColorStop(1, '#0891b2')
    ctx.fillStyle = gradient
    ctx.fillRect(0, 0, w, h)

    // Lane lines
    ctx.strokeStyle = 'rgba(0, 0, 0, 0.2)'
    ctx.lineWidth = 2
    for (let i = 1; i < 8; i++) {
      ctx.beginPath()
      ctx.moveTo(0, (h / 8) * i)
      ctx.lineTo(w, (h / 8) * i)
      ctx.stroke()
    }

    // Water ripple effect
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)'
    ctx.lineWidth = 1
    for (let i = 0; i < 20; i++) {
      const y = Math.random() * h
      ctx.beginPath()
      ctx.moveTo(0, y)
      ctx.bezierCurveTo(w * 0.25, y + 5, w * 0.75, y - 5, w, y)
      ctx.stroke()
    }

    // Pool edge
    ctx.strokeStyle = '#94a3b8'
    ctx.lineWidth = 12
    ctx.strokeRect(6, 6, w - 12, h - 12)

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
          <mesh position={[0, goalHeight / 2, -side * goalDepth / 2]}>
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
          <mesh position={[0, poleHeight / 2, -side * 0.5]} castShadow>
            <cylinderGeometry args={[0.1, 0.1, poleHeight, 8]} />
            <meshStandardMaterial color="#333333" />
          </mesh>
          {/* Backboard */}
          <mesh position={[0, rimHeight + backboardHeight / 2 - 0.15, 0]} castShadow>
            <boxGeometry args={[backboardWidth, backboardHeight, 0.05]} />
            <meshStandardMaterial color="#ffffff" transparent opacity={0.8} />
          </mesh>
          {/* Rim */}
          <mesh position={[0, rimHeight, side * 0.2]} rotation={[Math.PI / 2, 0, 0]}>
            <torusGeometry args={[0.23, 0.02, 8, 16]} />
            <meshStandardMaterial color="#ff4500" />
          </mesh>
        </group>
      ))}
    </group>
  )
}

// Tennis Court with net
function TennisCourt3D({ obj }) {
  const texture = useTennisCourtTexture(obj.width, obj.length)
  const netHeight = 1.07, postHeight = 1.2

  return (
    <group>
      {/* Court surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} />
      </mesh>

      {/* Net posts */}
      {[-1, 1].map((side) => (
        <mesh key={side} position={[side * (obj.width / 2 + 0.3), postHeight / 2, 0]} castShadow>
          <cylinderGeometry args={[0.04, 0.04, postHeight, 8]} />
          <meshStandardMaterial color="#333333" />
        </mesh>
      ))}

      {/* Net */}
      <mesh position={[0, netHeight / 2 + 0.1, 0]}>
        <planeGeometry args={[obj.width + 0.6, netHeight]} />
        <meshStandardMaterial color="#ffffff" transparent opacity={0.6} side={THREE.DoubleSide} />
      </mesh>

      {/* Net top cable */}
      <mesh position={[0, netHeight + 0.1, 0]} rotation={[0, 0, Math.PI / 2]}>
        <cylinderGeometry args={[0.02, 0.02, obj.width + 0.6, 8]} />
        <meshStandardMaterial color="#ffffff" />
      </mesh>
    </group>
  )
}

// 3D House with pitched roof
function House3D({ obj }) {
  const wallHeight = 3, roofHeight = 2

  return (
    <group>
      {/* Foundation/shadow */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.01, 0]}>
        <planeGeometry args={[obj.width + 0.5, obj.length + 0.5]} />
        <meshStandardMaterial color="#000000" transparent opacity={0.15} />
      </mesh>

      {/* Walls */}
      <mesh position={[0, wallHeight / 2, 0]} castShadow receiveShadow>
        <boxGeometry args={[obj.width, wallHeight, obj.length]} />
        <meshStandardMaterial color="#f5f5dc" />
      </mesh>

      {/* Pitched roof - using a simple triangular prism shape */}
      <mesh position={[0, wallHeight + roofHeight / 2, 0]} castShadow>
        <boxGeometry args={[obj.width + 0.5, 0.2, obj.length + 0.5]} />
        <meshStandardMaterial color="#8b4513" />
      </mesh>

      {/* Roof slopes */}
      <mesh position={[0, wallHeight + roofHeight / 2, 0]} rotation={[0, 0, Math.PI / 6]} castShadow>
        <boxGeometry args={[obj.width / 2 + 0.8, 0.15, obj.length + 0.3]} />
        <meshStandardMaterial color="#6b3a1f" />
      </mesh>
      <mesh position={[0, wallHeight + roofHeight / 2, 0]} rotation={[0, 0, -Math.PI / 6]} castShadow>
        <boxGeometry args={[obj.width / 2 + 0.8, 0.15, obj.length + 0.3]} />
        <meshStandardMaterial color="#6b3a1f" />
      </mesh>

      {/* Door */}
      <mesh position={[0, 1, obj.length / 2 + 0.01]}>
        <planeGeometry args={[1.2, 2]} />
        <meshStandardMaterial color="#5c4033" />
      </mesh>

      {/* Windows */}
      {[[-obj.width / 3, obj.length / 2], [obj.width / 3, obj.length / 2]].map(([x, z], i) => (
        <mesh key={i} position={[x, wallHeight / 2 + 0.3, z + 0.01]}>
          <planeGeometry args={[1, 1]} />
          <meshStandardMaterial color="#87ceeb" transparent opacity={0.7} />
        </mesh>
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

// Olympic Pool (sunken)
function Pool3D({ obj }) {
  const texture = usePoolTexture(obj.width, obj.length)
  const poolDepth = 2

  return (
    <group>
      {/* Pool edge/deck */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0.02, 0]}>
        <planeGeometry args={[obj.width + 2, obj.length + 2]} />
        <meshStandardMaterial color="#d4d4d4" />
      </mesh>

      {/* Pool walls (sunken box) */}
      <mesh position={[0, -poolDepth / 2, 0]}>
        <boxGeometry args={[obj.width, poolDepth, obj.length]} />
        <meshStandardMaterial color="#0ea5e9" side={THREE.BackSide} />
      </mesh>

      {/* Water surface */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, -0.1, 0]}>
        <planeGeometry args={[obj.width, obj.length]} />
        <meshStandardMaterial map={texture} transparent opacity={0.9} />
      </mesh>

      {/* Lane dividers */}
      {Array.from({ length: 7 }, (_, i) => (
        <mesh key={i} position={[0, -poolDepth / 2, -obj.length / 2 + (obj.length / 8) * (i + 1)]}>
          <boxGeometry args={[obj.width - 0.2, 0.1, 0.1]} />
          <meshStandardMaterial color="#1e40af" />
        </mesh>
      ))}
    </group>
  )
}

function ComparisonObject({ obj, index, totalObjects }) {
  const offsetZ = index * 2

  // Render the appropriate 3D component based on object type
  const render3DObject = () => {
    switch (obj.id) {
      case 'soccerField': return <SoccerField3D obj={obj} />
      case 'basketballCourt': return <BasketballCourt3D obj={obj} />
      case 'tennisCourt': return <TennisCourt3D obj={obj} />
      case 'house': return <House3D obj={obj} />
      case 'parkingSpace': return <ParkingSpace3D obj={obj} />
      case 'swimmingPool': return <Pool3D obj={obj} />
      default: return null
    }
  }

  // Calculate label height based on object type
  const labelHeight = obj.id === 'house' ? 7 : 3

  return (
    <group position={[0, 0, offsetZ]}>
      {render3DObject()}

      {/* Billboard labels */}
      <Billboard position={[0, labelHeight, 0]} follow={true}>
        <Text
          fontSize={1.2}
          color="#ffffff"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.12}
          outlineColor="#000000"
        >
          {obj.name}
        </Text>
        <Text
          position={[0, -1, 0]}
          fontSize={0.7}
          color="#eeeeee"
          anchorX="center"
          anchorY="middle"
          outlineWidth={0.08}
          outlineColor="#000000"
        >
          {`${obj.length}m × ${obj.width}m`}
        </Text>
      </Billboard>
    </group>
  )
}

function Scene({ length, width, isExploring, comparisonObjects = [], polygonPoints, placedBuildings = [], selectedBuilding, onPlaceBuilding, onDeleteBuilding }) {
  const { camera } = useThree()
  const grassTexture = useGrassTexture()

  const handleLandClick = (e) => {
    if (!selectedBuilding || !onPlaceBuilding) return
    e.stopPropagation()
    const point = e.point
    onPlaceBuilding({ x: point.x, z: point.z })
  }

  useEffect(() => {
    // Position camera at ground level (1.7m = eye height) at corner of land
    camera.position.set(-width / 2 - 2, 1.7, -length / 2 - 2)
    camera.lookAt(0, 1, 0)
  }, [length, width, camera])

  return (
    <>
      {/* Fog for depth */}
      <fog attach="fog" args={['#b8d4e8', 80, 300]} />

      {/* Lighting */}
      <ambientLight intensity={0.5} color="#f0f5ff" />
      <directionalLight
        position={[50, 80, 30]}
        intensity={1.2}
        castShadow
        shadow-mapSize-width={2048}
        shadow-mapSize-height={2048}
        shadow-camera-far={200}
        shadow-camera-left={-100}
        shadow-camera-right={100}
        shadow-camera-top={100}
        shadow-camera-bottom={-100}
        shadow-bias={-0.0001}
      />
      {/* Fill light from opposite side */}
      <directionalLight position={[-30, 40, -20]} intensity={0.3} color="#ffe4c4" />

      <RealisticSky />
      <DistantTreeline />

      {/* Ground plane with grass texture */}
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[500, 500]} />
        <meshStandardMaterial map={grassTexture} />
      </mesh>

      {/* Subtle grid for scale reference */}
      <Grid
        position={[0, 0.003, 0]}
        args={[100, 100]}
        cellSize={1}
        cellThickness={0.3}
        cellColor="rgba(100, 100, 100, 0.4)"
        sectionSize={5}
        sectionThickness={0.6}
        sectionColor="rgba(120, 120, 120, 0.5)"
        fadeDistance={60}
        fadeStrength={1.5}
        followCamera={false}
      />

      <LandPlot length={length} width={width} polygonPoints={polygonPoints} onClick={handleLandClick} />

      {/* Human figure for scale - placed at the center of the land */}
      <HumanFigure position={[0, 0, 0]} />

      {/* Additional human figures at corners for reference */}
      <HumanFigure position={[width / 4, 0, length / 4]} />

      {/* Placed buildings */}
      {placedBuildings.map((building) => (
        <PlacedBuilding
          key={building.id}
          building={building}
          onDelete={onDeleteBuilding}
        />
      ))}

      {/* Comparison objects */}
      {comparisonObjects.map((obj, index) => (
        <ComparisonObject
          key={obj.id}
          obj={obj}
          index={index}
          totalObjects={comparisonObjects.length}
        />
      ))}

      <FirstPersonControls enabled={isExploring} />
    </>
  )
}

export default function LandScene({ length, width, isExploring, comparisonObjects = [], polygonPoints, placedBuildings = [], selectedBuilding, onPlaceBuilding, onDeleteBuilding }) {
  return (
    <Canvas
      shadows
      camera={{ fov: 60, near: 0.1, far: 1000 }}
      style={{ background: '#87ceeb' }}
      gl={{ preserveDrawingBuffer: true }}
    >
      <Scene
        length={length}
        width={width}
        isExploring={isExploring}
        comparisonObjects={comparisonObjects}
        polygonPoints={polygonPoints}
        placedBuildings={placedBuildings}
        selectedBuilding={selectedBuilding}
        onPlaceBuilding={onPlaceBuilding}
        onDeleteBuilding={onDeleteBuilding}
      />
    </Canvas>
  )
}
