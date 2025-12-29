import { useRef } from 'react'
import { useFrame } from '@react-three/fiber'
import { NPC_COLORS, IDLE_BOB_AMPLITUDE, IDLE_BOB_SPEED } from '../../constants/landSceneConstants'

// NPC Character component with idle animation
// TODO: Future - click to interact / access features
export function NPCCharacter({ id, position, rotation = 0 }) {
  const bodyRef = useRef()
  const headRef = useRef()
  const timeRef = useRef(Math.random() * 10) // Random phase offset

  const colors = NPC_COLORS[id] || NPC_COLORS.guide1

  // Idle breathing animation
  useFrame((_, delta) => {
    timeRef.current += delta
    const t = timeRef.current

    // Subtle breathing bob
    const breathingBob = Math.sin(t * IDLE_BOB_SPEED * Math.PI * 2) * IDLE_BOB_AMPLITUDE

    if (bodyRef.current) {
      bodyRef.current.position.y = 0.75 + breathingBob
    }
    if (headRef.current) {
      headRef.current.position.y = 1.5 + breathingBob
    }
  })

  return (
    <group position={[position.x, 0, position.z]} rotation={[0, rotation, 0]}>
      {/* Body */}
      <mesh ref={bodyRef} position={[0, 0.75, 0]} castShadow>
        <capsuleGeometry args={[0.25, 0.7, 4, 8]} />
        <meshStandardMaterial color={colors.body} />
      </mesh>

      {/* Head */}
      <mesh ref={headRef} position={[0, 1.5, 0]} castShadow>
        <sphereGeometry args={[0.2, 16, 16]} />
        <meshStandardMaterial color="#ffcc99" />
      </mesh>

      {/* Left Leg */}
      <mesh position={[-0.12, 0.1, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.6, 4, 8]} />
        <meshStandardMaterial color={colors.pants} />
      </mesh>
      {/* Right Leg */}
      <mesh position={[0.12, 0.1, 0]} castShadow>
        <capsuleGeometry args={[0.1, 0.6, 4, 8]} />
        <meshStandardMaterial color={colors.pants} />
      </mesh>
      {/* Left Arm */}
      <mesh position={[-0.35, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
        <meshStandardMaterial color={colors.body} />
      </mesh>
      {/* Right Arm */}
      <mesh position={[0.35, 1.0, 0]} castShadow>
        <capsuleGeometry args={[0.07, 0.5, 4, 8]} />
        <meshStandardMaterial color={colors.body} />
      </mesh>
    </group>
  )
}
