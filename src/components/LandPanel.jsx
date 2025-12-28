import { useState, useEffect, useRef } from 'react'
import {
  LAND_TEMPLATES,
  areaToRectDims,
  formatTemplateArea,
  formatTemplateDims,
} from '../data/landTemplates'
import PolygonEditor, { calculatePolygonArea } from './PolygonEditor'
import ImageTracer from './ImageTracer'
import ShapeEditor from './ShapeEditor'
import { analyzeImage } from '../services/imageAnalysis'
import { useUser } from '../hooks/useUser.jsx'

// Confidence threshold for auto-routing
const AUTO_ROUTE_THRESHOLD = 0.7

// Section definitions with icons
const SECTIONS = [
  { id: 'rectangle', label: 'Rectangle', icon: 'rectangle' },
  { id: 'templates', label: 'Templates', icon: 'star' },
  { id: 'draw', label: 'Draw', icon: 'pencil' },
  { id: 'upload', label: 'Upload', icon: 'upload' },
  { id: 'edit', label: 'Edit', icon: 'edit' },
]

// Icon components
const Icons = {
  rectangle: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M3.75 3.75v4.5m0-4.5h4.5m-4.5 0L9 9M3.75 20.25v-4.5m0 4.5h4.5m-4.5 0L9 15M20.25 3.75h-4.5m4.5 0v4.5m0-4.5L15 9m5.25 11.25h-4.5m4.5 0v-4.5m0 4.5L15 15" />
    </svg>
  ),
  star: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M11.48 3.499a.562.562 0 011.04 0l2.125 5.111a.563.563 0 00.475.345l5.518.442c.499.04.701.663.321.988l-4.204 3.602a.563.563 0 00-.182.557l1.285 5.385a.562.562 0 01-.84.61l-4.725-2.885a.563.563 0 00-.586 0L6.982 20.54a.562.562 0 01-.84-.61l1.285-5.386a.562.562 0 00-.182-.557l-4.204-3.602a.563.563 0 01.321-.988l5.518-.442a.563.563 0 00.475-.345L11.48 3.5z" />
    </svg>
  ),
  pencil: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M16.862 4.487l1.687-1.688a1.875 1.875 0 112.652 2.652L6.832 19.82a4.5 4.5 0 01-1.897 1.13l-2.685.8.8-2.685a4.5 4.5 0 011.13-1.897L16.863 4.487zm0 0L19.5 7.125" />
    </svg>
  ),
  upload: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m6.75 12l-3-3m0 0l-3 3m3-3v6m-1.5-15H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
    </svg>
  ),
  edit: (
    <svg fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
      <path strokeLinecap="round" strokeLinejoin="round" d="M9.594 3.94c.09-.542.56-.94 1.11-.94h2.593c.55 0 1.02.398 1.11.94l.213 1.281c.063.374.313.686.645.87.074.04.147.083.22.127.324.196.72.257 1.075.124l1.217-.456a1.125 1.125 0 011.37.49l1.296 2.247a1.125 1.125 0 01-.26 1.431l-1.003.827c-.293.24-.438.613-.431.992a6.759 6.759 0 010 .255c-.007.378.138.75.43.99l1.005.828c.424.35.534.954.26 1.43l-1.298 2.247a1.125 1.125 0 01-1.369.491l-1.217-.456c-.355-.133-.75-.072-1.076.124a6.57 6.57 0 01-.22.128c-.331.183-.581.495-.644.869l-.213 1.28c-.09.543-.56.941-1.11.941h-2.594c-.55 0-1.02-.398-1.11-.94l-.213-1.281c-.062-.374-.312-.686-.644-.87a6.52 6.52 0 01-.22-.127c-.325-.196-.72-.257-1.076-.124l-1.217.456a1.125 1.125 0 01-1.369-.49l-1.297-2.247a1.125 1.125 0 01.26-1.431l1.004-.827c.292-.24.437-.613.43-.992a6.932 6.932 0 010-.255c.007-.378-.138-.75-.43-.99l-1.004-.828a1.125 1.125 0 01-.26-1.43l1.297-2.247a1.125 1.125 0 011.37-.491l1.216.456c.356.133.751.072 1.076-.124.072-.044.146-.087.22-.128.332-.183.582-.495.644-.869l.214-1.281z" />
      <path strokeLinecap="round" strokeLinejoin="round" d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
    </svg>
  ),
}

