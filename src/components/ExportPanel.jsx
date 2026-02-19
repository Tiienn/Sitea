import { useState, useEffect } from 'react'
import { useUser } from '../hooks/useUser'

// Section definitions
const SECTIONS = [
  { id: 'floorplan', label: 'Floor Plan', icon: 'floorplan' },
  { id: 'pdf', label: 'PDF Report', icon: 'document' },
  { id: 'screenshot', label: '3D View', icon: 'camera' },
  { id: 'model', label: '3D Model', icon: 'cube' },
  { id: 'airender', label: 'AI Render', icon: 'sparkles' },
]

// Icon components
const Icons = {
  floorplan: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 6A2.25 2.25 0 016 3.75h2.25A2.25 2.25 0 0110.5 6v2.25a2.25 2.25 0 01-2.25 2.25H6a2.25 2.25 0 01-2.25-2.25V6zM3.75 15.75A2.25 2.25 0 016 13.5h2.25a2.25 2.25 0 012.25 2.25V18a2.25 2.25 0 01-2.25 2.25H6A2.25 2.25 0 013.75 18v-2.25zM13.5 6a2.25 2.25 0 012.25-2.25H18A2.25 2.25 0 0120.25 6v2.25A2.25 2.25 0 0118 10.5h-2.25a2.25 2.25 0 01-2.25-2.25V6zM13.5 15.75a2.25 2.25 0 012.25-2.25H18a2.25 2.25 0 012.25 2.25V18A2.25 2.25 0 0118 20.25h-2.25A2.25 2.25 0 0113.5 18v-2.25z" />
    </svg>
  ),
  camera: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0zM18.75 10.5h.008v.008h-.008V10.5z" />
    </svg>
  ),
  cube: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M21 7.5l-9-5.25L3 7.5m18 0l-9 5.25m9-5.25v9l-9 5.25M3 7.5l9 5.25M3 7.5v9l9 5.25m0-9v9" />
    </svg>
  ),
  document: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  sparkles: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456zM16.894 20.567L16.5 21.75l-.394-1.183a2.25 2.25 0 00-1.423-1.423L13.5 18.75l1.183-.394a2.25 2.25 0 001.423-1.423l.394-1.183.394 1.183a2.25 2.25 0 001.423 1.423l1.183.394-1.183.394a2.25 2.25 0 00-1.423 1.423z" />
    </svg>
  ),
}

