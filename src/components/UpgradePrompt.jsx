import { useUser } from '../hooks/useUser'

/**
 * UpgradePrompt - Inline upgrade prompt for paid features
 *
 * Usage:
 * <UpgradePrompt context="upload" />
 * <UpgradePrompt context="daynight" variant="banner" />
 *
 * Variants:
 * - 'inline': Small inline badge (default)
 * - 'banner': Full-width banner
 * - 'card': Centered card with more details
 */

const COPY = {
  upload: {
    headline: 'See your real home in 3D',
    subtext: 'Upload your floor plan and walk through it',
    button: 'Upload My Floor Plan',
  },
  daynight: {
    headline: 'See your home at golden hour',
    subtext: 'Visualize your design in different lighting',
    button: 'Try Pro',
  },
  export: {
    headline: 'Share your design',
    subtext: 'Export images and 3D models of your home',
    button: 'Try Pro',
  },
  default: {
    headline: 'Walk through your real home',
    subtext: 'Turn any floor plan into a 3D walkthrough',
    button: 'Try Pro — $29',
  },
}

export default function UpgradePrompt({
  feature = 'this feature',
  context = 'default',
  variant = 'inline',
  className = ''
}) {
  const { setShowPricingModal } = useUser()

  const handleUpgrade = () => {
    setShowPricingModal(true)
  }

  // Inline variant - small badge-like prompt
  if (variant === 'inline') {
    return (
      <button
        onClick={handleUpgrade}
        className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium rounded-full
          bg-gradient-to-r from-teal-500/20 to-cyan-500/20
          text-teal-400 border border-teal-500/30
          hover:from-teal-500/30 hover:to-cyan-500/30
          hover:border-teal-500/50 transition-all ${className}`}
      >
        Pro
      </button>
    )
  }

  // Banner variant - full-width banner
  if (variant === 'banner') {
    const copy = COPY[context] || COPY.default
    return (
      <div className={`w-full p-4 rounded-lg bg-gradient-to-r from-teal-500/10 via-cyan-500/10 to-teal-500/10
        border border-teal-500/20 ${className}`}>
        <div className="flex items-center justify-between gap-4">
          <div>
            <p className="text-sm font-medium text-white">{copy.headline}</p>
            <p className="text-xs text-[var(--color-text-muted)]">{copy.subtext}</p>
          </div>
          <button
            onClick={handleUpgrade}
            className="px-4 py-2 text-sm font-medium rounded-lg
              bg-teal-500 text-white hover:bg-teal-400
              transition-all whitespace-nowrap"
          >
            {copy.button}
          </button>
        </div>
      </div>
    )
  }

  // Card variant - centered card with details
  if (variant === 'card') {
    const copy = COPY[context] || COPY.default
    return (
      <div className={`p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center ${className}`}>
        <h3 className="text-lg font-semibold text-white mb-2">
          {copy.headline}
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          {copy.subtext}
        </p>
        <button
          onClick={handleUpgrade}
          className="w-full px-4 py-3 text-sm font-medium rounded-lg
            bg-teal-500 text-white hover:bg-teal-400
            transition-all"
        >
          {copy.button}
        </button>
      </div>
    )
  }

  return null
}
