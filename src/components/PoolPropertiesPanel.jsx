import { useEffect } from 'react'

export default function PoolPropertiesPanel({
  pool,
  onClose,
  onUpdatePool
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

  if (!pool) return null

  const deckMaterial = pool.deckMaterial || 'concrete'
  const waterColor = pool.waterColor || '#00CED1'

  // Deck material options with preview colors
  const deckMaterials = [
    { id: 'concrete', name: 'Concrete', color: '#A9A9A9', preview: 'linear-gradient(135deg, #A9A9A9 0%, #909090 100%)' },
    { id: 'stone', name: 'Stone', color: '#708090', preview: 'linear-gradient(135deg, #708090 0%, #5a6a7a 50%, #8090a0 100%)' },
    { id: 'wood', name: 'Wood', color: '#8B7355', preview: 'repeating-linear-gradient(90deg, #8B7355 0px, #7a6348 8px, #9c845f 16px)' },
    { id: 'tile', name: 'Tile', color: '#CD853F', preview: 'repeating-linear-gradient(0deg, #CD853F 0px, #CD853F 12px, #808080 12px, #808080 14px)' },
  ]

  // Water color presets
  const waterColors = [
    { id: 'turquoise', name: 'Turquoise', color: '#00CED1' },
    { id: 'azure', name: 'Azure', color: '#007FFF' },
    { id: 'aqua', name: 'Aqua', color: '#00FFFF' },
    { id: 'teal', name: 'Teal', color: '#008080' },
    { id: 'lagoon', name: 'Lagoon', color: '#40E0D0' },
    { id: 'deep', name: 'Deep Blue', color: '#0047AB' },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10" style={{ padding: '20px 28px' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-cyan-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-cyan-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M3 15a4 4 0 004 4h10a4 4 0 004-4M3 15v-3a2 2 0 012-2h14a2 2 0 012 2v3M3 15l3-3m15 3l-3-3M7 8c.5-1 1.5-2 3-2s2.5 1 3 2c.5-1 1.5-2 3-2s2.5 1 3 2" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Pool Properties</h2>
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
          {/* Deck Material */}
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-2">Deck Material</label>
            <div className="grid grid-cols-2 gap-2">
              {deckMaterials.map((material) => (
                <button
                  key={material.id}
                  onClick={() => onUpdatePool?.(pool.id, { deckMaterial: material.id })}
                  className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                    deckMaterial === material.id
                      ? 'border-[var(--color-accent)] bg-white/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div
                    className="w-8 h-8 rounded"
                    style={{ background: material.preview }}
                  />
                  <span className="text-sm text-white">{material.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Water Color */}
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-2">Water Color</label>
            <div className="grid grid-cols-3 gap-2">
              {waterColors.map((color) => (
                <button
                  key={color.id}
                  onClick={() => onUpdatePool?.(pool.id, { waterColor: color.color })}
                  className={`flex flex-col items-center gap-1.5 p-2 rounded-lg border-2 transition-all ${
                    waterColor === color.color
                      ? 'border-[var(--color-accent)] bg-white/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <div
                    className="w-10 h-10 rounded-full shadow-inner"
                    style={{
                      background: `radial-gradient(circle at 30% 30%, ${color.color}aa, ${color.color})`,
                      boxShadow: `inset 0 2px 4px rgba(255,255,255,0.3), 0 2px 8px ${color.color}40`
                    }}
                  />
                  <span className="text-[10px] text-[var(--color-text-muted)]">{color.name}</span>
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
