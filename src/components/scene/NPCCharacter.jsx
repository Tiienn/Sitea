import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { NPC_COLORS, IDLE_BOB_AMPLITUDE, IDLE_BOB_SPEED } from '../../constants/landSceneConstants'

// NPC dialog data
const NPC_DATA = {
  guide1: {
    name: 'Alex',
    role: 'Architect',
    color: '#3b82f6',
    greeting: "Hey! I'm Alex, your architect. Let's design something great.",
    dialogs: [
      { question: "How do I measure my land?", answer: "Use the Rectangle tool for simple plots, or the Draw tool to trace a custom shape. For uploaded plans, use the Scale tool to set accurate measurements." },
      { question: "What are comparison objects?", answer: "Comparison objects help you visualize scale! Try placing a house, car, or sports field on your land to get a real sense of how big it is." },
      { question: "How do I walk around?", answer: "Use WASD keys to move and your mouse to look around. Press Space to jump! Scroll to switch between first-person and third-person views." },
      { question: "Can I add buildings?", answer: "Check out the Build panel to add walls, rooms, pools, and more. You can design your dream home right on your land!" }
    ]
  },
  guide2: {
    name: 'Sam',
    role: 'Design Architect',
    color: '#8b5cf6',
    greeting: "Hi! I'm Sam. Ready to bring your space to life?",
    dialogs: [
      { question: "How do I add walls?", answer: "In the Build panel, select the Wall tool and click to place wall points. Hold Shift for straight lines. Double-click or click the first point to complete a room!" },
      { question: "Can I add a pool?", answer: "Yes! Use the Pool tool in the Build panel. Draw the pool shape, then customize its depth and style in the properties panel." },
      { question: "How do I export my design?", answer: "Click the Export button in the top menu to save your design as an image." },
      { question: "Best view for designing?", answer: "I recommend 2D view for precise placement and measurements, then switch to 3D or first-person to see how it feels in real life!" }
    ]
  }
}

