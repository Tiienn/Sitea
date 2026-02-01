import { useRef, useState, useEffect } from 'react'
import { useFrame } from '@react-three/fiber'
import { Html } from '@react-three/drei'
import { NPC_COLORS, IDLE_BOB_AMPLITUDE, IDLE_BOB_SPEED } from '../../constants/landSceneConstants'

// NPC dialog data
const NPC_DATA = {
  guide1: {
    name: 'Alex',
    role: 'Land Advisor',
    color: '#3b82f6',
    greeting: "Hey there! I'm Alex, your land advisor.",
    dialogs: [
      { question: "How do I measure my land?", answer: "Use the Rectangle tool for simple plots, or the Draw tool to trace a custom shape. For uploaded plans, use the Scale tool to set accurate measurements." },
      { question: "What are comparison objects?", answer: "Comparison objects help you visualize scale! Try placing a house, car, or sports field on your land to get a real sense of how big it is." },
      { question: "How do I walk around?", answer: "Use WASD keys to move and your mouse to look around. Press Space to jump! Scroll to switch between first-person and third-person views." },
      { question: "Can I add buildings?", answer: "Check out the Build panel to add walls, rooms, pools, and more. You can design your dream home right on your land!" }
    ]
  },
  guide2: {
    name: 'Sam',
    role: 'Design Expert',
    color: '#8b5cf6',
    greeting: "Hi! I'm Sam, here to help with your design.",
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

  // Idle breathing animation + wave when hovered
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
