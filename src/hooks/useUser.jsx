import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'
import { toErrorMessage } from '../utils/errorMessages'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isPaidUser, setIsPaidUser] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [planType, setPlanType] = useState(null) // 'monthly' | 'lifetime' | null
  const [uploadCount, setUploadCount] = useState(0)
  const [uploadLimit, setUploadLimit] = useState(1)
  const [uploadsRemaining, setUploadsRemaining] = useState(0)
  const [uploadQuotaError, setUploadQuotaError] = useState(null)
  const hasUsedUpload = uploadCount > 0
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('landVisualizerTheme') || 'dark'
  })

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme)
    localStorage.setItem('landVisualizerTheme', newTheme)
  }, [])

  const applyUploadQuota = useCallback((quota) => {
    const limit = quota?.isUnlimited ? Infinity : (quota?.limit ?? 1)
    setUploadCount(quota?.used || 0)
    setUploadLimit(limit)
    setUploadsRemaining(limit === Infinity ? Infinity : (quota?.remaining ?? 0))
  }, [])

  const resetUploadQuota = useCallback(() => {
    setUploadCount(0)
    setUploadLimit(1)
    setUploadsRemaining(0)
    setUploadQuotaError(null)
  }, [])

  const refreshUploadQuota = useCallback(async () => {
    if (!isSupabaseConfigured()) {
      resetUploadQuota()
      return null
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        resetUploadQuota()
        return null
      }

      const response = await fetch('/api/upload-quota', {
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || data.error) {
        throw new Error(data.error || 'Could not load upload quota')
      }

      applyUploadQuota(data)
      setUploadQuotaError(null)
      return data
    } catch (error) {
      console.error('Error loading upload quota:', error)
      setUploadQuotaError(error.message)
      return null
    }
  }, [applyUploadQuota, resetUploadQuota])

  // Check subscription status from Supabase. localStorage is only a UI cache.
  const checkSubscription = useCallback(async () => {
    setIsLoading(true)
    try {
      const savedEmail = localStorage.getItem('landVisualizerEmail')
      const savedPlanType = localStorage.getItem('landVisualizerPlanType')

      if (savedPlanType) {
        setPlanType(savedPlanType)
      }

      if (!isSupabaseConfigured() || !savedEmail) {
        setIsPaidUser(false)
        setPlanType(null)
        localStorage.setItem('landVisualizerPaidUser', 'false')
        setIsLoading(false)
        return
      }

      const { data } = await supabase
        .from('subscriptions')
        .select('status, plan_type, expires_at')
        .eq('email', savedEmail.toLowerCase())
        .eq('status', 'active')
        .maybeSingle()

      if (data && (!data.expires_at || new Date(data.expires_at) >= new Date())) {
        setIsPaidUser(true)
        setPlanType(data.plan_type)
        localStorage.setItem('landVisualizerPaidUser', 'true')
        localStorage.setItem('landVisualizerPlanType', data.plan_type)
      } else {
        setIsPaidUser(false)
        setPlanType(null)
        localStorage.setItem('landVisualizerPaidUser', 'false')
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
      setIsPaidUser(false)
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    checkSubscription()
  }, [checkSubscription])

  useEffect(() => {
    localStorage.removeItem('landVisualizerUploadCount')
  }, [])

  // Auth listener — syncs Supabase auth session to user state
  useEffect(() => {
    if (!isSupabaseConfigured()) return

    // Check existing session on mount
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session?.user) {
        setUser(session.user)
        localStorage.setItem('landVisualizerEmail', session.user.email)
        checkSubscription()
      }
    })

    // Listen for auth changes (sign in, sign out, token refresh)
    const { data: { subscription: authSub } } = supabase.auth.onAuthStateChange((_event, session) => {
      if (session?.user) {
        setUser(session.user)
        setShowAuthModal(false)
        localStorage.setItem('landVisualizerEmail', session.user.email)
        checkSubscription()
      } else {
        setUser(null)
        resetUploadQuota()
      }
    })

    return () => authSub.unsubscribe()
  }, [checkSubscription, resetUploadQuota])

  useEffect(() => {
    if (user) {
      refreshUploadQuota()
    } else {
      resetUploadQuota()
    }
  }, [user, isPaidUser, planType, refreshUploadQuota, resetUploadQuota])

  // Sign out — clears auth session and local state
  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setIsPaidUser(false)
    setPlanType(null)
    resetUploadQuota()
    localStorage.removeItem('landVisualizerPaidUser')
    localStorage.removeItem('landVisualizerEmail')
    localStorage.removeItem('landVisualizerPlanType')
    localStorage.removeItem('landVisualizerUploadCount')
  }, [resetUploadQuota])

  // Called after successful payment
  const onPaymentSuccess = useCallback((newPlanType) => {
    setIsPaidUser(true)
    setPlanType(newPlanType)
    setShowPricingModal(false)
    localStorage.setItem('landVisualizerPaidUser', 'true')
    localStorage.setItem('landVisualizerPlanType', newPlanType)
    refreshUploadQuota()
  }, [refreshUploadQuota])

  // Show pricing modal when user tries to access paid feature
  const requirePaid = useCallback((callback) => {
    if (isPaidUser) {
      callback?.()
      return true
    }
    setShowPricingModal(true)
    return false
  }, [isPaidUser])

  // Upload limits by plan
  const getUploadLimit = useCallback(() => {
    return uploadLimit
  }, [uploadLimit])

  // Check if user can use upload
  // Returns true if allowed, false if blocked (shows auth/pricing modal)
  const canUseUpload = useCallback(() => {
    if (!user) {
      setShowAuthModal(true)
      return false
    }
    if (uploadsRemaining === Infinity || uploadCount < getUploadLimit()) return true
    setShowPricingModal(true)
    return false
  }, [user, uploadsRemaining, uploadCount, getUploadLimit])

  // Mark upload as used (call after successful upload)
  const markUploadUsed = useCallback(async () => {
    if (!user) {
      setShowAuthModal(true)
      return { ok: false, error: 'Please sign in to upload plans' }
    }
    if (!isSupabaseConfigured()) {
      return { ok: false, error: 'Uploads require Supabase to be configured' }
    }

    try {
      const { data: { session } } = await supabase.auth.getSession()
      if (!session?.access_token) {
        setShowAuthModal(true)
        return { ok: false, error: 'Please sign in to upload plans' }
      }

      const response = await fetch('/api/upload-quota', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${session.access_token}`,
        },
      })
      const data = await response.json().catch(() => ({}))

      if (!response.ok || data.error) {
        const message = toErrorMessage(data.error, 'Upload limit reached')
        if (response.status === 401) setShowAuthModal(true)
        if (response.status === 403) setShowPricingModal(true)
        setUploadQuotaError(message)
        return { ok: false, error: message }
      }

      applyUploadQuota(data)
      setUploadQuotaError(null)
      return { ok: true, ...data }
    } catch (error) {
      console.error('Error updating upload quota:', error)
      setUploadQuotaError(error.message)
      return { ok: false, error: error.message }
    }
  }, [applyUploadQuota, user])

  return (
    <UserContext.Provider value={{
      user,
      isPaidUser,
      isLoading,
      planType,
      showPricingModal,
      setShowPricingModal,
      showAuthModal,
      setShowAuthModal,
      setIsPaidUser,
      setUser,
      onPaymentSuccess,
      signOut,
      requirePaid,
      canUseUpload,
      markUploadUsed,
      hasUsedUpload,
      uploadCount,
      uploadsRemaining,
      uploadLimit,
      uploadQuotaError,
      refreshSubscription: checkSubscription,
      refreshUploadQuota,
      theme,
      setTheme
    }}>
      {children}
    </UserContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    // Return default values if used outside provider
    return {
      user: null,
      isPaidUser: false,
      isLoading: false,
      planType: null,
      showPricingModal: false,
      setShowPricingModal: () => {},
      showAuthModal: false,
      setShowAuthModal: () => {},
      setIsPaidUser: () => {},
      setUser: () => {},
      onPaymentSuccess: () => {},
      signOut: async () => {},
      requirePaid: () => false,
      canUseUpload: () => true,
      markUploadUsed: async () => ({ ok: true }),
      hasUsedUpload: false,
      uploadCount: 0,
      uploadsRemaining: 0,
      uploadLimit: 1,
      uploadQuotaError: null,
      refreshSubscription: () => {},
      refreshUploadQuota: () => {},
      theme: 'dark',
      setTheme: () => {}
    }
  }
  return context
}
