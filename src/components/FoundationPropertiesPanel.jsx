import { useEffect } from 'react'

export default function FoundationPropertiesPanel({
  foundation,
  onClose,
  onUpdateFoundation
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'Enter') { e.preventDefault(); onClose?.() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!foundation) return null

  const material = foundation.material || 'concrete'
  const height = foundation.height || 0.3

  // Foundation material options with preview colors
  const materials = [
    { id: 'concrete', name: 'Concrete', preview: 'linear-gradient(135deg, #A9A9A9 0%, #909090 100%)' },
    { id: 'wood', name: 'Wood', preview: 'repeating-linear-gradient(90deg, #8B7355 0px, #7a6348 8px, #9c845f 16px)' },
    { id: 'brick', name: 'Brick', preview: 'repeating-linear-gradient(0deg, #8B4513 0px, #8B4513 6px, #654321 6px, #654321 8px)' },
    { id: 'stone', name: 'Stone', preview: 'linear-gradient(135deg, #708090 0%, #5a6a7a 50%, #8090a0 100%)' },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10" style={{ padding: '20px 28px' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-amber-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Platform Properties</h2>
          </div>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Content */}
        <div className="space-y-5" style={{ padding: '20px 28px' }}>
          {/* Height Slider */}
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-2">
              Height: {height.toFixed(2)}m
            </label>
            <input
              type="range"
              min="0.1"
              max="2"
              step="0.1"
              value={height}
              onChange={(e) => onUpdateFoundation?.(foundation.id, { height: parseFloat(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              <span>0.1m</span>
              <span>2m</span>
            </div>
          </div>

          {/* Material */}
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-2">Material</label>
            <div className="grid grid-cols-2 gap-2">
              {materials.map((mat) => (
                <button
                  key={mat.id}
                  onClick={() => onUpdateFoundation?.(foundation.id, { material: mat.id })}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                    material === mat.id
                      ? 'border-[var(--color-accent)] bg-white/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded"
                    style={{ background: mat.preview }}
                  />
                  <span className="text-sm text-white">{mat.name}</span>
                </button>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="border-t border-white/10" style={{ padding: '20px 28px' }}>
          <button
            onClick={onClose}
            className="w-full py-2 bg-[var(--color-accent)] text-[var(--color-bg-primary)] font-medium rounded-lg hover:opacity-90 transition-opacity"
          >
            Done
          </button>
        </div>
      </div>
    </div>
  )
}
