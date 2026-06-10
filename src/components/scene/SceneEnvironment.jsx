import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
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

  // Multiply the tiled detail map by the macro texture at a much larger scale
  // so the 60x-repeated grass tile stops reading as a repeating pattern.
  const injectMacroBlend = useMemo(() => (shader) => {
    shader.uniforms.macroMap = { value: macroTexture }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D macroMap;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 macro = texture2D(macroMap, vMapUv * 0.135).rgb * 2.0;
        diffuseColor.rgb *= mix(vec3(1.0), macro, 0.4);`)
  }, [macroTexture])

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
        onBeforeCompile={injectMacroBlend}
      />
    </mesh>
  )
}

// Instanced 3D grass blades around the plot (BEST quality only — gate at
// the call site so FAST never builds the geometry).
// Stylized cross-quad tufts with a dark-base → light-tip gradient and
// gentle vertex-shader wind sway. The plot interior is excluded so blades
// never poke through building floors.
export function GrassField() {
  const { mesh, material } = useMemo(() => {
    // Tuft geometry: 3 crossed narrow quads with bend segments
    const blade = new THREE.PlaneGeometry(0.22, 0.48, 1, 2)
    blade.translate(0, 0.24, 0)
    const parts = []
    for (let i = 0; i < 3; i++) {
      const p = blade.clone()
      p.rotateX(0.28) // lean outward so blades show some face from above
      p.rotateY((Math.PI / 3) * i)
      parts.push(p)
    }
    const tuft = mergeGeometries(parts)
    blade.dispose()

    // Vertex colors: ground-toned base to warm light tip
    const base = new THREE.Color('#57a23c')
    const tip = new THREE.Color('#c4e878')
    const pos = tuft.attributes.position
    const colors = new Float32Array(pos.count * 3)
    const c = new THREE.Color()
    for (let i = 0; i < pos.count; i++) {
      const f = Math.min(1, pos.getY(i) / 0.48)
      c.copy(base).lerp(tip, f * f)
      colors[i * 3] = c.r
      colors[i * 3 + 1] = c.g
      colors[i * 3 + 2] = c.b
    }
    tuft.setAttribute('color', new THREE.BufferAttribute(colors, 3))

    // Up-facing normals: blades shade exactly like the ground beneath them,
    // so they read as bright meadow instead of dark vertical cards
    const normals = tuft.attributes.normal
    for (let i = 0; i < normals.count; i++) normals.setXYZ(i, 0, 1, 0)

    const mat = new THREE.MeshStandardMaterial({
      vertexColors: true,
      side: THREE.DoubleSide,
      roughness: 0.85,
      metalness: 0,
    })
    // Wind sway: bend each tuft by height, phase-shifted by instance position
    mat.onBeforeCompile = (shader) => {
      shader.uniforms.uTime = { value: 0 }
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nuniform float uTime;')
        .replace('#include <begin_vertex>', `#include <begin_vertex>
          float windPhase = instanceMatrix[3][0] * 0.45 + instanceMatrix[3][2] * 0.6;
          float sway = sin(uTime * 1.6 + windPhase) + sin(uTime * 2.7 + windPhase * 1.3) * 0.4;
          transformed.x += sway * 0.05 * position.y;
          transformed.z += sway * 0.025 * position.y;`)
      mat.userData.shader = shader
    }

    // Seeded scatter in a ring around the plot (same exclusion as trees)
    let seed = 54321
    const seededRandom = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    const placements = []
    for (let i = 0; i < 6000 && placements.length < 3500; i++) {
      const angle = seededRandom() * Math.PI * 2
      const dist = 30 + Math.pow(seededRandom(), 1.6) * 90
      const x = Math.cos(angle) * dist
      const z = Math.sin(angle) * dist
      if (Math.abs(x) < 35 && Math.abs(z) < 35) continue
      placements.push({ x, z, scale: 0.7 + seededRandom() * 0.8, rot: seededRandom() * Math.PI })
    }

    const instanced = new THREE.InstancedMesh(tuft, mat, placements.length)
    const dummy = new THREE.Object3D()
    placements.forEach((p, i) => {
      dummy.position.set(p.x, 0, p.z)
      dummy.rotation.set(0, p.rot, 0)
      dummy.scale.set(p.scale, p.scale, p.scale)
      dummy.updateMatrix()
      instanced.setMatrixAt(i, dummy.matrix)
    })
    instanced.instanceMatrix.needsUpdate = true
    instanced.frustumCulled = false
    return { mesh: instanced, material: mat }
  }, [])

  useFrame((state) => {
    const shader = material.userData.shader
    if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime
  })

  return <primitive object={mesh} />
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

// ─── Stylized vegetation helpers ───────────────────────────────────────────

// Write a base→top vertex-color gradient onto a geometry (by local Y), then
// translate it into place. brightness shades whole clumps lighter/darker.
function paintGradient(geo, baseColor, topColor, brightness = 1) {
  const pos = geo.attributes.position
  geo.computeBoundingBox()
  const minY = geo.boundingBox.min.y
  const maxY = geo.boundingBox.max.y
  const span = Math.max(maxY - minY, 0.0001)
  const colors = new Float32Array(pos.count * 3)
  const base = new THREE.Color(baseColor)
  const top = new THREE.Color(topColor)
  const c = new THREE.Color()
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getY(i) - minY) / span
    c.copy(base).lerp(top, t).multiplyScalar(brightness)
    colors[i * 3] = c.r
    colors[i * 3 + 1] = c.g
    colors[i * 3 + 2] = c.b
  }
  geo.setAttribute('color', new THREE.BufferAttribute(colors, 3))
  return geo
}

// Build one stylized tree as a single vertex-colored geometry:
// tapered trunk + layered foliage clumps (the Genshin look — distinct
// rounded clusters, each with its own dark-base → light-top gradient).
function buildTreeGeometry(kind) {
  const parts = []
  const blob = (r, x, y, z, squashY, base, top, brightness) => {
    const g = new THREE.IcosahedronGeometry(r, 1)
    g.scale(1, squashY, 1)
    paintGradient(g, base, top, brightness)
    g.translate(x, y, z)
    parts.push(g)
  }
  const trunk = (rTop, rBottom, h, x = 0, z = 0) => {
    // non-indexed to match IcosahedronGeometry blobs for mergeGeometries
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, 6).toNonIndexed()
    paintGradient(g, '#4e3a20', '#6f5433', 1)
    g.translate(x, h / 2, z)
    parts.push(g)
  }

  if (kind === 'round') {
    // Broad leafy tree: big crown + surrounding clumps
    trunk(0.16, 0.24, 2.4)
    blob(1.45, 0, 3.7, 0, 0.85, '#2f7030', '#8cc44e', 1.0)
    blob(1.0, 1.05, 3.0, 0.25, 0.8, '#2f7030', '#8cc44e', 0.92)
    blob(0.95, -1.0, 3.1, -0.2, 0.8, '#2f7030', '#8cc44e', 1.06)
    blob(0.9, 0.15, 3.0, 1.0, 0.8, '#2f7030', '#8cc44e', 0.88)
    blob(0.85, -0.2, 3.15, -1.0, 0.8, '#2f7030', '#8cc44e', 1.1)
  } else if (kind === 'tall') {
    // Tall cool-green tree: stacked, narrowing clumps
    trunk(0.13, 0.2, 3.0)
    blob(1.25, 0, 3.0, 0, 0.75, '#235c39', '#67ab49', 0.95)
    blob(1.0, 0, 4.1, 0, 0.75, '#235c39', '#67ab49', 1.0)
    blob(0.75, 0, 5.0, 0, 0.75, '#235c39', '#67ab49', 1.08)
    blob(0.45, 0, 5.7, 0, 0.8, '#235c39', '#67ab49', 1.15)
  } else {
    // Small warm bushy tree
    trunk(0.11, 0.16, 1.5)
    blob(1.0, 0, 2.2, 0, 0.8, '#4a8a2c', '#aed258', 1.0)
    blob(0.7, 0.7, 1.9, 0.3, 0.75, '#4a8a2c', '#aed258', 0.9)
    blob(0.65, -0.65, 2.0, -0.25, 0.75, '#4a8a2c', '#aed258', 1.08)
  }
  return mergeGeometries(parts)
}

// Shared foliage material: vertex colors + gentle wind sway above trunk height
function makeSwayMaterial() {
  const mat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 })
  mat.onBeforeCompile = (shader) => {
    shader.uniforms.uTime = { value: 0 }
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nuniform float uTime;')
      .replace('#include <begin_vertex>', `#include <begin_vertex>
        float canopyH = max(transformed.y - 1.2, 0.0);
        float treePhase = instanceMatrix[3][0] * 0.35 + instanceMatrix[3][2] * 0.5;
        float treeSway = sin(uTime * 1.1 + treePhase) + sin(uTime * 1.9 + treePhase * 1.4) * 0.5;
        transformed.x += treeSway * 0.018 * canopyH;
        transformed.z += treeSway * 0.012 * canopyH;`)
    mat.userData.shader = shader
  }
  return mat
}

// Deterministic scatter in a ring around the plot, excluding the plot itself
function scatterRing(seedStart, count, distMin, distMax, distPow = 1) {
  let seed = seedStart
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const out = []
  for (let i = 0; i < count * 2 && out.length < count; i++) {
    const angle = rand() * Math.PI * 2
    const dist = distMin + Math.pow(rand(), distPow) * (distMax - distMin)
    const x = Math.cos(angle) * dist
    const z = Math.sin(angle) * dist
    if (Math.abs(x) < 35 && Math.abs(z) < 35) continue
    out.push({ x, z, scale: 0.7 + rand() * 0.6, rot: rand() * Math.PI * 2, pick: rand() })
  }
  return out
}

function fillInstances(mesh, placements) {
  const dummy = new THREE.Object3D()
  placements.forEach((p, i) => {
    dummy.position.set(p.x, 0, p.z)
    dummy.rotation.set(0, p.rot, 0)
    dummy.scale.set(p.scale, p.scale, p.scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
}

// Scattered stylized trees around the land plot — 3 variants, one
// instanced draw call each, layered-clump foliage with wind sway
export function ScatteredTrees({ quality }) {
  const treeCount = quality === QUALITY.FAST ? 40 : 120
  const castShadows = quality !== QUALITY.FAST

  const { group, material } = useMemo(() => {
    const placements = scatterRing(12345, treeCount, 40, 200)
    const byKind = { round: [], tall: [], bush: [] }
    for (const p of placements) {
      byKind[p.pick < 0.55 ? 'round' : p.pick < 0.8 ? 'tall' : 'bush'].push(p)
    }
    const mat = makeSwayMaterial()
    const g = new THREE.Group()
    for (const kind of Object.keys(byKind)) {
      const list = byKind[kind]
      if (!list.length) continue
      const mesh = new THREE.InstancedMesh(buildTreeGeometry(kind), mat, list.length)
      fillInstances(mesh, list)
      mesh.castShadow = castShadows
      g.add(mesh)
    }
    return { group: g, material: mat }
  }, [treeCount, castShadows])

  useFrame((state) => {
    const shader = material.userData.shader
    if (shader) shader.uniforms.uTime.value = state.clock.elapsedTime
  })

  return <primitive object={group} />
}

// Ground foliage: bushes, rocks, and flowers scattered outside the plot
// (BEST quality only — gate at the call site)
export function GroundFoliage() {
  const group = useMemo(() => {
    const g = new THREE.Group()

    // Bushes: two merged squashed blobs
    const bushParts = []
    const b1 = new THREE.IcosahedronGeometry(0.55, 1)
    b1.scale(1.2, 0.7, 1)
    paintGradient(b1, '#2f7030', '#8cc44e', 0.95)
    b1.translate(0, 0.32, 0)
    bushParts.push(b1)
    const b2 = new THREE.IcosahedronGeometry(0.4, 1)
    b2.scale(1.1, 0.75, 1)
    paintGradient(b2, '#2f7030', '#9ed25c', 1.05)
    b2.translate(0.45, 0.26, 0.2)
    bushParts.push(b2)
    const bushGeo = mergeGeometries(bushParts)
    const foliageMat = new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.9, metalness: 0 })
    const bushes = new THREE.InstancedMesh(bushGeo, foliageMat, 70)
    fillInstances(bushes, scatterRing(77777, 70, 30, 130, 1.4))
    g.add(bushes)

    // Rocks: low-poly, cool gray with warm top
    const rockGeo = new THREE.DodecahedronGeometry(0.45, 0)
    rockGeo.scale(1.3, 0.8, 1)
    paintGradient(rockGeo, '#6b7280', '#aab2bd', 1)
    rockGeo.translate(0, 0.25, 0)
    const rockMat = new THREE.MeshStandardMaterial({ vertexColors: true, flatShading: true, roughness: 0.95 })
    const rocks = new THREE.InstancedMesh(rockGeo, rockMat, 26)
    fillInstances(rocks, scatterRing(31313, 26, 32, 150, 1.3))
    g.add(rocks)

    // Flowers: tiny cross-quads, stem painted green, head tinted per mesh
    const flowerColors = ['#ffffff', '#ffd84d', '#ff9ec4']
    flowerColors.forEach((headColor, fi) => {
      const quad = new THREE.PlaneGeometry(0.16, 0.3, 1, 2)
      quad.translate(0, 0.15, 0)
      const cross = mergeGeometries([quad, quad.clone().rotateY(Math.PI / 2)])
      // stem (lower 55%) green, head takes the flower color
      const pos = cross.attributes.position
      const colors = new Float32Array(pos.count * 3)
      const stem = new THREE.Color('#3f8f2d')
      const head = new THREE.Color(headColor)
      for (let i = 0; i < pos.count; i++) {
        const c = pos.getY(i) > 0.165 ? head : stem
        colors[i * 3] = c.r
        colors[i * 3 + 1] = c.g
        colors[i * 3 + 2] = c.b
      }
      cross.setAttribute('color', new THREE.BufferAttribute(colors, 3))
      const norms = cross.attributes.normal
      for (let i = 0; i < norms.count; i++) norms.setXYZ(i, 0, 1, 0)
      const mat = new THREE.MeshStandardMaterial({ vertexColors: true, side: THREE.DoubleSide, roughness: 0.85 })
      const flowers = new THREE.InstancedMesh(cross, mat, 60)
      fillInstances(flowers, scatterRing(91000 + fi * 137, 60, 30, 110, 1.5))
      flowers.frustumCulled = false
      g.add(flowers)
    })

    return g
  }, [])

  return <primitive object={group} />
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
