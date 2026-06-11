import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'
import { mergeGeometries } from 'three/examples/jsm/utils/BufferGeometryUtils.js'
import { QUALITY, QUALITY_SETTINGS } from '../../constants/landSceneConstants'
import { useGrassTextures, useSimpleGrassTexture } from '../../hooks/useGrassTextures'

// Time-of-day color stops for sky interpolation — saturated, painterly
// (sun = glow/disc color near the sun direction)
const SKY_STOPS = [
  { t: 0.0, sunY: 40,  top: [0.024, 0.055, 0.125], horizon: [0.078, 0.137, 0.243], bottom: [0.039, 0.067, 0.110], cloud: [0.16, 0.18, 0.30], sun: [0.5, 0.6, 0.8] },
  { t: 0.2, sunY: 20,  top: [0.231, 0.282, 0.486], horizon: [0.957, 0.580, 0.392], bottom: [1.0, 0.741, 0.478],   cloud: [1.0, 0.78, 0.60],  sun: [1.0, 0.62, 0.30] },
  { t: 0.35, sunY: 120, top: [0.350, 0.530, 0.780], horizon: [0.700, 0.810, 0.890], bottom: [0.880, 0.920, 0.950], cloud: [1.0, 0.99, 0.96],  sun: [1.0, 0.95, 0.82] },
  { t: 0.5, sunY: 150,  top: [0.290, 0.490, 0.760], horizon: [0.620, 0.780, 0.890], bottom: [0.820, 0.890, 0.940], cloud: [1.0, 1.0, 1.0],    sun: [1.0, 0.98, 0.90] },
  { t: 0.7, sunY: 30,  top: [0.300, 0.330, 0.560], horizon: [0.930, 0.580, 0.350], bottom: [0.980, 0.780, 0.470],   cloud: [1.0, 0.72, 0.46],  sun: [1.0, 0.52, 0.18] },
  { t: 0.85, sunY: -10, top: [0.075, 0.110, 0.278], horizon: [0.439, 0.227, 0.420], bottom: [0.804, 0.380, 0.263], cloud: [0.42, 0.24, 0.34], sun: [0.9, 0.4, 0.3] },
  { t: 1.0, sunY: 40,  top: [0.024, 0.055, 0.125], horizon: [0.078, 0.137, 0.243], bottom: [0.039, 0.067, 0.110], cloud: [0.16, 0.18, 0.30], sun: [0.5, 0.6, 0.8] },
]

function lerpStops(stops, time, key) {
  for (let i = 0; i < stops.length - 1; i++) {
    if (time >= stops[i].t && time <= stops[i + 1].t) {
      const f = (time - stops[i].t) / (stops[i + 1].t - stops[i].t)
      const a = stops[i][key], b = stops[i + 1][key]
      if (Array.isArray(a)) return a.map((v, j) => v + (b[j] - v) * f)
      return a + (b - a) * f
    }
  }
  return stops[0][key]
}

// ─── Terrain ────────────────────────────────────────────────────────────────

// Rolling-hill height: dead flat near the plot (buildings, comparisons, NPCs
// all live inside r<65), gentle hills further out. Shared by the ground mesh
// and every scatter placement so vegetation sits on the terrain.
export function terrainHeight(x, z) {
  const r = Math.sqrt(x * x + z * z)
  if (r < 65) return 0
  const fade = Math.min((r - 65) / 130, 1)
  const smooth = fade * fade * (3 - 2 * fade)
  const amp = 4.2 * smooth
  return (
    Math.sin(x * 0.020 + 1.3) * 0.45 +
    Math.sin(z * 0.016 - 0.7) * 0.35 +
    Math.sin((x + z) * 0.011 + 2.1) * 0.20
  ) * amp
}

// ─── Procedural surface textures (canvas-painted, generated once) ──────────

// Tiling leaf-cluster texture: dense small leaves in layered green tones
function makeLeafTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 256
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#42663a'
  ctx.fillRect(0, 0, 256, 256)
  const tones = ['#33522a', '#3f6334', '#4d7540', '#5c864c', '#6e9759', '#82a868']
  for (let i = 0; i < 1400; i++) {
    const x = Math.random() * 256
    const y = Math.random() * 256
    const w = 4 + Math.random() * 7
    const h = w * (0.45 + Math.random() * 0.3)
    const rot = Math.random() * Math.PI
    // bias brighter leaves slightly toward the top of the tile
    const bias = Math.min(1, (1 - y / 256) * 0.7 + Math.random() * 0.6)
    const tone = tones[Math.min(tones.length - 1, Math.floor(bias * tones.length))]
    ctx.save()
    ctx.translate(x, y)
    ctx.rotate(rot)
    ctx.fillStyle = tone
    ctx.globalAlpha = 0.85
    ctx.beginPath()
    ctx.ellipse(0, 0, w, h, 0, 0, Math.PI * 2)
    ctx.fill()
    ctx.restore()
  }
  ctx.globalAlpha = 1
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

