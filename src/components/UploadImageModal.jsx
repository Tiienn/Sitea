import { useState, useRef } from 'react'
import { analyzeImage } from '../services/imageAnalysis'
import { useUser } from '../hooks/useUser.jsx'

// Confidence threshold for auto-routing (70%)
const AUTO_ROUTE_THRESHOLD = 0.7

export default function UploadImageModal({ onClose, onUploadForLand, onUploadForFloorPlan }) {
  const { isPaidUser } = useUser()
  const [isDragging, setIsDragging] = useState(false)
  const [preview, setPreview] = useState(null)
  const [step, setStep] = useState('upload') // 'upload' | 'analyzing' | 'confirm'
  const [detection, setDetection] = useState(null) // { type, confidence, method }
  const [error, setError] = useState(null)
  const fileInputRef = useRef(null)

  // Route to the appropriate mode
  const routeToMode = (type, imageData) => {
    if (type === 'site-plan') {
      onUploadForLand(imageData)
    } else {
      onUploadForFloorPlan(imageData)
    }
    onClose()
  }

  const handleFile = async (f) => {
    if (!f) return

    const validTypes = ['image/png', 'image/jpeg', 'image/jpg']
    if (!validTypes.includes(f.type)) {
      alert('Please upload a PNG or JPG file')
      return
    }

    setError(null)

    const reader = new FileReader()
    reader.onload = async (e) => {
      const imageData = e.target.result
      setPreview(imageData)
      setStep('analyzing')

      try {
        // Analyze the image to detect type
        const result = await analyzeImage(imageData, isPaidUser)
        setDetection(result)

        // Auto-route if high confidence
        if (result.confidence >= AUTO_ROUTE_THRESHOLD) {
          routeToMode(result.type, imageData)
        } else {
          // Low confidence - show confirmation
          setStep('confirm')
        }
      } catch (err) {
        console.error('Analysis failed:', err)
        setError('Could not analyze image. Please try again.')
        setStep('upload')
      }
    }
    reader.readAsDataURL(f)
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
    setStep('upload')
    setDetection(null)
    setError(null)
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

          {step === 'upload' && (
            <>
              {/* Header */}
              <div className="text-center mb-6">
                <h1 className="text-xl font-display font-semibold text-white mb-2">Upload Plan</h1>
                <p className="text-[var(--color-text-muted)] text-sm">Upload your site plan or floor plan</p>
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
                  accept="image/png,image/jpeg,image/jpg"
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
                  <p className="text-[var(--color-text-muted)] text-sm">PNG or JPG</p>
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

        </div>

        {/* Help Text */}
        <p className="text-center text-[var(--color-text-muted)] text-sm mt-4">
          {step === 'confirm'
            ? 'Choose the type that best matches your image'
            : 'We\'ll automatically detect if this is a site plan or floor plan'
          }
        </p>

      </div>
    </div>
  )
}
