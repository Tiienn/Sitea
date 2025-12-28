import { useState, useEffect, createContext, useContext } from 'react'

const UserContext = createContext(null)

export function UserProvider({ children }) {
  const [user, setUser] = useState(null)
  const [isPaidUser, setIsPaidUser] = useState(false)

  useEffect(() => {
    // Check user subscription status
    // This could be from localStorage, Supabase, or your auth provider
    const checkSubscription = async () => {
      try {
        // Check localStorage for subscription status
        const savedStatus = localStorage.getItem('landVisualizerPaidUser')
        if (savedStatus === 'true') {
          setIsPaidUser(true)
          return
        }

        // TODO: Add real subscription check via Supabase or auth provider
        // const { data: { user } } = await supabase.auth.getUser()
        // setIsPaidUser(user?.user_metadata?.subscription === 'paid')

        // Default to free user
        setIsPaidUser(false)
      } catch (error) {
        console.error('Error checking subscription:', error)
        setIsPaidUser(false)
      }
    }

    checkSubscription()
  }, [])

  // Persist paid status to localStorage when it changes
  useEffect(() => {
    localStorage.setItem('landVisualizerPaidUser', isPaidUser.toString())
  }, [isPaidUser])

  return (
    <UserContext.Provider value={{ user, isPaidUser, setIsPaidUser, setUser }}>
      {children}
    </UserContext.Provider>
  )
}

export function useUser() {
  const context = useContext(UserContext)
  if (!context) {
    // Return default values if used outside provider
    return { user: null, isPaidUser: false, setIsPaidUser: () => {}, setUser: () => {} }
  }
  return context
}
