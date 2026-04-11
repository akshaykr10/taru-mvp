import { useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import '../styles/auth.css'

export default function Signup() {
  const navigate = useNavigate()
  const [form, setForm]       = useState({ name: '', email: '', password: '' })
  const [error, setError]     = useState('')
  const [loading, setLoading] = useState(false)

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  async function handleSubmit(e) {
    e.preventDefault()
    setError('')

    if (form.password.length < 8) {
      setError('Password must be at least 8 characters.')
      return
    }

    setLoading(true)
    const { error: signUpError } = await supabase.auth.signUp({
      email: form.email.trim().toLowerCase(),
      password: form.password,
      options: {
        // name is stored in user_metadata → picked up by the DB trigger
        data: { name: form.name.trim() },
        // After email confirmation, Supabase redirects here
        emailRedirectTo: `${window.location.origin}/parent/onboarding`,
      },
    })
    setLoading(false)

    if (signUpError) {
      setError(signUpError.message)
      return
    }

    // Go to the holding page — user must confirm email before they can log in
    navigate('/verify-email', { state: { email: form.email.trim().toLowerCase() } })
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Taru</div>
        <div className="auth-tagline">Watch your family's money grow.</div>

        <h1 className="auth-title">Create your account</h1>

        <form className="auth-form" onSubmit={handleSubmit} noValidate>
          <div className="field">
            <label htmlFor="name">Your name</label>
            <input
              id="name"
              name="name"
              type="text"
              autoComplete="name"
              placeholder="Priya Sharma"
              value={form.name}
              onChange={handleChange}
              required
            />
          </div>

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
              autoComplete="new-password"
              placeholder="Minimum 8 characters"
              value={form.password}
              onChange={handleChange}
              required
            />
          </div>

          {error && <div className="auth-error">{error}</div>}

          <button type="submit" className="btn-primary" disabled={loading}>
            {loading ? 'Creating account…' : 'Create account'}
          </button>
        </form>

        <div className="auth-footer">
          Already have an account? <Link to="/login">Log in</Link>
        </div>
      </div>
    </div>
  )
}
