import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.jsx'
import './index.css'
import { useAuth } from './store/useAuth.js'

// Force dark theme by default (traders expect dark terminals).
document.documentElement.classList.add('dark')

// Start Firebase Auth session listener before first render.
useAuth.getState().initListener()

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
)
