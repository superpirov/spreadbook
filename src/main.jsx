import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { useAuth } from './store/useAuth.js'
import { captureRefParam } from './utils/referral.js'
import { applyTheme, getTheme } from './utils/theme.js'
import { trackVisit } from './utils/visits.js'
import { hydrateAmlCaches } from './utils/aml.js'

// Theme: dark by default (traders expect dark terminals), saved per device.
applyTheme(getTheme())

// Warm AML screening caches (OFAC index + community) from IndexedDB.
hydrateAmlCaches()

// Remember ?ref= invite code (consumed on registration).
captureRefParam()

// Visitor stats (one doc per visitor per day, throttled).
trackVisit(useAuth.getState().user)

// Start Firebase Auth session listener before first render.
useAuth.getState().initListener()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
