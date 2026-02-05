import { useEffect } from 'react'

export default function StairsPropertiesPanel({
  stairs,
  onClose,
  onUpdateStairs
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!stairs) return null

  const width = stairs.width || 1.0
  const topY = stairs.topY || 2.7
  const material = stairs.material || 'wood'
  const railings = stairs.railings !== false
  const style = stairs.style || 'straight'

  // Style labels
  const styleLabels = {
    'straight': 'Straight',
    'wide': 'Wide Straight',
    'l-left': 'L-Shape (Left)',
    'l-right': 'L-Shape (Right)'
  }

  // Material options with preview gradients (consistent with Foundation)
  const materials = [
    { id: 'wood', name: 'Wood', preview: 'repeating-linear-gradient(90deg, #8B4513 0px, #7a3d10 4px, #9c4f15 8px)' },
    { id: 'concrete', name: 'Concrete', preview: 'linear-gradient(135deg, #A9A9A9 0%, #909090 100%)' },
    { id: 'metal', name: 'Metal', preview: 'linear-gradient(135deg, #6a6a6a 0%, #4a4a4a 50%, #5a5a5a 100%)' },
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
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 7v10l4-4v-2l-4-4zm4 4l4-4v10l-4-4v-2zm8-4v10l4-4v-2l-4-4z" />
              </svg>
            </div>
            <div>
              <h2 className="text-lg font-semibold text-white">Stairs Properties</h2>
              <p className="text-xs text-[var(--color-text-muted)]">{styleLabels[style] || style}</p>
            </div>
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
          {/* Width Slider */}
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-2">
              Width: {width.toFixed(1)}m
            </label>
            <input
              type="range"
              min="0.6"
              max="2.5"
              step="0.1"
              value={width}
              onChange={(e) => onUpdateStairs?.(stairs.id, { width: parseFloat(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              <span>0.6m</span>
              <span>2.5m</span>
            </div>
          </div>

          {/* Height Slider */}
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-2">
              Top Height: {topY.toFixed(1)}m
            </label>
            <input
              type="range"
              min="0.5"
              max="5"
              step="0.1"
              value={topY}
              onChange={(e) => onUpdateStairs?.(stairs.id, { topY: parseFloat(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-amber-500"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              <span>0.5m</span>
              <span>5m</span>
            </div>
          </div>

          {/* Material */}
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-2">Material</label>
            <div className="grid grid-cols-2 gap-2">
              {materials.map((mat) => (
                <button
                  key={mat.id}
                  onClick={() => onUpdateStairs?.(stairs.id, { material: mat.id })}
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

          {/* Railings Toggle */}
          <div className="flex items-center justify-between p-3 rounded-lg bg-white/5">
            <div>
              <label className="text-sm text-white">Railings</label>
              <p className="text-xs text-[var(--color-text-muted)]">Show handrails and posts</p>
            </div>
            <button
              onClick={() => onUpdateStairs?.(stairs.id, { railings: !railings })}
              className={`relative w-12 h-6 rounded-full transition-colors ${
                railings ? 'bg-[var(--color-accent)]' : 'bg-white/20'
              }`}
            >
              <div
                className={`absolute top-1 w-4 h-4 rounded-full bg-white transition-transform ${
                  railings ? 'left-7' : 'left-1'
                }`}
              />
            </button>
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
