import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Mobile debugging
console.log('📱 Main.jsx loaded:', {
  viewport: `${window.innerWidth}x${window.innerHeight}`,
  userAgent: navigator.userAgent,
  isMobile: window.innerWidth <= 768,
  isSafari: /Safari/.test(navigator.userAgent) && !/Chrome/.test(navigator.userAgent),
  isIOS: /iPad|iPhone|iPod/.test(navigator.userAgent),
  hasTouch: 'ontouchstart' in window,
  rootElement: !!document.getElementById('root')
})

// Error handling for mobile
window.addEventListener('error', (e) => {
  console.error('📱 Global error:', e.error)
  console.error('📱 Error details:', {
    message: e.message,
    filename: e.filename,
    lineno: e.lineno,
    colno: e.colno
  })
})

window.addEventListener('unhandledrejection', (e) => {
  console.error('📱 Unhandled promise rejection:', e.reason)
})

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
