import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'

// Landing
import Landing from './pages/Landing.jsx'

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

/**
 * /app entry point: if the user is already authenticated send them to the
 * parent dashboard; otherwise send them to the login page.
 * Both legacy paths (/login, /parent/*) remain registered below so existing
 * internal navigation (RequireParentAuth redirects, Signup.navigate, etc.)
 * continues to work without touching any component files.
 */
function AppRedirect() {
  const { session, loading } = useAuth()
  if (loading) return null
  return session
    ? <Navigate to="/parent/dashboard" replace />
    : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Landing page ─────────────────────────────────────────── */}
          <Route path="/" element={<Landing />} />

          {/* ── /app entry: auth-gate redirect ───────────────────────── */}
          <Route path="/app" element={<AppRedirect />} />

          {/* ── Public auth routes (original paths + /app/* aliases) ─── */}
          <Route path="/signup"           element={<Signup />} />
          <Route path="/login"            element={<Login />} />
          <Route path="/verify-email"     element={<VerifyEmail />} />
          <Route path="/app/signup"       element={<Signup />} />
          <Route path="/app/login"        element={<Login />} />
          <Route path="/app/verify-email" element={<VerifyEmail />} />

          {/* ── Parent — auth required (original paths + /app/* aliases) */}
          <Route element={<RequireParentAuth />}>
            {/* Onboarding is full-screen (no nav shell) */}
            <Route path="/parent/onboarding"     element={<ParentOnboarding />} />
            <Route path="/app/parent/onboarding" element={<ParentOnboarding />} />

            {/* All other parent routes share the header + bottom-nav shell */}
            <Route element={<ParentLayout />}>
              <Route path="/parent/dashboard"      element={<ParentDashboard />} />
              <Route path="/parent/portfolio"      element={<ParentPortfolio />} />
              <Route path="/parent/settings"       element={<ParentSettings />} />
              <Route path="/app/parent/dashboard"  element={<ParentDashboard />} />
              <Route path="/app/parent/portfolio"  element={<ParentPortfolio />} />
              <Route path="/app/parent/settings"   element={<ParentSettings />} />
            </Route>
          </Route>

          {/* ── Child — signed child JWT in URL (original + /app/* aliases) */}
          <Route path="/child/:token"     element={<ChildGarden />} />
          <Route path="/app/child/:token" element={<ChildGarden />} />

          {/* ── Fallback — send unknown URLs to the landing page ──────── */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  )
}