// Format area for display
const formatAreaDisplay = (sqMeters, lengthUnit) => {
  if (lengthUnit === 'ft') {
    const sqFt = sqMeters * 10.7639
    if (sqFt >= 43560) {
      return `${(sqFt / 43560).toFixed(2)} acres`
    }
    return `${sqFt.toFixed(0)} ft²`
  }
  if (sqMeters >= 10000) {
    return `${(sqMeters / 10000).toFixed(2)} ha`
  }
  return `${sqMeters.toFixed(0)} m²`
}

export default function LandPanel({
  dimensions,
  setDimensions,
  shapeMode,
  setShapeMode,
  polygonPoints,
  setPolygonPoints,
  confirmedPolygon,
  setConfirmedPolygon,
  uploadedImage,
  setUploadedImage,
  lengthUnit,
  setLengthUnit,
  onExpandedChange,
  isActive,
  onDetectedFloorPlan, // Called when floor plan is detected
}) {
  const { isPaidUser } = useUser()
  const [activeSection, setActiveSection] = useState('rectangle')
  const [localDimensions, setLocalDimensions] = useState({
    length: dimensions.length,
    width: dimensions.width
  })
  const [originalPolygon, setOriginalPolygon] = useState(null) // For edit reset
  const [editingPoints, setEditingPoints] = useState([]) // Points being edited

  // Upload state
  const [isAnalyzing, setIsAnalyzing] = useState(false)
  const [isDragging, setIsDragging] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [pendingImage, setPendingImage] = useState(null)
  const [detectedType, setDetectedType] = useState(null)
  const fileInputRef = useRef(null)

  // Report expanded state when becoming active
  useEffect(() => {
    if (isActive) {
      onExpandedChange?.(activeSection !== null)
    }
  }, [activeSection, onExpandedChange, isActive])

  // Sync local dimensions when props change
  useEffect(() => {
    setLocalDimensions({
      length: dimensions.length,
      width: dimensions.width
    })
  }, [dimensions])

  // Apply rectangle dimensions
  const handleApplyRectangle = () => {
    setDimensions(localDimensions)
    setShapeMode('rectangle')
    setConfirmedPolygon(null)
  }

  // Apply template
  const handleTemplateSelect = (template) => {
    if (template.polygon) {
      setConfirmedPolygon(template.polygon)
      setPolygonPoints(template.polygon)
      setShapeMode('polygon')
    } else {
      setDimensions({ length: template.length, width: template.width })
      setShapeMode('rectangle')
      setConfirmedPolygon(null)
    }
  }

  // Handle polygon complete
  const handlePolygonComplete = (points) => {
    setConfirmedPolygon(points)
    setPolygonPoints(points)
    setShapeMode('polygon')
  }

  // Handle upload complete
  const handleUploadComplete = (points) => {
    setConfirmedPolygon(points)
    setPolygonPoints(points)
    setShapeMode('upload')
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
          if (result.type === 'site-plan') {
            setUploadedImage(imageData)
          } else {
            onDetectedFloorPlan?.(imageData)
          }
          setPendingImage(null)
        } else {
          // Low confidence - show confirmation
          setDetectedType(result.type)
          setShowConfirm(true)
        }
      } catch (err) {
        console.error('Analysis failed:', err)
        // Fallback: assume site plan (we're in Land panel)
        setUploadedImage(imageData)
        setPendingImage(null)
      }

      setIsAnalyzing(false)
    }
    reader.readAsDataURL(file)
  }

  // Confirm detected type (for low confidence)
  const confirmType = (type) => {
    if (type === 'site-plan') {
      setUploadedImage(pendingImage)
    } else {
      onDetectedFloorPlan?.(pendingImage)
    }
    setShowConfirm(false)
    setPendingImage(null)
    setDetectedType(null)
  }

  // Handle edit section activation - initialize editing points
  const handleSectionClick = (sectionId) => {
    if (sectionId === 'edit') {
      // Initialize editing points from current shape
      const pointsToEdit = getEditablePoints()
      if (pointsToEdit && pointsToEdit.length >= 3) {
        setOriginalPolygon([...pointsToEdit])
        setEditingPoints([...pointsToEdit])
      }
    }
    if (activeSection === sectionId) {
      setActiveSection(null)
    } else {
      setActiveSection(sectionId)
    }
  }

  // Get current editable points (from polygon or rectangle)
  const getEditablePoints = () => {
    if (confirmedPolygon && confirmedPolygon.length >= 3) {
      return confirmedPolygon
    }
    // Convert rectangle to polygon
    const hw = dimensions.width / 2
    const hl = dimensions.length / 2
    return [
      { x: -hw, y: -hl },
      { x: hw, y: -hl },
      { x: hw, y: hl },
      { x: -hw, y: hl }
    ]
  }

  // Handle edit changes (live update)
  const handleEditChange = (newPoints) => {
    setEditingPoints(newPoints)
    // Live update the 3D view
    setConfirmedPolygon(newPoints)
    setPolygonPoints(newPoints)
    if (shapeMode === 'rectangle') {
      setShapeMode('polygon')
    }
  }

  // Handle edit complete
  const handleEditComplete = (finalPoints) => {
    setConfirmedPolygon(finalPoints)
    setPolygonPoints(finalPoints)
    if (shapeMode === 'rectangle') {
      setShapeMode('polygon')
    }
    setActiveSection(null) // Close the edit panel
  }

  // Handle edit reset
  const handleEditReset = () => {
    if (originalPolygon) {
      setEditingPoints([...originalPolygon])
      setConfirmedPolygon([...originalPolygon])
      setPolygonPoints([...originalPolygon])
    }
  }

  // Check if there's a shape to edit
  const hasEditableShape = confirmedPolygon?.length >= 3 || (dimensions.length > 0 && dimensions.width > 0)

  // Convert length for display
  const convertLength = (meters) => {
    if (lengthUnit === 'ft') return meters * 3.28084
    return meters
  }

  const formatLength = (meters) => {
    const value = convertLength(meters)
    return `${value.toFixed(1)} ${lengthUnit}`
  }

  // Calculate current area
  const area = confirmedPolygon
    ? calculatePolygonArea(confirmedPolygon)
    : localDimensions.length * localDimensions.width

  // Get current section
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

            {/* RECTANGLE Section */}
            {activeSection === 'rectangle' && (
              <div className="space-y-4">
                {/* Unit selector */}
                <div className="flex items-center justify-between">
                  <span className="text-xs text-[var(--color-text-muted)]">Units</span>
                  <select
                    value={lengthUnit}
                    onChange={(e) => setLengthUnit?.(e.target.value)}
                    className="select-premium text-sm"
                  >
                    <option value="m">Meters (m)</option>
                    <option value="ft">Feet (ft)</option>
                  </select>
                </div>

                <div className="space-y-3">
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">Length</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={convertLength(localDimensions.length).toFixed(1)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          const meters = lengthUnit === 'ft' ? val / 3.28084 : val
                          setLocalDimensions(prev => ({ ...prev, length: meters }))
                        }}
                        className="flex-1 px-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent)]"
                        min="1"
                        step="0.5"
                      />
                      <span className="text-sm text-[var(--color-text-muted)] w-8">{lengthUnit}</span>
                    </div>
                  </div>
                  <div>
                    <label className="text-xs text-[var(--color-text-muted)] mb-1.5 block">Width</label>
                    <div className="flex items-center gap-2">
                      <input
                        type="number"
                        value={convertLength(localDimensions.width).toFixed(1)}
                        onChange={(e) => {
                          const val = parseFloat(e.target.value) || 0
                          const meters = lengthUnit === 'ft' ? val / 3.28084 : val
                          setLocalDimensions(prev => ({ ...prev, width: meters }))
                        }}
                        className="flex-1 px-3 py-2 text-sm bg-[var(--color-bg-primary)] border border-[var(--color-border)] rounded-lg focus:outline-none focus:border-[var(--color-accent)]"
                        min="1"
                        step="0.5"
                      />
                      <span className="text-sm text-[var(--color-text-muted)] w-8">{lengthUnit}</span>
                    </div>
                  </div>
                </div>

                {/* Area display */}
                <div className="bg-[var(--color-bg-elevated)] rounded-xl p-3">
                  <div className="text-xs text-[var(--color-text-muted)] mb-1">Area</div>
                  <div className="text-lg font-display font-bold text-[var(--color-text-primary)]">
                    {formatAreaDisplay(localDimensions.length * localDimensions.width, lengthUnit)}
                  </div>
                </div>

                <button
                  onClick={handleApplyRectangle}
                  className="btn-primary w-full"
                >
                  Apply
                </button>
              </div>
            )}

            {/* TEMPLATES Section */}
            {activeSection === 'templates' && (
              <div className="space-y-2">
                {LAND_TEMPLATES.map(template => {
                  const { widthM, lengthM } = areaToRectDims(template.areaM2)
                  return (
                    <button
                      key={template.id}
                      onClick={() => handleTemplateSelect({ ...template, width: widthM, length: lengthM })}
                      className="w-full px-4 py-3 text-left rounded-xl bg-[var(--color-bg-elevated)] border border-[var(--color-border)] hover:bg-white/10 transition-colors"
                    >
                      <div className="text-sm font-medium text-[var(--color-text-primary)]">{template.label}</div>
                      <div className="text-xs text-[var(--color-text-muted)] mt-0.5">
                        {formatTemplateArea(template.areaM2, lengthUnit)} • {formatTemplateDims(widthM, lengthM, lengthUnit)}
                      </div>
                    </button>
                  )
                })}
              </div>
            )}

            {/* DRAW Section */}
            {activeSection === 'draw' && (
              <div className="space-y-4">
                <p className="text-xs text-[var(--color-text-muted)]">
                  Click on the mini-map below to draw your land boundary. Double-click or press Done to finish.
                </p>
                <PolygonEditor
                  points={polygonPoints}
                  onChange={setPolygonPoints}
                  onComplete={handlePolygonComplete}
                  lengthUnit={lengthUnit}
                />
                {confirmedPolygon && shapeMode === 'polygon' && (
                  <div className="bg-[var(--color-bg-elevated)] rounded-xl p-3">
                    <div className="text-xs text-[var(--color-text-muted)] mb-1">Area</div>
                    <div className="text-lg font-display font-bold text-[var(--color-text-primary)]">
                      {formatAreaDisplay(calculatePolygonArea(confirmedPolygon), lengthUnit)}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* UPLOAD Section */}
            {activeSection === 'upload' && (
              <div className="space-y-4">
                {!uploadedImage && !isAnalyzing && !showConfirm ? (
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
                  <>
                    {/* ImageTracer for tracing the boundary */}
                    <ImageTracer
                      uploadedImage={uploadedImage}
                      setUploadedImage={setUploadedImage}
                      onComplete={handleUploadComplete}
                      lengthUnit={lengthUnit}
                    />
                    {confirmedPolygon && shapeMode === 'upload' && (
                      <div className="bg-[var(--color-bg-elevated)] rounded-xl p-3">
                        <div className="text-xs text-[var(--color-text-muted)] mb-1">Area</div>
                        <div className="text-lg font-display font-bold text-[var(--color-text-primary)]">
                          {formatAreaDisplay(calculatePolygonArea(confirmedPolygon), lengthUnit)}
                        </div>
                      </div>
                    )}
                  </>
                )}
              </div>
            )}

            {/* EDIT Section */}
            {activeSection === 'edit' && (
              <div className="space-y-4">
                {hasEditableShape ? (
                  <>
                    <p className="text-xs text-[var(--color-text-muted)]">
                      Drag points to adjust your land boundary. Double-click an edge to add a point.
                    </p>
                    <ShapeEditor
                      points={editingPoints}
                      onChange={handleEditChange}
                      onComplete={handleEditComplete}
                      onReset={handleEditReset}
                      originalPoints={originalPolygon}
                      lengthUnit={lengthUnit}
                    />
                  </>
                ) : (
                  <div className="text-center py-8">
                    <div className="w-12 h-12 mx-auto mb-3 rounded-full bg-white/5 flex items-center justify-center">
                      <svg className="w-6 h-6 text-white/30" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M9.879 7.519c1.171-1.025 3.071-1.025 4.242 0 1.172 1.025 1.172 2.687 0 3.712-.203.179-.43.326-.67.442-.745.361-1.45.999-1.45 1.827v.75M21 12a9 9 0 11-18 0 9 9 0 0118 0zm-9 5.25h.008v.008H12v-.008z" />
                      </svg>
                    </div>
                    <p className="text-sm text-white/50 mb-2">No shape to edit</p>
                    <p className="text-xs text-white/30">
                      First create a shape using Rectangle, Draw, or Upload
                    </p>
                  </div>
                )}
              </div>
            )}

          </div>
        </div>
      </div>

      {/* Collapse bar */}
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
