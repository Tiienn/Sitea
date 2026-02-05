import { useState, useEffect } from 'react'

// Unit conversion constants
const FEET_PER_METER = 3.28084

export default function FencePropertiesPanel({
  fence,
  onClose,
  onChangeHeight,
  onChangeFenceType,
  lengthUnit = 'm'
}) {
  const [activeTab, setActiveTab] = useState('general') // 'general' or 'style'
  const [editingHeight, setEditingHeight] = useState(false)
  const [heightValue, setHeightValue] = useState('')

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Calculate fence length
  const fenceLengthM = fence ? Math.sqrt(
    Math.pow(fence.end.x - fence.start.x, 2) +
    Math.pow(fence.end.z - fence.start.z, 2)
  ) : 0

  const fenceHeight = fence?.height || 1.0
  const fenceType = fence?.fenceType || 'picket'

  // Format length based on unit
  const formatLength = (meters) => {
    if (lengthUnit === 'ft') {
      return `${(meters * FEET_PER_METER).toFixed(2)} ft`
    }
    return `${meters.toFixed(2)} m`
  }

  // Parse input value to meters
  const parseToMeters = (value) => {
    const num = parseFloat(value)
    if (isNaN(num)) return null
    return lengthUnit === 'ft' ? num / FEET_PER_METER : num
  }

  // Get display value for editing
  const getDisplayValue = (meters) => {
    if (lengthUnit === 'ft') {
      return (meters * FEET_PER_METER).toFixed(2)
    }
    return meters.toFixed(2)
  }

  const handleSaveHeight = () => {
    const newHeightM = parseToMeters(heightValue)
    if (newHeightM && newHeightM > 0) {
      onChangeHeight?.(fence.id, newHeightM)
    }
    setEditingHeight(false)
  }

  if (!fence) return null

  // Fence type options with colors and CSS preview patterns
  const fenceTypes = [
    { id: 'picket', name: 'Picket', color: '#8B4513', preview: 'repeating-linear-gradient(90deg, #8B4513 0px, #8B4513 4px, #654321 4px, #654321 8px)' },
    { id: 'privacy', name: 'Privacy', color: '#D2691E', preview: 'linear-gradient(180deg, #D2691E 0%, #A0522D 100%)' },
    { id: 'chainLink', name: 'Chain Link', color: '#708090', preview: 'repeating-linear-gradient(45deg, #708090 0px, #708090 2px, #A9A9A9 2px, #A9A9A9 4px)' },
    { id: 'iron', name: 'Iron', color: '#2F2F2F', preview: 'repeating-linear-gradient(90deg, #2F2F2F 0px, #2F2F2F 3px, #1a1a1a 3px, #1a1a1a 6px)' },
    { id: 'ranch', name: 'Ranch', color: '#8B7355', preview: 'repeating-linear-gradient(0deg, #8B7355 0px, #8B7355 8px, #6B5344 8px, #6B5344 12px)' },
  ]

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10" style={{ padding: '20px 28px' }}>
          <h2 className="text-lg font-semibold text-white">Fence Properties</h2>
          <button
            onClick={onClose}
            className="p-2 rounded-lg hover:bg-white/10 transition-colors"
          >
            <svg className="w-5 h-5 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-white/10">
          {['general', 'style'].map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`flex-1 px-4 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-[var(--color-accent)] border-b-2 border-[var(--color-accent)]'
                  : 'text-[var(--color-text-muted)] hover:text-white'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="space-y-5" style={{ padding: '20px 28px' }}>
          {/* General Tab */}
          {activeTab === 'general' && (
            <>
              {/* Length (read-only) */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">Length</label>
                <div className="px-3 py-2 bg-[var(--color-bg-primary)] border border-white/10 rounded-lg text-white flex items-center justify-between" style={{ padding: '8px 14px' }}>
                  <span>{formatLength(fenceLengthM)}</span>
                  <span className="flex items-center gap-1 text-xs text-[var(--color-text-muted)]">
                    <svg className="w-3 h-3" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 15v2m-6 4h12a2 2 0 002-2v-6a2 2 0 00-2-2H6a2 2 0 00-2 2v6a2 2 0 002 2zm10-10V7a4 4 0 00-8 0v4h8z" />
                    </svg>
                    Fixed
                  </span>
                </div>
              </div>

              {/* Height */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">Height</label>
                {editingHeight ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={heightValue}
                      onChange={(e) => setHeightValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveHeight()
                        if (e.key === 'Escape') setEditingHeight(false)
                      }}
                      autoFocus
                      step="0.1"
                      min="0.3"
                      max="2.5"
                      className="flex-1 px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-accent)] rounded-lg text-white focus:outline-none"
                      style={{ padding: '8px 14px' }}
                    />
                    <span className="text-[var(--color-text-muted)]">{lengthUnit}</span>
                    <button
                      onClick={handleSaveHeight}
                      className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditingHeight(false)}
                      className="p-2 rounded-lg bg-white/5 hover:bg-white/10 text-white"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                      </svg>
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => {
                      setHeightValue(getDisplayValue(fenceHeight))
                      setEditingHeight(true)
                    }}
                    className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-white/10 rounded-lg text-white text-left hover:border-white/30 transition-colors"
                    style={{ padding: '8px 14px' }}
                  >
                    {formatLength(fenceHeight)}
                  </button>
                )}
              </div>

              {/* Height Presets */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-2">Quick Height Presets</label>
                <div className="flex gap-2">
                  {[
                    { value: 0.6, label: '0.6m', desc: 'Low' },
                    { value: 1.0, label: '1.0m', desc: 'Standard' },
                    { value: 1.2, label: '1.2m', desc: 'Medium' },
                    { value: 1.8, label: '1.8m', desc: 'Privacy' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => onChangeHeight?.(fence.id, option.value)}
                      className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                        Math.abs(fenceHeight - option.value) < 0.05
                          ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                          : 'bg-[var(--color-bg-primary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-secondary)] border border-white/10'
                      }`}
                    >
                      <div>{option.label}</div>
                      <div className="text-[9px] opacity-70">{option.desc}</div>
                    </button>
                  ))}
                </div>
              </div>
            </>
          )}

          {/* Style Tab */}
          {activeTab === 'style' && (
            <div className="space-y-4">
              {/* Fence Style */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-2">Fence Style</label>
                <div className="grid grid-cols-2 gap-2">
                  {fenceTypes.map((type) => (
                    <button
                      key={type.id}
                      onClick={() => onChangeFenceType?.(fence.id, type.id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                        fenceType === type.id
                          ? 'border-[var(--color-accent)] bg-white/10'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded"
                        style={{ background: type.preview }}
                      />
                      <span className="text-sm text-white">{type.name}</span>
                    </button>
                  ))}
                </div>
              </div>
            </div>
          )}
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
