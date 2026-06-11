import { useMemo, useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import * as THREE from 'three'

const MAX_POINTS = 500

// Fading dotted trail of where the player has walked. CameraController
// appends ground-level points to walkTrackerRef; this renders the last
// MAX_POINTS as soft teal dots on the ground.
export function BreadcrumbTrail({ walkTrackerRef }) {
  const lastVersion = useRef(-1)

  const mesh = useMemo(() => {
    const geo = new THREE.CircleGeometry(0.05, 10)
    geo.rotateX(-Math.PI / 2)
    const mat = new THREE.MeshBasicMaterial({
      color: '#2dd4bf',
      transparent: true,
      opacity: 0.25,
      depthWrite: false,
    })
    const m = new THREE.InstancedMesh(geo, mat, MAX_POINTS)
    m.count = 0
    m.frustumCulled = false
    m.renderOrder = 2
    return m
  }, [])

  useFrame(() => {
    const tracker = walkTrackerRef?.current
    if (!tracker || tracker.version === lastVersion.current) return
    lastVersion.current = tracker.version
    const pts = tracker.points
    const dummy = new THREE.Object3D()
    const n = Math.min(pts.length, MAX_POINTS)
    const start = pts.length - n
    for (let i = 0; i < n; i++) {
      const p = pts[start + i]
      dummy.position.set(p.x, p.y + 0.03, p.z)
      dummy.updateMatrix()
      mesh.setMatrixAt(i, dummy.matrix)
    }
    mesh.count = n
    mesh.instanceMatrix.needsUpdate = true
  })

  return <primitive object={mesh} />
}
