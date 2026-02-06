import { useState, useEffect, useRef } from 'react'
import PolygonEditor, { calculatePolygonArea } from './PolygonEditor'
import ImageTracer from './ImageTracer'
import {
  LAND_TEMPLATES,
  areaToRectDims,
  formatTemplateArea,
  formatTemplateDims,
} from '../data/landTemplates'

const FEET_PER_METER = 3.28084
const SQ_FEET_PER_SQ_METER = 10.7639

// Soccer field area in m²
const SOCCER_FIELD_AREA = 68 * 105 // 7140 m²

// Animated preview components for method cards
const RectanglePreview = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
    <rect
      x="8" y="12" width="40" height="32" rx="2"
      stroke="currentColor" strokeWidth="2"
      className="preview-rect"
      fill="none"
    />
    {/* Animated circle tracing the rectangle */}
    <circle r="3" fill="var(--color-accent)">
      <animateMotion
        dur="3s"
        repeatCount="indefinite"
        path="M8,12 L48,12 L48,44 L8,44 Z"
      />
    </circle>
  </svg>
)

const TemplatesPreview = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none" className="preview-shapes">
    <rect x="6" y="6" width="18" height="18" rx="3" fill="currentColor" opacity="0.5" />
    <rect x="32" y="6" width="18" height="18" rx="3" fill="currentColor" opacity="0.5" />
    <rect x="6" y="32" width="18" height="18" rx="3" fill="currentColor" opacity="0.5" />
    <rect x="32" y="32" width="18" height="18" rx="3" fill="currentColor" opacity="0.5" />
  </svg>
)

const DrawPreview = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
    {/* Polygon being drawn */}
    <polygon
      points="10,42 28,10 46,38 32,46"
      stroke="currentColor" strokeWidth="2"
      className="preview-polygon"
      fill="none"
      strokeLinejoin="round"
    />
    {/* Animated circle tracing the polygon */}
    <circle r="3" fill="var(--color-accent)">
      <animateMotion
        dur="3s"
        repeatCount="indefinite"
        path="M10,42 L28,10 L46,38 L32,46 Z"
      />
    </circle>
  </svg>
)

const UploadPreview = () => (
  <svg width="56" height="56" viewBox="0 0 56 56" fill="none">
    {/* Document outline */}
    <rect x="12" y="6" width="32" height="44" rx="3" stroke="currentColor" strokeWidth="2" fill="none" />
    {/* Page fold */}
    <path d="M32 6 L44 18 L32 18 Z" stroke="currentColor" strokeWidth="2" fill="none" />
    {/* Scan line */}
    <rect x="14" y="20" width="28" height="2" fill="var(--color-accent)" className="preview-scan-line" />
  </svg>
)

// Method card data
const METHODS = [
  {
    id: 'rectangle',
    name: 'Rectangle',
    description: 'Enter length & width',
    Preview: RectanglePreview,
  },
  {
    id: 'template',
    name: 'Templates',
    description: 'Pick a common lot size',
    Preview: TemplatesPreview,
  },
  {
    id: 'draw',
    name: 'Draw',
    description: 'Custom polygon shape',
    Preview: DrawPreview,
  },
  {
    id: 'upload',
    name: 'Upload',
    description: 'Site or floor plan',
    Preview: UploadPreview,
  },
]

