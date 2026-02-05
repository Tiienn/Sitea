import { useEffect } from 'react'

export default function RoofPropertiesPanel({
  roof,
  onClose,
  onUpdateRoof
}) {
  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  if (!roof) return null

  const type = roof.type || 'gable'
  const pitch = roof.pitch || 30
  const overhang = roof.overhang || 0.5
  const thickness = roof.thickness || 0.15
  const material = roof.material || 'shingle'

  // Roof type options
  const roofTypes = [
    { id: 'gable', name: 'Gable', icon: '⌂' },
    { id: 'flat', name: 'Flat', icon: '▬' },
    { id: 'hip', name: 'Hip', icon: '△' },
    { id: 'shed', name: 'Shed', icon: '⟋' },
  ]

  // Roof material options with preview patterns
  const materials = [
    { id: 'shingle', name: 'Shingle', preview: 'repeating-linear-gradient(0deg, #4A4A4A 0px, #3A3A3A 4px, #4A4A4A 8px)' },
    { id: 'tile', name: 'Tile', preview: 'repeating-linear-gradient(0deg, #B5651D 0px, #8B4513 6px, #B5651D 12px)' },
    { id: 'metal', name: 'Metal', preview: 'repeating-linear-gradient(90deg, #5A6A7A 0px, #708090 3px, #5A6A7A 6px)' },
    { id: 'slate', name: 'Slate', preview: 'linear-gradient(135deg, #2F4F4F 0%, #3A5A5A 50%, #2F4F4F 100%)' },
    { id: 'concrete', name: 'Concrete', preview: 'linear-gradient(135deg, #808080 0%, #696969 50%, #808080 100%)' },
    { id: 'thatch', name: 'Thatch', preview: 'repeating-linear-gradient(45deg, #D2B48C 0px, #C4A676 4px, #B8956A 8px)' },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10" style={{ padding: '20px 28px' }}>
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-lg bg-orange-600/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-orange-500" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
              </svg>
            </div>
            <h2 className="text-lg font-semibold text-white">Roof Properties</h2>
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
        <div className="space-y-5 max-h-[70vh] overflow-y-auto" style={{ padding: '20px 28px' }}>
          {/* Roof Type */}
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-2">Roof Type</label>
            <div className="grid grid-cols-4 gap-2">
              {roofTypes.map((rt) => (
                <button
                  key={rt.id}
                  onClick={() => onUpdateRoof?.(roof.id, { type: rt.id })}
                  className={`flex flex-col items-center gap-1 p-3 rounded-lg border-2 transition-all ${
                    type === rt.id
                      ? 'border-[var(--color-accent)] bg-white/10'
                      : 'border-white/10 hover:border-white/30'
                  }`}
                >
                  <span className="text-xl">{rt.icon}</span>
                  <span className="text-xs text-white">{rt.name}</span>
                </button>
              ))}
            </div>
          </div>

          {/* Pitch Slider (not for flat roofs) */}
          {type !== 'flat' && (
            <div>
              <label className="block text-sm text-[var(--color-text-muted)] mb-2">
                Pitch: {pitch}°
              </label>
              <input
                type="range"
                min="15"
                max="60"
                step="5"
                value={pitch}
                onChange={(e) => onUpdateRoof?.(roof.id, { pitch: parseInt(e.target.value) })}
                className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
              />
              <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
                <span>15°</span>
                <span>60°</span>
              </div>
            </div>
          )}

          {/* Overhang Slider */}
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-2">
              Overhang: {overhang.toFixed(1)}m
            </label>
            <input
              type="range"
              min="0"
              max="2"
              step="0.1"
              value={overhang}
              onChange={(e) => onUpdateRoof?.(roof.id, { overhang: parseFloat(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              <span>0m</span>
              <span>2m</span>
            </div>
          </div>

          {/* Thickness Slider */}
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-2">
              Thickness: {thickness.toFixed(2)}m
            </label>
            <input
              type="range"
              min="0.05"
              max="1"
              step="0.05"
              value={thickness}
              onChange={(e) => onUpdateRoof?.(roof.id, { thickness: parseFloat(e.target.value) })}
              className="w-full h-2 bg-white/10 rounded-lg appearance-none cursor-pointer accent-orange-500"
            />
            <div className="flex justify-between text-xs text-[var(--color-text-muted)] mt-1">
              <span>0.05m</span>
              <span>1m</span>
            </div>
          </div>

          {/* Material */}
          <div>
            <label className="block text-sm text-[var(--color-text-muted)] mb-2">Material</label>
            <div className="grid grid-cols-2 gap-2">
              {materials.map((mat) => (
                <button
                  key={mat.id}
                  onClick={() => onUpdateRoof?.(roof.id, { material: mat.id })}
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
