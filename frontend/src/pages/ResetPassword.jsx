import { useEffect, useState } from 'react'
import { Link, useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import '../styles/auth.css'

export default function ResetPassword() {
  const navigate = useNavigate()

  // 'verifying' | 'expired' | 'ready' | 'success'
  const [stage,    setStage]    = useState('verifying')
  const [form,     setForm]     = useState({ password: '', confirm: '' })
  const [error,    setError]    = useState('')
  const [loading,  setLoading]  = useState(false)

  useEffect(() => {
    const timeout = setTimeout(() => {
      setStage(s => s === 'verifying' ? 'expired' : s)
    }, 5000)

    const { data: { subscription } } = supabase.auth.onAuthStateChange((event) => {
      if (event === 'PASSWORD_RECOVERY') {
        clearTimeout(timeout)
        setStage('ready')
      }
    })

    return () => {
      clearTimeout(timeout)
      subscription.unsubscribe()
    }
  }, [])

  function handleChange(e) {
    setForm(prev => ({ ...prev, [e.target.name]: e.target.value }))
    setError('')
  }

  const passwordsMatch = form.password && form.password === form.confirm

  async function handleSubmit(e) {
    e.preventDefault()
    if (!passwordsMatch) return
    setLoading(true)
    const { error: updateError } = await supabase.auth.updateUser({ password: form.password })
    setLoading(false)
    if (updateError) {
      setError(updateError.message)
      return
    }
    setStage('success')
    setTimeout(() => navigate('/login', { replace: true }), 2000)
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Taru</div>
        <div className="auth-tagline">Watch your family's money grow.</div>

        {stage === 'verifying' && (
          <p className="auth-tagline" style={{ marginTop: 16 }}>Verifying your link…</p>
        )}

        {stage === 'expired' && (
          <>
            <p className="auth-tagline" style={{ marginTop: 16 }}>
              This link is invalid or has expired.
            </p>
            <div className="auth-footer">
              <Link to="/forgot-password">Request a new one</Link>
            </div>
          </>
        )}

        {stage === 'ready' && (
          <>
            <h1 className="auth-title">Choose a new password</h1>
            <form className="auth-form" onSubmit={handleSubmit} noValidate>
              <div className="field">
                <label htmlFor="password">New password</label>
                <input
                  id="password"
                  name="password"
                  type="password"
                  autoComplete="new-password"
                  placeholder="At least 8 characters"
                  value={form.password}
                  onChange={handleChange}
                  required
                />
              </div>

              <div className="field">
                <label htmlFor="confirm">Confirm new password</label>
                <input
                  id="confirm"
                  name="confirm"
                  type="password"
                  autoComplete="new-password"
                  placeholder="Same password again"
                  value={form.confirm}
                  onChange={handleChange}
                  required
                />
              </div>

              {error && <div className="auth-error">{error}</div>}

              <button type="submit" className="btn-primary" disabled={!passwordsMatch || loading}>
                {loading ? 'Updating…' : 'Update password'}
              </button>
            </form>
          </>
        )}

        {stage === 'success' && (
          <p className="auth-tagline" style={{ marginTop: 16 }}>
            Password updated. Taking you to login…
          </p>
        )}
      </div>
    </div>
  )
}
