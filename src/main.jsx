// StrictMode removed - causes WebGL context loss with Three.js
// import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { UserProvider } from './hooks/useUser'
import './index.css'
import App from './App.jsx'

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
