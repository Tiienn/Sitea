import { useState, useEffect, useRef } from 'react'
import { PRESETS } from '../data/presets'
import { placePreset } from '../utils/presetPlacer'
import { analyzeImage } from '../services/imageAnalysis'
import { useUser } from '../hooks/useUser.jsx'

// Confidence threshold for auto-routing
const AUTO_ROUTE_THRESHOLD = 0.7

// Coverage thresholds (percentage)
const COVERAGE_THRESHOLDS = { green: 20, yellow: 40 }

// Get coverage color class
const getCoverageColorClass = (percent) => {
  if (percent < COVERAGE_THRESHOLDS.green) return 'green'
  if (percent < COVERAGE_THRESHOLDS.yellow) return 'yellow'
  return 'red'
}

// Section definitions with icons
const SECTIONS = [
  { id: 'tools', label: 'Tools', icon: 'hammer' },
  { id: 'structures', label: 'Structures', icon: 'home' },
  { id: 'presets', label: 'Quick Presets', icon: 'zap' },
  { id: 'coverage', label: 'Coverage', icon: 'chart' },
  { id: 'setbacks', label: 'Setbacks', icon: 'ruler' },
  { id: 'upload', label: 'Upload', icon: 'upload' },
  { id: 'labels', label: 'Labels', icon: 'tag' },
]

// Icon components (Lucide-style)
const Icons = {
  upload: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  hammer: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.42 15.17L17.25 21A2.652 2.652 0 0021 17.25l-5.877-5.877M11.42 15.17l2.496-3.03c.317-.384.74-.626 1.208-.766M11.42 15.17l-4.655 5.653a2.548 2.548 0 11-3.586-3.586l6.837-5.63m5.108-.233c.55-.164 1.163-.188 1.743-.14a4.5 4.5 0 004.486-6.336l-3.276 3.277a3.004 3.004 0 01-2.25-2.25l3.276-3.276a4.5 4.5 0 00-6.336 4.486c.091 1.076-.071 2.264-.904 2.95l-.102.085m-1.745 1.437L5.909 7.5H4.5L2.25 3.75l1.5-1.5L7.5 4.5v1.409l4.26 4.26m-1.745 1.437l1.745-1.437m6.615 8.206L15.75 15.75M4.867 19.125h.008v.008h-.008v-.008z" />
    </svg>
  ),
  home: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
    </svg>
  ),
  zap: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 13.5l10.5-11.25L12 10.5h8.25L9.75 21.75 12 13.5H3.75z" />
    </svg>
  ),
  chart: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3 13.125C3 12.504 3.504 12 4.125 12h2.25c.621 0 1.125.504 1.125 1.125v6.75C7.5 20.496 6.996 21 6.375 21h-2.25A1.125 1.125 0 013 19.875v-6.75zM9.75 8.625c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125v11.25c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V8.625zM16.5 4.125c0-.621.504-1.125 1.125-1.125h2.25C20.496 3 21 3.504 21 4.125v15.75c0 .621-.504 1.125-1.125 1.125h-2.25a1.125 1.125 0 01-1.125-1.125V4.125z" />
    </svg>
  ),
  ruler: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  ),
  tag: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.568 3H5.25A2.25 2.25 0 003 5.25v4.318c0 .597.237 1.17.659 1.591l9.581 9.581c.699.699 1.78.872 2.607.33a18.095 18.095 0 005.223-5.223c.542-.827.369-1.908-.33-2.607L11.16 3.66A2.25 2.25 0 009.568 3z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 6h.008v.008H6V6z" />
    </svg>
  ),
  close: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
    </svg>
  ),
}

