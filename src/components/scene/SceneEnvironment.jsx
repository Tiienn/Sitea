import { useMemo } from 'react'
import * as THREE from 'three'
import { QUALITY, QUALITY_SETTINGS } from '../../constants/landSceneConstants'
import { useGrassTextures, useSimpleGrassTexture } from '../../hooks/useGrassTextures'

// Original gradient sky with procedural clouds
export function RealisticSky() {
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
