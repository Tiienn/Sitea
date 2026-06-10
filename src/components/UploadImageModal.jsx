import { useState, useRef } from 'react'
import { analyzeImage } from '../services/imageAnalysis'
import { useUser } from '../hooks/useUser.jsx'
import { fileToImageData, renderPdfPageToImage } from '../utils/pdfToImage'

// Confidence threshold for auto-routing (70%)
const AUTO_ROUTE_THRESHOLD = 0.7

export default function UploadImageModal({ onClose, onUploadForLand, onUploadForFloorPlan }) {
  const { user, isPaidUser, planType, canUseUpload, markUploadUsed, hasUsedUpload, uploadCount, uploadsRemaining, setShowPricingModal } = useUser()
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState(null)
  const [step, setStep] = useState('promise') // 'promise' | 'upload' | 'preview' | 'analyzing' | 'confirm' | 'scale'
  const [detection, setDetection] = useState(null) // { type, confidence, method }
  const [error, setError] = useState(null)
  const [pendingFloorPlan, setPendingFloorPlan] = useState(null) // imageData waiting for scale input
  const [scaleValue, setScaleValue] = useState('')
  const [scaleUnit, setScaleUnit] = useState('meters')
  const [pdfFile, setPdfFile] = useState(null)
  const [pdfPageNumber, setPdfPageNumber] = useState(1)
  const [pdfPageCount, setPdfPageCount] = useState(1)
  const [isRenderingPdf, setIsRenderingPdf] = useState(false)
  const fileInputRef = useRef(null)

  // Route to the appropriate mode
  const routeToMode = async (type, imageData) => {
    if (type === 'site-plan') {
      const quota = await markUploadUsed()
      if (!quota?.ok) {
        setStep('preview')
        return
      }
      onUploadForLand(imageData)
      onClose()
    } else {
      // Floor plan — collect scale hint first
      setPendingFloorPlan(imageData)
      setStep('scale')
    }
  }

  const confirmFloorPlan = (knownWidthMeters = null) => {
    onUploadForFloorPlan(pendingFloorPlan, knownWidthMeters ? { knownWidthMeters } : null)
    onClose()
  }

  const handleScaleSubmit = () => {
    const val = parseFloat(scaleValue)
    if (!scaleValue || isNaN(val) || val <= 0) {
      confirmFloorPlan(null) // skip
      return
    }
    const meters = scaleUnit === 'feet' ? val * 0.3048 : val
    confirmFloorPlan(meters)
  }

  const handleFile = async (f) => {
    if (!f) return

    if (!canUseUpload()) {
      return
    }

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg', 'application/pdf']
    if (!validTypes.includes(f.type)) {
      alert('Please upload a PNG, JPG, or PDF file')
      return
    }

    setError(null)
    setIsRenderingPdf(f.type === 'application/pdf')

    try {
      const result = await fileToImageData(f, { pageNumber: 1 })
      setPreview(result.imageData)
      setPdfFile(result.isPdf ? f : null)
      setPdfPageNumber(result.pageNumber)
      setPdfPageCount(result.pageCount)
      setStep('preview')
    } catch (err) {
      console.error('PDF render failed:', err)
      setError('Could not read this file. Please try a clearer PDF, PNG, or JPG.')
      setStep('upload')
    } finally {
      setIsRenderingPdf(false)
    }
  }

  const renderPdfPage = async (pageNumber) => {
    if (!pdfFile || pageNumber < 1 || pageNumber > pdfPageCount) return

    setIsRenderingPdf(true)
    setError(null)

    try {
      const result = await renderPdfPageToImage(pdfFile, { pageNumber })
      setPreview(result.imageData)
      setPdfPageNumber(result.pageNumber)
      setPdfPageCount(result.pageCount)
    } catch (err) {
      console.error('PDF page render failed:', err)
      setError('Could not render that PDF page. Please try another page or file.')
    } finally {
      setIsRenderingPdf(false)
    }
  }

  // Called when user clicks "Generate 3D Walkthrough" from preview step
  const proceedToAnalysis = async () => {
    setStep('analyzing')

    try {
      const result = await analyzeImage(preview, isPaidUser)
      setDetection(result)

      if (result.confidence >= AUTO_ROUTE_THRESHOLD) {
        await routeToMode(result.type, preview)
      } else {
        setStep('confirm')
      }
    } catch (err) {
      console.error('Analysis failed:', err)
      setError('Could not analyze image. Please try again.')
      setStep('upload')
    }
  }

  const handleDragOver = (e) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = () => setIsDragging(false)

  const handleDrop = (e) => {
    e.preventDefault()
    setIsDragging(false)
    handleFile(e.dataTransfer.files[0])
  }

  const resetModal = () => {
    setPreview(null)
    setStep('promise')
    setDetection(null)
    setError(null)
    setPendingFloorPlan(null)
    setScaleValue('')
    setScaleUnit('meters')
    setPdfFile(null)
    setPdfPageNumber(1)
    setPdfPageCount(1)
    setIsRenderingPdf(false)
  }

  const handleClose = () => {
    resetModal()
    onClose()
  }

  return (
    <div className="fixed inset-0 bg-black/90 backdrop-blur-sm flex items-center justify-center p-4 z-50">
      <div className="w-full max-w-md">

        {/* Back Button */}
        <button
          onClick={handleClose}
          className="flex items-center gap-2 text-[var(--color-text-muted)] hover:text-white mb-4 transition-colors group"
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

        {/* Main Card */}
        <div className="bg-[var(--color-bg-primary)] rounded-2xl p-6 shadow-2xl border border-[var(--color-border)]">

          {step === 'promise' && (
            <div className="text-center">
              <h1 className="text-xl font-display font-semibold text-white mb-2">
                Turn your floor plan into a 3D walkthrough
              </h1>
              <p className="text-[var(--color-text-muted)] text-sm mb-6">
                Upload a scanned PDF, photo, or screenshot. We'll detect walls, doors, and windows automatically.
              </p>

              {/* 2D → 3D visual */}
              <div className="flex items-center justify-center gap-4 mb-8">
                <div className="w-20 h-20 rounded-lg bg-white/5 border border-white/10 flex items-center justify-center">
                  <svg className="w-9 h-9 text-white/50" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <rect x="3" y="3" width="18" height="18" rx="1" />
                    <line x1="3" y1="12" x2="21" y2="12" />
                    <line x1="12" y1="3" x2="12" y2="21" />
                  </svg>
                </div>
                <svg className="w-6 h-6 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={2}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M13 7l5 5m0 0l-5 5m5-5H6" />
                </svg>
                <div className="w-20 h-20 rounded-lg bg-[var(--color-accent)]/10 border border-[var(--color-accent)]/30 flex items-center justify-center">
                  <svg className="w-9 h-9 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M2.25 12l8.954-8.955c.44-.439 1.152-.439 1.591 0L21.75 12M4.5 9.75v10.125c0 .621.504 1.125 1.125 1.125H9.75v-4.875c0-.621.504-1.125 1.125-1.125h2.25c.621 0 1.125.504 1.125 1.125V21h4.125c.621 0 1.125-.504 1.125-1.125V9.75M8.25 21h8.25" />
                  </svg>
                </div>
              </div>

              <button
                onClick={() => setStep('upload')}
                className="w-full py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-lg transition-colors"
              >
                Upload Floor Plan
              </button>
            </div>
          )}

          {step === 'upload' && (
            <>
              {/* Header */}
              <div className="text-center mb-6">
                <h1 className="text-xl font-display font-semibold text-white mb-2">Upload Plan</h1>
                <p className="text-[var(--color-text-muted)] text-sm">Upload your site plan or floor plan</p>
                {!isPaidUser ? (
                  <p className="mt-2 text-xs">
                    {hasUsedUpload ? (
                      <span className="text-teal-400">
                        Want to upload more? <span className="px-1.5 py-0.5 bg-teal-500 text-white font-bold rounded ml-0.5">Pro - $20</span>
                      </span>
                    ) : user ? (
                      <span className="text-green-400">Your first upload is free</span>
                    ) : (
                      <span className="text-green-400">Sign in to use your free upload</span>
                    )}
                  </p>
                ) : (planType === 'homeowner' || planType === 'monthly') ? (
                  <p className="mt-2 text-xs text-teal-400">
                    {uploadCount} of {uploadCount + uploadsRemaining} uploads used
                  </p>
                ) : null}
              </div>

              {/* Upload Zone */}
              <div
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
                className={`
                  cursor-pointer rounded-xl border-2 border-dashed p-10
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
                  accept="image/png,image/jpeg,image/jpg,application/pdf,.pdf"
                  onChange={(e) => handleFile(e.target.files?.[0])}
                  className="hidden"
                />

                <div className="flex flex-col items-center justify-center text-center">
                  <div className={`
                    w-16 h-16 rounded-full mb-4 flex items-center justify-center
                    transition-all duration-200
                    ${isDragging ? 'bg-[var(--color-accent)]/20' : 'bg-[var(--color-bg-secondary)]'}
                  `}>
                    <svg
                      className={`w-8 h-8 ${isDragging ? 'text-[var(--color-accent)]' : 'text-[var(--color-text-muted)]'}`}
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                    </svg>
                  </div>

                  <p className="text-white font-medium mb-1">
                    {isDragging ? 'Drop your file here' : 'Click to upload or drag and drop'}
                  </p>
                  <p className="text-[var(--color-text-muted)] text-sm">
                    {isRenderingPdf ? 'Rendering PDF...' : 'PDF, PNG, or JPG'}
                  </p>
                </div>
              </div>

              {/* Error Message */}
              {error && (
                <p className="text-red-400 text-sm text-center mt-4">{error}</p>
              )}

              {/* Format Indicators */}
              <div className="mt-4 flex items-center justify-center gap-4 text-sm text-[var(--color-text-muted)]">
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"></div>
                  <span>PNG</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"></div>
                  <span>JPG</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <div className="w-1.5 h-1.5 rounded-full bg-[var(--color-accent)]"></div>
                  <span>PDF</span>
                </div>
              </div>

              {/* User Tier Indicator */}
              <div className="mt-4 text-center">
                {isPaidUser ? (
                  <span className="inline-flex items-center gap-1.5 text-xs text-[var(--color-accent)]">
                    <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20">
                      <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                    </svg>
                    AI-powered detection
                  </span>
                ) : (
                  <span className="text-xs text-[var(--color-text-muted)]">
                    Smart auto-detection
                  </span>
                )}
              </div>
            </>
          )}

          {step === 'preview' && preview && (
            <div>
              {/* Show uploaded image */}
              <div className="rounded-xl overflow-hidden mb-4 border border-white/10">
                <img src={preview} alt="Your floor plan" className="w-full" />
              </div>

              {pdfFile && pdfPageCount > 1 && (
                <div className="flex items-center justify-between gap-3 rounded-xl bg-white/5 border border-white/10 mb-4" style={{ padding: '10px 12px' }}>
                  <button
                    type="button"
                    onClick={() => renderPdfPage(pdfPageNumber - 1)}
                    disabled={pdfPageNumber <= 1 || isRenderingPdf}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Previous
                  </button>
                  <span className="text-sm text-[var(--color-text-secondary)] text-center">
                    {isRenderingPdf ? 'Rendering...' : `Page ${pdfPageNumber} of ${pdfPageCount}`}
                  </span>
                  <button
                    type="button"
                    onClick={() => renderPdfPage(pdfPageNumber + 1)}
                    disabled={pdfPageNumber >= pdfPageCount || isRenderingPdf}
                    className="px-4 py-2 rounded-lg text-sm font-medium bg-white/10 text-white hover:bg-white/15 disabled:opacity-40 disabled:cursor-not-allowed transition-all"
                  >
                    Next
                  </button>
                </div>
              )}

              {pdfFile && pdfPageCount === 1 && (
                <p className="text-xs text-[var(--color-text-muted)] text-center mb-4">PDF page rendered for analysis</p>
              )}

              {error && (
                <p className="text-red-400 text-sm text-center mb-4">{error}</p>
              )}

              {/* Gate check */}
              {uploadsRemaining <= 0 ? (
                /* PAYWALL — out of uploads */
                <div className="text-center">
                  <p className="text-white font-medium mb-2">Ready to generate your 3D walkthrough</p>
                  <p className="text-[var(--color-text-muted)] text-sm mb-4">
                    {isPaidUser
                      ? `You've used all uploads on the ${planType === 'monthly' ? 'Monthly Pro' : 'Homeowner'} plan. Upgrade for more.`
                      : "You've used your free upload. Upgrade to continue."}
                  </p>
                  <button
                    onClick={() => setShowPricingModal(true)}
                    className="w-full py-3 bg-gradient-to-r from-amber-500 to-orange-500 hover:from-amber-400 hover:to-orange-400 text-white font-semibold rounded-lg transition-all mb-3"
                  >
                    {isPaidUser ? 'Upgrade Plan' : 'Upgrade to Pro'}
                  </button>
                  <button
                    onClick={handleClose}
                    className="text-sm text-[var(--color-text-muted)] hover:text-white transition-colors"
                  >
                    Go back
                  </button>
                </div>
              ) : (
                /* ALLOWED — has uploads remaining */
                <button
                  onClick={proceedToAnalysis}
                  className="w-full py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-lg transition-colors"
                >
                  Generate 3D Walkthrough
                </button>
              )}
            </div>
          )}

          {step === 'analyzing' && (
            /* Analyzing State */
            <div className="py-12 text-center">
              {preview && (
                <div className="w-32 h-32 mx-auto mb-6 rounded-xl overflow-hidden bg-[var(--color-bg-secondary)]">
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <div className="w-10 h-10 mx-auto mb-4 border-2 border-[var(--color-accent)] border-t-transparent rounded-full animate-spin"></div>

              <p className="text-white font-medium mb-1">Analyzing your plan...</p>
              <p className="text-[var(--color-text-muted)] text-sm">
                Detecting plan type automatically
              </p>
            </div>
          )}

          {step === 'confirm' && (
            /* Low Confidence Confirmation */
            <div className="text-center">
              {/* Preview */}
              {preview && (
                <div className="w-32 h-32 mx-auto mb-6 rounded-xl overflow-hidden bg-[var(--color-bg-secondary)]">
                  <img src={preview} alt="Preview" className="w-full h-full object-cover" />
                </div>
              )}

              <p className="text-white font-medium mb-2">
                We detected this as a{' '}
                <span className={detection?.type === 'site-plan' ? 'text-green-400' : 'text-[var(--color-accent)]'}>
                  {detection?.type === 'site-plan' ? 'Site Plan' : 'Floor Plan'}
                </span>
              </p>
              <p className="text-[var(--color-text-muted)] text-sm mb-6">Is that correct?</p>

              {/* Confirmation Buttons */}
              <div className="flex gap-3">
                <button
                  onClick={() => routeToMode('site-plan', preview)}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2
                    ${detection?.type === 'site-plan'
                      ? 'bg-green-600 hover:bg-green-500 text-white'
                      : 'bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
                    }
                  `}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M9 20l-5.447-2.724A1 1 0 013 16.382V5.618a1 1 0 011.447-.894L9 7m0 13l6-3m-6 3V7m6 10l4.553 2.276A1 1 0 0021 18.382V7.618a1 1 0 00-.553-.894L15 4m0 13V4m0 0L9 7" />
                  </svg>
                  Site Plan
                </button>
                <button
                  onClick={() => routeToMode('floor-plan', preview)}
                  className={`flex-1 py-3 rounded-xl font-medium transition-all flex items-center justify-center gap-2
                    ${detection?.type === 'floor-plan'
                      ? 'bg-[var(--color-accent)] hover:opacity-90 text-[var(--color-bg-primary)]'
                      : 'bg-[var(--color-bg-secondary)] hover:bg-[var(--color-bg-elevated)] text-[var(--color-text-secondary)] border border-[var(--color-border)]'
                    }
                  `}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M19 21V5a2 2 0 00-2-2H7a2 2 0 00-2 2v16m14 0h2m-2 0h-5m-9 0H3m2 0h5M9 7h1m-1 4h1m4-4h1m-1 4h1m-5 10v-5a1 1 0 011-1h2a1 1 0 011 1v5m-4 0h4" />
                  </svg>
                  Floor Plan
                  {!isPaidUser && hasUsedUpload && (
                    <span className="ml-1 px-1.5 py-0.5 text-[9px] font-bold bg-teal-500 text-white rounded">Pro</span>
                  )}
                </button>
              </div>

              {/* Try Again Link */}
              <button
                onClick={resetModal}
                className="mt-4 text-[var(--color-text-muted)] text-sm hover:text-white transition-colors"
              >
                Upload different image
              </button>
            </div>
          )}

          {/* ─── Scale calibration step ─── */}
          {step === 'scale' && (
            <div>
              <div className="text-center mb-5">
                <div className="w-10 h-10 mx-auto mb-3 rounded-full bg-[var(--color-accent)]/10 flex items-center justify-center">
                  <svg className="w-5 h-5 text-[var(--color-accent)]" fill="none" stroke="currentColor" viewBox="0 0 24 24" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 7.5h18M3 12h18M3 16.5h18" />
                  </svg>
                </div>
                <h2 className="text-white font-semibold text-lg mb-1">What's the real-world width?</h2>
                <p className="text-[var(--color-text-muted)] text-sm">
                  Enter the total width of this floor plan for accurate 3D scale. You can skip and adjust later.
                </p>
              </div>

              {/* Preview thumbnail */}
              {pendingFloorPlan && (
                <div className="w-24 h-24 mx-auto mb-4 rounded-lg overflow-hidden border border-white/10">
                  <img src={pendingFloorPlan} alt="Floor plan" className="w-full h-full object-cover" />
                </div>
              )}

              {/* Width input */}
              <div className="flex gap-2 mb-4">
                <input
                  type="number"
                  value={scaleValue}
                  onChange={e => setScaleValue(e.target.value)}
                  onKeyDown={e => e.key === 'Enter' && handleScaleSubmit()}
                  placeholder="e.g. 12"
                  min="0.1"
                  step="0.1"
                  className="flex-1 bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-white rounded-lg px-4 py-3 text-sm focus:outline-none focus:border-[var(--color-accent)]"
                  autoFocus
                />
                <select
                  value={scaleUnit}
                  onChange={e => setScaleUnit(e.target.value)}
                  className="bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-white rounded-lg px-3 py-3 text-sm focus:outline-none focus:border-[var(--color-accent)]"
                >
                  <option value="meters">meters</option>
                  <option value="feet">feet</option>
                </select>
              </div>

              <button
                onClick={handleScaleSubmit}
                className="w-full py-3 bg-[var(--color-accent)] hover:bg-[var(--color-accent-hover)] text-white font-semibold rounded-lg transition-colors mb-3"
              >
                Generate 3D Walkthrough →
              </button>
              <button
                onClick={() => confirmFloorPlan(null)}
                className="w-full py-2 text-[var(--color-text-muted)] text-sm hover:text-white transition-colors"
              >
                Skip — I'll adjust scale manually
              </button>
            </div>
          )}

        </div>

        {/* Help Text */}
        <p className="text-center text-[var(--color-text-muted)] text-sm mt-4">
          {step === 'confirm' && 'Choose the type that best matches your image'}
          {step === 'upload' && 'We\'ll automatically detect if this is a site plan or floor plan'}
          {step === 'preview' && 'Your image is ready for analysis'}
          {step === 'promise' && 'Works with photos, screenshots, and scanned plans'}
          {step === 'scale' && 'Optional — helps get room sizes right in the 3D model'}
        </p>

      </div>
    </div>
  )
}
