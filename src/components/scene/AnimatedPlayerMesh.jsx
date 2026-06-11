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

// Stylized casual human (Quaternius "Casual Character", CC0) — self-hosted,
// with its own embedded animation set so no cross-rig retargeting is needed.
// Matches Sitea's low-poly art style and reads as a relatable person.
const CHARACTER_URL = '/models/character-casual.glb'

// Clip names look like "CharacterArmature|Walk" — find by suffix
function findClip(animations, name) {
  return animations.find((c) => c.name === name || c.name.endsWith(`|${name}`))
}

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

    const idle = findClip(animations, 'Idle_Neutral') || findClip(animations, 'Idle')
    const walk = findClip(animations, 'Walk')
    const run = findClip(animations, 'Run')
    const runBack = findClip(animations, 'Run_Back') || walk
    const runLeft = findClip(animations, 'Run_Left') || walk
    const runRight = findClip(animations, 'Run_Right') || walk

    const clips = {
      idle,
      walk,
      run,
      jump: idle,
      walkback: runBack,
      strafe: runLeft,
      straferight: runRight,
      straferunleft: runLeft,
      straferunright: runRight,
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
        action.setEffectiveWeight(clip === idle ? 1 : 0)
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
        to.setEffectiveTimeScale(1)
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