export default function BuildPanel({
  canEdit,
  selectedBuilding,
  setSelectedBuilding,
  buildingRotation,
  setBuildingRotation,
  placedBuildings,
  setPlacedBuildings,
  setbacksEnabled,
  setSetbacksEnabled,
  setbackDistanceM,
  setSetbackDistanceM,
  gridSnapEnabled,
  setGridSnapEnabled,
  labels,
  setLabels,
  coveragePercent,
  coverageAreaM2,
  landArea,
  overlappingCount,
  formatArea,
  areaUnit,
  lengthUnit,
  FEET_PER_METER,
  BUILDING_TYPES,
  polygon,
  onClosePanel,
  onExpandedChange,
  isActive,
  walls = [],
  wallDrawingMode = false,
  setWallDrawingMode,
  clearAllWalls,
  openingPlacementMode = 'none',
  setOpeningPlacementMode,
  BUILD_TOOLS = {},
  activeBuildTool = 'none',
  setActiveBuildTool,
  selectedElement,
  setSelectedElement,
  doorWidth = 0.9,
  setDoorWidth,
  doorHeight = 2.1,
  setDoorHeight,
  windowWidth = 1.2,
  setWindowWidth,
  windowHeight = 1.2,
  setWindowHeight,
  windowSillHeight = 0.9,
  setWindowSillHeight,
  rooms = [],
  onUndo,
  onRedo,
  canUndo = false,
  canRedo = false,
  floorPlanImage,
  floorPlanSettings,
  setFloorPlanSettings,
  setFloorPlanImage,
  onRemoveFloorPlan,
  onDetectedSitePlan, // Called when site plan is detected
  onOpenFloorPlanGenerator, // Called to open AI floor plan generator
}) {
  const { isPaidUser } = useUser()
  const [activeSection, setActiveSection] = useState('tools')
  const [presetToast, setPresetToast] = useState(null)

  // Upload state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingImage, setPendingImage] = useState(null)
  const [detectedType, setDetectedType] = useState(null)
  const fileInputRef = useRef(null)

  // Report expanded state when becoming active or when section changes
  useEffect(() => {
    if (isActive) {
      onExpandedChange?.(activeSection !== null)
    }
  }, [activeSection, onExpandedChange, isActive])

  // Handle section click - toggle if same, switch if different
  const handleSectionClick = (sectionId) => {
    if (activeSection === sectionId) {
      setActiveSection(null)
    } else {
      setActiveSection(sectionId)
    }
  }

  // Handle preset button click
  const handlePresetClick = (presetId) => {
    if (!canEdit || !polygon) return

    const setbackM = setbacksEnabled ? setbackDistanceM : 0
    const result = placePreset(presetId, polygon, setbackM, BUILDING_TYPES)

    if (result.success) {
      setPlacedBuildings(prev => [...prev, ...result.buildings])
      setPresetToast('success')
    } else {
      setPresetToast('error')
    }

    setTimeout(() => setPresetToast(null), 2000)
  }

  // Format dimension for display
  const formatDimension = (meters) => {
    if (lengthUnit === 'ft') {
      return `${Math.round(meters * FEET_PER_METER)}ft`
    }
    return `${meters}m`
  }

  // Handle file upload with auto-detection
  const handleFileUpload = async (file) => {
    if (!file) return

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
    if (!validTypes.includes(file.type)) {
      alert('Please upload a PNG, JPG, or PDF file')
      return
    }

    // PDF not yet supported
    if (file.type === 'application/pdf') {
      alert('PDF support coming soon. Please use PNG or JPG for now.')
      return
    }

    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageData = e.target.result
      setPendingImage(imageData)
      setIsAnalyzing(true)

      try {
        const result = await analyzeImage(imageData, isPaidUser)

        if (result.confidence >= AUTO_ROUTE_THRESHOLD) {
          // High confidence - auto-route
          if (result.type === 'floor-plan') {
            // Open AI generator modal for floor plans
            onOpenFloorPlanGenerator?.(imageData)
          } else {
            onDetectedSitePlan?.(imageData)
          }
          setPendingImage(null)
        } else {
          // Low confidence - show confirmation
          setDetectedType(result.type)
          setShowConfirm(true)
        }
      } catch (err) {
        console.error('Analysis failed:', err)
        // Fallback: open generator modal (we're in Build panel, assume floor plan)
        onOpenFloorPlanGenerator?.(imageData)
        setPendingImage(null)
      }

      setIsAnalyzing(false)
    }
    reader.readAsDataURL(file)
  }

  // Confirm detected type (for low confidence)
  const confirmType = (type) => {
    if (type === 'floor-plan') {
      // Open AI generator modal for floor plans
      onOpenFloorPlanGenerator?.(pendingImage)
    } else {
      onDetectedSitePlan?.(pendingImage)
    }
    setShowConfirm(false)
    setPendingImage(null)
    setDetectedType(null)
  }

  const colorClass = getCoverageColorClass(coveragePercent)

  // Get current section data
  const currentSection = SECTIONS.find(s => s.id === activeSection)

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

            {/* UPLOAD Section */}
            {activeSection === 'upload' && (
              <div className="space-y-4">
                {!floorPlanImage && !isAnalyzing && !showConfirm ? (
                  <>
                    {/* Direct Upload Zone */}
                    <div
                      onClick={() => fileInputRef.current?.click()}
                      onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                      onDragLeave={() => setIsDragging(false)}
                      onDrop={(e) => {
                        e.preventDefault()
                        setIsDragging(false)
                        handleFileUpload(e.dataTransfer.files[0])
                      }}
                      className={`
                        cursor-pointer rounded-xl border-2 border-dashed p-8
                        transition-all duration-200
                        ${isDragging
                          ? 'border-[var(--color-accent)] bg-[var(--color-accent)]/10 scale-[1.02]'
                          : 'border-[var(--color-border)] hover:border-[var(--color-accent)]/50 hover:bg-white/5'
                        }
                      `}
                    >
                      <input
                        ref={fileInputRef}
                        type="file"
                        accept="image/png,image/jpeg,image/jpg,application/pdf"
                        onChange={(e) => handleFileUpload(e.target.files?.[0])}
                        className="hidden"
                      />
                      <div className="flex flex-col items-center justify-center text-center">
                        <div className={`w-12 h-12 rounded-full mb-3 flex items-center justify-center transition-all ${isDragging ? 'bg-[var(--color-accent)]/20' : 'bg-[var(--color-bg-elevated)]'}`}>
                          <svg className={`w-6 h-6 ${isDragging ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                          </svg>
                        </div>
                        <p className="text-white text-sm font-medium mb-1">
                          {isDragging ? 'Drop your file here' : 'Upload your plan'}
                        </p>
                        <p className="text-[var(--color-text-muted)] text-xs">PNG, JPG, or PDF</p>
                      </div>
                    </div>

                    {/* Plan type descriptions */}
                    <div className="space-y-2 mt-2">
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-[var(--color-bg-elevated)]">
                        <svg className="w-4 h-4 mt-0.5 text-green-400 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                        </svg>
                        <div>
                          <p className="text-xs font-medium text-white">Site Plan</p>
                          <p className="text-xs text-[var(--color-text-muted)]">Outdoor land boundaries, property lines, lot surveys</p>
                        </div>
                      </div>
                      <div className="flex items-start gap-2 p-2 rounded-lg bg-[var(--color-bg-elevated)]">
                        <svg className="w-4 h-4 mt-0.5 text-[var(--color-accent)] flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                          <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                        </svg>
                        <div>
                          <p className="text-xs font-medium text-white">Floor Plan</p>
                          <p className="text-xs text-[var(--color-text-muted)]">Interior room layouts, building blueprints, architectural plans</p>
                        </div>
                      </div>
                    </div>

                    {/* Auto-detection indicator */}
                    <p className="text-xs text-center text-[var(--color-text-muted)] mt-3">
                      {isPaidUser ? 'AI-powered detection' : 'Smart auto-detection'}
                    </p>
                  </>
                ) : isAnalyzing ? (
                  /* Analyzing State */
                  <div className="py-8 text-center">
                    {pendingImage && (
                      <div className="w-24 h-24 mx-auto mb-4 rounded-xl overflow-hidden bg-[var(--color-bg-elevated)]">
                        <img src={pendingImage} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <div className="w-8 h-8 mx-auto mb-3 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>
                    <p className="text-white text-sm font-medium">Analyzing...</p>
                    <p className="text-[var(--color-text-muted)] text-xs">Detecting plan type</p>
                  </div>
                ) : showConfirm ? (
                  /* Low Confidence Confirmation */
                  <div className="text-center">
                    {pendingImage && (
                      <div className="w-24 h-24 mx-auto mb-4 rounded-xl overflow-hidden bg-[var(--color-bg-elevated)]">
                        <img src={pendingImage} alt="Preview" className="w-full h-full object-cover" />
                      </div>
                    )}
                    <p className="text-white text-sm font-medium mb-1">
                      Detected: <span className={detectedType === 'site-plan' ? 'text-green-400' : 'text-[var(--color-accent)]'}>
                        {detectedType === 'site-plan' ? 'Site Plan' : 'Floor Plan'}
                      </span>
                    </p>
                    <p className="text-[var(--color-text-muted)] text-xs mb-4">Is that correct?</p>
                    <div className="flex gap-2">
                      <button
                        onClick={() => confirmType('site-plan')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${detectedType === 'site-plan' ? 'bg-green-600 hover:bg-green-500 text-white' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-white/10'}`}
                      >
                        Site Plan
                      </button>
                      <button
                        onClick={() => confirmType('floor-plan')}
                        className={`flex-1 py-2 rounded-lg text-sm font-medium transition-all ${detectedType === 'floor-plan' ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]' : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] hover:bg-white/10'}`}
                      >
                        Floor Plan
                      </button>
                    </div>
                    <button
                      onClick={() => { setShowConfirm(false); setPendingImage(null); setDetectedType(null) }}
                      className="mt-3 text-[var(--color-text-muted)] text-xs hover:text-white transition-colors"
                    >
                      Upload different image
                    </button>
                  </div>
                ) : (
                  /* Floor Plan Controls (when image is loaded) */
                  <div className="space-y-3">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-medium text-[var(--color-text-primary)]">Floor Plan</span>
                      <div className="flex items-center gap-1">
                        <button
                          onClick={() => setFloorPlanSettings(prev => ({ ...prev, visible: !prev.visible }))}
                          className={`p-1.5 rounded-lg transition-colors ${
                            floorPlanSettings.visible
                              ? 'bg-[var(--color-accent)] text-[var(--color-bg-primary)]'
                              : 'bg-white/10 text-[var(--color-text-muted)]'
                          }`}
                          title={floorPlanSettings.visible ? 'Hide' : 'Show'}
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            {floorPlanSettings.visible ? (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z" />
                            ) : (
                              <path strokeLinecap="round" strokeLinejoin="round" d="M13.875 18.825A10.05 10.05 0 0112 19c-4.478 0-8.268-2.943-9.543-7a9.97 9.97 0 011.563-3.029m5.858.908a3 3 0 114.243 4.243M9.878 9.878l4.242 4.242M9.88 9.88l-3.29-3.29m7.532 7.532l3.29 3.29M3 3l3.59 3.59m0 0A9.953 9.953 0 0112 5c4.478 0 8.268 2.943 9.543 7a10.025 10.025 0 01-4.132 5.411m0 0L21 21" />
                            )}
                          </svg>
                        </button>
                        <button
                          onClick={onRemoveFloorPlan}
                          className="p-1.5 rounded-lg bg-white/10 text-red-400 hover:bg-red-500/20 transition-colors"
                          title="Remove"
                        >
                          <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                            <path strokeLinecap="round" strokeLinejoin="round" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                          </svg>
                        </button>
                      </div>
                    </div>

                    {/* Opacity slider */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--color-text-muted)]">Opacity</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{Math.round(floorPlanSettings.opacity * 100)}%</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="0.8"
                        step="0.05"
                        value={floorPlanSettings.opacity}
                        onChange={(e) => setFloorPlanSettings(prev => ({ ...prev, opacity: parseFloat(e.target.value) }))}
                        className="w-full h-1.5 bg-[var(--color-bg-primary)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                      />
                    </div>

                    {/* Scale slider */}
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <span className="text-xs text-[var(--color-text-muted)]">Scale</span>
                        <span className="text-xs text-[var(--color-text-secondary)]">{floorPlanSettings.scale.toFixed(2)}x</span>
                      </div>
                      <input
                        type="range"
                        min="0.1"
                        max="3"
                        step="0.05"
                        value={floorPlanSettings.scale}
                        onChange={(e) => setFloorPlanSettings(prev => ({ ...prev, scale: parseFloat(e.target.value) }))}
                        className="w-full h-1.5 bg-[var(--color-bg-primary)] rounded-lg appearance-none cursor-pointer accent-[var(--color-accent)]"
                      />
                    </div>

                    {/* Position offsets */}
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--color-text-muted)]">Offset X</label>
                        <input
                          type="number"
                          value={floorPlanSettings.offsetX}
                          onChange={(e) => setFloorPlanSettings(prev => ({ ...prev, offsetX: parseFloat(e.target.value) || 0 }))}
                          step={0.5}
                          className="w-full px-2 py-1 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)]"
                        />
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--color-text-muted)]">Offset Z</label>
                        <input
                          type="number"
                          value={floorPlanSettings.offsetZ}
                          onChange={(e) => setFloorPlanSettings(prev => ({ ...prev, offsetZ: parseFloat(e.target.value) || 0 }))}
                          step={0.5}
                          className="w-full px-2 py-1 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)]"
                        />
                      </div>
                    </div>

                    <p className="text-[10px] text-[var(--color-text-muted)]">
                      Draw walls over the floor plan image
                    </p>

                    {/* Upload new button */}
                    <button
                      onClick={() => fileInputRef.current?.click()}
                      className="w-full py-2 text-xs text-[var(--color-text-muted)] hover:text-white transition-colors"
                    >
                      Upload different image
                    </button>
                  </div>
                )}
              </div>
            )}

            {/* TOOLS Section */}
            {activeSection === 'tools' && (
              <div className="space-y-4">
                {/* Tool Grid */}
                <div className="grid grid-cols-3 gap-2">
                  {/* Room Tool */}
                  <button
                    onClick={() => canEdit && setActiveBuildTool?.(activeBuildTool === BUILD_TOOLS.ROOM ? BUILD_TOOLS.NONE : BUILD_TOOLS.ROOM)}
                    disabled={!canEdit}
                    className={`tool-btn ${activeBuildTool === BUILD_TOOLS.ROOM ? 'active' : ''}`}
                  >
                    <span className="text-lg">🏠</span>
                    <span className="text-[10px]">Room</span>
                  </button>

                  {/* Wall Tool */}
                  <button
                    onClick={() => canEdit && setActiveBuildTool?.(activeBuildTool === BUILD_TOOLS.WALL ? BUILD_TOOLS.NONE : BUILD_TOOLS.WALL)}
                    disabled={!canEdit}
                    className={`tool-btn ${activeBuildTool === BUILD_TOOLS.WALL ? 'active' : ''}`}
                  >
                    <span className="text-lg">📐</span>
                    <span className="text-[10px]">Wall</span>
                  </button>

                  {/* Door Tool */}
                  <button
                    onClick={() => canEdit && setActiveBuildTool?.(activeBuildTool === BUILD_TOOLS.DOOR ? BUILD_TOOLS.NONE : BUILD_TOOLS.DOOR)}
                    disabled={!canEdit}
                    className={`tool-btn ${activeBuildTool === BUILD_TOOLS.DOOR ? 'active' : ''}`}
                  >
                    <span className="text-lg">🚪</span>
                    <span className="text-[10px]">Door</span>
                  </button>

                  {/* Window Tool */}
                  <button
                    onClick={() => canEdit && setActiveBuildTool?.(activeBuildTool === BUILD_TOOLS.WINDOW ? BUILD_TOOLS.NONE : BUILD_TOOLS.WINDOW)}
                    disabled={!canEdit}
                    className={`tool-btn ${activeBuildTool === BUILD_TOOLS.WINDOW ? 'active' : ''}`}
                  >
                    <span className="text-lg">🪟</span>
                    <span className="text-[10px]">Window</span>
                  </button>

                  {/* Select Tool */}
                  <button
                    onClick={() => canEdit && setActiveBuildTool?.(activeBuildTool === BUILD_TOOLS.SELECT ? BUILD_TOOLS.NONE : BUILD_TOOLS.SELECT)}
                    disabled={!canEdit}
                    className={`tool-btn ${activeBuildTool === BUILD_TOOLS.SELECT ? 'active' : ''}`}
                  >
                    <span className="text-lg">🔍</span>
                    <span className="text-[10px]">Select</span>
                  </button>

                  {/* Delete Tool */}
                  <button
                    onClick={() => canEdit && setActiveBuildTool?.(activeBuildTool === BUILD_TOOLS.DELETE ? BUILD_TOOLS.NONE : BUILD_TOOLS.DELETE)}
                    disabled={!canEdit}
                    className={`tool-btn ${activeBuildTool === BUILD_TOOLS.DELETE ? 'active' : ''} ${activeBuildTool === BUILD_TOOLS.DELETE ? '!bg-red-500/20 !border-red-500/50' : ''}`}
                  >
                    <span className="text-lg">🗑️</span>
                    <span className="text-[10px]">Delete</span>
                  </button>
                </div>

                {/* Undo/Redo Buttons */}
                <div className="flex gap-2 pt-2 border-t border-[var(--color-border)]">
                  <button
                    onClick={onUndo}
                    disabled={!canUndo}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                      canUndo
                        ? 'bg-[var(--color-bg-elevated)] hover:bg-white/10 text-[var(--color-text-primary)]'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] opacity-50 cursor-not-allowed'
                    }`}
                    title="Undo (Ctrl+Z)"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 10h10a5 5 0 0 1 5 5v2M3 10l4-4M3 10l4 4" />
                    </svg>
                    <span>Undo</span>
                  </button>
                  <button
                    onClick={onRedo}
                    disabled={!canRedo}
                    className={`flex-1 flex items-center justify-center gap-2 py-2 rounded-lg text-sm font-medium transition-colors ${
                      canRedo
                        ? 'bg-[var(--color-bg-elevated)] hover:bg-white/10 text-[var(--color-text-primary)]'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-muted)] opacity-50 cursor-not-allowed'
                    }`}
                    title="Redo (Ctrl+Shift+Z)"
                  >
                    <svg className="w-4 h-4" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21 10H11a5 5 0 0 0-5 5v2M21 10l-4-4M21 10l-4 4" />
                    </svg>
                    <span>Redo</span>
                  </button>
                </div>

                {/* Tool hint text */}
                <div className="text-xs text-[var(--color-text-muted)] text-center py-2">
                  {activeBuildTool === BUILD_TOOLS.NONE && 'Select a tool to start building'}
                  {activeBuildTool === BUILD_TOOLS.ROOM && 'Click and drag to draw a room'}
                  {activeBuildTool === BUILD_TOOLS.WALL && 'Click and drag to draw a wall'}
                  {activeBuildTool === BUILD_TOOLS.DOOR && 'Click on a wall to place a door'}
                  {activeBuildTool === BUILD_TOOLS.WINDOW && 'Click on a wall to place a window'}
                  {activeBuildTool === BUILD_TOOLS.SELECT && 'Click on an element to select it'}
                  {activeBuildTool === BUILD_TOOLS.DELETE && 'Click on an element to delete it'}
                </div>

                {/* Door Size Options */}
                {activeBuildTool === BUILD_TOOLS.DOOR && (
                  <div className="bg-[var(--color-bg-elevated)] rounded-xl p-3 space-y-3">
                    <div className="text-xs text-[var(--color-text-muted)] font-medium">Door Size</div>
                    <div className="grid grid-cols-2 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--color-text-muted)]">Width</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={doorWidth}
                            onChange={(e) => setDoorWidth?.(Math.max(0.6, Math.min(2.5, parseFloat(e.target.value) || 0.9)))}
                            step={0.1}
                            min={0.6}
                            max={2.5}
                            className="w-full px-2 py-1 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)]"
                          />
                          <span className="text-[10px] text-[var(--color-text-muted)]">m</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--color-text-muted)]">Height</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={doorHeight}
                            onChange={(e) => setDoorHeight?.(Math.max(1.8, Math.min(2.6, parseFloat(e.target.value) || 2.1)))}
                            step={0.1}
                            min={1.8}
                            max={2.6}
                            className="w-full px-2 py-1 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)]"
                          />
                          <span className="text-[10px] text-[var(--color-text-muted)]">m</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setDoorWidth?.(0.9); setDoorHeight?.(2.1); }}
                        className="flex-1 px-2 py-1 text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded hover:bg-white/10"
                      >
                        Standard
                      </button>
                      <button
                        onClick={() => { setDoorWidth?.(1.5); setDoorHeight?.(2.1); }}
                        className="flex-1 px-2 py-1 text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded hover:bg-white/10"
                      >
                        Double
                      </button>
                    </div>
                  </div>
                )}

                {/* Window Size Options */}
                {activeBuildTool === BUILD_TOOLS.WINDOW && (
                  <div className="bg-[var(--color-bg-elevated)] rounded-xl p-3 space-y-3">
                    <div className="text-xs text-[var(--color-text-muted)] font-medium">Window Size</div>
                    <div className="grid grid-cols-3 gap-2">
                      <div>
                        <label className="text-[10px] text-[var(--color-text-muted)]">Width</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={windowWidth}
                            onChange={(e) => setWindowWidth?.(Math.max(0.4, Math.min(3.0, parseFloat(e.target.value) || 1.2)))}
                            step={0.1}
                            min={0.4}
                            max={3.0}
                            className="w-full px-2 py-1 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)]"
                          />
                          <span className="text-[10px] text-[var(--color-text-muted)]">m</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--color-text-muted)]">Height</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={windowHeight}
                            onChange={(e) => setWindowHeight?.(Math.max(0.4, Math.min(2.0, parseFloat(e.target.value) || 1.2)))}
                            step={0.1}
                            min={0.4}
                            max={2.0}
                            className="w-full px-2 py-1 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)]"
                          />
                          <span className="text-[10px] text-[var(--color-text-muted)]">m</span>
                        </div>
                      </div>
                      <div>
                        <label className="text-[10px] text-[var(--color-text-muted)]">Sill</label>
                        <div className="flex items-center gap-1">
                          <input
                            type="number"
                            value={windowSillHeight}
                            onChange={(e) => setWindowSillHeight?.(Math.max(0, Math.min(2.0, parseFloat(e.target.value) || 0.9)))}
                            step={0.1}
                            min={0}
                            max={2.0}
                            className="w-full px-2 py-1 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded focus:outline-none focus:border-[var(--color-accent)]"
                          />
                          <span className="text-[10px] text-[var(--color-text-muted)]">m</span>
                        </div>
                      </div>
                    </div>
                    <div className="flex gap-1.5">
                      <button
                        onClick={() => { setWindowWidth?.(1.2); setWindowHeight?.(1.2); setWindowSillHeight?.(0.9); }}
                        className="flex-1 px-2 py-1 text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded hover:bg-white/10"
                      >
                        Standard
                      </button>
                      <button
                        onClick={() => { setWindowWidth?.(2.0); setWindowHeight?.(1.5); setWindowSillHeight?.(0.6); }}
                        className="flex-1 px-2 py-1 text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded hover:bg-white/10"
                      >
                        Large
                      </button>
                      <button
                        onClick={() => { setWindowWidth?.(0.6); setWindowHeight?.(0.6); setWindowSillHeight?.(1.5); }}
                        className="flex-1 px-2 py-1 text-[10px] bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded hover:bg-white/10"
                      >
                        High
                      </button>
                    </div>
                  </div>
                )}

                {/* Stats */}
                <div className="bg-[var(--color-bg-elevated)] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">Walls</span>
                    <span className="text-[var(--color-text-primary)] font-medium">{walls.length}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">Doors</span>
                    <span className="text-[var(--color-text-primary)] font-medium">
                      {walls.reduce((sum, w) => sum + (w.openings?.filter(o => o.type === 'door').length || 0), 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">Windows</span>
                    <span className="text-[var(--color-text-primary)] font-medium">
                      {walls.reduce((sum, w) => sum + (w.openings?.filter(o => o.type === 'window').length || 0), 0)}
                    </span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">Rooms</span>
                    <span className="text-[var(--color-text-primary)] font-medium">{rooms.length}</span>
                  </div>
                  {rooms.length > 0 && (
                    <div className="flex items-center justify-between text-sm pt-2 border-t border-[var(--color-border)]">
                      <span className="text-[var(--color-text-muted)]">Floor Area</span>
                      <span className="text-[var(--color-accent)] font-medium">
                        {rooms.reduce((sum, r) => sum + r.area, 0).toFixed(1)} m²
                      </span>
                    </div>
                  )}
                </div>

                {/* Clear all */}
                {walls.length > 0 && canEdit && (
                  <button
                    onClick={clearAllWalls}
                    className="w-full py-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear all walls
                  </button>
                )}
              </div>
            )}

            {/* STRUCTURES Section */}
            {activeSection === 'structures' && (
              <div className="space-y-2">
                {BUILDING_TYPES.map(building => (
                  <button
                    key={building.id}
                    onClick={() => {
                      if (!canEdit) return
                      const newSelection = selectedBuilding === building.id ? null : building.id
                      setSelectedBuilding(newSelection)
                    }}
                    disabled={!canEdit}
                    className={`structure-card w-full ${selectedBuilding === building.id ? 'selected' : ''}`}
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className="w-8 h-8 rounded-lg flex-shrink-0"
                        style={{ backgroundColor: building.color }}
                      />
                      <div className="text-left">
                        <div className="text-sm font-medium text-[var(--color-text-primary)]">{building.name}</div>
                        <div className="text-[11px] text-[var(--color-text-muted)]">
                          {formatDimension(building.width)} × {formatDimension(building.length)}
                        </div>
                      </div>
                    </div>
                  </button>
                ))}
                {selectedBuilding && canEdit && (
                  <>
                    {/* Rotation controls */}
                    <div className="mt-3 pt-3 border-t border-[var(--color-border)]">
                      <div className="text-xs text-[var(--color-text-muted)] mb-2">Rotation</div>
                      <div className="flex items-center gap-2">
                        <button
                          onClick={() => setBuildingRotation(prev => (prev - 15 + 360) % 360)}
                          className="flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:bg-white/15 transition-colors"
                        >
                          ↺ -15°
                        </button>
                        <span className="text-sm font-medium text-[var(--color-text-primary)] min-w-[40px] text-center">
                          {buildingRotation}°
                        </span>
                        <button
                          onClick={() => setBuildingRotation(prev => (prev + 15) % 360)}
                          className="flex-1 px-2 py-1.5 text-xs font-medium rounded-lg bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:bg-white/15 transition-colors"
                        >
                          ↻ +15°
                        </button>
                      </div>
                    </div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-2">
                      Click on land to place structure
                    </div>
                  </>
                )}
              </div>
            )}

            {/* PRESETS Section */}
            {activeSection === 'presets' && (
              <div className="space-y-3">
                {PRESETS.map(preset => (
                  <button
                    key={preset.id}
                    onClick={() => handlePresetClick(preset.id)}
                    disabled={!canEdit}
                    className={`w-full px-4 py-3 text-sm font-medium rounded-xl transition-colors text-left ${
                      !canEdit
                        ? 'bg-white/5 text-white/30 cursor-not-allowed'
                        : 'bg-[var(--color-bg-elevated)] text-[var(--color-text-primary)] hover:bg-white/15 border border-[var(--color-border)]'
                    }`}
                  >
                    {preset.name}
                  </button>
                ))}
                {presetToast && (
                  <div className={`text-xs ${presetToast === 'success' ? 'text-green-400' : 'text-orange-400'}`}>
                    {presetToast === 'success' ? 'Preset placed!' : "Doesn't fit — try larger plot or disable setbacks"}
                  </div>
                )}
              </div>
            )}

            {/* COVERAGE Section */}
            {activeSection === 'coverage' && (
              <div className="space-y-4">
                {/* Big percentage display */}
                <div className="text-center py-2">
                  <div className={`text-4xl font-display font-bold ${
                    colorClass === 'green' ? 'text-green-400' : colorClass === 'yellow' ? 'text-yellow-400' : 'text-red-400'
                  }`}>
                    {coveragePercent.toFixed(1)}%
                  </div>
                  <div className="text-xs text-[var(--color-text-muted)] mt-1">Land coverage</div>
                </div>

                {/* Progress bar */}
                <div className="coverage-bar">
                  <div
                    className={`coverage-bar-fill ${colorClass}`}
                    style={{ width: `${Math.min(coveragePercent, 100)}%` }}
                  />
                </div>

                {/* Stats */}
                <div className="bg-[var(--color-bg-elevated)] rounded-xl p-3 space-y-2">
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">Used</span>
                    <span className="text-[var(--color-text-primary)] font-medium">{formatArea(coverageAreaM2, areaUnit)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">Total</span>
                    <span className="text-[var(--color-text-primary)] font-medium">{formatArea(landArea, areaUnit)}</span>
                  </div>
                  <div className="flex items-center justify-between text-sm">
                    <span className="text-[var(--color-text-muted)]">Buildings</span>
                    <span className="text-[var(--color-text-primary)] font-medium">{placedBuildings.length}</span>
                  </div>
                  {overlappingCount > 0 && (
                    <div className="flex items-center justify-between text-sm">
                      <span className="text-orange-400">Overlaps</span>
                      <span className="text-orange-400 font-medium">{overlappingCount}</span>
                    </div>
                  )}
                </div>

                {placedBuildings.length > 0 && canEdit && (
                  <button
                    onClick={() => setPlacedBuildings([])}
                    className="w-full py-2 text-xs text-red-400 hover:text-red-300 transition-colors"
                  >
                    Clear all buildings
                  </button>
                )}
              </div>
            )}

            {/* SETBACKS Section */}
            {activeSection === 'setbacks' && (
              <div className="space-y-4">
                <div className="flex items-center justify-between">
                  <div>
                    <div className="text-sm text-[var(--color-text-primary)] font-medium">Boundary buffer</div>
                    <div className="text-xs text-[var(--color-text-muted)] mt-0.5">Keep structures away from edges</div>
                  </div>
                  <button
                    onClick={() => canEdit && setSetbacksEnabled(prev => !prev)}
                    disabled={!canEdit}
                    className={`toggle-switch ${setbacksEnabled ? 'active' : ''}`}
                  >
                    <span className="toggle-knob" />
                  </button>
                </div>

                {setbacksEnabled && (
                  <div className="bg-[var(--color-bg-elevated)] rounded-xl p-4">
                    <div className="text-xs text-[var(--color-text-muted)] mb-2">Buffer distance</div>
                    <div className="flex items-center gap-3">
                      <input
                        type="number"
                        value={lengthUnit === 'ft' ? (setbackDistanceM * FEET_PER_METER).toFixed(1) : setbackDistanceM.toFixed(1)}
                        onChange={(e) => {
                          if (!canEdit) return
                          const val = parseFloat(e.target.value) || 0
                          setSetbackDistanceM(lengthUnit === 'ft' ? val / FEET_PER_METER : val)
                        }}
                        disabled={!canEdit}
                        className="flex-1 px-3 py-2 text-lg font-medium bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg text-center focus:outline-none focus:border-[var(--color-accent)]"
                        min="0"
                        step="0.5"
                      />
                      <span className="text-sm text-[var(--color-text-muted)] w-8">{lengthUnit}</span>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* LABELS Section */}
            {activeSection === 'labels' && (
              <div className="space-y-3">
                <button
                  onClick={() => setLabels(prev => ({ ...prev, land: !prev.land }))}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                    labels.land
                      ? 'bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30'
                      : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]'
                  }`}
                >
                  <span className={`text-sm font-medium ${labels.land ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                    Land dimensions
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    labels.land ? 'border-[var(--color-accent)] bg-[var(--color-accent)]' : 'border-[var(--color-text-muted)]'
                  }`}>
                    {labels.land && (
                      <svg className="w-3 h-3 text-[var(--color-bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setLabels(prev => ({ ...prev, buildings: !prev.buildings }))}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                    labels.buildings
                      ? 'bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30'
                      : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]'
                  }`}
                >
                  <span className={`text-sm font-medium ${labels.buildings ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                    Building labels
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    labels.buildings ? 'border-[var(--color-accent)] bg-[var(--color-accent)]' : 'border-[var(--color-text-muted)]'
                  }`}>
                    {labels.buildings && (
                      <svg className="w-3 h-3 text-[var(--color-bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>

                <button
                  onClick={() => setLabels(prev => ({ ...prev, orientation: !prev.orientation }))}
                  className={`w-full flex items-center justify-between px-4 py-3 rounded-xl transition-colors ${
                    labels.orientation
                      ? 'bg-[var(--color-accent)]/15 border border-[var(--color-accent)]/30'
                      : 'bg-[var(--color-bg-elevated)] border border-[var(--color-border)]'
                  }`}
                >
                  <span className={`text-sm font-medium ${labels.orientation ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-primary)]'}`}>
                    Compass
                  </span>
                  <div className={`w-5 h-5 rounded-full border-2 flex items-center justify-center ${
                    labels.orientation ? 'border-[var(--color-accent)] bg-[var(--color-accent)]' : 'border-[var(--color-text-muted)]'
                  }`}>
                    {labels.orientation && (
                      <svg className="w-3 h-3 text-[var(--color-bg-primary)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={3}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M5 13l4 4L19 7" />
                      </svg>
                    )}
                  </div>
                </button>
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Collapse bar with arrow - at end of expanded panel */}
      {activeSection && (
        <button
          onClick={() => setActiveSection(null)}
          className="w-4 h-full flex items-center justify-center bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-elevated)] transition-colors cursor-pointer border-l border-[var(--color-border)]"
        >
          <svg className="w-4 h-4 text-[var(--color-text-muted)]" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M15 19l-7-7 7-7" />
          </svg>
        </button>
      )}
    </div>
  )
}
