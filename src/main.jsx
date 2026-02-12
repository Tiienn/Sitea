// StrictMode removed - causes WebGL context loss with Three.js
// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { UserProvider } from './hooks/useUser'
import './index.css'
import App from './App.jsx'
import { supabase } from './lib/supabaseClient'

// Handle deep link OAuth callback (Capacitor: Chrome redirects back to app with tokens)
if (window.Capacitor) {
  import('@capacitor/app').then(({ App: CapApp }) => {
    CapApp.addListener('appUrlOpen', ({ url }) => {
      // Extract tokens from hash fragment: sitea.live/#access_token=...&refresh_token=...
      const hashParams = new URLSearchParams(url.split('#')[1] || '')
      const accessToken = hashParams.get('access_token')
      const refreshToken = hashParams.get('refresh_token')
      if (accessToken && refreshToken && supabase) {
        supabase.auth.setSession({ access_token: accessToken, refresh_token: refreshToken })
      }
    })
  })
}

createRoot(document.getElementById('root')).render(
  // StrictMode disabled - causes WebGL context loss due to double-mounting 3D scene
  // <StrictMode>
    <BrowserRouter>
      <UserProvider>
        <App />
      </UserProvider>
    </BrowserRouter>
  // </StrictMode>,
)