// Vertical-streak bark texture
function makeBarkTexture() {
  const canvas = document.createElement('canvas')
  canvas.width = 128
  canvas.height = 256
  const ctx = canvas.getContext('2d')
  ctx.fillStyle = '#5d4730'
  ctx.fillRect(0, 0, 128, 256)
  for (let i = 0; i < 110; i++) {
    const x = Math.random() * 128
    const w = 1 + Math.random() * 4
    const dark = Math.random() > 0.45
    const v = dark ? 0.55 + Math.random() * 0.2 : 1.1 + Math.random() * 0.25
    ctx.fillStyle = `rgba(${(93 * v) | 0}, ${(71 * v) | 0}, ${(48 * v) | 0}, ${0.35 + Math.random() * 0.3})`
    const y0 = Math.random() * 256
    const len = 60 + Math.random() * 180
    ctx.fillRect(x, y0, w, len)
    if (y0 + len > 256) ctx.fillRect(x, 0, w, y0 + len - 256) // wrap for tiling
  }
  const tex = new THREE.CanvasTexture(canvas)
  tex.colorSpace = THREE.SRGBColorSpace
  tex.wrapS = THREE.RepeatWrapping
  tex.wrapT = THREE.RepeatWrapping
  return tex
}

// Stylized painterly sky: gradient + domain-warped two-tone cumulus clouds
// with slow drift, sun disc + glow, and horizon haze — animated by timeOfDay
export function RealisticSky({ timeOfDay = 0.35 }) {
  const matRef = useRef()

  const uniforms = useMemo(() => ({
    topColor: { value: new THREE.Color('#5b8ec9') },
    horizonColor: { value: new THREE.Color('#f0c89a') },
    bottomColor: { value: new THREE.Color('#ffe8d0') },
    cloudTint: { value: new THREE.Vector3(1.0, 0.95, 0.88) },
    sunColor: { value: new THREE.Vector3(1.0, 0.95, 0.82) },
    sunDir: { value: new THREE.Vector3(0.5, 0.8, 0.3) },
    uTime: { value: 0 },
  }), [])

  // Update sky colors each frame based on timeOfDay (no re-renders)
  useFrame((state) => {
    if (!matRef.current) return
    const u = matRef.current.uniforms
    const top = lerpStops(SKY_STOPS, timeOfDay, 'top')
    const hor = lerpStops(SKY_STOPS, timeOfDay, 'horizon')
    const bot = lerpStops(SKY_STOPS, timeOfDay, 'bottom')
    const cld = lerpStops(SKY_STOPS, timeOfDay, 'cloud')
    const sun = lerpStops(SKY_STOPS, timeOfDay, 'sun')
    u.topColor.value.setRGB(top[0], top[1], top[2])
    u.horizonColor.value.setRGB(hor[0], hor[1], hor[2])
    u.bottomColor.value.setRGB(bot[0], bot[1], bot[2])
    u.cloudTint.value.set(cld[0], cld[1], cld[2])
    u.sunColor.value.set(sun[0], sun[1], sun[2])
    // Same sun orbit as DayNightController so the glow tracks the light
    const sx = Math.cos(timeOfDay * Math.PI * 2) * 80
    const sy = lerpStops(SKY_STOPS, timeOfDay, 'sunY')
    const sz = Math.sin(timeOfDay * Math.PI * 2) * 40
    u.sunDir.value.set(sx, sy, sz).normalize()
    u.uTime.value = state.clock.elapsedTime
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
    uniform vec3 sunColor;
    uniform vec3 sunDir;
    uniform float uTime;
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
      v += noise(p * 8.0) * 0.0625;
      return v;
    }

    void main() {
      vec3 dir = normalize(vWorldPosition);
      float h = dir.y;

      vec3 skyColor;
      if (h > 0.0) {
        float t = pow(h, 0.65);
        skyColor = mix(horizonColor, topColor, t);
      } else {
        skyColor = bottomColor;
      }

      // Sun glow + soft disc
      float cosAngle = max(dot(dir, sunDir), 0.0);
      float glow = pow(cosAngle, 6.0) * 0.30 + pow(cosAngle, 60.0) * 0.35;
      float disc = smoothstep(0.9993, 0.9997, cosAngle);
      skyColor += sunColor * (glow + disc * 1.4);

      // Stylized cumulus: domain-warped fbm, two-tone (lit top / shaded base)
      if (h > 0.03) {
        vec2 cloudUV = dir.xz / (h + 0.18) * 1.4;
        cloudUV += vec2(uTime * 0.006, uTime * 0.002);
        vec2 warp = vec2(fbm(cloudUV * 1.6 + 3.7), fbm(cloudUV * 1.6 - 1.3));
        float n = fbm(cloudUV + (warp - 0.5) * 0.9);
        float cloud = smoothstep(0.46, 0.62, n);
        float fade = smoothstep(0.0, 0.22, h) * 0.85;
        // shading: re-sample slightly offset toward the sun for lit edges
        float lit = fbm(cloudUV + (warp - 0.5) * 0.9 + sunDir.xz * 0.18);
        vec3 shadeTint = cloudTint * vec3(0.58, 0.62, 0.76);
        vec3 cloudCol = mix(shadeTint, cloudTint, smoothstep(0.38, 0.62, lit));
        // silver lining near the sun
        cloudCol += sunColor * pow(cosAngle, 5.0) * 0.18;
        skyColor = mix(skyColor, cloudCol, cloud * fade);
      }

      // Horizon haze band
      skyColor = mix(skyColor, horizonColor, exp(-abs(h) * 7.0) * 0.45);

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
  // so the repeated grass tile stops reading as a repeating pattern.
  const injectMacroBlend = useMemo(() => (shader) => {
    shader.uniforms.macroMap = { value: macroTexture }
    shader.fragmentShader = shader.fragmentShader
      .replace('#include <common>', '#include <common>\nuniform sampler2D macroMap;')
      .replace('#include <map_fragment>', `#include <map_fragment>
        vec3 macro = texture2D(macroMap, vMapUv * 0.135).rgb * 2.0;
        diffuseColor.rgb *= mix(vec3(1.0), macro, 0.25);`)
  }, [macroTexture])

  // Rolling terrain: displace the plane with terrainHeight (flat near plot).
  // Plane is rotated -90° about X, so local (x, y) → world (x, -y) and
  // local z becomes world height.
  const terrainGeo = useMemo(() => {
    const geo = new THREE.PlaneGeometry(2000, 2000, 160, 160)
    const pos = geo.attributes.position
    for (let i = 0; i < pos.count; i++) {
      pos.setZ(i, terrainHeight(pos.getX(i), -pos.getY(i)))
    }
    geo.computeVertexNormals()
    return geo
  }, [])

  if (quality === QUALITY.FAST) {
    return (
      <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow geometry={terrainGeo}>
        <meshStandardMaterial map={simpleTexture} roughness={0.95} metalness={0} />
      </mesh>
    )
  }

  // Best quality: use enhanced material
  return (
    <mesh rotation={[-Math.PI / 2, 0, 0]} position={[0, 0, 0]} receiveShadow geometry={terrainGeo}>
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

// Day/night tint multiplier for unlit distant scenery (mountains, treeline)
const DISTANT_TINT_STOPS = [
  { t: 0.0,  tint: [0.14, 0.18, 0.32] },
  { t: 0.2,  tint: [0.95, 0.62, 0.55] },
  { t: 0.35, tint: [0.82, 0.90, 1.0] },
  { t: 0.5,  tint: [0.80, 0.88, 1.0] },
  { t: 0.7,  tint: [1.0, 0.60, 0.45] },
  { t: 0.85, tint: [0.28, 0.22, 0.38] },
  { t: 1.0,  tint: [0.14, 0.18, 0.32] },
]

// Build a circular ridge "curtain": jagged top edge with real silhouette
// depth, vertex colors fading from peak color down into horizon haze
function buildRidgeGeometry(radius, height, phase, peakColor, hazeColor) {
  const segments = 160
  const positions = []
  const colors = []
  const indices = []
  const peak = new THREE.Color(peakColor)
  const haze = new THREE.Color(hazeColor)
  const litPeak = peak.clone().lerp(new THREE.Color('#ffffff'), 0.22)
  for (let i = 0; i <= segments; i++) {
    const theta = (i / segments) * Math.PI * 2
    let p = 0
    p += Math.sin(theta * 3 + phase * 1.7) * 0.30
    p += Math.sin(theta * 7 + phase * 2.3) * 0.15
    p += Math.sin(theta * 13 + phase * 0.9) * 0.08
    p += Math.sin(theta * 23 + phase * 3.1) * 0.04
    const hNorm = Math.max(0.18, 0.55 + p) // 0.18..~1.1
    const x = Math.cos(theta) * radius
    const z = Math.sin(theta) * radius
    positions.push(x, hNorm * height, z, x, -10, z)
    // peaks catch light; base melts into haze
    const topC = peak.clone().lerp(litPeak, Math.max(0, (hNorm - 0.55) * 1.6))
    colors.push(topC.r, topC.g, topC.b, haze.r, haze.g, haze.b)
    if (i < segments) {
      const a = i * 2
      indices.push(a, a + 1, a + 2, a + 1, a + 3, a + 2)
    }
  }
  const geo = new THREE.BufferGeometry()
  geo.setAttribute('position', new THREE.Float32BufferAttribute(positions, 3))
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colors, 3))
  geo.setIndex(indices)
  return geo
}

// Layered mountain ranges on the horizon — real ridge geometry instead of
// transparent billboards, progressively bluer with distance (aerial
// perspective), tinted by time of day
export function MountainSilhouettes({ timeOfDay = 0.35 }) {
  const { group, materials } = useMemo(() => {
    const configs = [
      // far → near: lighter/bluer → more saturated
      { radius: 450, height: 80, phase: 0, peak: '#a8b6cc', haze: '#cdd8e6' },
      { radius: 355, height: 72, phase: 2.1, peak: '#8ea2b8', haze: '#bccadb' },
      { radius: 265, height: 52, phase: 4.4, peak: '#74909f', haze: '#a8bfcc' },
    ]
    const g = new THREE.Group()
    const mats = []
    for (const cfg of configs) {
      const geo = buildRidgeGeometry(cfg.radius, cfg.height, cfg.phase, cfg.peak, cfg.haze)
      const mat = new THREE.MeshBasicMaterial({ vertexColors: true, side: THREE.DoubleSide, fog: false })
      mats.push(mat)
      g.add(new THREE.Mesh(geo, mat))
    }
    return { group: g, materials: mats }
  }, [])

  // Tint with time of day (unlit material × tint ≈ aerial light)
  useFrame(() => {
    const tint = lerpStops(DISTANT_TINT_STOPS, timeOfDay, 'tint')
    for (const m of materials) m.color.setRGB(tint[0], tint[1], tint[2])
  })

  return <primitive object={group} />
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

// Foliage canopy: irregular jittered clumps surfaced with the tiling leaf
// texture — silhouettes are bumpy, the surface reads as actual leaves.
function buildCanopyGeometry(kind, jitterSeed) {
  let seed = jitterSeed
  const rand = () => {
    seed = (seed * 16807) % 2147483647
    return (seed - 1) / 2147483646
  }
  const parts = []
  const clump = (r, x, y, z, squashY, base, top, brightness) => {
    const g = new THREE.IcosahedronGeometry(r, 2)
    // radial jitter for an organic, non-balloon silhouette
    const pos = g.attributes.position
    const v = new THREE.Vector3()
    for (let i = 0; i < pos.count; i++) {
      v.fromBufferAttribute(pos, i)
      const n = 1 + (rand() - 0.5) * 0.34
      pos.setXYZ(i, v.x * n, v.y * n, v.z * n)
    }
    g.scale(1, squashY, 1)
    g.computeVertexNormals()
    paintGradient(g, base, top, brightness)
    g.translate(x, y, z)
    parts.push(g)
  }

  // colors are multipliers over the leaf texture: dark gray base → white-ish
  // lit top, with a slight per-variant hue cast
  if (kind === 'round') {
    clump(1.45, 0, 3.8, 0, 0.85, '#86907e', '#f2f5ea', 1.05)
    clump(1.0, 1.1, 3.1, 0.3, 0.8, '#86907e', '#f2f5ea', 0.92)
    clump(0.95, -1.05, 3.2, -0.25, 0.8, '#86907e', '#f2f5ea', 1.05)
    clump(0.9, 0.2, 3.05, 1.05, 0.8, '#86907e', '#f2f5ea', 0.88)
    clump(0.85, -0.25, 3.2, -1.05, 0.8, '#86907e', '#f2f5ea', 1.1)
    clump(0.7, 0.65, 4.5, -0.5, 0.85, '#86907e', '#f2f5ea', 1.15)
  } else if (kind === 'tall') {
    clump(1.25, 0, 3.1, 0, 0.72, '#7b8a84', '#dfeee3', 0.95)
    clump(1.0, 0.15, 4.2, -0.1, 0.72, '#7b8a84', '#dfeee3', 1.0)
    clump(0.75, -0.1, 5.1, 0.1, 0.72, '#7b8a84', '#dfeee3', 1.1)
    clump(0.45, 0.05, 5.8, 0, 0.8, '#7b8a84', '#dfeee3', 1.18)
  } else {
    clump(1.0, 0, 2.25, 0, 0.78, '#8f947f', '#f5f1de', 1.05)
    clump(0.7, 0.72, 1.95, 0.3, 0.72, '#8f947f', '#f5f1de', 0.92)
    clump(0.65, -0.68, 2.05, -0.25, 0.72, '#8f947f', '#f5f1de', 1.1)
  }
  const merged = mergeGeometries(parts)
  merged.scale(1.18, 1.18, 1.18)
  return merged
}

// Trunk with a couple of branch stubs reaching into the canopy
function buildTrunkGeometry(kind) {
  const parts = []
  const seg = (rTop, rBottom, h, tx, ty, tz, tiltZ = 0, tiltX = 0) => {
    const g = new THREE.CylinderGeometry(rTop, rBottom, h, 7).toNonIndexed()
    g.translate(0, h / 2, 0)
    g.rotateZ(tiltZ)
    g.rotateX(tiltX)
    g.translate(tx, ty, tz)
    // subtle AO: darker base, full brightness up top (multiplies bark map)
    paintGradient(g, '#9b9b9b', '#ffffff', 1)
    parts.push(g)
  }
  if (kind === 'round') {
    seg(0.14, 0.26, 2.6, 0, 0, 0)
    seg(0.06, 0.10, 1.4, 0.1, 1.6, 0.05, 0.55)
    seg(0.05, 0.09, 1.2, -0.05, 1.8, -0.05, -0.5, 0.3)
  } else if (kind === 'tall') {
    seg(0.10, 0.22, 3.2, 0, 0, 0)
  } else {
    seg(0.09, 0.17, 1.7, 0, 0, 0, 0.08)
    seg(0.04, 0.07, 0.9, 0.06, 1.0, 0, 0.6)
  }
  const merged = mergeGeometries(parts)
  merged.scale(1.18, 1.18, 1.18)
  return merged
}

// Shared foliage material: leaf texture + vertex tint + gentle wind sway
function makeSwayMaterial(leafTexture) {
  const mat = new THREE.MeshStandardMaterial({
    map: leafTexture,
    vertexColors: true,
    roughness: 0.9,
    metalness: 0,
  })
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

// Deterministic scatter in a ring around the plot, excluding the plot itself;
// placements land on the rolling terrain
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
    out.push({ x, z, y: terrainHeight(x, z), scale: 0.7 + rand() * 0.6, rot: rand() * Math.PI * 2, pick: rand() })
  }
  return out
}

function fillInstances(mesh, placements) {
  const dummy = new THREE.Object3D()
  placements.forEach((p, i) => {
    dummy.position.set(p.x, (p.y || 0) - 0.04, p.z)
    dummy.rotation.set(0, p.rot, 0)
    dummy.scale.set(p.scale, p.scale, p.scale)
    dummy.updateMatrix()
    mesh.setMatrixAt(i, dummy.matrix)
  })
  mesh.instanceMatrix.needsUpdate = true
}

// Scattered stylized trees around the land plot — 3 variants, each drawn as
// two instanced meshes (bark-textured trunk + leaf-textured canopy)
export function ScatteredTrees({ quality }) {
  const treeCount = quality === QUALITY.FAST ? 40 : 150
  const castShadows = quality !== QUALITY.FAST

  const { group, material } = useMemo(() => {
    const placements = scatterRing(12345, treeCount, 40, 200)
    const byKind = { round: [], tall: [], bush: [] }
    for (const p of placements) {
      byKind[p.pick < 0.55 ? 'round' : p.pick < 0.8 ? 'tall' : 'bush'].push(p)
    }
    const leafMat = makeSwayMaterial(makeLeafTexture())
    const barkMat = new THREE.MeshStandardMaterial({
      map: makeBarkTexture(),
      vertexColors: true,
      roughness: 0.95,
      metalness: 0,
    })
    const g = new THREE.Group()
    let jitterSeed = 9421
    for (const kind of Object.keys(byKind)) {
      const list = byKind[kind]
      if (!list.length) continue
      const canopy = new THREE.InstancedMesh(buildCanopyGeometry(kind, jitterSeed), leafMat, list.length)
      jitterSeed += 517
      const trunk = new THREE.InstancedMesh(buildTrunkGeometry(kind), barkMat, list.length)
      fillInstances(canopy, list)
      fillInstances(trunk, list)
      canopy.castShadow = castShadows
      trunk.castShadow = castShadows
      g.add(canopy)
      g.add(trunk)
    }
    return { group: g, material: leafMat }
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

    // Bushes: two merged squashed blobs surfaced with the leaf texture
    const bushParts = []
    const b1 = new THREE.IcosahedronGeometry(0.55, 2)
    b1.scale(1.2, 0.7, 1)
    paintGradient(b1, '#86907e', '#f2f5ea', 0.95)
    b1.translate(0, 0.32, 0)
    bushParts.push(b1)
    const b2 = new THREE.IcosahedronGeometry(0.4, 2)
    b2.scale(1.1, 0.75, 1)
    paintGradient(b2, '#86907e', '#f2f5ea', 1.08)
    b2.translate(0.45, 0.26, 0.2)
    bushParts.push(b2)
    const bushGeo = mergeGeometries(bushParts)
    const foliageMat = new THREE.MeshStandardMaterial({
      map: makeLeafTexture(),
      vertexColors: true,
      roughness: 0.9,
      metalness: 0,
    })
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

    return g
  }, [])

  return <primitive object={group} />
}

// Distant circular treeline between the scattered trees and the mountains —
// painted canopy-cluster silhouettes on a ring, tinted by time of day
export function DistantTreeline({ timeOfDay = 0.35 }) {
  const { texture, material } = useMemo(() => {
    const canvas = document.createElement('canvas')
    canvas.width = 1024
    canvas.height = 128
    const ctx = canvas.getContext('2d')

    // Rounded canopy clusters at varying heights (painted, not triangles)
    let seed = 24680
    const rand = () => {
      seed = (seed * 16807) % 2147483647
      return (seed - 1) / 2147483646
    }
    for (let x = 0; x < 1024; x += 7) {
      const clusterH = 38 + rand() * 50
      const shade = 0.82 + rand() * 0.36
      const r = Math.round(58 * shade)
      const g = Math.round(92 * shade)
      const b = Math.round(74 * shade)
      ctx.fillStyle = `rgb(${r}, ${g}, ${b})`
      // stacked overlapping circles form a soft canopy silhouette
      for (let j = 0; j < 3; j++) {
        const cx = x + (rand() - 0.5) * 10
        const cy = 128 - clusterH + j * 14
        const cr = 12 + rand() * 10
        ctx.beginPath()
        ctx.arc(cx, cy, cr, 0, Math.PI * 2)
        ctx.fill()
      }
      // fill to the bottom so there are no gaps under canopies
      ctx.fillRect(x - 6, 128 - clusterH + 26, 24, clusterH)
    }

    const tex = new THREE.CanvasTexture(canvas)
    tex.colorSpace = THREE.SRGBColorSpace
    tex.wrapS = THREE.RepeatWrapping
    tex.repeat.set(10, 1)
    const mat = new THREE.MeshBasicMaterial({
      map: tex,
      transparent: true,
      alphaTest: 0.4,
      side: THREE.BackSide,
      fog: false,
    })
    return { texture: tex, material: mat }
  }, [])

  useFrame(() => {
    const tint = lerpStops(DISTANT_TINT_STOPS, timeOfDay, 'tint')
    // slightly darker than the mountains so the treeline reads as nearer
    material.color.setRGB(tint[0] * 0.8, tint[1] * 0.85, tint[2] * 0.8)
  })

  return (
    <mesh position={[0, 5, 0]}>
      <cylinderGeometry args={[225, 225, 22, 96, 1, true]} />
      <primitive object={material} attach="material" map={texture} />
    </mesh>
  )
}
