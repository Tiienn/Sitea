import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useFBX } from '@react-three/drei'
import * as THREE from 'three'
import {
  WALK_SPEED,
  PLAYER_HEIGHT
} from '../../constants/landSceneConstants'

const MODEL_SCALE = 1.9 / 178.82
const FADE_DURATION = 0.25

export function AnimatedPlayerMesh({ visible, position, rotation, velocity = 0, moveType = 'idle' }) {
  const groupRef = useRef()
  const mixerRef = useRef(null)
  const actionsRef = useRef({})
  const currentActionRef = useRef('idle')
  const hipsRef = useRef(null)
  const hipsBindPos = useRef(new THREE.Vector3())

  // Load character model
  const fbx = useFBX('/character.fbx')

  // Load all animations from locomotion pack
  const idleFbx = useFBX('/idle.fbx')
  const walkFbx = useFBX('/walk.fbx')
  const runFbx = useFBX('/run.fbx')
  const jumpFbx = useFBX('/jump.fbx')
  const walkbackFbx = useFBX('/walkback.fbx')
  const strafeFbx = useFBX('/strafe.fbx')
  const straferightFbx = useFBX('/straferight.fbx')
  const straferunleftFbx = useFBX('/straferunleft.fbx')
  const straferunrightFbx = useFBX('/straferunright.fbx')
  const turnleftFbx = useFBX('/turnleft.fbx')
  const turnrightFbx = useFBX('/turnright.fbx')
  const turnleft90Fbx = useFBX('/turnleft90.fbx')
  const turnright90Fbx = useFBX('/turnright90.fbx')

  useMemo(() => {
    fbx.traverse((child) => {
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
  }, [fbx])

  // Set up AnimationMixer and all actions
  useEffect(() => {
    const mixer = new THREE.AnimationMixer(fbx)
    mixerRef.current = mixer

    const clips = {
      idle: idleFbx.animations[0],
      walk: walkFbx.animations[0],
      run: runFbx.animations[0],
      jump: jumpFbx.animations[0],
      walkback: walkbackFbx.animations[0],
      strafe: strafeFbx.animations[0],
      straferight: straferightFbx.animations[0],
      straferunleft: straferunleftFbx.animations[0],
      straferunright: straferunrightFbx.animations[0],
      turnleft: turnleftFbx.animations[0],
      turnright: turnrightFbx.animations[0],
      turnleft90: turnleft90Fbx.animations[0],
      turnright90: turnright90Fbx.animations[0]
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
  }, [fbx, idleFbx, walkFbx, runFbx, jumpFbx, walkbackFbx, strafeFbx, straferightFbx, straferunleftFbx, straferunrightFbx, turnleftFbx, turnrightFbx, turnleft90Fbx, turnright90Fbx])

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
      scale={MODEL_SCALE}
    >
      <primitive object={fbx} />
    </group>
  )
}