// NPC Character component with idle animation and chat bubble
export function NPCCharacter({ id, position, rotation = 0, onClick, isActive, isNearby, onClose }) {
  const bodyRef = useRef()
  const headRef = useRef()
  const groupRef = useRef()
  const timeRef = useRef(Math.random() * 10) // Random phase offset
  const [hovered, setHovered] = useState(false)
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [displayedAnswer, setDisplayedAnswer] = useState('')
  const [isTyping, setIsTyping] = useState(false)

  const colors = NPC_COLORS[id] || NPC_COLORS.guide1
  const npc = NPC_DATA[id] || NPC_DATA.guide1

  // Reset state when dialog closes
  useEffect(() => {
    if (!isActive) {
      setSelectedQuestion(null)
      setDisplayedAnswer('')
      setIsTyping(false)
    }
  }, [isActive])

  // Typing effect for answers
  useEffect(() => {
    if (selectedQuestion !== null && isActive) {
      setIsTyping(true)
      setDisplayedAnswer('')
      const answer = npc.dialogs[selectedQuestion].answer
      let i = 0
      const interval = setInterval(() => {
        if (i < answer.length) {
          setDisplayedAnswer(prev => prev + answer[i])
          i++
        } else {
          setIsTyping(false)
          clearInterval(interval)
        }
      }, 20)
      return () => clearInterval(interval)
    }
  }, [selectedQuestion, isActive, npc.dialogs])

  const antennaRef = useRef()

  // Idle hover animation
  useFrame((_, delta) => {
    timeRef.current += delta
    const t = timeRef.current

    // Gentle floating bob
    const floatBob = Math.sin(t * IDLE_BOB_SPEED * Math.PI * 2) * 0.03

    if (bodyRef.current) {
      bodyRef.current.position.y = floatBob
    }
    if (headRef.current) {
      headRef.current.position.y = 1.05 + floatBob
    }
    // Antenna wobble
    if (antennaRef.current) {
      antennaRef.current.rotation.z = Math.sin(t * 3) * 0.1
    }
  })

  const handleClick = (e) => {
    e.stopPropagation()
    onClick?.(id)
  }

  return (
    <group
      ref={groupRef}
      position={[position.x, 0, position.z]}
      rotation={[0, rotation, 0]}
      onClick={handleClick}
      onPointerOver={(e) => { e.stopPropagation(); setHovered(true); document.body.style.cursor = 'pointer' }}
      onPointerOut={() => { setHovered(false); document.body.style.cursor = 'auto' }}
    >
      {/* Interaction indicator - floating icon above head (only when not chatting) */}
      {!isActive && (hovered || isNearby) && (
        <mesh position={[0, 2.2, 0]}>
          <sphereGeometry args={[0.15, 16, 16]} />
          <meshStandardMaterial color="#4ade80" emissive="#4ade80" emissiveIntensity={0.5} />
        </mesh>
      )}

      {/* Press E to talk prompt */}
      {isNearby && !isActive && (
        <Html position={[0, 2.5, 0]} center>
          <div style={{
            background: 'rgba(0,0,0,0.8)',
            color: 'white',
            padding: '6px 12px',
            borderRadius: '6px',
            fontSize: '14px',
            fontWeight: '500',
            whiteSpace: 'nowrap',
            border: '1px solid rgba(74, 222, 128, 0.5)'
          }}>
            Press <span style={{ color: '#4ade80', fontWeight: 'bold' }}>E</span> to talk
          </div>
        </Html>
      )}

      {/* Chat bubble */}
      {isActive && (
        <Html position={[0, 2.8, 0]} center style={{ pointerEvents: 'auto' }}>
          <div style={{
            background: 'rgba(15, 15, 20, 0.95)',
            backdropFilter: 'blur(12px)',
            borderRadius: '16px',
            padding: '16px',
            minWidth: '280px',
            maxWidth: '320px',
            boxShadow: '0 8px 32px rgba(0,0,0,0.4), 0 0 0 1px rgba(255,255,255,0.1)',
            fontFamily: 'system-ui, -apple-system, sans-serif'
          }}>
            {/* Header with name and close button */}
            <div style={{
              display: 'flex',
              alignItems: 'center',
              gap: '10px',
              marginBottom: '12px',
              paddingBottom: '12px',
              borderBottom: '1px solid rgba(255,255,255,0.1)'
            }}>
              <div style={{
                width: '36px',
                height: '36px',
                borderRadius: '50%',
                background: npc.color,
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: 'white',
                fontWeight: '600',
                fontSize: '14px'
              }}>
                {npc.name[0]}
              </div>
              <div style={{ flex: 1 }}>
                <div style={{ color: 'white', fontWeight: '600', fontSize: '14px' }}>{npc.name}</div>
                <div style={{ color: 'rgba(255,255,255,0.5)', fontSize: '12px' }}>{npc.role}</div>
              </div>
              <button
                onClick={(e) => { e.stopPropagation(); onClose?.() }}
                style={{
                  background: 'rgba(255,255,255,0.1)',
                  border: 'none',
                  borderRadius: '8px',
                  width: '28px',
                  height: '28px',
                  cursor: 'pointer',
                  color: 'rgba(255,255,255,0.6)',
                  fontSize: '16px',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center'
                }}
              >
                ×
              </button>
            </div>

            {selectedQuestion === null ? (
              <>
                {/* Greeting */}
                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '13px',
                  lineHeight: '1.4'
                }}>
                  {npc.greeting}
                </div>

                {/* Questions */}
                <div style={{ display: 'flex', flexDirection: 'column', gap: '6px' }}>
                  {npc.dialogs.map((dialog, idx) => (
                    <button
                      key={idx}
                      onClick={(e) => { e.stopPropagation(); setSelectedQuestion(idx) }}
                      style={{
                        background: 'rgba(255,255,255,0.05)',
                        border: '1px solid rgba(255,255,255,0.1)',
                        borderRadius: '8px',
                        padding: '10px 12px',
                        textAlign: 'left',
                        cursor: 'pointer',
                        color: 'rgba(255,255,255,0.9)',
                        fontSize: '12px',
                        transition: 'all 0.15s ease'
                      }}
                      onMouseOver={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.1)'
                        e.currentTarget.style.borderColor = npc.color
                      }}
                      onMouseOut={(e) => {
                        e.currentTarget.style.background = 'rgba(255,255,255,0.05)'
                        e.currentTarget.style.borderColor = 'rgba(255,255,255,0.1)'
                      }}
                    >
                      {dialog.question}
                    </button>
                  ))}
                </div>
              </>
            ) : (
              <>
                {/* Selected question */}
                <div style={{
                  background: `${npc.color}22`,
                  border: `1px solid ${npc.color}44`,
                  borderRadius: '10px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  color: npc.color,
                  fontSize: '12px',
                  fontWeight: '500'
                }}>
                  {npc.dialogs[selectedQuestion].question}
                </div>

                {/* Answer */}
                <div style={{
                  background: 'rgba(255,255,255,0.05)',
                  borderRadius: '10px',
                  padding: '10px 12px',
                  marginBottom: '12px',
                  color: 'rgba(255,255,255,0.8)',
                  fontSize: '13px',
                  lineHeight: '1.5',
                  minHeight: '60px'
                }}>
                  {displayedAnswer}
                  {isTyping && <span style={{ opacity: 0.5 }}>|</span>}
                </div>

                {/* Back button */}
                <button
                  onClick={(e) => { e.stopPropagation(); setSelectedQuestion(null); setDisplayedAnswer('') }}
                  style={{
                    width: '100%',
                    background: 'rgba(255,255,255,0.05)',
                    border: '1px solid rgba(255,255,255,0.1)',
                    borderRadius: '8px',
                    padding: '8px 12px',
                    cursor: 'pointer',
                    color: 'rgba(255,255,255,0.7)',
                    fontSize: '12px',
                    display: 'flex',
                    alignItems: 'center',
                    justifyContent: 'center',
                    gap: '6px'
                  }}
                >
                  ← Ask another question
                </button>
              </>
            )}

            {/* Speech bubble pointer */}
            <div style={{
              position: 'absolute',
              bottom: '-8px',
              left: '50%',
              transform: 'translateX(-50%)',
              width: '0',
              height: '0',
              borderLeft: '10px solid transparent',
              borderRight: '10px solid transparent',
              borderTop: '10px solid rgba(15, 15, 20, 0.95)'
            }} />
          </div>
        </Html>
      )}
      {/* === Architect Body (animated by floating bob) === */}
      <group ref={bodyRef} position={[0, 0, 0]}>
        {/* Jeans / legs */}
        <mesh position={[-0.12, 0.2, 0]} castShadow>
          <boxGeometry args={[0.15, 0.42, 0.15]} />
          <meshStandardMaterial color={colors.pants} roughness={0.9} />
        </mesh>
        <mesh position={[0.12, 0.2, 0]} castShadow>
          <boxGeometry args={[0.15, 0.42, 0.15]} />
          <meshStandardMaterial color={colors.pants} roughness={0.9} />
        </mesh>

        {/* Work boots */}
        <mesh position={[-0.12, -0.03, 0.05]} castShadow>
          <boxGeometry args={[0.17, 0.08, 0.26]} />
          <meshStandardMaterial color={colors.boots} roughness={0.8} />
        </mesh>
        <mesh position={[0.12, -0.03, 0.05]} castShadow>
          <boxGeometry args={[0.17, 0.08, 0.26]} />
          <meshStandardMaterial color={colors.boots} roughness={0.8} />
        </mesh>
        {/* Boot sole */}
        <mesh position={[-0.12, -0.075, 0.05]}>
          <boxGeometry args={[0.18, 0.02, 0.27]} />
          <meshStandardMaterial color=#1a1a1a roughness={1} />
        </mesh>
        <mesh position={[0.12, -0.075, 0.05]}>
          <boxGeometry args={[0.18, 0.02, 0.27]} />
          <meshStandardMaterial color=#1a1a1a roughness={1} />
        </mesh>

        {/* Shirt — light blue work shirt */}
        <mesh position={[0, 0.58, 0]} castShadow>
          <boxGeometry args={[0.46, 0.48, 0.28]} />
          <meshStandardMaterial color={colors.shirt} roughness={0.85} />
        </mesh>
        {/* Shirt pocket */}
        <mesh position={[-0.14, 0.66, 0.143]}>
          <boxGeometry args={[0.1, 0.1, 0.01]} />
          <meshStandardMaterial color={colors.shirtDark} roughness={0.85} />
        </mesh>
        {/* Pen in pocket */}
        <mesh position={[-0.14, 0.73, 0.15]}>
          <cylinderGeometry args={[0.01, 0.01, 0.12, 5]} />
          <meshStandardMaterial color=#FFD700 metalness={0.4} roughness={0.3} />
        </mesh>

        {/* Left arm — straight down */}
        <mesh position={[-0.33, 0.55, 0]} castShadow>
          <boxGeometry args={[0.13, 0.42, 0.15]} />
          <meshStandardMaterial color={colors.shirt} roughness={0.85} />
        </mesh>
        {/* Left hand */}
        <mesh position={[-0.33, 0.3, 0]} castShadow>
          <boxGeometry args={[0.11, 0.14, 0.1]} />
          <meshStandardMaterial color={colors.skin} roughness={0.7} />
        </mesh>

        {/* Right arm — raised slightly, holding blueprint roll */}
        <mesh position={[0.33, 0.6, 0]} rotation={[0, 0, -0.3]} castShadow>
          <boxGeometry args={[0.13, 0.42, 0.15]} />
          <meshStandardMaterial color={colors.shirt} roughness={0.85} />
        </mesh>
        {/* Right hand */}
        <mesh position={[0.42, 0.38, 0]} castShadow>
          <boxGeometry args={[0.11, 0.14, 0.1]} />
          <meshStandardMaterial color={colors.skin} roughness={0.7} />
        </mesh>

        {/* Blueprint roll under right arm */}
        <mesh position={[0.38, 0.52, 0]} rotation={[Math.PI / 2, 0, 0.2]}>
          <cylinderGeometry args={[0.05, 0.05, 0.32, 10]} />
          <meshStandardMaterial color=#f5f0dc roughness={0.9} />
        </mesh>
        {/* Blueprint end caps */}
        <mesh position={[0.38, 0.52, 0.17]} rotation={[Math.PI / 2, 0, 0.2]}>
          <cylinderGeometry args={[0.055, 0.055, 0.02, 10]} />
          <meshStandardMaterial color=#c8b870 roughness={0.6} />
        </mesh>
        <mesh position={[0.38, 0.52, -0.17]} rotation={[Math.PI / 2, 0, 0.2]}>
          <cylinderGeometry args={[0.055, 0.055, 0.02, 10]} />
          <meshStandardMaterial color=#c8b870 roughness={0.6} />
        </mesh>
        {/* Blueprint rubber band */}
        <mesh position={[0.38, 0.52, 0]} rotation={[Math.PI / 2, 0, 0.2]}>
          <cylinderGeometry args={[0.056, 0.056, 0.06, 10, 1, true]} />
          <meshStandardMaterial color=#c0392b roughness={0.6} />
        </mesh>
      </group>

      {/* === Architect Head (animated by floating bob) === */}
      <group ref={headRef} position={[0, 1.05, 0]}>
        {/* Neck */}
        <mesh position={[0, -0.22, 0]}>
          <cylinderGeometry args={[0.09, 0.1, 0.18, 8]} />
          <meshStandardMaterial color={colors.skin} roughness={0.7} />
        </mesh>

        {/* Head — sphere */}
        <mesh castShadow>
          <sphereGeometry args={[0.22, 14, 12]} />
          <meshStandardMaterial color={colors.skin} roughness={0.7} />
        </mesh>

        {/* Eyes — left */}
        <mesh position={[-0.08, 0.03, 0.2]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color=#2c2c2c roughness={0.5} />
        </mesh>
        {/* Eyes — right */}
        <mesh position={[0.08, 0.03, 0.2]}>
          <sphereGeometry args={[0.03, 8, 8]} />
          <meshStandardMaterial color=#2c2c2c roughness={0.5} />
        </mesh>

        {/* Eyebrows */}
        <mesh position={[-0.08, 0.09, 0.19]} rotation={[0, 0, 0.15]}>
          <boxGeometry args={[0.07, 0.015, 0.01]} />
          <meshStandardMaterial color={colors.hair} roughness={0.8} />
        </mesh>
        <mesh position={[0.08, 0.09, 0.19]} rotation={[0, 0, -0.15]}>
          <boxGeometry args={[0.07, 0.015, 0.01]} />
          <meshStandardMaterial color={colors.hair} roughness={0.8} />
        </mesh>

        {/* Nose — small bump */}
        <mesh position={[0, -0.01, 0.215]}>
          <sphereGeometry args={[0.025, 6, 6]} />
          <meshStandardMaterial color={colors.skinDark} roughness={0.7} />
        </mesh>

        {/* Smile — slight arc, two segments */}
        <mesh position={[-0.04, -0.08, 0.2]} rotation={[0, 0, 0.4]}>
          <boxGeometry args={[0.05, 0.015, 0.01]} />
          <meshStandardMaterial color={colors.skinDark} roughness={0.8} />
        </mesh>
        <mesh position={[0.04, -0.08, 0.2]} rotation={[0, 0, -0.4]}>
          <boxGeometry args={[0.05, 0.015, 0.01]} />
          <meshStandardMaterial color={colors.skinDark} roughness={0.8} />
        </mesh>

        {/* Hair — simple cap over top of head */}
        <mesh position={[0, 0.1, -0.02]}>
          <sphereGeometry args={[0.225, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.52]} />
          <meshStandardMaterial color={colors.hair} roughness={0.85} />
        </mesh>

        {/* Hard hat brim — flat disc, wobbles via antennaRef */}
        <group ref={antennaRef} position={[0, 0.2, 0]} rotation={[0.08, 0, 0]}>
          <mesh>
            <cylinderGeometry args={[0.3, 0.28, 0.04, 16]} />
            <meshStandardMaterial color={colors.hardHat} roughness={0.5} metalness={0.1} />
          </mesh>
          {/* Hard hat dome */}
          <mesh position={[0, 0.08, 0]}>
            <sphereGeometry args={[0.22, 14, 8, 0, Math.PI * 2, 0, Math.PI * 0.55]} />
            <meshStandardMaterial color={colors.hardHat} roughness={0.5} metalness={0.1} />
          </mesh>
          {/* Hard hat brim band */}
          <mesh>
            <cylinderGeometry args={[0.23, 0.23, 0.03, 16, 1, true]} />
            <meshStandardMaterial color={colors.hardHatBand} roughness={0.6} />
          </mesh>
        </group>
      </group>
    </group>
  )
}
