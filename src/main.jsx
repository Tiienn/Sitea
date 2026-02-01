// StrictMode removed - causes WebGL context loss with Three.js
// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { PayPalScriptProvider } from '@paypal/react-paypal-js'
import { UserProvider } from './hooks/useUser'
import './index.css'
import App from './App.jsx'

// PayPal configuration - uses environment variable or placeholder
const paypalOptions = {
  'client-id': import.meta.env.VITE_PAYPAL_CLIENT_ID || 'test',
  currency: 'USD',
  intent: 'capture',
  // Enable both buttons and subscription
  components: 'buttons',
  vault: true
}

createRoot(document.getElementById('root')).render(
  // StrictMode disabled - causes WebGL context loss due to double-mounting 3D scene
  // <StrictMode>
    <BrowserRouter>
      <PayPalScriptProvider options={paypalOptions}>
        <UserProvider>
          <App />
        </UserProvider>
      </PayPalScriptProvider>
    </BrowserRouter>
  // </StrictMode>,
)
