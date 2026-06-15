import { useState, useEffect } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import { BACKEND_URL } from '../lib/api.js'
import { EULA_VERSION } from '../legal/index.js'
import { useAuth } from '../context/AuthContext.jsx'
import '../styles/auth.css'

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const { session } = useAuth()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)
  const [navigateTo, setNavigateTo] = useState(null)

  // Redirect to wherever the user was trying to go, or default to dashboard
  const from = location.state?.from || '/parent/dashboard'

  // Wait for AuthContext to confirm the session before navigating to protected routes.
  // This avoids a race condition where navigate() fires before onAuthStateChange updates the context.
  useEffect(() => {
    if (session && navigateTo) {
      navigate(navigateTo, { replace: true })
    }
  }, [session, navigateTo, navigate])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')
    setLoading(true)

    const { error: signInError } = await supabase.auth.signInWithPassword({
      email:    form.email.trim().toLowerCase(),
      password: form.password,
    })
    setLoading(false)

    if (signInError) {
      setError('Incorrect email or password.')
      return
    }

    // Check whether the user has already accepted the current EULA version.
    // Uses the backend (service role) so RLS on consent_log is not a factor.
    const { data: { session: newSession } } = await supabase.auth.getSession()
    let accepted = false
    try {
      const statusRes = await fetch(
        `${BACKEND_URL}/api/consent/status?eulaVersion=${encodeURIComponent(EULA_VERSION)}`,
        { headers: { Authorization: `Bearer ${newSession?.access_token}` } }
      )
      if (statusRes.ok) {
        const body = await statusRes.json()
        accepted = body.accepted
      }
    } catch {
      // Network error — treat as unaccepted so the user sees the EULA
      accepted = false
    }

    if (!accepted) {
      // No acceptance on record — show EULA before proceeding.
      // /eula is not auth-protected so we can navigate immediately.
      navigate('/eula', { replace: true, state: { from } })
      return
    }

    // Don't navigate immediately — wait for AuthContext to confirm the session
    // via onAuthStateChange, then the useEffect above will fire the navigation.
    setNavigateTo(from)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Taru</div>
        <div className="auth-tagline">Watch your family's money grow.</div>

        <h1 className="auth-title">Log in</h1>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="email">Email address</label>
            <input
              id="email"
              name="email"
              type="email"
              autoComplete="email"
              placeholder="priya@example.com"
              value={form.email}
              onChange={handleChange}
              required
            />
          </div>

          <div className="field">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              placeholder="Your password"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Logging in…' : 'Log in'}
          </button>
        </form>

        <div className="auth-footer">
          No account yet? <Link to="/signup">Create one</Link>
        </div>
      </div>
    </div>
  )
}
