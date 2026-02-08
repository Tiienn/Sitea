import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  WALK_SPEED,
  PLAYER_HEIGHT
} from '../../constants/landSceneConstants'

const TARGET_HEIGHT = 1.9 // desired character height in meters
const FADE_DURATION = 0.25

// GLB models hosted on Supabase Storage
const ASSET_BASE = 'https://utudexexqnmaoohmnsmk.supabase.co/storage/v1/object/public/assets/models'

export function AnimatedPlayerMesh({ visible, position, rotation, velocity = 0, moveType = 'idle' }) {
  const groupRef = useRef()
  const mixerRef = useRef(null)
  const actionsRef = useRef({})
  const currentActionRef = useRef('idle')
  const hipsRef = useRef(null)
  const hipsBindPos = useRef(new THREE.Vector3())

  // Load character model (GLB from Supabase)
  const { scene: characterScene } = useGLTF(`${ASSET_BASE}/character.glb`)

  // Load all animations from locomotion pack
  const { animations: idleAnims } = useGLTF(`${ASSET_BASE}/idle.glb`)
  const { animations: walkAnims } = useGLTF(`${ASSET_BASE}/walk.glb`)
  const { animations: runAnims } = useGLTF(`${ASSET_BASE}/run.glb`)
  const { animations: jumpAnims } = useGLTF(`${ASSET_BASE}/jump.glb`)
  const { animations: walkbackAnims } = useGLTF(`${ASSET_BASE}/walkback.glb`)
  const { animations: strafeAnims } = useGLTF(`${ASSET_BASE}/strafe.glb`)
  const { animations: straferightAnims } = useGLTF(`${ASSET_BASE}/straferight.glb`)
  const { animations: straferunleftAnims } = useGLTF(`${ASSET_BASE}/straferunleft.glb`)
  const { animations: straferunrightAnims } = useGLTF(`${ASSET_BASE}/straferunright.glb`)
  const { animations: turnleftAnims } = useGLTF(`${ASSET_BASE}/turnleft.glb`)
  const { animations: turnrightAnims } = useGLTF(`${ASSET_BASE}/turnright.glb`)
  const { animations: turnleft90Anims } = useGLTF(`${ASSET_BASE}/turnleft90.glb`)
  const { animations: turnright90Anims } = useGLTF(`${ASSET_BASE}/turnright90.glb`)

  // Auto-detect model height and compute correct scale
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
    console.log('[PlayerMesh] Model height:', height, '-> scale:', height > 0 ? TARGET_HEIGHT / height : 1)
    return height > 0 ? TARGET_HEIGHT / height : 1
  }, [characterScene])

  // Set up AnimationMixer and all actions
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(characterScene)
    mixerRef.current = mixer

    const clips = {
      idle: idleAnims[0],
      walk: walkAnims[0],
      run: runAnims[0],
      jump: jumpAnims[0],
      walkback: walkbackAnims[0],
      strafe: strafeAnims[0],
      straferight: straferightAnims[0],
      straferunleft: straferunleftAnims[0],
      straferunright: straferunrightAnims[0],
      turnleft: turnleftAnims[0],
      turnright: turnrightAnims[0],
      turnleft90: turnleft90Anims[0],
      turnright90: turnright90Anims[0]
    }

    const actions = {}
    for (const [name, clip] of Object.entries(clips)) {
      if (clip) {
        const action = mixer.clipAction(clip)
        if (name === 'jump' || name === 'turnleft90' || name === 'turnright90') {
          action.setLoop(THREE.LoopOnce)
          action.clampWhenFinished = true
        }
        action.play()
        action.setEffectiveWeight(name === 'idle' ? 1 : 0)
        actions[name] = action
      }
    }

    actionsRef.current = actions
    currentActionRef.current = 'idle'

    return () => {
      mixer.stopAllAction()
      mixerRef.current = null
    }
  }, [characterScene, idleAnims, walkAnims, runAnims, jumpAnims, walkbackAnims, strafeAnims, straferightAnims, straferunleftAnims, straferunrightAnims, turnleftAnims, turnrightAnims, turnleft90Anims, turnright90Anims])

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

      if (from && to) {
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
