import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider } from './context/AuthContext.jsx'

// Public routes
import Signup      from './pages/Signup.jsx'
import Login       from './pages/Login.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'

// Parent routes (auth-gated)
import ParentOnboarding from './pages/parent/Onboarding.jsx'
import ParentDashboard  from './pages/parent/Dashboard.jsx'
import ParentPortfolio  from './pages/parent/Portfolio.jsx'
import ParentSettings   from './pages/parent/Settings.jsx'

// Child route (token-gated, no login)
import ChildGarden from './pages/child/Garden.jsx'

// Guards & layout
import RequireParentAuth from './components/RequireParentAuth.jsx'
import ParentLayout      from './components/ParentLayout.jsx'

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* ── Public ───────────────────────────────────── */}
          <Route path="/signup"       element={<Signup />} />
          <Route path="/login"        element={<Login />} />
          <Route path="/verify-email" element={<VerifyEmail />} />

          {/* ── Parent — auth required ────────────────────── */}
          <Route element={<RequireParentAuth />}>
            {/* Onboarding is full-screen (no nav shell) */}
            <Route path="/parent/onboarding" element={<ParentOnboarding />} />

            {/* All other parent routes share the header + bottom-nav shell */}
            <Route element={<ParentLayout />}>
              <Route path="/parent/dashboard" element={<ParentDashboard />} />
              <Route path="/parent/portfolio" element={<ParentPortfolio />} />
              <Route path="/parent/settings"  element={<ParentSettings />} />
            </Route>
          </Route>

          {/* ── Child — signed child JWT in URL, no login ─── */}
          <Route path="/child/:token" element={<ChildGarden />} />

          {/* ── Fallbacks ─────────────────────────────────── */}
          <Route path="/" element={<Navigate to="/login" replace />} />
          <Route path="*" element={<Navigate to="/login" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
