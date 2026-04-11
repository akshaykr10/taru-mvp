import { useState } from 'react'
import { Link, useNavigate, useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import '../styles/auth.css'

export default function Login() {
  const navigate  = useNavigate()
  const location  = useLocation()
  const [form, setForm]       = useState({ email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  // Redirect to wherever the user was trying to go, or default to dashboard
  const from = location.state?.from || '/parent/dashboard'

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
      // Supabase returns "Email not confirmed" for unverified accounts
      if (signInError.message.toLowerCase().includes('email not confirmed')) {
        navigate('/verify-email', { state: { email: form.email.trim().toLowerCase() } })
        return
      }
      setError('Incorrect email or password.')
      return
    }

    navigate(from, { replace: true })
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
