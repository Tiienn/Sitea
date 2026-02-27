import { useState, useRef, useEffect } from 'react'

const UNITS = ['sqm', 'sqft', 'acres']
const UNIT_LABELS = { sqm: 'm²', sqft: 'ft²', acres: 'acres' }

const toM2 = (val, unit) => {
  if (unit === 'sqft') return val * 0.092903
  if (unit === 'acres') return val * 4046.86
  return val
}

const fromM2 = (m2, unit) => {
  if (unit === 'sqft') return m2 / 0.092903
  if (unit === 'acres') return m2 / 4046.86
  return m2
}

const formatVal = (num, unit) => {
  if (unit === 'acres') return parseFloat(num.toFixed(2)).toString()
  return Math.round(num).toString()
}

export default function LandingHero({ onExplore }) {
  const [unit, setUnit] = useState('sqm')
  const [inputValue, setInputValue] = useState('800')
  const inputRef = useRef(null)

  useEffect(() => {
    // Autofocus with slight delay for animation
    const t = setTimeout(() => inputRef.current?.focus(), 400)
    return () => clearTimeout(t)
  }, [])

  const getSizeM2 = () => {
    const val = parseFloat(inputValue) || 800
    return toM2(val, unit)
  }

  const handleExplore = () => {
    onExplore({ sizeM2: getSizeM2(), unit })
  }

  const cycleUnit = () => {
    setUnit(prev => {
      const nextIdx = (UNITS.indexOf(prev) + 1) % UNITS.length
      const next = UNITS[nextIdx]
      const currentM2 = toM2(parseFloat(inputValue) || 800, prev)
      setInputValue(formatVal(fromM2(currentM2, next), next))
      return next
    })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleExplore()
  }

  return (
    <div
      className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: '#FAFAF8' }}
    >
      {/* Subtle grain texture */}
      <div className="absolute inset-0 opacity-[0.03] pointer-events-none"
        style={{
          backgroundImage: `url("data:image/svg+xml,%3Csvg viewBox='0 0 256 256' xmlns='http://www.w3.org/2000/svg'%3E%3Cfilter id='noise'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.9' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='100%25' height='100%25' filter='url(%23noise)'/%3E%3C/svg%3E")`,
        }}
      />

      <div className="w-full max-w-lg mx-auto px-6 flex flex-col items-center"
        style={{ animation: 'heroFadeIn 0.7s cubic-bezier(0.16, 1, 0.3, 1) both' }}>

        {/* Headline */}
        <h1
          className="font-display font-bold text-center leading-[1.15] tracking-tight text-slate-800"
          style={{ fontSize: 'clamp(1.75rem, 6vw, 2.5rem)', marginBottom: '16px' }}
        >
          You can't picture 800m².
          <br />
          <span className="text-slate-400">Neither could we.</span>
        </h1>

        {/* Subheadline */}
        <p className="text-center text-slate-500 text-base leading-relaxed" style={{ marginBottom: '40px', maxWidth: '360px' }}>
          Type in the size. See it at human scale.<br className="hidden sm:block" /> No signup needed.
        </p>

        {/* Input row */}
        <div className="w-full flex gap-3" style={{ marginBottom: '20px', maxWidth: '340px' }}>
          <div className="flex-1 relative">
            <input
              ref={inputRef}
              type="number"
              value={inputValue}
              onChange={e => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="800"
              min="1"
              step="any"
              className="w-full rounded-xl text-2xl font-bold text-center text-slate-800 outline-none transition-all"
              style={{
                background: '#fff',
                border: '2px solid #e2e8f0',
                padding: '14px 16px',
              }}
              onFocus={e => e.target.style.borderColor = '#14b8a6'}
              onBlur={e => e.target.style.borderColor = '#e2e8f0'}
            />
          </div>
          <button
            onClick={cycleUnit}
            className="rounded-xl font-bold text-lg transition-all shrink-0 select-none"
            style={{
              background: '#fff',
              border: '2px solid #e2e8f0',
              color: '#64748b',
              padding: '14px 20px',
              minWidth: '76px',
            }}
          >
            {UNIT_LABELS[unit]}
          </button>
        </div>

        {/* CTA */}
        <button
          onClick={handleExplore}
          className="w-full rounded-xl text-base font-bold text-white flex items-center justify-center gap-2 transition-all active:scale-[0.98]"
          style={{
            background: '#14b8a6',
            padding: '16px 24px',
            maxWidth: '340px',
            marginBottom: '32px',
          }}
          onMouseEnter={e => e.currentTarget.style.background = '#2dd4bf'}
          onMouseLeave={e => e.currentTarget.style.background = '#14b8a6'}
        >
          Show me
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>

        {/* Muted footer */}
        <p className="text-center text-slate-400 text-sm leading-relaxed" style={{ maxWidth: '320px' }}>
          Used by people buying land, planning builds, and finally picturing the numbers.
        </p>
      </div>

      <style>{`
        @keyframes heroFadeIn {
          from {
            opacity: 0;
            transform: translateY(16px);
          }
          to {
            opacity: 1;
            transform: translateY(0);
          }
        }
        /* Hide number input spinners */
        input[type=number]::-webkit-inner-spin-button,
        input[type=number]::-webkit-outer-spin-button {
          -webkit-appearance: none;
          margin: 0;
        }
        input[type=number] {
          -moz-appearance: textfield;
        }
      `}</style>
    </div>
  )
}
