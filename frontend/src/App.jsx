import { useState, useEffect } from 'react'
import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'
import { supabase } from './lib/supabase.js'
import { EULA_VERSION } from './legal/index.js'

// Landing
import Landing from './pages/Landing.jsx'

// Public routes
import Signup      from './pages/Signup.jsx'
import Login       from './pages/Login.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'

// Legal pages
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import TermsOfUse    from './pages/TermsOfUse.jsx'

// Parent routes (auth-gated)
import ParentOnboarding from './pages/parent/Onboarding.jsx'
import ParentDashboard  from './pages/parent/Dashboard.jsx'
import ParentPortfolio  from './pages/parent/Portfolio.jsx'
import ParentSettings   from './pages/parent/Settings.jsx'

// Child route (token-gated, no login)
import ChildGarden from './pages/child/Garden.jsx'

// Guards, layout, modals
import RequireParentAuth from './components/RequireParentAuth.jsx'
import ParentLayout      from './components/ParentLayout.jsx'
import EulaModal         from './components/EulaModal.jsx'

function AppRedirect() {
  const { session, loading } = useAuth()
  if (loading) return null
  return session
    ? <Navigate to="/parent/dashboard" replace />
    : <Navigate to="/login" replace />
}

/**
 * Shown over authenticated parent routes only.
 * Checks consent_log server-side (via supabase admin client on backend) —
 * uses the anon client here just to read the record for the current user.
 */
function EulaGate({ children }) {
  const { session, loading } = useAuth()
  // null = still checking, false = no consent, true = consented
  const [hasConsent, setHasConsent] = useState(null)

  useEffect(() => {
    if (loading || !session) return

    async function checkConsent() {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) { setHasConsent(false); return }

      const { data } = await supabase
        .from('consent_log')
        .select('id')
        .eq('user_id', user.id)
        .eq('eula_version', EULA_VERSION)
        .maybeSingle()

      setHasConsent(!!data)
    }

    checkConsent()
  }, [session, loading])

  if (loading || hasConsent === null) return null

  if (!hasConsent) {
    return <EulaModal onAccepted={() => setHasConsent(true)} />
  }

  return children
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

          {/* ── Legal pages (public) ─────────────────────────────────── */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms"   element={<TermsOfUse />} />

          {/* ── Parent — auth required (original paths + /app/* aliases) */}
          <Route element={<RequireParentAuth />}>
            <Route element={<EulaGate><Outlet /></EulaGate>}>
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
