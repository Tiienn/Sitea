import { useState } from 'react'

export default function ExportPanel({
  onExport,
  isExporting = false,
  wallCount = 0,
  roomCount = 0,
  hasLand = false,
}) {
  const [includeDimensions, setIncludeDimensions] = useState(true)
  const [includeRoomLabels, setIncludeRoomLabels] = useState(true)
  const [includeLegend, setIncludeLegend] = useState(true)
  const [includeGrid, setIncludeGrid] = useState(false)

  const canExport = hasLand || wallCount > 0

  const handleExport = () => {
    if (!canExport || isExporting) return
    onExport({
      format: 'png',
      includeDimensions,
      includeRoomLabels,
      includeLegend,
      includeGrid,
    })
  }

  return (
    <div className="space-y-4">
      {/* Export Info */}
      <div className="bg-[var(--color-bg-elevated)] rounded-xl p-3 space-y-2">
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Walls</span>
          <span className="text-[var(--color-text-primary)] font-medium">{wallCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Rooms</span>
          <span className="text-[var(--color-text-primary)] font-medium">{roomCount}</span>
        </div>
        <div className="flex items-center justify-between text-sm">
          <span className="text-[var(--color-text-muted)]">Land defined</span>
          <span className={`font-medium ${hasLand ? 'text-green-400' : 'text-[var(--color-text-muted)]'}`}>
            {hasLand ? 'Yes' : 'No'}
          </span>
        </div>
      </div>

      {/* Options */}
      <div className="space-y-2">
        <div className="text-xs text-[var(--color-text-muted)] font-medium mb-2">Include in export</div>

        <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeDimensions}
            onChange={(e) => setIncludeDimensions(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
          />
          <span className="text-sm text-[var(--color-text-primary)]">Wall dimensions</span>
        </label>

        <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeRoomLabels}
            onChange={(e) => setIncludeRoomLabels(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
          />
          <span className="text-sm text-[var(--color-text-primary)]">Room areas</span>
        </label>

        <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeLegend}
            onChange={(e) => setIncludeLegend(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
          />
          <span className="text-sm text-[var(--color-text-primary)]">Legend</span>
        </label>

        <label className="flex items-center gap-3 p-2 rounded-lg hover:bg-white/5 cursor-pointer">
          <input
            type="checkbox"
            checked={includeGrid}
            onChange={(e) => setIncludeGrid(e.target.checked)}
            className="w-4 h-4 rounded border-gray-600 bg-gray-700 text-teal-500 focus:ring-teal-500 focus:ring-offset-0"
          />
          <span className="text-sm text-[var(--color-text-primary)]">Grid</span>
        </label>
      </div>

      {/* Export Button */}
      <button
        onClick={handleExport}
        disabled={!canExport || isExporting}
        className={`w-full py-3 rounded-xl font-medium text-sm transition-colors flex items-center justify-center gap-2 ${
          canExport && !isExporting
            ? 'bg-teal-500 hover:bg-teal-600 text-white'
            : 'bg-gray-600 text-gray-400 cursor-not-allowed'
        }`}
      >
        {isExporting ? (
          <>
            <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
              <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
              <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
            </svg>
            <span>Exporting...</span>
          </>
        ) : (
          <>
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
            </svg>
            <span>Export as PNG</span>
          </>
        )}
      </button>

      {!canExport && (
        <p className="text-xs text-[var(--color-text-muted)] text-center">
          Define your land or add walls to export
        </p>
      )}
    </div>
  )
}
