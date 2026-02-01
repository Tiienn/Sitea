import { useUser } from '../hooks/useUser'

/**
 * UpgradePrompt - Inline upgrade prompt for paid features
 *
 * Usage:
 * <UpgradePrompt feature="AI-powered floor plan analysis" />
 *
 * Variants:
 * - 'inline': Small inline badge (default)
 * - 'banner': Full-width banner
 * - 'card': Centered card with more details
 */
export default function UpgradePrompt({
  feature = 'this feature',
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
        className={`inline-flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-full
          bg-gradient-to-r from-amber-500/20 to-orange-500/20
          text-amber-400 border border-amber-500/30
          hover:from-amber-500/30 hover:to-orange-500/30
          hover:border-amber-500/50 transition-all ${className}`}
      >
        <svg className="w-3.5 h-3.5" fill="currentColor" viewBox="0 0 20 20">
          <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
        </svg>
        Upgrade
      </button>
    )
  }

  // Banner variant - full-width banner
  if (variant === 'banner') {
    return (
      <div className={`w-full p-4 rounded-lg bg-gradient-to-r from-amber-500/10 via-orange-500/10 to-amber-500/10
        border border-amber-500/20 ${className}`}>
        <div className="flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 rounded-full bg-amber-500/20 flex items-center justify-center">
              <svg className="w-5 h-5 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
            </div>
            <div>
              <p className="text-sm font-medium text-white">Unlock {feature}</p>
              <p className="text-xs text-[var(--color-text-muted)]">Upgrade to Pro for full access</p>
            </div>
          </div>
          <button
            onClick={handleUpgrade}
            className="px-4 py-2 text-sm font-medium rounded-lg
              bg-gradient-to-r from-amber-500 to-orange-500
              text-black hover:from-amber-400 hover:to-orange-400
              transition-all shadow-lg shadow-amber-500/25"
          >
            Upgrade
          </button>
        </div>
      </div>
    )
  }

  // Card variant - centered card with details
  if (variant === 'card') {
    return (
      <div className={`p-6 rounded-xl bg-[var(--color-bg-secondary)] border border-[var(--color-border)] text-center ${className}`}>
        <div className="w-16 h-16 rounded-full bg-gradient-to-br from-amber-500/20 to-orange-500/20 flex items-center justify-center mx-auto mb-4">
          <svg className="w-8 h-8 text-amber-400" fill="currentColor" viewBox="0 0 20 20">
            <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
          </svg>
        </div>
        <h3 className="text-lg font-semibold text-white mb-2">
          Upgrade to Pro
        </h3>
        <p className="text-sm text-[var(--color-text-secondary)] mb-4">
          Get access to {feature} and more premium features
        </p>
        <button
          onClick={handleUpgrade}
          className="w-full px-4 py-3 text-sm font-medium rounded-lg
            bg-gradient-to-r from-amber-500 to-orange-500
            text-black hover:from-amber-400 hover:to-orange-400
            transition-all shadow-lg shadow-amber-500/25"
        >
          View Plans
        </button>
      </div>
    )
  }

  return null
}
