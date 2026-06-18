import { useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { useAuth } from '../../context/AuthContext.jsx'
import { BACKEND_URL } from '../../lib/api.js'
import '../../styles/parent.css'

const FEATURES = {
  invest: {
    title: 'Invest',
    body: 'Start SIPs directly from Taru — curated funds, straight to your AMC, no paperwork.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <polyline
          points="4,32 14,20 22,26 36,8"
          stroke="var(--amber-md)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="28,8 36,8 36,16"
          stroke="var(--amber-md)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
  protect: {
    title: 'Protect',
    body: 'Term and child insurance — with full cost transparency before you commit.',
    icon: (
      <svg width="40" height="40" viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
        <path
          d="M20 4L6 10v10c0 8.284 5.928 14.636 14 17 8.072-2.364 14-8.716 14-17V10L20 4z"
          stroke="var(--amber-md)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
        <polyline
          points="14,20 18,24 26,16"
          stroke="var(--amber-md)"
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeLinejoin="round"
        />
      </svg>
    ),
  },
}

export default function ComingSoon() {
  const navigate = useNavigate()
  const [searchParams] = useSearchParams()
  const { user } = useAuth()

  const feature = searchParams.get('feature') ?? 'invest'
  const content = FEATURES[feature] ?? FEATURES.invest

  const [email, setEmail]       = useState(user?.email ?? '')
  const [submitted, setSubmitted] = useState(false)
  const [submitting, setSubmitting] = useState(false)

  async function handleSubmit(e) {
    e.preventDefault()
    if (!email || submitting) return
    setSubmitting(true)
    try {
      await fetch(`${BACKEND_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email, source: `coming_soon_${feature}` }),
      })
      setSubmitted(true)
    } catch {
      setSubmitted(true) // treat network errors as success — best-effort
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.page}>
      <button onClick={() => navigate(-1)} style={styles.back} aria-label="Go back">
        <svg width="20" height="20" viewBox="0 0 20 20" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
          <polyline points="12,4 6,10 12,16" stroke="var(--ink)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
        Back
      </button>

      <div style={styles.center}>
        <div style={styles.icon}>{content.icon}</div>

        <span style={styles.eyebrow}>Coming soon</span>
        <h1 style={styles.title}>{content.title}</h1>
        <p style={styles.body}>{content.body}</p>

        <div style={styles.captureCard}>
          {submitted ? (
            <p style={styles.success}>We'll let you know ✓</p>
          ) : (
            <form onSubmit={handleSubmit} style={styles.form}>
              <input
                type="email"
                required
                value={email}
                onChange={e => setEmail(e.target.value)}
                placeholder="Your email"
                style={styles.input}
              />
              <button type="submit" disabled={submitting} style={styles.btn}>
                {submitting ? 'Saving…' : 'Notify me'}
              </button>
            </form>
          )}
          <p style={styles.trust}>You're already on the list — we'll reach out when it's ready.</p>
        </div>
      </div>
    </div>
  )
}

const styles = {
  page: {
    minHeight: '100dvh',
    background: 'var(--bg)',
    display: 'flex',
    flexDirection: 'column',
    padding: 'var(--sp6)',
  },
  back: {
    display: 'inline-flex',
    alignItems: 'center',
    gap: 'var(--sp2)',
    background: 'none',
    border: 'none',
    cursor: 'pointer',
    color: 'var(--ink)',
    fontFamily: 'var(--font-parent)',
    fontSize: '14px',
    padding: '0',
    minHeight: '44px',
  },
  center: {
    flex: 1,
    display: 'flex',
    flexDirection: 'column',
    alignItems: 'center',
    justifyContent: 'center',
    textAlign: 'center',
    gap: 'var(--sp3)',
  },
  icon: {
    marginBottom: 'var(--sp2)',
  },
  eyebrow: {
    fontFamily: 'var(--font-parent)',
    fontSize: '11px',
    fontWeight: 600,
    letterSpacing: '0.1em',
    textTransform: 'uppercase',
    color: 'var(--amber-md)',
  },
  title: {
    fontFamily: 'var(--font-display)',
    fontSize: '32px',
    fontWeight: 600,
    color: 'var(--ink)',
    margin: 0,
  },
  body: {
    fontFamily: 'var(--font-parent)',
    fontSize: '15px',
    color: 'var(--ink-60)',
    maxWidth: '280px',
    lineHeight: 1.6,
    margin: 0,
  },
  captureCard: {
    marginTop: 'var(--sp6)',
    width: '100%',
    maxWidth: '320px',
    background: 'var(--surface)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-lg)',
    padding: 'var(--sp6)',
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp4)',
  },
  form: {
    display: 'flex',
    flexDirection: 'column',
    gap: 'var(--sp3)',
  },
  input: {
    width: '100%',
    padding: '10px var(--sp4)',
    border: '1px solid var(--border)',
    borderRadius: 'var(--r-md)',
    fontFamily: 'var(--font-parent)',
    fontSize: '14px',
    color: 'var(--ink)',
    background: 'var(--bg)',
    outline: 'none',
    minHeight: '44px',
  },
  btn: {
    width: '100%',
    minHeight: '44px',
    background: 'var(--ink)',
    color: '#fff',
    border: 'none',
    borderRadius: 'var(--r-md)',
    fontFamily: 'var(--font-parent)',
    fontSize: '14px',
    fontWeight: 600,
    cursor: 'pointer',
  },
  success: {
    fontFamily: 'var(--font-parent)',
    fontSize: '14px',
    fontWeight: 600,
    color: 'var(--leaf)',
    textAlign: 'center',
    padding: 'var(--sp2) 0',
  },
  trust: {
    fontFamily: 'var(--font-parent)',
    fontSize: '12px',
    color: 'var(--ink-30)',
    textAlign: 'center',
    margin: 0,
  },
}
