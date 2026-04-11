import { useState } from 'react'
import { useLocation } from 'react-router-dom'
import { supabase } from '../lib/supabase.js'
import '../styles/auth.css'

export default function VerifyEmail() {
  const location = useLocation()
  const email    = location.state?.email || ''

  const [resendState, setResendState] = useState('idle') // 'idle' | 'sending' | 'sent' | 'error'

  async function handleResend() {
    if (!email || resendState === 'sending') return
    setResendState('sending')

    const { error } = await supabase.auth.resend({
      type:  'signup',
      email: email,
      options: {
        emailRedirectTo: `${window.location.origin}/parent/onboarding`,
      },
    })

    setResendState(error ? 'error' : 'sent')
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-logo">Taru</div>

        <div className="verify-icon">📬</div>

        <h1 className="auth-title">Check your inbox</h1>

        <p className="verify-body">
          We've sent a confirmation link to{' '}
          {email ? <strong>{email}</strong> : 'your email address'}.
          <br /><br />
          Click the link in that email to activate your account. It may take a
          minute or two to arrive — check your spam folder if you don't see it.
        </p>

        {email && (
          <>
            <button
              className="btn-ghost"
              onClick={handleResend}
              disabled={resendState === 'sending' || resendState === 'sent'}
              style={{ width: '100%' }}
            >
              {resendState === 'sending' ? 'Sending…'
                : resendState === 'sent'    ? 'Email sent!'
                : 'Resend confirmation email'}
            </button>

            <div className="resend-status">
              {resendState === 'sent' && (
                <span style={{ color: 'var(--color-success)' }}>
                  Sent. Check your inbox again.
                </span>
              )}
              {resendState === 'error' && (
                <span style={{ color: 'var(--color-error)' }}>
                  Something went wrong. Try again in a moment.
                </span>
              )}
            </div>
          </>
        )}

        <div className="auth-footer" style={{ marginTop: 'var(--space-4)' }}>
          Wrong email? <a href="/signup">Start over</a>
        </div>
      </div>
    </div>
  )
}
