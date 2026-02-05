import { useState, useEffect, createContext, useContext, useCallback } from 'react'
import { supabase, isSupabaseConfigured } from '../lib/supabaseClient'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isPaidUser, setIsPaidUser] = useState(false)
  const [isLoading, setIsLoading] = useState(true)
  const [showPricingModal, setShowPricingModal] = useState(false)
  const [showAuthModal, setShowAuthModal] = useState(false)
  const [planType, setPlanType] = useState(null) // 'monthly' | 'lifetime' | null
  const [hasUsedUpload, setHasUsedUpload] = useState(() => {
    return localStorage.getItem('landVisualizerUploadUsed') === 'true'
  })
  const [theme, setThemeState] = useState(() => {
    return localStorage.getItem('landVisualizerTheme') || 'dark'
  })

  const setTheme = useCallback((newTheme) => {
    setThemeState(newTheme)
    localStorage.setItem('landVisualizerTheme', newTheme)
  }, [])

  // Check subscription status from localStorage and optionally Supabase
  const checkSubscription = useCallback(async () => {
    setIsLoading(true)
    try {
      // First check localStorage for quick access
      const savedStatus = localStorage.getItem('landVisualizerPaidUser')
      const savedEmail = localStorage.getItem('landVisualizerEmail')
      const savedPlanType = localStorage.getItem('landVisualizerPlanType')

      if (savedStatus === 'true') {
        setIsPaidUser(true)
        setPlanType(savedPlanType)

        // If Supabase is configured, verify the subscription is still valid
        if (isSupabaseConfigured() && savedEmail) {
          const { data, error } = await supabase
            .from('subscriptions')
            .select('status, plan_type, expires_at')
            .eq('email', savedEmail.toLowerCase())
            .single()

          if (error || !data) {
            // Subscription not found in database, but keep localStorage as fallback
            console.warn('Could not verify subscription in database')
          } else if (data.status !== 'active') {
            // Subscription is no longer active
            setIsPaidUser(false)
            setPlanType(null)
            localStorage.setItem('landVisualizerPaidUser', 'false')
          } else if (data.expires_at && new Date(data.expires_at) < new Date()) {
            // Subscription has expired
            setIsPaidUser(false)
            setPlanType(null)
            localStorage.setItem('landVisualizerPaidUser', 'false')
          } else {
            // Subscription is valid
            setPlanType(data.plan_type)
          }
        }
      } else {
        setIsPaidUser(false)
        setPlanType(null)
      }
    } catch (error) {
      console.error('Error checking subscription:', error)
      // On error, trust localStorage
      const savedStatus = localStorage.getItem('landVisualizerPaidUser')
      setIsPaidUser(savedStatus === 'true')
    }
    setIsLoading(false)
  }, [])

  useEffect(() => {
    checkSubscription()
  }, [checkSubscription])

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
        localStorage.setItem('landVisualizerEmail', session.user.email)
        checkSubscription()
      } else {
        setUser(null)
      }
    })

    return () => authSub.unsubscribe()
  }, [checkSubscription])

  // Sign out — clears auth session and local state
  const signOut = useCallback(async () => {
    if (isSupabaseConfigured()) {
      await supabase.auth.signOut()
    }
    setUser(null)
    setIsPaidUser(false)
    setPlanType(null)
    localStorage.removeItem('landVisualizerPaidUser')
    localStorage.removeItem('landVisualizerEmail')
    localStorage.removeItem('landVisualizerPlanType')
  }, [])

  // Called after successful payment
  const onPaymentSuccess = useCallback((newPlanType) => {
    setIsPaidUser(true)
    setPlanType(newPlanType)
    setShowPricingModal(false)
    localStorage.setItem('landVisualizerPaidUser', 'true')
    localStorage.setItem('landVisualizerPlanType', newPlanType)
  }, [])

  // Show pricing modal when user tries to access paid feature
  const requirePaid = useCallback((callback) => {
    if (isPaidUser) {
      callback?.()
      return true
    }
    setShowPricingModal(true)
    return false
  }, [isPaidUser])

  // Check if user can use upload (first time free, then Pro required)
  // Returns true if allowed, false if blocked (shows pricing modal)
  const canUseUpload = useCallback(() => {
    // Pro users always allowed
    if (isPaidUser) return true
    // First time free
    if (!hasUsedUpload) return true
    // Already used free trial, show pricing
    setShowPricingModal(true)
    return false
  }, [isPaidUser, hasUsedUpload])

  // Mark upload as used (call after successful upload)
  const markUploadUsed = useCallback(() => {
    if (!hasUsedUpload) {
      setHasUsedUpload(true)
      localStorage.setItem('landVisualizerUploadUsed', 'true')
    }
  }, [hasUsedUpload])

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
      refreshSubscription: checkSubscription,
      theme,
      setTheme
    }}>
      {children}
    </UserContext.Provider>
  )
}

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
      markUploadUsed: () => {},
      hasUsedUpload: false,
      refreshSubscription: () => {},
      theme: 'dark',
      setTheme: () => {}
    }
  }
  return context
}