export default function Onboarding({
  onComplete,
  onCancel,
  lengthUnit,
  setLengthUnit,
  isTouchDevice
}) {
  const [step, setStep] = useState(1)
  const [method, setMethod] = useState(null) // 'rectangle', 'draw', 'upload', 'template'

  // Rectangle inputs
  const [length, setLength] = useState('')
  const [width, setWidth] = useState('')

  // Polygon/Upload
  const [polygonPoints, setPolygonPoints] = useState([])

  // Close on Escape key (but not when drawing - let PolygonEditor handle it)
  useEffect(() => {
    const handleKeyDown = (e) => {
      if (e.key !== 'Escape') return
      // If Escape originated from an input, just blur it (don't close)
      if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.tagName === 'SELECT') {
        e.target.blur()
        return
      }
      if (onCancel) {
        onCancel()
      }
    }
    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [onCancel])
  const [uploadedImage, setUploadedImage] = useState(null)
  const [isDragging, setIsDragging] = useState(false)
  const fileInputRef = useRef(null)

  // Template state
  const [selectedTemplateId, setSelectedTemplateId] = useState(null)

  // Aha moment
  const [showAha, setShowAha] = useState(false)
  const [ahaFading, setAhaFading] = useState(false)
  const [hasMoved, setHasMoved] = useState(false)
  const ahaTimerRef = useRef(null)

  // Calculated values
  const [finalArea, setFinalArea] = useState(0)
  const [finalDimensions, setFinalDimensions] = useState({ length: 20, width: 15 })
  const [finalPolygon, setFinalPolygon] = useState(null)

  // Step 4 state
  const [showReinforce, setShowReinforce] = useState(false)

  // Fullscreen done modal state
  const [showFullscreenModal, setShowFullscreenModal] = useState(false)
  const [fullscreenPolygon, setFullscreenPolygon] = useState(null)

  // Handle method selection
  const selectMethod = (m) => {
    setMethod(m)
    setStep(2)
  }

  // Convert input to meters
  const toMeters = (val) => {
    const num = parseFloat(val) || 0
    return lengthUnit === 'ft' ? num / FEET_PER_METER : num
  }

  // Calculate area based on method
  const calculateArea = () => {
    if (method === 'rectangle') {
      return toMeters(length) * toMeters(width)
    } else if (finalPolygon && finalPolygon.length >= 3) {
      return calculatePolygonArea(finalPolygon)
    }
    return 0
  }

  // Handle rectangle submission
  const handleRectangleSubmit = () => {
    const l = toMeters(length) || 20
    const w = toMeters(width) || 15
    setFinalDimensions({ length: Math.max(1, l), width: Math.max(1, w) })
    setFinalArea(l * w)
    setFinalPolygon(null)
    triggerAha(l * w)
  }

  // Handle polygon complete
  const handlePolygonComplete = () => {
    if (polygonPoints.length >= 3) {
      const area = calculatePolygonArea(polygonPoints)
      setFinalPolygon(polygonPoints)
      setFinalArea(area)
      triggerAha(area)
    }
  }

  // Handle fullscreen Done - show modal with Explore/Build options
  const handleFullscreenDone = (pts) => {
    if (pts && pts.length >= 3) {
      setFullscreenPolygon(pts)
      setShowFullscreenModal(true)
    }
  }

  // Complete from fullscreen modal
  const completeFromFullscreenModal = (action) => {
    onComplete({
      dimensions: { length: 20, width: 15 }, // Default dimensions (not used for polygon)
      polygon: fullscreenPolygon,
      shapeMode: 'polygon',
      action,
      method: 'draw',
    })
  }

  // Handle upload trace complete
  const handleUploadComplete = (worldPoints) => {
    if (worldPoints && worldPoints.length >= 3) {
      const area = calculatePolygonArea(worldPoints)
      setFinalPolygon(worldPoints)
      setFinalArea(area)
      triggerAha(area)
    }
  }

  // Handle template selection - auto-complete after Aha moment
  const handleTemplateSelect = (template) => {
    const { widthM, lengthM } = areaToRectDims(template.areaM2)
    const dims = { length: lengthM, width: widthM }

    // Set state for display
    setSelectedTemplateId(template.id)
    setFinalDimensions(dims)
    setFinalArea(template.areaM2)
    setFinalPolygon(null)

    // Show Aha moment
    setStep(3)
    setShowAha(true)

    // Auto-complete after 2 seconds (no need for "Explore in 3D" button)
    setTimeout(() => {
      setAhaFading(true)
      setTimeout(() => {
        setShowAha(false)
        setAhaFading(false)
        // Directly complete - skip the reinforce panel for templates
        onComplete({
          dimensions: dims,
          polygon: null,
          shapeMode: 'rectangle',
          action: 'explore',
          templateId: template.id,
          method: 'template',
        })
      }, 500)
    }, 2000)
  }

  // Trigger the Aha moment
  const triggerAha = (area) => {
    setFinalArea(area)
    setStep(3)
    setShowAha(true)

    // Auto-fade after 3 seconds
    ahaTimerRef.current = setTimeout(() => {
      fadeAha()
    }, 3000)
  }

  // Fade the Aha overlay and auto-complete
  const fadeAha = () => {
    if (ahaTimerRef.current) {
      clearTimeout(ahaTimerRef.current)
    }
    setAhaFading(true)
    setTimeout(() => {
      setShowAha(false)
      setAhaFading(false)
      completeOnboarding('explore')
    }, 500)
  }

  // Listen for movement to fade Aha
  useEffect(() => {
    if (!showAha || hasMoved) return

    const handleKeyDown = (e) => {
      if (['w', 'a', 's', 'd', 'W', 'A', 'S', 'D', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
        setHasMoved(true)
        fadeAha()
      }
    }

    window.addEventListener('keydown', handleKeyDown)
    return () => window.removeEventListener('keydown', handleKeyDown)
  }, [showAha, hasMoved])

  // Format area display
  const formatArea = (sqMeters) => {
    if (lengthUnit === 'ft') {
      return `${Math.round(sqMeters * SQ_FEET_PER_SQ_METER).toLocaleString()} ft²`
    }
    return `${Math.round(sqMeters).toLocaleString()} m²`
  }

  // Soccer field comparison
  const soccerFieldComparison = (sqMeters) => {
    const ratio = sqMeters / SOCCER_FIELD_AREA
    if (ratio < 0.1) return `≈ ${(ratio * 100).toFixed(0)}% of a soccer field`
    if (ratio < 1) return `≈ ${ratio.toFixed(1)} soccer fields`
    return `≈ ${ratio.toFixed(1)} soccer fields`
  }

  // Complete onboarding
  const completeOnboarding = (action) => {
    // For templates, ensure we use the computed dimensions from the template
    let dims = finalDimensions
    if (method === 'template' && selectedTemplateId) {
      // Re-compute dimensions from the selected template to ensure correctness
      const template = LAND_TEMPLATES.find(t => t.id === selectedTemplateId)
      if (template) {
        const { widthM, lengthM } = areaToRectDims(template.areaM2)
        dims = { length: lengthM, width: widthM }
      }
    }

    onComplete({
      dimensions: dims,
      polygon: finalPolygon,
      shapeMode: finalPolygon ? (uploadedImage ? 'upload' : 'polygon') : 'rectangle',
      action, // 'explore', 'build', or 'save'
      // Include template info for analytics
      templateId: selectedTemplateId,
      method: method, // 'rectangle', 'draw', 'upload', or 'template'
    })
  }

  return (
    <>
      {/* Step 1 & 2: Full overlay */}
      {step <= 2 && (
        <div className="fixed inset-0 z-[100] bg-black/80 backdrop-blur-sm flex items-center justify-center overflow-y-auto">
          <div className={`w-full px-6 py-8 ${step === 1 ? 'max-w-3xl' : 'max-w-lg'}`}>
            {/* Step 1: Method Selection */}
            {step === 1 && (
              <div className="text-center">
                <div className="heading-enter">
                  <h1 className="text-2xl font-bold text-white mb-2">Define Your Land</h1>
                  <p className="text-white/50 mb-8">Choose how to get started</p>
                </div>

                {/* 4-card horizontal grid (2×2 on mobile) */}
                <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
                  {METHODS.map((method) => {
                    const Preview = method.Preview
                    return (
                      <button
                        key={method.id}
                        onClick={() => selectMethod(method.id)}
                        className="method-card method-card-enter text-white"
                      >
                        <div className="method-card-preview text-white/70">
                          <Preview />
                        </div>
                        <div className="font-semibold text-[15px] text-white">{method.name}</div>
                        <div className="text-white/50 text-xs mt-1">{method.description}</div>
                      </button>
                    )
                  })}
                </div>
              </div>
            )}

            {/* Step 2: Input */}
            {step === 2 && (
              <div>
                {/* Header row with Back and Title */}
                {!(method === 'upload' && uploadedImage) && (
                  <div className="mb-6">
                    <button
                      onClick={() => { setStep(1); setMethod(null) }}
                      className="flex items-center gap-2 text-gray-400 hover:text-white mb-4 transition-colors group"
                    >
                      <svg
                        className="w-5 h-5 group-hover:-translate-x-1 transition-transform"
                        fill="none"
                        stroke="currentColor"
                        viewBox="0 0 24 24"
                      >
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
                      </svg>
                      <span>Back</span>
                    </button>
                    <h2 className="text-xl font-bold text-white text-center">
                      {method === 'rectangle' && 'Enter Dimensions'}
                      {method === 'template' && 'Pick a Lot Size'}
                      {method === 'draw' && 'Draw Your Land'}
                      {method === 'upload' && 'Upload Plan'}
                    </h2>
                  </div>
                )}

                {/* Template Picker */}
                {method === 'template' && (
                  <div style={{ paddingTop: '15px' }}>
                    {/* Unit toggle */}
                    <div className="flex justify-center" style={{ marginBottom: '15px' }}>
                      <div className="flex bg-white/10 rounded-lg" style={{ padding: '3px', gap: '3px' }}>
                        <button
                          onClick={() => setLengthUnit('m')}
                          style={{ padding: '4px 16px' }}
                          className={`rounded-md text-sm font-medium transition-all ${
                            lengthUnit === 'm' ? 'bg-teal-500 text-white shadow-md' : 'text-white/50 hover:text-white/70'
                          }`}
                        >
                          Metric
                        </button>
                        <button
                          onClick={() => setLengthUnit('ft')}
                          style={{ padding: '4px 16px' }}
                          className={`rounded-md text-sm font-medium transition-all ${
                            lengthUnit === 'ft' ? 'bg-teal-500 text-white shadow-md' : 'text-white/50 hover:text-white/70'
                          }`}
                        >
                          Imperial
                        </button>
                      </div>
                    </div>

                    <div className="grid grid-cols-2 gap-3">
                      {LAND_TEMPLATES.map((template) => {
                        const { widthM, lengthM } = areaToRectDims(template.areaM2)
                        return (
                          <button
                            key={template.id}
                            onClick={() => handleTemplateSelect(template)}
                            style={{ padding: '16px 16px 16px 24px' }}
                            className="bg-white/5 hover:bg-white/15 border border-white/10 hover:border-white/30 rounded-xl transition-all text-left"
                          >
                            <div className="text-white font-semibold text-lg">
                              {formatTemplateArea(template.areaM2, lengthUnit)}
                            </div>
                            <div className="text-white/50 text-xs mt-1">
                              {formatTemplateDims(widthM, lengthM, lengthUnit)}
                            </div>
                            <div className="text-white/40 text-xs mt-1">
                              {template.label}
                            </div>
                          </button>
                        )
                      })}
                    </div>
                  </div>
                )}

                {/* Rectangle Input */}
                {method === 'rectangle' && (
                  <div className="text-center" style={{ paddingTop: '15px' }}>
                    {/* Unit toggle */}
                    <div className="flex justify-center" style={{ marginBottom: '25px' }}>
                      <div className="flex bg-white/10 rounded-lg" style={{ padding: '3px', gap: '3px' }}>
                        <button
                          onClick={() => setLengthUnit('m')}
                          style={{ padding: '4px 16px' }}
                          className={`rounded-md text-sm font-medium transition-all ${
                            lengthUnit === 'm' ? 'bg-teal-500 text-white shadow-md' : 'text-white/50 hover:text-white/70'
                          }`}
                        >
                          Meters
                        </button>
                        <button
                          onClick={() => setLengthUnit('ft')}
                          style={{ padding: '4px 16px' }}
                          className={`rounded-md text-sm font-medium transition-all ${
                            lengthUnit === 'ft' ? 'bg-teal-500 text-white shadow-md' : 'text-white/50 hover:text-white/70'
                          }`}
                        >
                          Feet
                        </button>
                      </div>
                    </div>

                    <div className="flex gap-6" style={{ marginBottom: '15px' }}>
                      <div className="flex-1">
                        <input
                          type="number"
                          value={length}
                          onChange={(e) => setLength(e.target.value)}
                          placeholder={lengthUnit === 'm' ? '50' : '165'}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-lg text-center focus:outline-none focus:border-white/50 placeholder:text-white/30"
                          autoFocus
                        />
                        <div className="text-white/50 text-sm mt-2">Length ({lengthUnit})</div>
                      </div>
                      <div className="flex-1">
                        <input
                          type="number"
                          value={width}
                          onChange={(e) => setWidth(e.target.value)}
                          placeholder={lengthUnit === 'm' ? '30' : '100'}
                          className="w-full px-4 py-3 bg-white/10 border border-white/20 rounded-lg text-white text-lg text-center focus:outline-none focus:border-white/50 placeholder:text-white/30"
                        />
                        <div className="text-white/50 text-sm mt-2">Width ({lengthUnit})</div>
                      </div>
                    </div>

                    <button
                      onClick={handleRectangleSubmit}
                      disabled={!length || !width}
                      className="w-full py-4 bg-green-600 hover:bg-green-500 disabled:bg-white/10 disabled:text-white/30 text-white font-semibold rounded-lg transition-colors text-lg"
                    >
                      See my land
                    </button>
                  </div>
                )}

                {/* Draw Input */}
                {method === 'draw' && (
                  <div style={{ paddingTop: '15px' }}>
                    {/* Unit toggle */}
                    <div className="flex justify-center" style={{ marginBottom: '15px' }}>
                      <div className="flex bg-white/10 rounded-lg" style={{ padding: '3px', gap: '3px' }}>
                        <button
                          onClick={() => setLengthUnit('m')}
                          style={{ padding: '4px 16px' }}
                          className={`rounded-md text-sm font-medium transition-all ${
                            lengthUnit === 'm' ? 'bg-teal-500 text-white shadow-md' : 'text-white/50 hover:text-white/70'
                          }`}
                        >
                          Meters
                        </button>
                        <button
                          onClick={() => setLengthUnit('ft')}
                          style={{ padding: '4px 16px' }}
                          className={`rounded-md text-sm font-medium transition-all ${
                            lengthUnit === 'ft' ? 'bg-teal-500 text-white shadow-md' : 'text-white/50 hover:text-white/70'
                          }`}
                        >
                          Feet
                        </button>
                      </div>
                    </div>

                    <div className="bg-white/5 rounded-xl p-4">
                      <PolygonEditor
                        points={polygonPoints}
                        onChange={setPolygonPoints}
                        onComplete={handlePolygonComplete}
                        onFullscreenDone={handleFullscreenDone}
                        onClear={() => setPolygonPoints([])}
                        lengthUnit={lengthUnit}
                      />
                    </div>
                  </div>
                )}

                {/* Upload Input */}
                {method === 'upload' && (
                  <div className="flex flex-col items-center">
                    {!uploadedImage ? (
                      <div className="w-full max-w-md">
                        {/* Subtitle */}
                        <p className="text-gray-400 text-sm text-center mb-6">Upload your site plan or floor plan</p>

                        {/* Main Card */}
                        <div className="bg-gray-800/80 backdrop-blur rounded-2xl p-8 shadow-2xl border border-gray-700/50">
                          {/* Upload Zone */}
                          <div
                            onClick={() => fileInputRef.current?.click()}
                            onDragOver={(e) => { e.preventDefault(); setIsDragging(true) }}
                            onDragLeave={() => setIsDragging(false)}
                            onDrop={(e) => {
                              e.preventDefault()
                              setIsDragging(false)
                              const file = e.dataTransfer.files[0]
                              if (file && (file.type.startsWith('image/') || file.type === 'application/pdf')) {
                                const reader = new FileReader()
                                reader.onload = (ev) => setUploadedImage(ev.target.result)
                                reader.readAsDataURL(file)
                              }
                            }}
                            className={`
                              cursor-pointer rounded-xl border-2 border-dashed p-10
                              transition-all duration-200 ease-out
                              ${isDragging
                                ? 'border-teal-400 bg-teal-500/10 scale-[1.02]'
                                : 'border-gray-600 hover:border-teal-500/50 hover:bg-gray-700/30'
                              }
                            `}
                          >
                            <input
                              ref={fileInputRef}
                              type="file"
                              accept="image/png,image/jpeg,application/pdf"
                              className="hidden"
                              onChange={(e) => {
                                const file = e.target.files?.[0]
                                if (file) {
                                  const reader = new FileReader()
                                  reader.onload = (ev) => setUploadedImage(ev.target.result)
                                  reader.readAsDataURL(file)
                                }
                              }}
                            />

                            {/* All content centered with flex column */}
                            <div className="flex flex-col items-center justify-center text-center">
                              {/* Upload Icon - Centered */}
                              <div className={`
                                w-16 h-16 rounded-full mb-4 flex items-center justify-center
                                transition-all duration-200
                                ${isDragging ? 'bg-teal-500/20 scale-110' : 'bg-gray-700'}
                              `}>
                                <svg
                                  className={`w-8 h-8 transition-colors ${isDragging ? 'text-teal-400' : 'text-gray-400'}`}
                                  fill="none"
                                  stroke="currentColor"
                                  viewBox="0 0 24 24"
                                >
                                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                                </svg>
                              </div>

                              {/* Text */}
                              <p className="text-white font-medium mb-1">
                                {isDragging ? 'Drop your file here' : 'Click to upload or drag and drop'}
                              </p>
                              <p className="text-gray-500 text-sm">PNG, JPG, or PDF up to 10MB</p>
                            </div>
                          </div>

                          {/* Format Indicators - Teal dots */}
                          <div className="mt-5 flex items-center justify-center gap-4 text-sm text-gray-500">
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                              <span>PNG</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                              <span>JPG</span>
                            </div>
                            <div className="flex items-center gap-1.5">
                              <div className="w-1.5 h-1.5 rounded-full bg-teal-500"></div>
                              <span>PDF</span>
                            </div>
                          </div>
                        </div>

                        {/* Help Text - Outside card */}
                        <p className="text-center text-gray-500 text-sm mt-5">
                          We'll automatically detect if this is a site plan or floor plan
                        </p>
                      </div>
                    ) : (
                      <div className="bg-white/5 rounded-xl p-4">
                        <ImageTracer
                          uploadedImage={uploadedImage}
                          setUploadedImage={setUploadedImage}
                          lengthUnit={lengthUnit}
                          onComplete={handleUploadComplete}
                          onClear={() => setUploadedImage(null)}
                        />
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>
        </div>
      )}

      {/* Step 3: Aha Moment Overlay */}
      {showAha && (
        <div
          className={`fixed inset-0 z-[100] flex items-center justify-center transition-opacity duration-500 ${
            ahaFading ? 'opacity-0' : 'opacity-100'
          }`}
          onClick={() => {
            if (ahaFading) return
            // For templates, clicking completes immediately
            if (method === 'template' && selectedTemplateId) {
              const template = LAND_TEMPLATES.find(t => t.id === selectedTemplateId)
              if (template) {
                const { widthM, lengthM } = areaToRectDims(template.areaM2)
                setAhaFading(true)
                setTimeout(() => {
                  setShowAha(false)
                  setAhaFading(false)
                  onComplete({
                    dimensions: { length: lengthM, width: widthM },
                    polygon: null,
                    shapeMode: 'rectangle',
                    action: 'explore',
                    templateId: template.id,
                    method: 'template',
                  })
                }, 500)
              }
            } else {
              fadeAha()
            }
          }}
        >
          <div className="text-center bg-black/70 backdrop-blur-md rounded-2xl max-w-sm mx-4" style={{ padding: '20px 36px' }}>
            <div className="text-white/60 text-sm mb-3">Your land</div>
            <div className="text-4xl font-bold text-white">{formatArea(finalArea)}</div>
          </div>
        </div>
      )}


      {/* Fullscreen Done Modal */}
      {showFullscreenModal && (
        <div className="fixed bottom-8 left-0 right-0 z-[250] flex justify-center px-4">
          <div className="bg-black/80 backdrop-blur-md rounded-xl p-4 max-w-sm w-full">
            <div className="flex gap-3">
              <button
                onClick={() => completeFromFullscreenModal('explore')}
                className="flex-1 py-3 bg-teal-500 hover:bg-teal-400 text-white font-semibold rounded-lg transition-colors"
              >
                Explore
              </button>
              <button
                onClick={() => completeFromFullscreenModal('build')}
                className="flex-1 py-3 bg-white/10 hover:bg-white/20 text-white font-semibold rounded-lg transition-colors"
              >
                Build
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
