import { useEffect, useState } from 'react'

export default function GuidedOnboarding({ step, onStart, onComplete, onSkip, isMobile }) {
  // Step 3 auto-advance after 4 seconds
  const [step3Timer, setStep3Timer] = useState(false)
  useEffect(() => {
    if (step === 3) {
      const t = setTimeout(() => setStep3Timer(true), 4000)
      return () => clearTimeout(t)
    }
    setStep3Timer(false)
  }, [step])

  useEffect(() => {
    if (step3Timer) onComplete('auto')
  }, [step3Timer, onComplete])

  // Step 1: Welcome overlay
  if (step === 1) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center" style={{ background: 'rgba(2, 6, 18, 0.85)', backdropFilter: 'blur(8px)' }}>
        <div className="panel-premium p-8 max-w-md w-[90%] text-center animate-fade-in-scale">
          {/* Icon */}
          <div className="mx-auto w-14 h-14 rounded-2xl bg-[var(--color-accent)]/15 flex items-center justify-center mb-5" style={{ boxShadow: '0 0 24px rgba(20,184,166,0.15)' }}>
            <svg className="w-7 h-7 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
            </svg>
          </div>

          <h1 className="font-display font-bold text-2xl text-white mb-2" style={{ fontFamily: 'var(--font-display)' }}>
            Walk Through Your Future Home
          </h1>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed mb-8">
            Let's create your future home in under 5 minutes.
          </p>

          <button
            onClick={onStart}
            className="btn-primary w-full text-base py-3 mb-4"
            style={{ boxShadow: '0 0 20px var(--color-accent-glow)' }}
          >
            Start Walkthrough
          </button>

          <button
            onClick={onSkip}
            className="text-[var(--color-text-muted)] text-xs hover:text-[var(--color-text-secondary)] transition-colors cursor-pointer bg-transparent border-none"
          >
            Skip, I know what I'm doing
          </button>
        </div>
      </div>
    )
  }

  // Step 2: Walk prompt — transparent, just a floating hint at bottom
  if (step === 2) {
    return (
      <div className="fixed bottom-24 left-1/2 -translate-x-1/2 z-[60] pointer-events-none animate-fade-in">
        <div className="panel-premium py-4 px-8 text-center" style={{ boxShadow: '0 0 30px rgba(0,0,0,0.5), 0 0 15px var(--color-accent-glow)' }}>
          {/* Bouncing arrow */}
          <div className="mb-2 flex justify-center">
            <svg
              className="w-6 h-6 text-[var(--color-accent)]"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={2}
              style={{ animation: 'bounceUp 1.5s ease-in-out infinite' }}
            >
              <path strokeLinecap="round" strokeLinejoin="round" d="M4.5 10.5L12 3m0 0l7.5 7.5M12 3v18" />
            </svg>
          </div>
          <p className="font-display font-semibold text-white text-lg" style={{ fontFamily: 'var(--font-display)' }}>
            Walk inside the house
          </p>
          <p className="text-[var(--color-text-secondary)] text-xs mt-1">
            {isMobile ? 'Use the joystick to move forward' : 'Press W to walk forward'}
          </p>
        </div>

        <style>{`
          @keyframes bounceUp {
            0%, 100% { transform: translateY(0); }
            50% { transform: translateY(-6px); }
          }
        `}</style>
      </div>
    )
  }

  // Step 3: Inside moment — center card
  if (step === 3) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
        <div className="panel-premium py-5 px-8 max-w-sm text-center animate-fade-in-scale" style={{ boxShadow: '0 0 30px rgba(0,0,0,0.5), 0 0 15px var(--color-accent-glow)' }}>
          <div className="mx-auto w-10 h-10 rounded-xl bg-[var(--color-accent)]/15 flex items-center justify-center mb-3">
            <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          </div>
          <p className="font-display font-semibold text-white text-base mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            You're inside!
          </p>
          <p className="text-[var(--color-text-secondary)] text-sm leading-relaxed">
            See these walls? You can move, resize, or delete any of them.
          </p>
        </div>
      </div>
    )
  }

  // Step 4: Unlock — action buttons
  if (step === 4) {
    return (
      <div className="fixed inset-0 z-[60] flex items-center justify-center pointer-events-none">
        <div className="panel-premium p-6 max-w-sm w-[90%] text-center pointer-events-auto animate-slide-in-bottom" style={{ boxShadow: '0 0 30px rgba(0,0,0,0.5), 0 0 15px var(--color-accent-glow)' }}>
          <p className="font-display font-semibold text-white text-base mb-1" style={{ fontFamily: 'var(--font-display)' }}>
            What would you like to do?
          </p>
          <p className="text-[var(--color-text-secondary)] text-xs mb-5">
            This house is yours to customize
          </p>

          <div className="flex flex-col gap-2.5">
            <button
              onClick={() => onComplete('edit')}
              className="btn-primary w-full py-3 text-sm font-semibold flex items-center justify-center gap-2"
              style={{ boxShadow: '0 0 16px var(--color-accent-glow)' }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L10.582 16.07a4.5 4.5 0 01-1.897 1.13L6 18l.8-2.685a4.5 4.5 0 011.13-1.897l8.932-8.931z" />
              </svg>
              Make it yours
            </button>

            <button
              onClick={() => onComplete('upload')}
              className="w-full py-3 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              style={{
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
              </svg>
              Upload your floor plan
            </button>

            <button
              onClick={() => onComplete('land')}
              className="w-full py-3 text-sm font-semibold rounded-xl transition-all flex items-center justify-center gap-2"
              style={{
                background: 'var(--color-bg-secondary)',
                color: 'var(--color-text-primary)',
                border: '1px solid var(--color-border)',
              }}
            >
              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
              </svg>
              Change land size
            </button>
          </div>
        </div>
      </div>
    )
  }

  return null
}