export default function ExportPanel({
  onExport,
  isExporting = false,
  wallCount = 0,
  roomCount = 0,
  hasLand = false,
  onExpandedChange,
  isActive = false,
  onScreenshot,
  isCapturing = false,
  viewMode = '3d',
  onModelExport,
  isExportingModel = false,
  onPdfExport,
  isExportingPdf = false,
  landArea = 0,
  buildingArea = 0,
  onAiVisualize,
  isGeneratingAI = false,
  aiRenderResult = null,
  onShowAiRender,
}) {
  const { isPaidUser } = useUser()
  const [activeSection, setActiveSection] = useState('floorplan')
  const [includeDimensions, setIncludeDimensions] = useState(true)
  const [includeRoomLabels, setIncludeRoomLabels] = useState(true)
  const [includeLegend, setIncludeLegend] = useState(true)
  const [includeGrid, setIncludeGrid] = useState(false)

  // Screenshot options
  const [screenshotFormat, setScreenshotFormat] = useState('png')
  const [screenshotScale, setScreenshotScale] = useState(1)

  // Model export options
  const [modelFormat, setModelFormat] = useState('glb')

  // AI render options
  const [aiStyle, setAiStyle] = useState('modern')

  const canExport = hasLand || wallCount > 0
  const currentSection = SECTIONS.find(s => s.id === activeSection)

  // Notify parent of expanded state
  useEffect(() => {
    onExpandedChange?.(!!activeSection)
  }, [activeSection, onExpandedChange])

  // Reset section when panel closes
  useEffect(() => {
    if (!isActive) {
      // Keep section selected for when panel reopens
    }
  }, [isActive])

  const handleSectionClick = (sectionId) => {
    setActiveSection(activeSection === sectionId ? null : sectionId)
  }

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

  const handleScreenshot = () => {
    if (isCapturing) return
    onScreenshot?.({
      format: screenshotFormat,
      scale: screenshotScale,
    })
  }

  const handleModelExport = () => {
    if (isExportingModel) return
    onModelExport?.({
      format: modelFormat,
    })
  }

  const handlePdfExport = () => {
    if (isExportingPdf) return
    onPdfExport?.({
      title: 'Floor Plan',
      wallCount,
      roomCount,
      landArea,
      buildingArea,
      includeDimensions,
      includeRoomLabels,
    })
  }

  // Toggle component
  const Toggle = ({ checked, onChange, label, icon }) => (
    <label className="flex items-center justify-between p-3 rounded-xl bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-elevated)] cursor-pointer transition-all group">
      <div className="flex items-center gap-3">
        <div className="w-8 h-8 rounded-lg bg-[var(--color-bg-elevated)] flex items-center justify-center text-[var(--color-text-muted)] group-hover:text-[var(--color-accent)] transition-colors">
          {icon}
        </div>
        <span className="text-sm text-[var(--color-text-primary)] font-medium">{label}</span>
      </div>
      <div
        className={`relative w-11 h-6 rounded-full transition-colors ${
          checked ? 'bg-[var(--color-accent)]' : 'bg-[var(--color-bg-elevated)]'
        }`}
        onClick={(e) => { e.preventDefault(); onChange(!checked) }}
      >
        <div
          className={`absolute top-1 w-4 h-4 rounded-full bg-white shadow-md transition-transform ${
            checked ? 'translate-x-6' : 'translate-x-1'
          }`}
        />
      </div>
    </label>
  )

  return (
    <div className="h-full flex text-white">
      {/* Icon Rail */}
      <div className="icon-rail">
        {SECTIONS.map(section => (
          <button
            key={section.id}
            onClick={() => handleSectionClick(section.id)}
            className={`icon-rail-btn ${activeSection === section.id ? 'active' : ''}`}
          >
            {Icons[section.icon]}
            <span className="tooltip">{section.label}</span>
          </button>
        ))}
      </div>

      {/* Expanded Panel */}
      <div className={`expanded-panel ${activeSection ? 'open' : ''}`}>
        <div className="expanded-panel-content">
          {/* Panel Header */}
          {currentSection && (
            <div className="flex items-center px-4 py-3 border-b border-[var(--color-border)]">
              <h2 className="font-display font-semibold text-sm">{currentSection.label}</h2>
            </div>
          )}

          {/* Panel Content */}
          <div className="flex-1 overflow-y-auto px-4 py-4">

            {/* FLOOR PLAN Section */}
            {activeSection === 'floorplan' && (
              <div className="space-y-5">
                {/* Preview Card */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-bg-elevated)] to-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  {/* Preview illustration */}
                  <div className="p-5 flex items-center justify-center">
                    <div className="relative w-full aspect-[4/3] max-w-[180px]">
                      {/* Document preview */}
                      <div className="absolute inset-0 bg-white rounded-lg shadow-xl flex flex-col overflow-hidden">
                        {/* Header bar */}
                        <div className="h-5 bg-gradient-to-r from-[var(--color-accent)] to-teal-400 flex items-center px-2 gap-1">
                          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                          <div className="w-1.5 h-1.5 rounded-full bg-white/30" />
                        </div>
                        {/* Content area */}
                        <div className="flex-1 p-2 bg-gray-50">
                          <svg viewBox="0 0 100 60" className="w-full h-full">
                            {/* Land outline */}
                            <path
                              d="M10 50 L10 15 L40 10 L70 15 L90 25 L85 55 L30 55 Z"
                              fill="none"
                              stroke="#10b981"
                              strokeWidth="1.5"
                              strokeDasharray="3 2"
                              className={hasLand ? 'opacity-100' : 'opacity-30'}
                            />
                            {/* Room boxes */}
                            <rect x="20" y="20" width="25" height="20" fill="#e5e7eb" stroke="#374151" strokeWidth="1" className={wallCount > 0 ? 'opacity-100' : 'opacity-30'} />
                            <rect x="45" y="25" width="20" height="25" fill="#e5e7eb" stroke="#374151" strokeWidth="1" className={wallCount > 0 ? 'opacity-100' : 'opacity-30'} />
                            {/* Dimension lines */}
                            {includeDimensions && (
                              <>
                                <line x1="20" y1="45" x2="45" y2="45" stroke="#6b7280" strokeWidth="0.5" />
                                <text x="32" y="43" fontSize="4" fill="#6b7280" textAnchor="middle">5m</text>
                              </>
                            )}
                            {/* Grid */}
                            {includeGrid && (
                              <g opacity="0.2">
                                {[...Array(10)].map((_, i) => (
                                  <line key={`v${i}`} x1={i * 10 + 5} y1="5" x2={i * 10 + 5} y2="58" stroke="#9ca3af" strokeWidth="0.3" />
                                ))}
                                {[...Array(6)].map((_, i) => (
                                  <line key={`h${i}`} x1="5" y1={i * 10 + 5} x2="95" y2={i * 10 + 5} stroke="#9ca3af" strokeWidth="0.3" />
                                ))}
                              </g>
                            )}
                          </svg>
                        </div>
                        {/* Legend area */}
                        {includeLegend && (
                          <div className="h-3 bg-gray-100 border-t border-gray-200 flex items-center justify-center gap-2 px-2">
                            <div className="flex items-center gap-0.5">
                              <div className="w-1 h-1 bg-green-500 rounded-full" />
                              <span className="text-[3px] text-gray-500">Land</span>
                            </div>
                            <div className="flex items-center gap-0.5">
                              <div className="w-1 h-1 bg-gray-600" />
                              <span className="text-[3px] text-gray-500">Walls</span>
                            </div>
                          </div>
                        )}
                      </div>
                      {/* PNG badge */}
                      <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-[var(--color-accent)] rounded text-[9px] font-bold text-white shadow-lg">
                        PNG
                      </div>
                    </div>
                  </div>

                  {/* Stats row */}
                  <div className="grid grid-cols-3 border-t border-[var(--color-border)]">
                    <div className="p-2 text-center border-r border-[var(--color-border)]">
                      <div className="text-base font-bold text-[var(--color-text-primary)]">{wallCount}</div>
                      <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wide">Walls</div>
                    </div>
                    <div className="p-2 text-center border-r border-[var(--color-border)]">
                      <div className="text-base font-bold text-[var(--color-text-primary)]">{roomCount}</div>
                      <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wide">Rooms</div>
                    </div>
                    <div className="p-2 text-center">
                      <div className={`text-base font-bold ${hasLand ? 'text-green-400' : 'text-[var(--color-text-muted)]'}`}>
                        {hasLand ? '✓' : '—'}
                      </div>
                      <div className="text-[9px] text-[var(--color-text-muted)] uppercase tracking-wide">Land</div>
                    </div>
                  </div>
                </div>

                {/* Options */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Options</span>
                  </div>
                  <div className="space-y-2">
                    <Toggle
                      checked={includeDimensions}
                      onChange={setIncludeDimensions}
                      label="Dimensions"
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 8V4m0 0h4M4 4l5 5m11-1V4m0 0h-4m4 0l-5 5M4 16v4m0 0h4m-4 0l5-5m11 5l-5-5m5 5v-4m0 4h-4" />
                        </svg>
                      }
                    />
                    <Toggle
                      checked={includeRoomLabels}
                      onChange={setIncludeRoomLabels}
                      label="Room Areas"
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6zM16 13a1 1 0 011-1h2a1 1 0 011 1v6a1 1 0 01-1 1h-2a1 1 0 01-1-1v-6z" />
                        </svg>
                      }
                    />
                    <Toggle
                      checked={includeLegend}
                      onChange={setIncludeLegend}
                      label="Legend"
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                        </svg>
                      }
                    />
                    <Toggle
                      checked={includeGrid}
                      onChange={setIncludeGrid}
                      label="Grid"
                      icon={
                        <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                          <path strokeLinecap="round" strokeLinejoin="round" d="M4 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2V6zM14 6a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2V6zM4 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2H6a2 2 0 01-2-2v-2zM14 16a2 2 0 012-2h2a2 2 0 012 2v2a2 2 0 01-2 2h-2a2 2 0 01-2-2v-2z" />
                        </svg>
                      }
                    />
                  </div>
                </div>

                {/* Export Button */}
                <button
                  style={{ marginTop: '12px' }}
                  onClick={handleExport}
                  disabled={!canExport || isExporting}
                  className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    canExport && !isExporting
                      ? 'bg-gradient-to-r from-[var(--color-accent)] to-teal-400 hover:opacity-90 text-white shadow-lg shadow-teal-500/20'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-not-allowed'
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
                      <span>Download PNG</span>
                      {!isPaidUser && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-400 text-amber-900 rounded-full">PRO</span>
                      )}
                    </>
                  )}
                </button>

                {/* Help text */}
                {!canExport && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-amber-200">
                      Define land or add walls to export
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* PDF REPORT Section */}
            {activeSection === 'pdf' && (
              <div className="space-y-5">
                {/* Preview area */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-bg-elevated)] to-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="p-5 flex items-center justify-center">
                    <div className="relative w-full aspect-[3/4] max-w-[140px]">
                      {/* PDF document preview */}
                      <div className="absolute inset-0 bg-white rounded-lg shadow-xl flex flex-col overflow-hidden">
                        {/* Header bar */}
                        <div className="h-6 bg-gradient-to-r from-red-500 to-rose-500 flex items-center px-2">
                          <svg className="w-3 h-3 text-white" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M4 4a2 2 0 012-2h4.586A2 2 0 0112 2.586L15.414 6A2 2 0 0116 7.414V16a2 2 0 01-2 2H6a2 2 0 01-2-2V4z" clipRule="evenodd" />
                          </svg>
                          <span className="ml-1.5 text-[8px] font-bold text-white">PDF</span>
                        </div>
                        {/* Content area */}
                        <div className="flex-1 p-2 bg-gray-50">
                          {/* Title line */}
                          <div className="h-1.5 w-16 bg-gray-300 rounded mb-2" />
                          {/* Floor plan placeholder */}
                          <div className="w-full aspect-square bg-gray-200 rounded mb-2 flex items-center justify-center">
                            <svg className="w-8 h-8 text-gray-400" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1} d="M4 5a1 1 0 011-1h14a1 1 0 011 1v2a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM4 13a1 1 0 011-1h6a1 1 0 011 1v6a1 1 0 01-1 1H5a1 1 0 01-1-1v-6z" />
                            </svg>
                          </div>
                          {/* Stats placeholder */}
                          <div className="grid grid-cols-2 gap-1">
                            <div className="h-2 bg-gray-200 rounded" />
                            <div className="h-2 bg-gray-200 rounded" />
                            <div className="h-2 bg-gray-200 rounded" />
                            <div className="h-2 bg-gray-200 rounded" />
                          </div>
                        </div>
                      </div>
                      {/* PDF badge */}
                      <div className="absolute -bottom-1 -right-1 px-1.5 py-0.5 bg-gradient-to-r from-red-500 to-rose-500 rounded text-[9px] font-bold text-white shadow-lg">
                        PDF
                      </div>
                    </div>
                  </div>

                  {/* Info text */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Professional report with floor plan & stats</span>
                    </div>
                  </div>
                </div>

                {/* What's included */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 5H7a2 2 0 00-2 2v12a2 2 0 002 2h10a2 2 0 002-2V7a2 2 0 00-2-2h-2M9 5a2 2 0 002 2h2a2 2 0 002-2M9 5a2 2 0 012-2h2a2 2 0 012 2" />
                    </svg>
                    <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Included</span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { label: 'Floor Plan Image', desc: 'High-resolution diagram' },
                      { label: 'Project Statistics', desc: 'Walls, rooms, areas' },
                      { label: 'Export Date', desc: 'Timestamp for records' },
                    ].map((item, i) => (
                      <div
                        key={i}
                        className="flex items-center gap-3 p-3 rounded-xl bg-[var(--color-bg-secondary)]"
                      >
                        <div className="w-8 h-8 rounded-lg bg-gradient-to-br from-red-500/20 to-rose-500/20 flex items-center justify-center">
                          <svg className="w-4 h-4 text-red-400" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                          </svg>
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">{item.label}</div>
                          <div className="text-[11px] text-[var(--color-text-muted)]">{item.desc}</div>
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* Export Button */}
                <button
                  style={{ marginTop: '12px' }}
                  onClick={handlePdfExport}
                  disabled={!canExport || isExportingPdf}
                  className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    canExport && !isExportingPdf
                      ? 'bg-gradient-to-r from-red-500 to-rose-500 hover:opacity-90 text-white shadow-lg shadow-red-500/20'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-not-allowed'
                  }`}
                >
                  {isExportingPdf ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Generating PDF...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4" />
                      </svg>
                      <span>Download PDF Report</span>
                    </>
                  )}
                </button>

                {/* Help text */}
                {!canExport && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-amber-200">
                      Define land or add walls to generate PDF
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 3D VIEW / SCREENSHOT Section */}
            {activeSection === 'screenshot' && (
              <div className="space-y-5">
                {/* Preview area */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-bg-elevated)] to-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="p-5 flex items-center justify-center">
                    <div className="relative w-full aspect-video max-w-[200px] rounded-lg overflow-hidden bg-[var(--color-bg-primary)] border border-[var(--color-border)]">
                      {/* 3D scene preview illustration */}
                      <svg viewBox="0 0 160 90" className="w-full h-full">
                        {/* Sky gradient */}
                        <defs>
                          <linearGradient id="skyGrad" x1="0%" y1="0%" x2="0%" y2="100%">
                            <stop offset="0%" stopColor="#60a5fa" />
                            <stop offset="100%" stopColor="#93c5fd" />
                          </linearGradient>
                        </defs>
                        <rect x="0" y="0" width="160" height="50" fill="url(#skyGrad)" />
                        {/* Ground */}
                        <rect x="0" y="50" width="160" height="40" fill="#22c55e" />
                        {/* Grid lines on ground */}
                        <g opacity="0.3">
                          {[...Array(8)].map((_, i) => (
                            <line key={`gh${i}`} x1="0" y1={50 + i * 5} x2="160" y2={50 + i * 5} stroke="#16a34a" strokeWidth="0.5" />
                          ))}
                        </g>
                        {/* Simple house shape */}
                        <rect x="50" y="35" width="60" height="30" fill="#e5e7eb" stroke="#9ca3af" strokeWidth="1" />
                        <polygon points="50,35 80,20 110,35" fill="#ef4444" stroke="#dc2626" strokeWidth="1" />
                        {/* Door */}
                        <rect x="70" y="50" width="10" height="15" fill="#78716c" />
                        {/* Windows */}
                        <rect x="55" y="42" width="10" height="10" fill="#60a5fa" stroke="#3b82f6" strokeWidth="0.5" />
                        <rect x="95" y="42" width="10" height="10" fill="#60a5fa" stroke="#3b82f6" strokeWidth="0.5" />
                      </svg>
                      {/* View mode badge */}
                      <div className="absolute top-1.5 left-1.5 px-1.5 py-0.5 bg-black/50 rounded text-[8px] font-medium text-white">
                        {viewMode === 'firstPerson' ? '1P' : viewMode === '2d' ? '2D' : '3D'}
                      </div>
                    </div>
                  </div>

                  {/* Info row */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Captures your current view</span>
                    </div>
                  </div>
                </div>

                {/* Options */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Options</span>
                  </div>

                  {/* Format selector */}
                  <div className="mb-3">
                    <label className="text-xs text-[var(--color-text-muted)] mb-2 block">Format</label>
                    <div className="grid grid-cols-2 gap-2">
                      {['png', 'jpeg'].map((fmt) => (
                        <button
                          key={fmt}
                          onClick={() => setScreenshotFormat(fmt)}
                          className={`p-2.5 rounded-xl text-xs font-medium transition-all ${
                            screenshotFormat === fmt
                              ? 'bg-[var(--color-accent)] text-white'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
                          }`}
                        >
                          {fmt.toUpperCase()}
                        </button>
                      ))}
                    </div>
                  </div>

                  {/* Resolution selector */}
                  <div className="mb-3">
                    <label className="text-xs text-[var(--color-text-muted)] mb-2 block">Resolution</label>
                    <div className="grid grid-cols-3 gap-2">
                      {[
                        { scale: 1, label: '1×', desc: 'Standard' },
                        { scale: 2, label: '2×', desc: 'High' },
                        { scale: 4, label: '4×', desc: 'Ultra' },
                      ].map((opt) => (
                        <button
                          key={opt.scale}
                          onClick={() => setScreenshotScale(opt.scale)}
                          className={`p-2 rounded-xl text-center transition-all ${
                            screenshotScale === opt.scale
                              ? 'bg-[var(--color-accent)] text-white'
                              : 'bg-[var(--color-bg-secondary)] text-[var(--color-text-secondary)] hover:bg-[var(--color-bg-elevated)]'
                          }`}
                        >
                          <div className="text-sm font-bold">{opt.label}</div>
                          <div className="text-[9px] opacity-70">{opt.desc}</div>
                        </button>
                      ))}
                    </div>
                  </div>
                </div>

                {/* Capture Button */}
                <button
                  style={{ marginTop: '12px' }}
                  onClick={handleScreenshot}
                  disabled={isCapturing || viewMode === '2d'}
                  className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    !isCapturing && viewMode !== '2d'
                      ? 'bg-gradient-to-r from-violet-500 to-purple-500 hover:opacity-90 text-white shadow-lg shadow-violet-500/20'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-not-allowed'
                  }`}
                >
                  {isCapturing ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Capturing...</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6.827 6.175A2.31 2.31 0 015.186 7.23c-.38.054-.757.112-1.134.175C2.999 7.58 2.25 8.507 2.25 9.574V18a2.25 2.25 0 002.25 2.25h15A2.25 2.25 0 0021.75 18V9.574c0-1.067-.75-1.994-1.802-2.169a47.865 47.865 0 00-1.134-.175 2.31 2.31 0 01-1.64-1.055l-.822-1.316a2.192 2.192 0 00-1.736-1.039 48.774 48.774 0 00-5.232 0 2.192 2.192 0 00-1.736 1.039l-.821 1.316z" />
                        <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 12.75a4.5 4.5 0 11-9 0 4.5 4.5 0 019 0z" />
                      </svg>
                      <span>Capture Screenshot</span>
                    </>
                  )}
                </button>

                {/* 2D mode warning */}
                {viewMode === '2d' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-amber-200">
                      Switch to 3D or 1P view to capture
                    </p>
                  </div>
                )}
              </div>
            )}

            {/* 3D MODEL Export Section */}
            {activeSection === 'model' && (
              <div className="space-y-5">
                {/* Preview area */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-bg-elevated)] to-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="p-5 flex items-center justify-center">
                    <div className="relative">
                      {/* 3D cube illustration */}
                      <svg viewBox="0 0 120 120" className="w-32 h-32">
                        {/* Back face */}
                        <polygon
                          points="60,15 100,35 100,85 60,105 20,85 20,35"
                          fill="none"
                          stroke="currentColor"
                          strokeWidth="1"
                          className="text-[var(--color-border)]"
                        />
                        {/* Top face */}
                        <polygon
                          points="60,15 100,35 60,55 20,35"
                          fill="rgba(59, 130, 246, 0.2)"
                          stroke="#3b82f6"
                          strokeWidth="1.5"
                        />
                        {/* Left face */}
                        <polygon
                          points="20,35 60,55 60,105 20,85"
                          fill="rgba(139, 92, 246, 0.2)"
                          stroke="#8b5cf6"
                          strokeWidth="1.5"
                        />
                        {/* Right face */}
                        <polygon
                          points="60,55 100,35 100,85 60,105"
                          fill="rgba(16, 185, 129, 0.2)"
                          stroke="#10b981"
                          strokeWidth="1.5"
                        />
                        {/* Vertices */}
                        <circle cx="60" cy="15" r="3" fill="#3b82f6" />
                        <circle cx="100" cy="35" r="3" fill="#3b82f6" />
                        <circle cx="20" cy="35" r="3" fill="#8b5cf6" />
                        <circle cx="60" cy="55" r="3" fill="#10b981" />
                        <circle cx="100" cy="85" r="3" fill="#10b981" />
                        <circle cx="20" cy="85" r="3" fill="#8b5cf6" />
                        <circle cx="60" cy="105" r="3" fill="#8b5cf6" />
                      </svg>
                      {/* Format badge */}
                      <div className="absolute -bottom-1 -right-1 px-2 py-1 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg text-[10px] font-bold text-white shadow-lg uppercase">
                        {modelFormat}
                      </div>
                    </div>
                  </div>

                  {/* Info row */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Use in Blender, SketchUp, Unity, etc.</span>
                    </div>
                  </div>
                </div>

                {/* Format selector */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6V4m0 2a2 2 0 100 4m0-4a2 2 0 110 4m-6 8a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4m6 6v10m6-2a2 2 0 100-4m0 4a2 2 0 110-4m0 4v2m0-6V4" />
                    </svg>
                    <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Format</span>
                  </div>

                  <div className="space-y-2">
                    {[
                      { id: 'glb', label: 'GLB', desc: 'Binary GLTF - Recommended', color: 'from-blue-500 to-cyan-500' },
                      { id: 'gltf', label: 'GLTF', desc: 'JSON format - Editable', color: 'from-purple-500 to-pink-500' },
                      { id: 'obj', label: 'OBJ', desc: 'Universal compatibility', color: 'from-orange-500 to-amber-500' },
                    ].map((fmt) => (
                      <button
                        key={fmt.id}
                        onClick={() => setModelFormat(fmt.id)}
                        className={`w-full p-3 rounded-xl text-left transition-all flex items-center gap-3 ${
                          modelFormat === fmt.id
                            ? 'bg-[var(--color-bg-elevated)] border-2 border-[var(--color-accent)]'
                            : 'bg-[var(--color-bg-secondary)] border-2 border-transparent hover:bg-[var(--color-bg-elevated)]'
                        }`}
                      >
                        <div className={`w-10 h-10 rounded-lg bg-gradient-to-br ${fmt.color} flex items-center justify-center text-white text-xs font-bold`}>
                          {fmt.label}
                        </div>
                        <div className="flex-1">
                          <div className="text-sm font-medium text-[var(--color-text-primary)]">{fmt.label}</div>
                          <div className="text-[11px] text-[var(--color-text-muted)]">{fmt.desc}</div>
                        </div>
                        {modelFormat === fmt.id && (
                          <svg className="w-5 h-5 text-[var(--color-accent)]" fill="currentColor" viewBox="0 0 20 20">
                            <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                          </svg>
                        )}
                      </button>
                    ))}
                  </div>
                </div>

                {/* Export Button */}
                <button
                  style={{ marginTop: '12px' }}
                  onClick={handleModelExport}
                  disabled={isExportingModel || !canExport}
                  className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    !isExportingModel && canExport
                      ? 'bg-gradient-to-r from-blue-500 to-purple-500 hover:opacity-90 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-not-allowed'
                  }`}
                >
                  {isExportingModel ? (
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
                      <span>Export 3D Model</span>
                    </>
                  )}
                </button>

                {/* Help text */}
                {!canExport && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-amber-200">
                      Add walls or buildings to export
                    </p>
                  </div>
                )}

                {/* Compatibility info */}
                <div className="p-3 rounded-xl bg-[var(--color-bg-secondary)]">
                  <div className="text-[11px] font-medium text-[var(--color-text-muted)] mb-2">Compatible with:</div>
                  <div className="flex flex-wrap gap-1.5">
                    {['Blender', 'SketchUp', 'Unity', 'Unreal', 'Cinema 4D', '3ds Max'].map((app) => (
                      <span
                        key={app}
                        className="px-2 py-0.5 rounded-full bg-[var(--color-bg-elevated)] text-[10px] text-[var(--color-text-secondary)]"
                      >
                        {app}
                      </span>
                    ))}
                  </div>
                </div>
              </div>
            )}

            {/* AI RENDER Section */}
            {activeSection === 'airender' && (
              <div className="space-y-5">
                {/* Preview area */}
                <div className="relative overflow-hidden rounded-2xl bg-gradient-to-br from-[var(--color-bg-elevated)] to-[var(--color-bg-secondary)] border border-[var(--color-border)]">
                  <div className="p-5 flex items-center justify-center">
                    {aiRenderResult ? (
                      <div
                        className="relative w-full aspect-square max-w-[200px] rounded-lg overflow-hidden cursor-pointer hover:opacity-90 transition-opacity"
                        onClick={() => onShowAiRender?.()}
                      >
                        <img
                          src={`data:image/png;base64,${aiRenderResult}`}
                          alt="AI Render"
                          className="w-full h-full object-cover"
                        />
                        <div className="absolute inset-0 flex items-center justify-center bg-black/0 hover:bg-black/30 transition-colors">
                          <svg className="w-8 h-8 text-white opacity-0 hover:opacity-100 transition-opacity" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M21 21l-5.197-5.197m0 0A7.5 7.5 0 105.196 5.196a7.5 7.5 0 0010.607 10.607zM10.5 7.5v6m3-3h-6" />
                          </svg>
                        </div>
                      </div>
                    ) : (
                      <div className="relative w-full aspect-square max-w-[200px]">
                        {/* AI visualization placeholder */}
                        <div className="absolute inset-0 rounded-lg bg-gradient-to-br from-purple-900/40 to-pink-900/40 border border-purple-500/20 flex flex-col items-center justify-center gap-3">
                          <svg className="w-12 h-12 text-purple-400/60" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                          </svg>
                          <span className="text-xs text-purple-300/60 font-medium">AI Photorealistic Render</span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* Info row */}
                  <div className="px-4 pb-4">
                    <div className="flex items-center gap-2 text-xs text-[var(--color-text-muted)]">
                      <svg className="w-3.5 h-3.5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                      </svg>
                      <span>Transforms your 3D view into a photo</span>
                    </div>
                  </div>
                </div>

                {/* Style selector */}
                <div>
                  <div className="flex items-center gap-2 mb-3">
                    <svg className="w-3.5 h-3.5 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4.098 19.902a3.75 3.75 0 005.304 0l6.401-6.402M6.75 21A3.75 3.75 0 013 17.25V4.125C3 3.504 3.504 3 4.125 3h5.25c.621 0 1.125.504 1.125 1.125v4.072M6.75 21a3.75 3.75 0 003.75-3.75V8.197M6.75 21h13.125c.621 0 1.125-.504 1.125-1.125v-5.25c0-.621-.504-1.125-1.125-1.125h-4.072M10.5 8.197l2.88-2.88c.438-.439 1.15-.439 1.59 0l3.712 3.713c.44.44.44 1.152 0 1.59l-2.879 2.88M6.75 17.25h.008v.008H6.75v-.008z" />
                    </svg>
                    <span className="text-[11px] font-semibold text-[var(--color-text-muted)] uppercase tracking-wider">Style</span>
                  </div>

                  <div className="grid grid-cols-2 gap-2">
                    {[
                      { id: 'modern', label: 'Modern', desc: 'Clean & minimal' },
                      { id: 'traditional', label: 'Traditional', desc: 'Classic & warm' },
                      { id: 'minimalist', label: 'Minimalist', desc: 'Pure & simple' },
                      { id: 'rustic', label: 'Rustic', desc: 'Natural & cozy' },
                    ].map((style) => (
                      <button
                        key={style.id}
                        onClick={() => setAiStyle(style.id)}
                        className={`p-3 rounded-xl text-left transition-all ${
                          aiStyle === style.id
                            ? 'bg-gradient-to-br from-purple-500/20 to-pink-500/20 border-2 border-purple-500/50'
                            : 'bg-[var(--color-bg-secondary)] border-2 border-transparent hover:bg-[var(--color-bg-elevated)]'
                        }`}
                      >
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">{style.label}</div>
                        <div className="text-[10px] text-[var(--color-text-muted)]">{style.desc}</div>
                      </button>
                    ))}
                  </div>
                </div>

                {/* Generate Button */}
                <button
                  style={{ marginTop: '12px' }}
                  onClick={() => onAiVisualize?.({ style: aiStyle })}
                  disabled={isGeneratingAI || viewMode === '2d'}
                  className={`w-full py-3.5 rounded-xl font-semibold text-sm transition-all flex items-center justify-center gap-2 ${
                    !isGeneratingAI && viewMode !== '2d'
                      ? 'bg-gradient-to-r from-purple-500 to-pink-500 hover:opacity-90 text-white shadow-lg shadow-purple-500/20'
                      : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] cursor-not-allowed'
                  }`}
                >
                  {isGeneratingAI ? (
                    <>
                      <svg className="w-4 h-4 animate-spin" viewBox="0 0 24 24" fill="none">
                        <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                        <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                      </svg>
                      <span>Generating... (15-30s)</span>
                    </>
                  ) : (
                    <>
                      <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09z" />
                      </svg>
                      <span>Generate AI Render</span>
                      {!isPaidUser && (
                        <span className="px-1.5 py-0.5 text-[9px] font-bold bg-amber-400 text-amber-900 rounded-full">PRO</span>
                      )}
                    </>
                  )}
                </button>

                {/* Time estimate */}
                {!isGeneratingAI && viewMode !== '2d' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-purple-500/10 border border-purple-500/20">
                    <svg className="w-4 h-4 text-purple-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-purple-200">
                      Takes 15-30 seconds to generate
                    </p>
                  </div>
                )}

                {/* 2D mode warning */}
                {viewMode === '2d' && (
                  <div className="flex items-center gap-2 p-3 rounded-xl bg-amber-500/10 border border-amber-500/20">
                    <svg className="w-4 h-4 text-amber-400 flex-shrink-0" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <p className="text-xs text-amber-200">
                      Switch to 3D or 1P view to generate
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>
    </div>
  )
}
