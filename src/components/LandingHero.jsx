import { useState } from 'react'

const PRESETS = [
  { label: '449 m²', sizeM2: 449 },
  { label: '1,000 m²', sizeM2: 1000 },
  { label: '5,000 m²', sizeM2: 5000 },
  { label: '1 acre', sizeM2: 4047 },
]

export default function LandingHero({ onExplore }) {
  const [unit, setUnit] = useState('sqm')
  const [inputValue, setInputValue] = useState('449')

  const getSizeM2 = () => {
    const val = parseFloat(inputValue) || 449
    return unit === 'sqft' ? val * 0.092903 : val
  }

  const handleExplore = () => {
    onExplore({ sizeM2: getSizeM2() })
  }

  const handlePreset = (preset) => {
    const displayVal = unit === 'sqft'
      ? Math.round(preset.sizeM2 / 0.092903).toString()
      : preset.sizeM2.toString()
    setInputValue(displayVal)
    onExplore({ sizeM2: preset.sizeM2 })
  }

  const handleKeyDown = (e) => {
    if (e.key === 'Enter') handleExplore()
  }

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center"
      style={{ background: 'rgba(0,0,0,0.75)', backdropFilter: 'blur(6px)' }}>
      <div className="panel-premium w-full max-w-md mx-4 p-8 flex flex-col gap-5 animate-fade-in-scale">

        {/* Eyebrow */}
        <p className="text-center text-xs font-medium tracking-widest uppercase"
          style={{ color: 'var(--color-accent)' }}>
          Free · No signup · No download
        </p>

        {/* Headline */}
        <div className="text-center space-y-2">
          <h1 className="font-display font-bold text-3xl leading-tight"
            style={{ color: 'var(--color-text-primary)' }}>
            Can't picture how big<br />your land is?
          </h1>
          <p className="text-sm" style={{ color: 'var(--color-text-secondary)' }}>
            Type any size and walk through it at real scale — in seconds.
          </p>
        </div>

        {/* Input + unit toggle */}
        <div className="flex gap-2">
          <input
            type="number"
            value={inputValue}
            onChange={e => setInputValue(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="449"
            min="1"
            className="flex-1 rounded-xl px-4 py-3 text-xl font-bold text-center outline-none border transition-all"
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1.5px solid var(--color-border)',
              color: 'var(--color-text-primary)',
            }}
            autoFocus
          />
          <button
            onClick={() => setUnit(u => u === 'sqm' ? 'sqft' : 'sqm')}
            className="px-4 py-3 rounded-xl font-semibold text-sm transition-all border"
            style={{
              background: 'var(--color-bg-secondary)',
              border: '1.5px solid var(--color-border)',
              color: 'var(--color-text-secondary)',
            }}
          >
            {unit === 'sqm' ? 'm²' : 'ft²'}
          </button>
        </div>

        {/* CTA */}
        <button
          onClick={handleExplore}
          className="btn-primary w-full py-4 text-base font-bold flex items-center justify-center gap-2"
        >
          Explore in 3D
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2.5}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M13.5 4.5L21 12m0 0l-7.5 7.5M21 12H3" />
          </svg>
        </button>

        {/* Presets */}
        <div className="flex flex-wrap gap-2 justify-center">
          {PRESETS.map(preset => (
            <button
              key={preset.label}
              onClick={() => handlePreset(preset)}
              className="px-3 py-1.5 rounded-lg text-sm font-medium transition-all border"
              style={{
                background: 'var(--color-bg-secondary)',
                border: '1px solid var(--color-border)',
                color: 'var(--color-text-secondary)',
              }}
            >
              {preset.label}
            </button>
          ))}
        </div>

        {/* Footer */}
        <p className="text-center text-xs" style={{ color: 'var(--color-text-muted)' }}>
          Used by people visualizing land before they build
        </p>
      </div>
    </div>
  )
}
