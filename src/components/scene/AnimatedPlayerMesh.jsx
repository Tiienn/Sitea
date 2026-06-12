import { useRef, useEffect, useMemo } from 'react'
import { useFrame } from '@react-three/fiber'
import { useGLTF } from '@react-three/drei'
import * as THREE from 'three'
import {
  WALK_SPEED,
  PLAYER_HEIGHT
} from '../../constants/landSceneConstants'
import { ASSET_BASE, AVATARS, useAvatar } from '../../constants/avatars'

const TARGET_HEIGHT = 1.9 // desired character height in meters
const FADE_DURATION = 0.25

// Clip names in embedded packs look like "Armature|Walk" — find by suffix
function findClip(animations, name) {
  return animations.find((c) => c.name === name || c.name.endsWith(`|${name}`))
}

// Shared mixer/crossfade driver for both avatar kinds. `clips` maps every
// moveType the CameraController emits to an AnimationClip (or undefined).
function useAvatarAnimation({ characterScene, clips, visible, velocity, moveType, oneShotNames }) {
  const mixerRef = useRef(null)
  const actionsRef = useRef({})
  const currentActionRef = useRef('idle')
  const hipsRef = useRef(null)
  const hipsBindPos = useRef(new THREE.Vector3())

  // Auto-detect model height, enable shadows, and find the hips bone.
  // Rendered as authored — no mesh hiding or material edits.
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

  useEffect(() => {
    const mixer = new THREE.AnimationMixer(characterScene)
    mixerRef.current = mixer

    const actions = {}
    const seen = new Set()
    for (const [name, clip] of Object.entries(clips)) {
      if (!clip) continue
      // clipAction returns the same action for the same clip — reuse it so
      // shared clips (e.g. strafe fallback → walk) don't fight over weights
      const action = mixer.clipAction(clip)
      if (!seen.has(action)) {
        seen.add(action)
        if (oneShotNames?.includes(name)) {
          action.setLoop(THREE.LoopOnce)
          action.clampWhenFinished = true
        }
        action.play()
        action.setEffectiveWeight(name === 'idle' ? 1 : 0)
      }
      actions[name] = action
    }

    actionsRef.current = actions
    currentActionRef.current = 'idle'

    return () => {
      mixer.stopAllAction()
      mixerRef.current = null
    }
  }, [characterScene, clips, oneShotNames])

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

  return modelScale
}

function AvatarGroup({ visible, position, rotation, modelScale, characterScene }) {
  if (!visible) return null
  return (
    <group
      position={[position.x, position.y - PLAYER_HEIGHT, position.z]}
      rotation={[0, rotation + Math.PI, 0]}
      scale={modelScale}
    >
      <primitive object={characterScene} />
    </group>
  )
}

// Mixamo-style avatar: model GLB plus the 13-clip locomotion pack hosted
// alongside it on Supabase (idle/walk/run/jump/walkback/strafes/turns,
// all exported on the same rig so no retargeting is needed).
const PACK_ONE_SHOTS = ['jump', 'turnleft90', 'turnright90']
const PACK_CLIP_NAMES = ['idle', 'walk', 'run', 'jump', 'walkback', 'strafe', 'straferight', 'straferunleft', 'straferunright', 'turnleft', 'turnright', 'turnleft90', 'turnright90']

// Warm the cache in parallel — the 13 sequential hook suspensions below
// would otherwise waterfall on first load
PACK_CLIP_NAMES.forEach((n) => useGLTF.preload(`${ASSET_BASE}/${n}.glb`))
AVATARS.filter((a) => a.clipSource === 'pack').forEach((a) => useGLTF.preload(a.modelUrl))

function PackAvatar({ avatar, visible, position, rotation, velocity, moveType }) {
  const { scene: characterScene } = useGLTF(avatar.modelUrl)

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

  const clips = useMemo(() => ({
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
  }), [idleAnims, walkAnims, runAnims, jumpAnims, walkbackAnims, strafeAnims, straferightAnims, straferunleftAnims, straferunrightAnims, turnleftAnims, turnrightAnims, turnleft90Anims, turnright90Anims])

  const modelScale = useAvatarAnimation({ characterScene, clips, visible, velocity, moveType, oneShotNames: PACK_ONE_SHOTS })

  return <AvatarGroup visible={visible} position={position} rotation={rotation} modelScale={modelScale} characterScene={characterScene} />
}

// Avatar whose clips ship inside the model GLB. Movement states the pack
// doesn't cover map onto the nearest clip.
function EmbeddedAvatar({ avatar, visible, position, rotation, velocity, moveType }) {
  const { scene: characterScene, animations } = useGLTF(avatar.modelUrl)

  const { clips, oneShotNames } = useMemo(() => {
    const idle = findClip(animations, 'Idle_Neutral') || findClip(animations, 'Idle')
    const walk = findClip(animations, 'Walk')
    const run = findClip(animations, 'Run')
    const jump = findClip(animations, 'Jump')
    const walkback = findClip(animations, 'Walk_Back') || findClip(animations, 'Run_Back') || walk
    const left = findClip(animations, 'Run_Left') || walk
    const right = findClip(animations, 'Run_Right') || walk

    return {
      clips: {
        idle,
        walk,
        run,
        jump: jump || idle,
        walkback,
        strafe: left,
        straferight: right,
        straferunleft: left,
        straferunright: right,
        turnleft: idle,
        turnright: idle,
        turnleft90: idle,
        turnright90: idle
      },
      // A real jump clip plays once and clamps; the idle fallback must keep looping
      oneShotNames: jump ? ['jump'] : undefined
    }
  }, [animations])

  const modelScale = useAvatarAnimation({ characterScene, clips, visible, velocity, moveType, oneShotNames })

  return <AvatarGroup visible={visible} position={position} rotation={rotation} modelScale={modelScale} characterScene={characterScene} />
}

export function AnimatedPlayerMesh(props) {
  const avatar = useAvatar()

  if (avatar.clipSource === 'pack') {
    return <PackAvatar key={avatar.id} avatar={avatar} {...props} />
  }
  return <EmbeddedAvatar key={avatar.id} avatar={avatar} {...props} />
}
