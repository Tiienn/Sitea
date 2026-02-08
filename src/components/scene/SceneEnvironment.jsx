import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { QUALITY, QUALITY_SETTINGS } from '../../constants/landSceneConstants'
import { useGrassTextures, useSimpleGrassTexture } from '../../hooks/useGrassTextures'

// Time-of-day color stops for sky interpolation
const SKY_STOPS = [
  { t: 0.0,  top: [0.039, 0.086, 0.157], horizon: [0.102, 0.165, 0.267], bottom: [0.051, 0.082, 0.125], cloud: [0.1, 0.1, 0.2] },
  { t: 0.2,  top: [0.165, 0.251, 0.376], horizon: [0.831, 0.522, 0.416], bottom: [0.941, 0.659, 0.439], cloud: [1.0, 0.7, 0.5] },
  { t: 0.35, top: [0.357, 0.557, 0.788], horizon: [0.722, 0.812, 0.878], bottom: [0.847, 0.894, 0.941], cloud: [1.0, 0.98, 0.95] },
  { t: 0.5,  top: [0.227, 0.522, 0.839], horizon: [0.529, 0.722, 0.878], bottom: [0.753, 0.855, 0.941], cloud: [1.0, 1.0, 1.0] },
  { t: 0.7,  top: [0.290, 0.376, 0.565], horizon: [0.910, 0.580, 0.416], bottom: [1.0, 0.784, 0.502],   cloud: [1.0, 0.75, 0.5] },
  { t: 0.85, top: [0.102, 0.165, 0.314], horizon: [0.416, 0.251, 0.439], bottom: [0.816, 0.408, 0.282], cloud: [0.4, 0.2, 0.3] },
  { t: 1.0,  top: [0.039, 0.086, 0.157], horizon: [0.102, 0.165, 0.267], bottom: [0.051, 0.082, 0.125], cloud: [0.1, 0.1, 0.2] },
]

function lerpStops(stops, time, key) {
  for (let i = 0; i < stops.length - 1; i++) {
    if (time >= stops[i].t && time <= stops[i + 1].t) {
      const f = (time - stops[i].t) / (stops[i + 1].t - stops[i].t)
      const a = stops[i][key], b = stops[i + 1][key]
      return a.map((v, j) => v + (b[j] - v) * f)
    }
  }
  return stops[0][key]
}

