import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { useAuth } from './store/useAuth.js'
import { captureRefParam } from './utils/referral.js'
import { applyTheme, getTheme } from './utils/theme.js'

// Theme: dark by default (traders expect dark terminals), saved per device.
applyTheme(getTheme())

// Remember ?ref= invite code (consumed on registration).
captureRefParam()

// Start Firebase Auth session listener before first render.
useAuth.getState().initListener()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
