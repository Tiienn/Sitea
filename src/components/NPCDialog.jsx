import { useState, useEffect } from 'react'

// NPC personalities and dialog content
const NPC_DATA = {
  guide1: {
    name: 'Alex',
    role: 'Land Advisor',
    avatar: '#3b82f6', // blue
    greeting: "Hey there! I'm Alex, your land advisor.",
    dialogs: [
      {
        question: "How do I measure my land?",
        answer: "Great question! You can use the Rectangle tool for simple plots, or the Draw tool to trace a custom shape. For uploaded plans, use the Scale tool to set accurate measurements."
      },
      {
        question: "What are comparison objects?",
        answer: "Comparison objects help you visualize scale! Try placing a house, car, or sports field on your land to get a real sense of how big it is. You'll find them in the Compare panel."
      },
      {
        question: "How do I walk around my land?",
        answer: "Use WASD keys to move and your mouse to look around. Press Space to jump! You can also scroll to switch between first-person and third-person views."
      },
      {
        question: "Can I add buildings?",
        answer: "Absolutely! Check out the Build panel to add walls, rooms, pools, and more. You can design your dream home right on your land!"
      }
    ]
  },
  guide2: {
    name: 'Sam',
    role: 'Design Expert',
    avatar: '#8b5cf6', // purple
    greeting: "Hi! I'm Sam, here to help with your design.",
    dialogs: [
      {
        question: "How do I add walls?",
        answer: "In the Build panel, select the Wall tool and click to place wall points. Hold Shift for straight lines. Double-click or click the first point to complete a room!"
      },
      {
        question: "Can I add a pool?",
        answer: "Yes! Use the Pool tool in the Build panel. Draw the pool shape, then customize its depth and style in the properties panel."
      },
      {
        question: "How do I export my design?",
        answer: "Click the Export button in the top menu to save your design as an image. Pro users get high-resolution exports!"
      },
      {
        question: "What's the best view for designing?",
        answer: "I recommend 2D view for precise placement and measurements, then switch to 3D or first-person to see how it feels in real life!"
      }
    ]
  }
}

export default function NPCDialog({ npcId, onClose, area, lengthUnit }) {
  const [selectedQuestion, setSelectedQuestion] = useState(null)
  const [isTyping, setIsTyping] = useState(false)
  const [displayedAnswer, setDisplayedAnswer] = useState('')

  const npc = NPC_DATA[npcId]
  if (!npc) return null

  // Typing effect for answers
  useEffect(() => {
    if (selectedQuestion !== null) {
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
  }, [selectedQuestion, npc.dialogs])

  const handleBack = () => {
    setSelectedQuestion(null)
    setDisplayedAnswer('')
  }

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-[var(--color-bg-primary)] rounded-2xl shadow-2xl border border-[var(--color-border)] max-w-md w-full overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-[var(--color-bg-secondary)] to-[var(--color-bg-elevated)] p-4 flex items-center gap-4">
          <div
            className="w-14 h-14 rounded-full flex items-center justify-center text-white text-xl font-bold"
            style={{ backgroundColor: npc.avatar }}
          >
            {npc.name[0]}
          </div>
          <div className="flex-1">
            <h3 className="text-white font-semibold text-lg">{npc.name}</h3>
            <p className="text-[var(--color-text-muted)] text-sm">{npc.role}</p>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-white/10 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="p-4">
          {selectedQuestion === null ? (
            <>
              {/* Greeting */}
              <div className="bg-[var(--color-bg-secondary)] rounded-xl p-3 mb-4">
                <p className="text-[var(--color-text-secondary)]">{npc.greeting}</p>
                {area && (
                  <p className="text-[var(--color-text-muted)] text-sm mt-2">
                    Your land is looking great! About {Math.round(area)} {lengthUnit === 'ft' ? 'ft²' : 'm²'} of possibilities!
                  </p>
                )}
              </div>

              {/* Questions */}
              <p className="text-[var(--color-text-muted)] text-xs mb-2">What would you like to know?</p>
              <div className="space-y-2">
                {npc.dialogs.map((dialog, idx) => (
                  <button
                    key={idx}
                    onClick={() => setSelectedQuestion(idx)}
                    className="w-full text-left p-3 bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-elevated)] rounded-xl transition-colors group"
                  >
                    <span className="text-white group-hover:text-[var(--color-accent)] transition-colors">
                      {dialog.question}
                    </span>
                  </button>
                ))}
              </div>
            </>
          ) : (
            <>
              {/* Selected question */}
              <div className="bg-[var(--color-accent)]/20 rounded-xl p-3 mb-3">
                <p className="text-[var(--color-accent)] font-medium">
                  {npc.dialogs[selectedQuestion].question}
                </p>
              </div>

              {/* Answer */}
              <div className="bg-[var(--color-bg-secondary)] rounded-xl p-3 min-h-[100px]">
                <p className="text-[var(--color-text-secondary)]">
                  {displayedAnswer}
                  {isTyping && <span className="animate-pulse">|</span>}
                </p>
              </div>

              {/* Back button */}
              <button
                onClick={handleBack}
                className="mt-4 w-full py-2 bg-[var(--color-bg-elevated)] hover:bg-white/10 rounded-xl text-[var(--color-text-secondary)] transition-colors flex items-center justify-center gap-2"
              >
                <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                </svg>
                Ask another question
              </button>
            </>
          )}
        </div>

        {/* Footer */}
        <div className="px-4 pb-4">
          <button
            onClick={onClose}
            className="w-full py-3 bg-[var(--color-accent)] hover:opacity-90 rounded-xl text-[var(--color-bg-primary)] font-medium transition-opacity"
          >
            Thanks, bye!
          </button>
        </div>
      </div>
    </div>
  )
}
