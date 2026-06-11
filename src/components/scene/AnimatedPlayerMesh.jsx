import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  WALK_SPEED,
  PLAYER_HEIGHT
} from '../../constants/landSceneConstants'

const TARGET_HEIGHT = 1.8 // desired character height in meters
const FADE_DURATION = 0.25

// Neutral mannequin avatar (three.js examples Xbot) — self-hosted, with its
// own embedded idle/walk/run clips so no cross-rig retargeting is needed.
// Reads as a clean human-scale figure like the people in archviz renders.
const CHARACTER_URL = '/models/xbot.glb'

export function AnimatedPlayerMesh({ visible, position, rotation, velocity = 0, moveType = 'idle' }) {
  const groupRef = useRef()
  const mixerRef = useRef(null)
  const actionsRef = useRef({})
  const currentActionRef = useRef('idle')
  const hipsRef = useRef(null)
  const hipsBindPos = useRef(new THREE.Vector3())

  // Load character model (embedded animations included)
  const { scene: characterScene, animations } = useGLTF(CHARACTER_URL)

  // Auto-detect model height, restyle materials, and find the hips bone
  const modelScale = useMemo(() => {
    characterScene.traverse((child) => {
      if (child.isMesh) {
        child.castShadow = true
        child.receiveShadow = false
        // The GLB ships with salmon-red materials; restyle as a clean
        // mannequin: light surface, graphite joints
        if (child.material) {
          child.material = child.material.clone()
          if (/joint/i.test(child.material.name)) {
            child.material.color.set('#3a4046')
            child.material.metalness = 0.3
          } else {
            child.material.color.set('#e9ecef')
            child.material.metalness = 0.05
          }
        }
      }
      // Find the root Hips bone and save its bind position
      if (child.isBone && child.name.toLowerCase().includes('hips')) {
        if (!hipsRef.current) {
          hipsRef.current = child
          hipsBindPos.current.copy(child.position)
        }
      }
    })
    const box = new THREE.Box3().setFromObject(characterScene)
    const height = box.max.y - box.min.y
    return height > 0 ? TARGET_HEIGHT / height : 1
  }, [characterScene])

  // Set up AnimationMixer using the model's own clips. Movement states the
  // pack doesn't cover map onto the nearest clip (walkback plays walk in
  // reverse via negative timeScale).
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(characterScene)
    mixerRef.current = mixer

    const byName = {}
    for (const clip of animations) byName[clip.name] = clip
    const idle = byName.idle
    const walk = byName.walk
    const run = byName.run
    const walkback = walk ? walk.clone() : null
    if (walkback) walkback.name = 'walkback'

    const clips = {
      idle,
      walk,
      run,
      jump: idle,
      walkback,
      strafe: walk,
      straferight: walk,
      straferunleft: run,
      straferunright: run,
      turnleft: idle,
      turnright: idle,
      turnleft90: idle,
      turnright90: idle
    }

    const actions = {}
    const seen = new Set()
    for (const [name, clip] of Object.entries(clips)) {
      if (!clip) continue
      // clipAction returns the same action for the same clip — reuse it so
      // shared clips (e.g. strafe → walk) don't fight over weights
      const action = mixer.clipAction(clip)
      if (!seen.has(action)) {
        seen.add(action)
        action.play()
        action.setEffectiveWeight(clip.name === 'idle' ? 1 : 0)
        if (clip.name === 'walkback') action.timeScale = -1
      }
      actions[name] = action
    }

    actionsRef.current = actions
    currentActionRef.current = 'idle'

    return () => {
      mixer.stopAllAction()
      mixerRef.current = null
    }
  }, [characterScene, animations])

  useFrame((_, delta) => {
    if (!visible) return
    if (!mixerRef.current) return

    // Update animation mixer
    mixerRef.current.update(delta)

    // Lock Hips bone X/Z to prevent root motion from animations
    if (hipsRef.current) {
      hipsRef.current.position.x = hipsBindPos.current.x
      hipsRef.current.position.z = hipsBindPos.current.z
    }

    // Map moveType to animation name
    const desired = actionsRef.current[moveType] ? moveType : 'idle'

    if (desired !== currentActionRef.current) {
      const from = actionsRef.current[currentActionRef.current]
      const to = actionsRef.current[desired]

      if (from && to && from !== to) {
        to.reset()
        to.setEffectiveWeight(1)
        to.setEffectiveTimeScale(to.getClip().name === 'walkback' ? -1 : 1)
        from.crossFadeTo(to, FADE_DURATION, true)
      }

      currentActionRef.current = desired
    }

    // Adjust walk/run speed to match actual movement
    const walkAction = actionsRef.current.walk
    if (walkAction && moveType === 'walk') {
      walkAction.timeScale = Math.max(0.5, velocity / WALK_SPEED)
    }
    const runAction = actionsRef.current.run
    if (runAction && moveType === 'run') {
      runAction.timeScale = Math.max(0.7, velocity / (WALK_SPEED * 2))
    }
  })

  if (!visible) return null

  return (
    <group
      ref={groupRef}
      position={[position.x, position.y - PLAYER_HEIGHT, position.z]}
      rotation={[0, rotation + Math.PI, 0]}
      scale={modelScale}
    >
      <primitive object={characterScene} />
    </group>
  )
}
