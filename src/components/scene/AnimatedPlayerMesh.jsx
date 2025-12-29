import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import {
  WALK_SPEED,
  RUN_SPEED,
  IDLE_BOB_AMPLITUDE,
  IDLE_BOB_SPEED,
  WALK_LEG_SWING,
  WALK_ARM_SWING,
  WALK_BOB_AMPLITUDE,
  WALK_CYCLE_SPEED,
  RUN_LEG_SWING,
  RUN_ARM_SWING,
  RUN_BOB_AMPLITUDE,
  RUN_CYCLE_SPEED,
  RUN_LEAN
} from '../../constants/landSceneConstants'

// Animated player mesh for third-person view
export function AnimatedPlayerMesh({ visible, position, rotation, velocity = 0 }) {
  const groupRef = useRef()
  const bodyRef = useRef()
  const headRef = useRef()
  const leftLegRef = useRef()
  const rightLegRef = useRef()
  const leftArmRef = useRef()
  const rightArmRef = useRef()

  // Animation time accumulator
  const timeRef = useRef(0)

  useFrame((_, delta) => {
    if (!visible) return

    timeRef.current += delta
    const t = timeRef.current

    // Normalize velocity (0 = idle, 1 = walk, 2 = run)
    const walkSpeed = WALK_SPEED
    const runSpeed = RUN_SPEED
    const normalizedVel = Math.min(velocity / walkSpeed, runSpeed / walkSpeed)
    const isRunning = velocity > walkSpeed * 1.2

    // Interpolate animation parameters based on velocity
    const legSwing = isRunning ? RUN_LEG_SWING : WALK_LEG_SWING
    const armSwing = isRunning ? RUN_ARM_SWING : WALK_ARM_SWING
    const bobAmplitude = isRunning ? RUN_BOB_AMPLITUDE : WALK_BOB_AMPLITUDE
    const cycleSpeed = isRunning ? RUN_CYCLE_SPEED : WALK_CYCLE_SPEED
    const forwardLean = isRunning ? RUN_LEAN : 0

    // Movement blend (0 = idle, 1 = full movement)
    const moveBlend = Math.min(1, velocity / (walkSpeed * 0.5))

    // Idle breathing animation (always present, fades when moving)
    const idleBlend = 1 - moveBlend
    const breathingBob = Math.sin(t * IDLE_BOB_SPEED * Math.PI * 2) * IDLE_BOB_AMPLITUDE * idleBlend

    // Walking/running cycle
    const cyclePhase = t * cycleSpeed * normalizedVel
    const walkBob = Math.abs(Math.sin(cyclePhase)) * bobAmplitude * moveBlend

    // Apply body bob (breathing + walk bob)
    if (bodyRef.current) {
      bodyRef.current.position.y = 0.75 + breathingBob + walkBob
      // Forward lean when running
      bodyRef.current.rotation.x = forwardLean * moveBlend
    }

    // Head follows body
    if (headRef.current) {
      headRef.current.position.y = 1.5 + breathingBob + walkBob
    }

    // Leg swing animation
    const legAngle = Math.sin(cyclePhase) * legSwing * moveBlend
    if (leftLegRef.current) {
      leftLegRef.current.rotation.x = legAngle
      leftLegRef.current.position.y = 0.1 + walkBob * 0.3
    }
    if (rightLegRef.current) {
      rightLegRef.current.rotation.x = -legAngle
      rightLegRef.current.position.y = 0.1 + walkBob * 0.3
    }

    // Arm swing animation (opposite to legs)
    const armAngle = Math.sin(cyclePhase) * armSwing * moveBlend
    if (leftArmRef.current) {
      leftArmRef.current.rotation.x = -armAngle
    }
    if (rightArmRef.current) {
      rightArmRef.current.rotation.x = armAngle
    }
  })

  if (!visible) return null

  return (
    <group ref={groupRef} position={[position.x, 0, position.z]} rotation={[0, rotation, 0]}>
      {/* Body */}
      <mesh ref={bodyRef} position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.25, 0.7, 4, 8]} />
        <meshStandardMaterial color="#3366cc" />
      </mesh>
      {/* Head */}
      <mesh ref={headRef} position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#ffcc99" />
      </mesh>
      {/* Left Leg */}
      <mesh ref={leftLegRef} position={[-0.12, 0.1, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.6, 4, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Right Leg */}
      <mesh ref={rightLegRef} position={[0.12, 0.1, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.6, 4, 8]} />
        <meshStandardMaterial color="#333333" />
      </mesh>
      {/* Left Arm */}
      <mesh ref={leftArmRef} position={[-0.35, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
        <meshStandardMaterial color="#3366cc" />
      </mesh>
      {/* Right Arm */}
      <mesh ref={rightArmRef} position={[0.35, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
        <meshStandardMaterial color="#3366cc" />
      </mesh>
    </group>
  )
}
