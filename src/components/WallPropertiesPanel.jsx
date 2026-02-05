import { useState, useEffect } from 'react'

// Unit conversion constants
const FEET_PER_METER = 3.28084

export default function WallPropertiesPanel({
  wall,
  onClose,
  onResizeWall,
  onChangeHeight,
  onChangeThickness,
  onChangeColor,
  onChangePattern,
  onDeleteOpening,
  lengthUnit = 'm'
}) {
  const [activeTab, setActiveTab] = useState('general') // 'general', 'openings', 'style'
  const [editingLength, setEditingLength] = useState(false)
  const [editingHeight, setEditingHeight] = useState(false)
  const [lengthValue, setLengthValue] = useState('')
  const [heightValue, setHeightValue] = useState('')

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Calculate wall length
  const wallLengthM = wall ? Math.sqrt(
    Math.pow(wall.end.x - wall.start.x, 2) +
    Math.pow(wall.end.z - wall.start.z, 2)
  ) : 0

  const wallHeight = wall?.height || 2.7
  const wallThickness = wall?.thickness || 0.15

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

  const handleSaveLength = () => {
    const newLengthM = parseToMeters(lengthValue)
    if (newLengthM && newLengthM > 0) {
      onResizeWall?.(wall.id, newLengthM)
    }
    setEditingLength(false)
  }

  const handleSaveHeight = () => {
    const newHeightM = parseToMeters(heightValue)
    if (newHeightM && newHeightM > 0) {
      onChangeHeight?.(wall.id, newHeightM)
    }
    setEditingHeight(false)
  }

  if (!wall) return null

  const openings = wall.openings || []
  const doors = openings.filter(o => o.type === 'door')
  const windows = openings.filter(o => o.type === 'window')

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10" style={{ padding: '20px 28px' }}>
          <h2 className="text-lg font-semibold text-white">Wall Properties</h2>
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
          {['general', 'openings', 'style'].map((tab) => (
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
        <div className="max-h-[60vh] overflow-y-auto" style={{ padding: '20px 28px' }}>
          {/* General Tab */}
          {activeTab === 'general' && (
            <div className="space-y-4">
              {/* Length */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">Length</label>
                {editingLength ? (
                  <div className="flex items-center gap-2">
                    <input
                      type="number"
                      value={lengthValue}
                      onChange={(e) => setLengthValue(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') handleSaveLength()
                        if (e.key === 'Escape') setEditingLength(false)
                      }}
                      autoFocus
                      step="0.1"
                      min="0.1"
                      className="flex-1 px-3 py-2 bg-[var(--color-bg-primary)] border border-[var(--color-accent)] rounded-lg text-white focus:outline-none"
                      style={{ padding: '8px 14px' }}
                    />
                    <span className="text-[var(--color-text-muted)]">{lengthUnit}</span>
                    <button
                      onClick={handleSaveLength}
                      className="p-2 rounded-lg bg-green-500/20 hover:bg-green-500/30 text-green-400"
                    >
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                      </svg>
                    </button>
                    <button
                      onClick={() => setEditingLength(false)}
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
                      setLengthValue(getDisplayValue(wallLengthM))
                      setEditingLength(true)
                    }}
                    className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-white/10 rounded-lg text-white text-left hover:border-white/30 transition-colors"
                    style={{ padding: '8px 14px' }}
                  >
                    {formatLength(wallLengthM)}
                  </button>
                )}
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
                      min="0.1"
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
                      setHeightValue(getDisplayValue(wallHeight))
                      setEditingHeight(true)
                    }}
                    className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-white/10 rounded-lg text-white text-left hover:border-white/30 transition-colors"
                    style={{ padding: '8px 14px' }}
                  >
                    {formatLength(wallHeight)}
                  </button>
                )}
              </div>

              {/* Half Wall Presets */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-2">Quick Height Presets</label>
                <div className="flex gap-2">
                  {[
                    { value: 0.9, label: '0.9m', desc: 'Low' },
                    { value: 1.2, label: '1.2m', desc: 'Counter' },
                    { value: 1.5, label: '1.5m', desc: 'Railing' },
                    { value: 2.7, label: '2.7m', desc: 'Full' },
                  ].map((option) => (
                    <button
                      key={option.value}
                      onClick={() => onChangeHeight?.(wall.id, option.value)}
                      className={`flex-1 py-2 px-2 rounded-lg text-xs font-medium transition-colors ${
                        Math.abs(wallHeight - option.value) < 0.05
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

              {/* Thickness (read-only for now) */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">Thickness</label>
                <div className="px-3 py-2 bg-[var(--color-bg-primary)] border border-white/10 rounded-lg text-white" style={{ padding: '8px 14px' }}>
                  {formatLength(wallThickness)}
                </div>
              </div>

              {/* Summary */}
              <div className="pt-2 border-t border-white/10 text-sm text-[var(--color-text-muted)]">
                {openings.length} openings ({doors.length} doors, {windows.length} windows)
              </div>
            </div>
          )}

          {/* Openings Tab */}
          {activeTab === 'openings' && (
            <div className="space-y-2">
              {openings.length === 0 ? (
                <p className="text-[var(--color-text-muted)] text-sm">No doors or windows on this wall.</p>
              ) : (
                openings.map((opening, index) => {
                  const isDoor = opening.type === 'door'
                  return (
                    <div
                      key={opening.id}
                      className="flex items-center justify-between p-3 bg-[var(--color-bg-primary)] rounded-lg border border-white/10"
                    >
                      <div className="flex items-center gap-3">
                        {/* Icon */}
                        <div className={`p-2 rounded-lg ${isDoor ? 'bg-amber-500/20' : 'bg-blue-500/20'}`}>
                          {isDoor ? (
                            <svg className="w-4 h-4 text-amber-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 9l4-4 4 4m0 6l-4 4-4-4" />
                            </svg>
                          ) : (
                            <svg className="w-4 h-4 text-blue-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
                            </svg>
                          )}
                        </div>
                        <div>
                          <div className="text-white font-medium">
                            {isDoor ? (opening.doorType === 'double' ? 'Double Door' : 'Door') : 'Window'}
                          </div>
                          <div className="text-sm text-[var(--color-text-muted)]">
                            {formatLength(opening.width || (isDoor ? 0.9 : 1.2))} wide
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => onDeleteOpening?.(wall.id, opening.id)}
                        className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                        title="Delete opening"
                      >
                        <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                        </svg>
                      </button>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Style Tab */}
          {activeTab === 'style' && (
            <div className="space-y-4">
              {/* Wall Pattern */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-2">Wall Pattern</label>
                <div className="grid grid-cols-2 gap-2">
                  {[
                    { id: null, name: 'Smooth', preview: 'linear-gradient(180deg, #E5E5E5 0%, #D4D4D4 100%)' },
                    { id: 'brick', name: 'Brick', preview: 'repeating-linear-gradient(0deg, #8B4513 0px, #8B4513 8px, #654321 8px, #654321 10px), repeating-linear-gradient(90deg, #8B4513 0px, #8B4513 20px, #654321 20px, #654321 22px)' },
                    { id: 'stone', name: 'Stone', preview: 'linear-gradient(135deg, #9CA3AF 0%, #6B7280 25%, #9CA3AF 50%, #6B7280 75%, #9CA3AF 100%)' },
                    { id: 'woodPanels', name: 'Wood Panels', preview: 'repeating-linear-gradient(90deg, #8B5A2B 0px, #A0522D 15px, #8B5A2B 30px)' },
                  ].map(({ id, name, preview }) => (
                    <button
                      key={id || 'smooth'}
                      onClick={() => onChangePattern?.(wall.id, id)}
                      className={`flex items-center gap-2 p-2 rounded-lg border-2 transition-all ${
                        wall.pattern === id
                          ? 'border-[var(--color-accent)] bg-white/10'
                          : 'border-white/10 hover:border-white/30'
                      }`}
                    >
                      <div
                        className="w-8 h-8 rounded"
                        style={{ background: preview }}
                      />
                      <span className="text-sm text-white">{name}</span>
                    </button>
                  ))}
                </div>
              </div>

              {/* Wall Color */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-2">Wall Color</label>
                <div className="grid grid-cols-6 gap-2">
                  {[
                    { color: '#ffffff', name: 'White' },
                    { color: '#e5e5e5', name: 'Light Gray' },
                    { color: '#a3a3a3', name: 'Gray' },
                    { color: '#525252', name: 'Dark Gray' },
                    { color: '#fef3c7', name: 'Cream' },
                    { color: '#fde68a', name: 'Yellow' },
                    { color: '#fed7aa', name: 'Peach' },
                    { color: '#fecaca', name: 'Pink' },
                    { color: '#bfdbfe', name: 'Light Blue' },
                    { color: '#bbf7d0', name: 'Light Green' },
                    { color: '#d4a574', name: 'Tan' },
                    { color: '#92400e', name: 'Brown' },
                  ].map(({ color, name }) => (
                    <button
                      key={color}
                      onClick={() => onChangeColor?.(wall.id, color)}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        wall.color === color
                          ? 'border-[var(--color-accent)] scale-110'
                          : 'border-white/20 hover:border-white/50'
                      }`}
                      style={{ backgroundColor: color }}
                      title={name}
                    />
                  ))}
                </div>
              </div>

              {/* Reset Button */}
              <button
                onClick={() => {
                  onChangeColor?.(wall.id, null)
                  onChangePattern?.(wall.id, null)
                }}
                className="w-full py-2 bg-white/5 hover:bg-white/10 text-[var(--color-text-muted)] rounded-lg transition-colors text-sm"
                style={{ marginTop: 8 }}
              >
                Reset to Default
              </button>
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
