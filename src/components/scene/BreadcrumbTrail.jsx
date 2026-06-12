import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MAX_POINTS = 500
const LIFETIME = 25 // seconds until a print is gone
const FADE_START = 20 // full size until here, then shrinks away
const TOE_OUT = 0.12 // ~7° — toes point slightly outward per foot

// Shoe-sole print: front pad + heel pad, toe toward -Z at rotation 0
// (the player's forward direction at yaw 0), ~0.26 m long
function makeFootprintGeometry() {
  const pad = new THREE.Shape()
  pad.absellipse(0, 0.045, 0.045, 0.085, 0, Math.PI * 2)
  const heel = new THREE.Shape()
  heel.absellipse(0, -0.085, 0.035, 0.045, 0, Math.PI * 2)
  const geo = new THREE.ShapeGeometry([pad, heel], 10)
  geo.rotateX(-Math.PI / 2)
  return geo
}

// Trail of footprints where the player has walked. CameraController stamps
// a point per footstep (position, yaw, foot side, time); each print holds
// for FADE_START seconds, dissolves by LIFETIME, then is pruned.
export function BreadcrumbTrail({ walkTrackerRef }) {
  const lastCount = useRef(0)
  const dummy = useMemo(() => new THREE.Object3D(), [])

  const mesh = useMemo(() => {
    const mat = new THREE.MeshBasicMaterial({
      color: '#46412f', // pressed-earth brown
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
    })
    const m = new THREE.InstancedMesh(makeFootprintGeometry(), mat, MAX_POINTS)
    m.count = 0
    m.frustumCulled = false
    m.renderOrder = 2
    return m
  }, [])

  useFrame((state) => {
    const tracker = walkTrackerRef?.current
    if (!tracker) return
    const now = state.clock.elapsedTime
    const pts = tracker.points

    // Prune expired prints (oldest first)
    let expired = 0
    while (expired < pts.length && now - (pts[expired].t ?? now) > LIFETIME) expired++
    if (expired > 0) pts.splice(0, expired)

    const n = Math.min(pts.length, MAX_POINTS)
    if (n === 0 && lastCount.current === 0) return
    lastCount.current = n

    const start = pts.length - n
    for (let i = 0; i < n; i++) {
      const p = pts[start + i]
      const age = now - (p.t ?? now)
      const scale = age > FADE_START
        ? Math.max(0.001, 1 - (age - FADE_START) / (LIFETIME - FADE_START))
        : 1
      dummy.position.set(p.x, p.y + 0.03, p.z)
      dummy.rotation.set(0, (p.yaw ?? 0) - (p.side ?? 1) * TOE_OUT, 0)
      dummy.scale.setScalar(scale)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}
