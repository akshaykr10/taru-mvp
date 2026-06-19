import { BrowserRouter, Routes, Route, Navigate, Outlet } from 'react-router-dom'
import { HelmetProvider } from 'react-helmet-async'
import { AuthProvider, useAuth } from './context/AuthContext.jsx'

// Landing
import Landing from './pages/Landing.jsx'

// Public routes
import Signup      from './pages/Signup.jsx'
import Login       from './pages/Login.jsx'
import VerifyEmail from './pages/VerifyEmail.jsx'
import EulaPage       from './pages/EulaPage.jsx'
import ForgotPassword from './pages/ForgotPassword.jsx'
import ResetPassword  from './pages/ResetPassword.jsx'

// Legal pages
import PrivacyPolicy from './pages/PrivacyPolicy.jsx'
import TermsOfUse    from './pages/TermsOfUse.jsx'

// Blog
import BlogIndex     from './components/blog/BlogIndex.jsx'
import BlogPost      from './components/blog/BlogPost.jsx'

// Public tools
import TaxCalculator          from './pages/TaxCalculator.jsx'
import MilestoneCalculatorPage from './pages/MilestoneCalculatorPage.jsx'

// Parent routes (auth-gated)
import ParentOnboarding from './pages/parent/Onboarding.jsx'
import ParentDashboard  from './pages/parent/Dashboard.jsx'
import ParentPortfolio  from './pages/parent/Portfolio.jsx'
import ParentSettings   from './pages/parent/Settings.jsx'
import ParentComingSoon from './pages/parent/ComingSoon.jsx'

// Child route (token-gated, no login)
import ChildGarden from './pages/child/Garden.jsx'

// Guards & layout
import RequireParentAuth from './components/RequireParentAuth.jsx'
import ParentLayout      from './components/ParentLayout.jsx'

function AppRedirect() {
  const { session, loading } = useAuth()
  if (loading) return null
  return session
    ? <Navigate to="/parent/dashboard" replace />
    : <Navigate to="/login" replace />
}

export default function App() {
  return (
    <HelmetProvider>
    <AuthProvider>
      <BrowserRouter>
        <Routes>

          {/* ── Landing page ─────────────────────────────────────────── */}
          <Route path="/" element={<Landing />} />

          {/* ── Blog (public, no auth) ───────────────────────────────── */}
          <Route path="/blog"           element={<BlogIndex />} />
          <Route path="/blog/:slug"     element={<BlogPost />} />

          {/* ── Public tools ─────────────────────────────────────────── */}
          <Route path="/tax-calculator" element={<TaxCalculator />} />
          <Route path="/calculator"     element={<MilestoneCalculatorPage />} />

          {/* ── /app entry: auth-gate redirect ───────────────────────── */}
          <Route path="/app" element={<AppRedirect />} />

          {/* ── Public auth routes (original paths + /app/* aliases) ─── */}
          <Route path="/signup"           element={<Signup />} />
          <Route path="/login"            element={<Login />} />
          <Route path="/verify-email"     element={<VerifyEmail />} />
          <Route path="/app/signup"       element={<Signup />} />
          <Route path="/app/login"        element={<Login />} />
          <Route path="/app/verify-email" element={<VerifyEmail />} />

          {/* ── EULA acceptance — public (user is authed but hasn't agreed yet) */}
          <Route path="/eula"             element={<EulaPage />} />

          {/* ── Password reset flow (public) ─────────────────────────── */}
          <Route path="/forgot-password"  element={<ForgotPassword />} />
          <Route path="/reset-password"   element={<ResetPassword />} />

          {/* ── Legal pages (public) ─────────────────────────────────── */}
          <Route path="/privacy" element={<PrivacyPolicy />} />
          <Route path="/terms"   element={<TermsOfUse />} />

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
              <Route path="/parent/coming-soon"    element={<ParentComingSoon />} />
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
    </HelmetProvider>
  )
}
