import { useState, useEffect, useMemo } from 'react'
import { findWallsForRoom } from '../utils/roomDetection'

// Unit conversion constants
const FEET_PER_METER = 3.28084
const SQ_FEET_PER_SQ_METER = 10.7639

export default function RoomPropertiesPanel({
  room,
  walls,
  roomLabel,
  onLabelChange,
  onClose,
  selectedWallId,
  onSelectWall,
  onDeleteWall,
  onResizeWall,
  roomStyle,
  onStyleChange,
  lengthUnit = 'm'
}) {
  const [name, setName] = useState(roomLabel || '')
  const [activeTab, setActiveTab] = useState('general') // 'general', 'walls', 'resize'
  const [editingWallId, setEditingWallId] = useState(null)
  const [editingLength, setEditingLength] = useState('')

  // Sync name with prop
  useEffect(() => {
    setName(roomLabel || '')
  }, [roomLabel])

  // Close on Escape key
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key === 'Escape') onClose?.()
      if (e.key === 'Enter') { e.preventDefault(); onClose?.() }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onClose])

  // Find walls belonging to this room
  const roomWallIds = useMemo(() => {
    if (!room || !walls) return []
    return findWallsForRoom(room, walls)
  }, [room, walls])

  const roomWalls = useMemo(() => {
    return walls.filter(w => roomWallIds.includes(w.id))
  }, [walls, roomWallIds])

  // Calculate room dimensions (bounding box)
  const dimensions = useMemo(() => {
    if (!room?.points || room.points.length < 2) return { width: 0, length: 0 }
    const xs = room.points.map(p => p.x)
    const zs = room.points.map(p => p.z)
    const width = Math.max(...xs) - Math.min(...xs)
    const length = Math.max(...zs) - Math.min(...zs)
    return { width, length }
  }, [room])

  // Format dimensions based on unit
  const formatLength = (meters) => {
    if (lengthUnit === 'ft') {
      return `${(meters * FEET_PER_METER).toFixed(1)} ft`
    }
    return `${meters.toFixed(1)} m`
  }

  const formatArea = (sqMeters) => {
    if (lengthUnit === 'ft') {
      return `${(sqMeters * SQ_FEET_PER_SQ_METER).toFixed(0)} ft²`
    }
    return `${sqMeters.toFixed(1)} m²`
  }

  // Handle name save
  const handleSaveName = () => {
    if (onLabelChange && name !== roomLabel) {
      onLabelChange(name.trim())
    }
  }

  if (!room) return null

  return (
    <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md bg-[var(--color-bg-secondary)] rounded-2xl shadow-2xl overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-white/10" style={{ padding: '20px 28px' }}>
          <h2 className="text-lg font-semibold text-white">Room Properties</h2>
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
          {['general', 'walls', 'style'].map((tab) => (
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
              {/* Room Name */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">Room Name</label>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  onBlur={handleSaveName}
                  onKeyDown={(e) => e.key === 'Enter' && handleSaveName()}
                  placeholder="e.g., Living Room, Bedroom"
                  className="w-full px-3 py-2 bg-[var(--color-bg-primary)] border border-white/10 rounded-lg text-white placeholder-white/30 focus:outline-none focus:border-[var(--color-accent)]"
                  style={{ padding: '8px 14px' }}
                />
              </div>

              {/* Dimensions (read-only) */}
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-[var(--color-text-muted)] mb-1">Width</label>
                  <div className="px-3 py-2 bg-[var(--color-bg-primary)] border border-white/10 rounded-lg text-white" style={{ padding: '8px 14px' }}>
                    {formatLength(dimensions.width)}
                  </div>
                </div>
                <div>
                  <label className="block text-sm text-[var(--color-text-muted)] mb-1">Length</label>
                  <div className="px-3 py-2 bg-[var(--color-bg-primary)] border border-white/10 rounded-lg text-white" style={{ padding: '8px 14px' }}>
                    {formatLength(dimensions.length)}
                  </div>
                </div>
              </div>

              {/* Area */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-1">Area</label>
                <div className="px-3 py-2 bg-[var(--color-bg-primary)] border border-white/10 rounded-lg text-white text-lg font-semibold" style={{ padding: '8px 14px' }}>
                  {formatArea(room.area)}
                </div>
              </div>

              {/* Wall count */}
              <div className="text-sm text-[var(--color-text-muted)]">
                {roomWalls.length} walls
              </div>
            </div>
          )}

          {/* Walls Tab */}
          {activeTab === 'walls' && (
            <div className="space-y-2">
              {roomWalls.length === 0 ? (
                <p className="text-[var(--color-text-muted)] text-sm">No walls found for this room.</p>
              ) : (
                roomWalls.map((wall, index) => {
                  const wallLengthM = Math.sqrt(
                    Math.pow(wall.end.x - wall.start.x, 2) +
                    Math.pow(wall.end.z - wall.start.z, 2)
                  )
                  const isHighlighted = selectedWallId === wall.id
                  const isEditing = editingWallId === wall.id

                  // Convert length for display based on unit
                  const displayLength = lengthUnit === 'ft'
                    ? (wallLengthM * FEET_PER_METER).toFixed(2)
                    : wallLengthM.toFixed(2)

                  const handleStartEdit = () => {
                    setEditingWallId(wall.id)
                    setEditingLength(displayLength)
                  }

                  const handleSaveLength = () => {
                    const newValue = parseFloat(editingLength)
                    if (!isNaN(newValue) && newValue > 0) {
                      // Convert back to meters if in feet
                      const newLengthM = lengthUnit === 'ft'
                        ? newValue / FEET_PER_METER
                        : newValue
                      // Pass room center for re-selection after room regenerates
                      onResizeWall?.(wall.id, newLengthM, room?.center)
                    }
                    setEditingWallId(null)
                    setEditingLength('')
                  }

                  const handleCancelEdit = () => {
                    setEditingWallId(null)
                    setEditingLength('')
                  }

                  return (
                    <div
                      key={wall.id}
                      className={`p-3 rounded-lg border transition-colors ${
                        isHighlighted
                          ? 'bg-yellow-500/20 border-yellow-500/50'
                          : 'bg-[var(--color-bg-primary)] border-white/10'
                      }`}
                    >
                      <div className="flex items-center justify-between">
                        <div className="text-white font-medium">Wall {index + 1}</div>
                        <div className="flex gap-2">
                          <button
                            onClick={() => onSelectWall?.(wall.id)}
                            className={`p-2 rounded-lg transition-colors ${
                              isHighlighted
                                ? 'bg-yellow-500/30 hover:bg-yellow-500/40'
                                : 'bg-white/5 hover:bg-white/10'
                            }`}
                            title={isHighlighted ? "Unhighlight wall" : "Highlight wall"}
                          >
                            <svg className={`w-4 h-4 ${isHighlighted ? 'text-yellow-400' : 'text-white'}`} fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            </svg>
                          </button>
                          <button
                            onClick={() => onDeleteWall?.(wall.id)}
                            className="p-2 rounded-lg bg-red-500/10 hover:bg-red-500/20 transition-colors"
                            title="Delete wall"
                          >
                            <svg className="w-4 h-4 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>

                      {/* Length edit row */}
                      <div className="mt-2 flex items-center gap-2">
                        <span className="text-sm text-[var(--color-text-muted)]">Length:</span>
                        {isEditing ? (
                          <div className="flex items-center gap-1">
                            <input
                              type="number"
                              value={editingLength}
                              onChange={(e) => setEditingLength(e.target.value)}
                              onKeyDown={(e) => {
                                if (e.key === 'Enter') handleSaveLength()
                                if (e.key === 'Escape') handleCancelEdit()
                              }}
                              autoFocus
                              step="0.1"
                              min="0.1"
                              className="w-20 px-2 py-1 bg-[var(--color-bg-primary)] border border-[var(--color-accent)] rounded text-white text-sm focus:outline-none"
                            />
                            <span className="text-sm text-[var(--color-text-muted)]">{lengthUnit}</span>
                            <button
                              onClick={handleSaveLength}
                              className="p-1 rounded bg-green-500/20 hover:bg-green-500/30 text-green-400"
                              title="Save"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                              </svg>
                            </button>
                            <button
                              onClick={handleCancelEdit}
                              className="p-1 rounded bg-white/5 hover:bg-white/10 text-white"
                              title="Cancel"
                            >
                              <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                              </svg>
                            </button>
                          </div>
                        ) : (
                          <button
                            onClick={handleStartEdit}
                            className="px-2 py-1 bg-white/5 hover:bg-white/10 rounded text-white text-sm transition-colors"
                            title="Click to edit length"
                          >
                            {displayLength} {lengthUnit}
                          </button>
                        )}
                        <span className="text-sm text-[var(--color-text-muted)] ml-auto">
                          {wall.openings?.length || 0} openings
                        </span>
                      </div>
                    </div>
                  )
                })
              )}
            </div>
          )}

          {/* Style Tab */}
          {activeTab === 'style' && (
            <div className="space-y-4">
              {/* Floor Pattern */}
              <div>
                <label className="block text-sm text-[var(--color-text-muted)] mb-2">Floor Pattern</label>
                <div className="grid grid-cols-3 gap-2">
                  {[
                    { id: 'wood', name: 'Wood', color: '#8B5A2B', preview: 'linear-gradient(90deg, #8B5A2B 0%, #A0522D 50%, #8B5A2B 100%)' },
                    { id: 'tile', name: 'Tile', color: '#D4D4D4', preview: 'repeating-linear-gradient(90deg, #E5E5E5 0px, #E5E5E5 10px, #D4D4D4 10px, #D4D4D4 20px)' },
                    { id: 'carpet', name: 'Carpet', color: '#4A5568', preview: '#4A5568' },
                    { id: 'concrete', name: 'Concrete', color: '#9CA3AF', preview: '#9CA3AF' },
                    { id: 'marble', name: 'Marble', color: '#F5F5F4', preview: 'linear-gradient(135deg, #FAFAF9 0%, #E7E5E4 50%, #F5F5F4 100%)' },
                    { id: null, name: 'Default', color: null, preview: '#3A3A3A' },
                  ].map(({ id, name, preview }) => (
                    <button
                      key={id || 'default'}
                      onClick={() => onStyleChange?.({ floorPattern: id })}
                      className={`p-2 rounded-lg border-2 transition-all ${
                        roomStyle?.floorPattern === id
                          ? 'border-[var(--color-accent)] scale-105'
                          : 'border-white/20 hover:border-white/50'
                      }`}
                    >
                      <div
                        className="w-full h-8 rounded mb-1"
                        style={{ background: preview }}
                      />
                      <span className="text-[10px] text-[var(--color-text-secondary)]">{name}</span>
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
                      onClick={() => onStyleChange?.({ wallColor: color })}
                      className={`w-8 h-8 rounded-lg border-2 transition-all ${
                        roomStyle?.wallColor === color
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
                onClick={() => onStyleChange?.({ wallColor: null, floorPattern: null })}
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
