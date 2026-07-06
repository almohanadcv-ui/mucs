/**
 * MAB UNITED — Support System
 * Copyright © 2026 IT.MAB. All Rights Reserved.
 * Owner & Developer: IT.MAB
 */
import React from 'react'
import ReactDOM from 'react-dom/client'
import axios from 'axios'
import App from './App.jsx'
import './index.css'
import { AuthProvider } from './context/AuthContext.jsx'
import { SocketProvider } from './context/SocketContext.jsx'
import { BrowserRouter } from 'react-router-dom'
import { Toaster } from 'react-hot-toast'
import ErrorBoundary from './components/ErrorBoundary.jsx'

// ─────────────────────────────────────────────────────────────────
//  Production API URL — hardcoded fallback so the site never breaks
//  even if VITE_API_URL is missing/empty in the build environment.
// ─────────────────────────────────────────────────────────────────
const PRODUCTION_API = 'https://mab-united-support-production.up.railway.app';

const apiUrl = (import.meta.env.VITE_API_URL || PRODUCTION_API).trim().replace(/\/$/, '');

axios.defaults.baseURL = apiUrl;
axios.defaults.timeout = 30000; // 30s — never hang forever

// Restore Authorization header from localStorage immediately
try {
  const stored = localStorage.getItem('mab_userInfo');
  if (stored) {
    const parsed = JSON.parse(stored);
    if (parsed?.token) {
      axios.defaults.headers.common['Authorization'] = `Bearer ${parsed.token}`;
    }
  }
} catch {
  // Malformed localStorage — wipe it
  try { localStorage.removeItem('mab_userInfo'); } catch {}
}

// Debug info — visible in DevTools so we can verify the bundle is current
console.info('[MAB] API:', apiUrl);

ReactDOM.createRoot(document.getElementById('root')).render(
  <ErrorBoundary>
    <BrowserRouter>
      <AuthProvider>
        <SocketProvider>
          <App />
          <Toaster position="top-center" reverseOrder={false} />
        </SocketProvider>
      </AuthProvider>
    </BrowserRouter>
  </ErrorBoundary>
)
