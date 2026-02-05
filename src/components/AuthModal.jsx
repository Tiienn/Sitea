import { useState } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

export default function AuthModal({ onClose, onSuccess }) {
  const [mode, setMode] = useState('signin') // 'signin' | 'signup'
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [error, setError] = useState(null)
  const [message, setMessage] = useState(null)
  const [isLoading, setIsLoading] = useState(false)

  const handleGoogleSignIn = async () => {
    if (!isSupabaseConfigured()) {
      setError('Authentication service unavailable')
      return
    }
    setError(null)
    const { error: oauthError } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: window.location.origin }
    })
    if (oauthError) setError(oauthError.message)
  }

  const handleEmailSubmit = async (e) => {
    e.preventDefault()
    if (!email || !email.includes('@')) {
      setError('Please enter a valid email address')
      return
    }
    if (!password || password.length < 6) {
      setError('Password must be at least 6 characters')
      return
    }
    if (!isSupabaseConfigured()) {
      setError('Authentication service unavailable')
      return
    }

    setError(null)
    setMessage(null)
    setIsLoading(true)

    if (mode === 'signup') {
      const { error: signUpError } = await supabase.auth.signUp({
        email,
        password,
        options: { emailRedirectTo: window.location.origin }
      })
      if (signUpError) {
        setError(signUpError.message)
      } else {
        setMessage('Check your email to confirm your account')
      }
    } else {
      const { data, error: signInError } = await supabase.auth.signInWithPassword({
        email,
        password
      })
      if (signInError) {
        setError(signInError.message)
      } else if (data?.user) {
        onSuccess?.()
        onClose?.()
      }
    }

    setIsLoading(false)
  }

  const handleForgotPassword = async () => {
    if (!email || !email.includes('@')) {
      setError('Enter your email above, then click Forgot Password')
      return
    }
    if (!isSupabaseConfigured()) {
      setError('Authentication service unavailable')
      return
    }
    setError(null)
    setIsLoading(true)
    const { error: resetError } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: window.location.origin
    })
    if (resetError) {
      setError(resetError.message)
    } else {
      setMessage('Password reset link sent to your email')
    }
    setIsLoading(false)
  }

  return (
    <div className="fixed inset-0 z-[9999] flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="absolute inset-0 bg-black/80 backdrop-blur-md"
        onClick={onClose}
      />

      {/* Ambient glow */}
      <div className="absolute top-1/4 left-1/4 w-96 h-96 bg-emerald-500/20 rounded-full blur-[128px] pointer-events-none" />
      <div className="absolute bottom-1/4 right-1/4 w-96 h-96 bg-cyan-500/15 rounded-full blur-[128px] pointer-events-none" />

      {/* Modal */}
      <div
        className="relative w-full max-w-md"
        style={{
          animation: 'modalSlideUp 0.4s cubic-bezier(0.16, 1, 0.3, 1)'
        }}
      >
        {/* Close button */}
        <button
          onClick={onClose}
          className="absolute -top-14 right-0 w-10 h-10 flex items-center justify-center rounded-full bg-white/5 border border-white/10 text-white/60 hover:text-white hover:bg-white/10 transition-all hover:scale-105"
        >
          <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
            <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>

        {/* Glass card */}
        <div className="relative overflow-hidden rounded-3xl bg-gradient-to-b from-slate-800/90 to-slate-900/95 border border-white/10 shadow-2xl shadow-black/50">
          {/* Top highlight line */}
          <div className="absolute top-0 left-8 right-8 h-px bg-gradient-to-r from-transparent via-emerald-400/50 to-transparent" />

          {/* Inner glow */}
          <div className="absolute top-0 left-1/2 -translate-x-1/2 w-3/4 h-32 bg-emerald-500/10 blur-3xl pointer-events-none" />

          {/* Header */}
          <div className="relative px-8 pt-10 pb-4 text-center">
            <div className="inline-flex items-center gap-2 px-4 py-2 rounded-full bg-gradient-to-r from-emerald-500/20 to-cyan-500/20 border border-emerald-500/30 mb-5">
              <div className="w-2 h-2 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-sm font-semibold bg-gradient-to-r from-emerald-300 to-cyan-300 bg-clip-text text-transparent">
                Welcome
              </span>
            </div>

            <h2 className="text-2xl font-bold text-white mb-2 tracking-tight">
              {mode === 'signin' ? 'Sign In' : 'Create Account'}
            </h2>
            <p className="text-slate-400 text-sm">
              {mode === 'signin'
                ? 'Sign in to sync your Pro status across devices'
                : 'Create an account to get started'}
            </p>
          </div>

          {/* Tabs */}
          <div className="px-8 pb-4">
            <div className="flex bg-slate-800/50 rounded-xl p-1 border border-slate-700/50">
              <button
                onClick={() => { setMode('signin'); setError(null); setMessage(null) }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  mode === 'signin'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign In
              </button>
              <button
                onClick={() => { setMode('signup'); setError(null); setMessage(null) }}
                className={`flex-1 py-2.5 text-sm font-medium rounded-lg transition-all ${
                  mode === 'signup'
                    ? 'bg-emerald-500/20 text-emerald-300 border border-emerald-500/30'
                    : 'text-slate-400 hover:text-white'
                }`}
              >
                Sign Up
              </button>
            </div>
          </div>

          {/* Content */}
          <div className="px-8 pb-8">
            {/* Google OAuth */}
            <button
              onClick={handleGoogleSignIn}
              className="w-full flex items-center justify-center gap-3 px-4 py-3.5 bg-white/5 border border-white/10 rounded-2xl text-white text-sm font-medium hover:bg-white/10 transition-all"
            >
              <svg className="w-5 h-5" viewBox="0 0 24 24">
                <path fill="#4285F4" d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 01-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" />
                <path fill="#34A853" d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" />
                <path fill="#FBBC05" d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" />
                <path fill="#EA4335" d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" />
              </svg>
              Continue with Google
            </button>

            {/* Divider */}
            <div className="flex items-center gap-4 my-5">
              <div className="flex-1 h-px bg-slate-700/50" />
              <span className="text-xs text-slate-500">or</span>
              <div className="flex-1 h-px bg-slate-700/50" />
            </div>

            {/* Email / Password form */}
            <form onSubmit={handleEmailSubmit} className="space-y-3">
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="Email"
                className="w-full px-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all text-sm"
              />
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="Password"
                className="w-full px-4 py-3.5 bg-slate-800/50 border border-slate-700/50 rounded-2xl text-white placeholder-slate-500 focus:outline-none focus:border-emerald-500/50 focus:bg-slate-800/80 transition-all text-sm"
              />

              {mode === 'signin' && (
                <button
                  type="button"
                  onClick={handleForgotPassword}
                  className="text-xs text-slate-500 hover:text-emerald-400 transition-colors"
                >
                  Forgot password?
                </button>
              )}

              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3.5 bg-gradient-to-r from-emerald-500 to-cyan-500 text-white font-semibold rounded-2xl hover:from-emerald-400 hover:to-cyan-400 transition-all disabled:opacity-50 text-sm"
              >
                {isLoading ? 'Please wait...' : (mode === 'signin' ? 'Sign In' : 'Create Account')}
              </button>
            </form>

            {/* Error / Success messages */}
            {error && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <svg className="w-4 h-4 text-red-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-red-400">{error}</p>
              </div>
            )}
            {message && (
              <div className="flex items-center justify-center gap-2 mt-4">
                <svg className="w-4 h-4 text-emerald-400 flex-shrink-0" fill="currentColor" viewBox="0 0 20 20">
                  <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm3.707-9.293a1 1 0 00-1.414-1.414L9 10.586 7.707 9.293a1 1 0 00-1.414 1.414l2 2a1 1 0 001.414 0l4-4z" clipRule="evenodd" />
                </svg>
                <p className="text-sm text-emerald-400">{message}</p>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Reuse PricingModal animation keyframes */}
      <style>{`
        @keyframes modalSlideUp {
          from {
            opacity: 0;
            transform: translateY(20px) scale(0.98);
          }
          to {
            opacity: 1;
            transform: translateY(0) scale(1);
          }
        }
      `}</style>
    </div>
  )
}