// Original gradient sky with procedural clouds - now animated by timeOfDay
export function RealisticSky({ timeOfDay = 0.35 }) {
  const matRef = useRef()

  const uniforms = useMemo(() => ({
    topColor: { value: new THREE.Color('#5b8ec9') },
    horizonColor: { value: new THREE.Color('#f0c89a') },
    bottomColor: { value: new THREE.Color('#ffe8d0') },
    cloudTint: { value: new THREE.Vector3(1.0, 0.95, 0.88) },
  }), [])

  // Update sky colors each frame based on timeOfDay (no re-renders)
  useFrame(() => {
    if (!matRef.current) return
    const u = matRef.current.uniforms
    const top = lerpStops(SKY_STOPS, timeOfDay, 'top')
    const hor = lerpStops(SKY_STOPS, timeOfDay, 'horizon')
    const bot = lerpStops(SKY_STOPS, timeOfDay, 'bottom')
    const cld = lerpStops(SKY_STOPS, timeOfDay, 'cloud')
    u.topColor.value.setRGB(top[0], top[1], top[2])
    u.horizonColor.value.setRGB(hor[0], hor[1], hor[2])
    u.bottomColor.value.setRGB(bot[0], bot[1], bot[2])
    u.cloudTint.value.set(cld[0], cld[1], cld[2])
  })

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
    uniform vec3 cloudTint;
    varying vec3 vWorldPosition;

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

      vec3 skyColor;
      if (h > 0.0) {
        float t = pow(h, 0.7);
        skyColor = mix(horizonColor, topColor, t);
      } else {
        skyColor = bottomColor;
      }

      if (h > 0.05) {
        vec2 cloudUV = dir.xz / (h + 0.1) * 2.0;
        float cloudNoise = fbm(cloudUV);
        float clouds = smoothstep(0.35, 0.65, cloudNoise);
        clouds *= smoothstep(0.0, 0.3, h) * 0.6;
        skyColor = mix(skyColor, cloudTint, clouds);
      }

      gl_FragColor = vec4(skyColor, 1.0);
    }
  `

  return (
    <mesh scale={[500, 500, 500]}>
      <sphereGeometry args={[1, 64, 64]} />
      <shaderMaterial
        ref={matRef}
        uniforms={uniforms}
        vertexShader={vertexShader}
        fragmentShader={fragmentShader}
        side={THREE.BackSide}
      />
    </mesh>
  )
}

// Night stars - visible during night phases (~0.8-0.2)
export function NightStars({ timeOfDay = 0.35 }) {
  const matRef = useRef()

  const positions = useMemo(() => {
    const pts = new Float32Array(200 * 3)
    let seed = 99999
    const rand = () => { seed = (seed * 16807) % 2147483647; return (seed - 1) / 2147483646 }
    for (let i = 0; i < 200; i++) {
      const theta = rand() * Math.PI * 2
      const phi = Math.acos(rand() * 0.8 + 0.2) // bias toward upper hemisphere
      const r = 480
      pts[i * 3] = r * Math.sin(phi) * Math.cos(theta)
      pts[i * 3 + 1] = r * Math.cos(phi)
      pts[i * 3 + 2] = r * Math.sin(phi) * Math.sin(theta)
    }
    return pts
  }, [])

  useFrame(() => {
    if (!matRef.current) return
    // Fade in during night (0.8-1.0 and 0.0-0.2), fade out during day
    let opacity = 0
    if (timeOfDay > 0.85) opacity = (timeOfDay - 0.85) / 0.15
    else if (timeOfDay < 0.2) opacity = 1.0 - timeOfDay / 0.2
    else if (timeOfDay >= 0.2 && timeOfDay <= 0.85) opacity = 0
    matRef.current.opacity = opacity
  })

  return (
    <points>
      <bufferGeometry>
        <bufferAttribute attach="attributes-position" array={positions} count={200} itemSize={3} />
      </bufferGeometry>
      <pointsMaterial ref={matRef} color="#ffffff" size={1.5} sizeAttenuation={false} transparent depthWrite={false} />
    </points>
  )
}

// Enhanced ground plane with quality-dependent materials
export function EnhancedGround({ quality }) {
  const settings = QUALITY_SETTINGS[quality]
  const simpleTexture = useSimpleGrassTexture()
  const { detailTexture, macroTexture, roughnessTexture } = useGrassTextures(quality)

  if (quality === QUALITY.FAST) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
        <planeGeometry args={[2000, 2000]} />
        <meshStandardMaterial map={simpleTexture} />
      </mesh>
    )
  }

  // Best quality: use enhanced material
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow>
      <planeGeometry args={[2000, 2000, 64, 64]} />
      <meshStandardMaterial
        map={detailTexture}
        roughnessMap={roughnessTexture}
        roughness={0.9}
        metalness={0}
        envMapIntensity={settings.envMapIntensity}
      />
    </mesh>
  )
}

// Mountain silhouettes on the horizon (3 concentric rings)
export function MountainSilhouettes() {
  const layers = useMemo(() => {
    const configs = [
      { radius: 450, height: 80, color: '#8a7b9a', opacity: 0.4 },
      { radius: 350, height: 100, color: '#7a8b6a', opacity: 0.6 },
      { radius: 260, height: 70, color: '#5a7a55', opacity: 0.8 },
    ]
    return configs.map((cfg, i) => {
      const canvas = document.createElement('canvas')
      canvas.width = 1024
      canvas.height = 128
      const ctx = canvas.getContext('2d')
      // Mountain profile via summed sine waves
      ctx.fillStyle = cfg.color
      ctx.beginPath()
      ctx.moveTo(0, 128)
      for (let x = 0; x <= 1024; x++) {
        const t = x / 1024
        let h = 0
        h += Math.sin(t * Math.PI * 2 * 3 + i * 1.7) * 0.3
        h += Math.sin(t * Math.PI * 2 * 7 + i * 2.3) * 0.15
        h += Math.sin(t * Math.PI * 2 * 13 + i * 0.9) * 0.08
        h = 0.5 + h * 0.5 // normalize to 0.2-0.8 range
        const py = 128 - h * 100
        ctx.lineTo(x, py)
      }
      ctx.lineTo(1024, 128)
      ctx.closePath()
      ctx.fill()
      const texture = new THREE.CanvasTexture(canvas)
      texture.wrapS = THREE.RepeatWrapping
      texture.repeat.set(3, 1)
      return { ...cfg, texture }
    })
  }, [])

  return (
    <group>
      {layers.map((layer, i) => (
        <mesh key={i} position={[0, layer.height * 0.3, 0]}>
          <cylinderGeometry args={[layer.radius, layer.radius, layer.height, 64, 1, true]} />
          <meshBasicMaterial
            map={layer.texture}
            side={THREE.BackSide}
            transparent
            opacity={layer.opacity}
            depthWrite={false}
            fog
          />
        </mesh>
      ))}
    </group>
  )
}

// Scattered low-poly trees around the land plot
export function ScatteredTrees({ quality }) {
  const treeCount = quality === QUALITY.FAST ? 40 : 120

  const { trunkData, canopyData } = useMemo(() => {
    const trunks = []
    const canopies = []
    // Seeded random for deterministic placement
    let seed = 12345
    const seededRandom = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let i = 0; i < treeCount; i++) {
      const angle = seededRandom() * Math.PI * 2
      const dist = 40 + seededRandom() * 160
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      // Exclude land plot area
      if (Math.abs(x) < 35 && Math.abs(z) < 35) continue
      const scale = 0.7 + seededRandom() * 0.6
      trunks.push({ x, z, scale })
      canopies.push({ x, z, scale })
    }
    return { trunkData: trunks, canopyData: canopies }
  }, [treeCount])

  const trunkRef = useMemo(() => {
    const dummy = new THREE.Object3D()
    const mesh = new THREE.InstancedMesh(
      new THREE.CylinderGeometry(0.15, 0.2, 3, 6),
      new THREE.MeshStandardMaterial({ color: '#8B6914' }),
      trunkData.length
    )
    trunkData.forEach((t, i) => {
      dummy.position.set(t.x, 1.5 * t.scale, t.z)
      dummy.scale.set(t.scale, t.scale, t.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    return mesh
  }, [trunkData])

  const canopyRef = useMemo(() => {
    const dummy = new THREE.Object3D()
    const mesh = new THREE.InstancedMesh(
      new THREE.IcosahedronGeometry(1.8, 1),
      new THREE.MeshStandardMaterial({ color: '#4a9e3f', flatShading: true }),
      canopyData.length
    )
    canopyData.forEach((t, i) => {
      dummy.position.set(t.x, 3.5 * t.scale, t.z)
      dummy.scale.set(t.scale, t.scale * 1.1, t.scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    })
    mesh.instanceMatrix.needsUpdate = true
    return mesh
  }, [canopyData])

  return (
    <group>
      <primitive object={trunkRef} />
      <primitive object={canopyRef} />
    </group>
  )
}

// Distant treeline for horizon
export function DistantTreeline() {
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
