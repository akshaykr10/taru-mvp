/**
 * InvestComingSoon.jsx
 *
 * "Invest with Taru" demand-capture surface.
 *
 * COMPLIANCE GUARDRAILS — do not remove:
 *   • No return claims, yield figures, or performance projections.
 *   • No countdown timers, urgency mechanics, or "limited spots" language.
 *   • No copy that implies the user can transact now — empanelment is pending.
 *   • No specific fund names or asset classes recommended.
 *   • Consent checkbox must be unchecked by default; submit is disabled until
 *     both email is non-empty AND checkbox is ticked.
 *   • Source field is always 'in_app_invest' — never 'landing'.
 *
 * Prominence is read from frontend/src/config.js (INVEST_CTA_PROMINENCE).
 * Render varies by prominence value:
 *   'hidden' — renders nothing
 *   'footer' — quiet single line with inline form
 *   'card'   — titled card with one sentence of context
 *   'primary'— same as 'card' (primary placement is Dashboard's responsibility)
 */

import { useState } from 'react'
import { BACKEND_URL } from '../lib/api.js'
import { INVEST_CTA_PROMINENCE } from '../config.js'

const SOURCE = 'in_app_invest'

export default function InvestComingSoon() {
  const prominence = INVEST_CTA_PROMINENCE

  const [email,       setEmail]       = useState('')
  const [consented,   setConsented]   = useState(false)
  const [submitting,  setSubmitting]  = useState(false)
  const [submitted,   setSubmitted]   = useState(false)
  const [error,       setError]       = useState('')

  if (prominence === 'hidden') return null

  const canSubmit = email.trim().length > 0 && consented && !submitting

  async function handleSubmit(e) {
    e.preventDefault()
    if (!canSubmit) return

    setSubmitting(true)
    setError('')

    try {
      const res = await fetch(`${BACKEND_URL}/api/waitlist`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json' },
        body:    JSON.stringify({
          email:         email.trim().toLowerCase(),
          source:        SOURCE,
          consent_given: true,   // checkbox enforces this before submit is enabled
        }),
      })

      const body = await res.json().catch(() => ({}))

      if (!res.ok && res.status !== 409) {
        // 409 means already on list — treat as success (idempotent)
        setError(body.error || 'Something went wrong. Please try again.')
        return
      }

      setSubmitted(true)
    } catch {
      setError('Could not connect. Check your internet and try again.')
    } finally {
      setSubmitting(false)
    }
  }

  // ── Shared: confirmation shown after successful submit ──────────────────────
  if (submitted) {
    return (
      <div style={prominence === 'footer' ? styles.footerWrap : styles.cardWrap}>
        <p style={styles.confirmText}>
          Got it — we'll let you know when investing goes live.
        </p>
      </div>
    )
  }

  // ── Footer prominence ───────────────────────────────────────────────────────
  // A single quiet line. The form sits inline on wider screens, stacks on narrow.
  if (prominence === 'footer') {
    return (
      <div style={styles.footerWrap}>
        <p style={styles.footerLabel}>
          Investing through Taru is coming.{' '}
          <span style={styles.footerLabelMuted}>Want to know when it's live?</span>
        </p>

        <form onSubmit={handleSubmit} noValidate style={styles.footerForm}>
          <input
            type="email"
            value={email}
            onChange={e => setEmail(e.target.value)}
            placeholder="your@email.com"
            required
            style={styles.emailInput}
            aria-label="Email address for invest waitlist"
            autoComplete="email"
          />

          <button
            type="submit"
            disabled={!canSubmit}
            style={canSubmit ? styles.submitBtn : { ...styles.submitBtn, ...styles.submitBtnDisabled }}
          >
            {submitting ? '…' : 'Notify me'}
          </button>
        </form>

        <label style={styles.consentRow}>
          <input
            type="checkbox"
            checked={consented}
            onChange={e => setConsented(e.target.checked)}
            style={styles.checkbox}
            aria-label="I agree to be contacted when investing goes live"
          />
          <span style={styles.consentText}>
            I'm happy to be contacted when investing goes live.
          </span>
        </label>

        {error && <p style={styles.errorText}>{error}</p>}
      </div>
    )
  }

  // ── Card prominence (also used for 'primary' — placement is Dashboard's job) ─
  return (
    <div style={styles.cardWrap}>
      <p style={styles.cardLabel}>Coming soon</p>
      <p style={styles.cardTitle}>Invest for your child directly in Taru</p>
      <p style={styles.cardBody}>
        Soon you'll be able to start new investments for your child without
        leaving the app. Add your email and we'll tell you when it's ready.
      </p>

      <form onSubmit={handleSubmit} noValidate style={styles.cardForm}>
        <input
          type="email"
          value={email}
          onChange={e => setEmail(e.target.value)}
          placeholder="your@email.com"
          required
          style={styles.emailInput}
          aria-label="Email address for invest waitlist"
          autoComplete="email"
        />

        <label style={styles.consentRow}>
          <input
            type="checkbox"
            checked={consented}
            onChange={e => setConsented(e.target.checked)}
            style={styles.checkbox}
            aria-label="I agree to be contacted when investing goes live"
          />
          <span style={styles.consentText}>
            I'm happy to be contacted when investing goes live.
          </span>
        </label>

        {error && <p style={styles.errorText}>{error}</p>}

        <button
          type="submit"
          disabled={!canSubmit}
          style={canSubmit ? styles.submitBtnFull : { ...styles.submitBtnFull, ...styles.submitBtnDisabled }}
        >
          {submitting ? 'Saving…' : "Notify me when it's ready"}
        </button>
      </form>
    </div>
  )
}

// ── Styles ────────────────────────────────────────────────────────────────────
// All values use CSS variables from tokens.css. No hardcoded hex or px values
// except where a token does not exist for the specific use case.

const styles = {
  // Footer wrapper — sits below task approvals, quiet separator above
  footerWrap: {
    borderTop:  '1px solid var(--color-border)',
    marginTop:  'var(--space-6)',
    paddingTop: 'var(--space-5)',
    paddingBottom: 'var(--space-8)',
  },

  footerLabel: {
    fontSize:     '13px',
    color:        'var(--color-text-secondary)',
    marginBottom: 'var(--space-3)',
    lineHeight:   1.4,
  },

  footerLabelMuted: {
    color: 'var(--ink-30)',
  },

  footerForm: {
    display:   'flex',
    gap:       'var(--space-2)',
    flexWrap:  'wrap',
    marginBottom: 'var(--space-2)',
  },

  // Card wrapper — matches .card appearance
  cardWrap: {
    background:   'var(--color-bg)',
    border:       '1px solid var(--color-border)',
    borderRadius: 'var(--radius-md)',
    padding:      'var(--space-5)',
    marginBottom: 'var(--space-4)',
  },

  cardLabel: {
    fontSize:      '12px',
    fontWeight:    500,
    textTransform: 'uppercase',
    letterSpacing: '0.06em',
    color:         'var(--color-text-secondary)',
    marginBottom:  'var(--space-2)',
  },

  cardTitle: {
    fontFamily:   'var(--font-heading)',
    fontSize:     '18px',
    color:        'var(--color-navy)',
    marginBottom: 'var(--space-2)',
    lineHeight:   1.3,
  },

  cardBody: {
    fontSize:     '14px',
    color:        'var(--color-text-secondary)',
    lineHeight:   1.5,
    marginBottom: 'var(--space-4)',
  },

  cardForm: {
    display:       'flex',
    flexDirection: 'column',
    gap:           'var(--space-3)',
  },

  // Shared input
  emailInput: {
    flex:         '1 1 180px',
    height:       'var(--tap-target)',
    padding:      '0 var(--space-3)',
    border:       '1px solid var(--color-border)',
    borderRadius: 'var(--radius-sm)',
    fontFamily:   'var(--font-body)',
    fontSize:     '14px',
    color:        'var(--ink)',
    background:   'var(--surface)',
    outline:      'none',
    minWidth:     0,
  },

  // Consent row
  consentRow: {
    display:    'flex',
    alignItems: 'flex-start',
    gap:        'var(--space-2)',
    cursor:     'pointer',
  },

  checkbox: {
    marginTop:  '2px',   // optical alignment with first line of text
    flexShrink: 0,
    width:      '16px',
    height:     '16px',
    cursor:     'pointer',
    accentColor: 'var(--forest)',
  },

  consentText: {
    fontSize:   '12px',
    color:      'var(--color-text-secondary)',
    lineHeight: 1.4,
  },

  // Submit — inline (footer) variant
  submitBtn: {
    height:       'var(--tap-target)',
    padding:      '0 var(--space-4)',
    background:   'var(--forest)',
    color:        '#fff',
    border:       'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily:   'var(--font-body)',
    fontSize:     '14px',
    fontWeight:   500,
    cursor:       'pointer',
    whiteSpace:   'nowrap',
    flexShrink:   0,
  },

  // Submit — full-width (card) variant
  submitBtnFull: {
    height:       'var(--tap-target)',
    width:        '100%',
    background:   'var(--forest)',
    color:        '#fff',
    border:       'none',
    borderRadius: 'var(--radius-sm)',
    fontFamily:   'var(--font-body)',
    fontSize:     '14px',
    fontWeight:   500,
    cursor:       'pointer',
  },

  // Applied on top of either button when disabled
  submitBtnDisabled: {
    background: 'var(--ink-10)',
    color:      'var(--ink-30)',
    cursor:     'not-allowed',
  },

  // Error
  errorText: {
    fontSize:  '13px',
    color:     'var(--color-error)',
    marginTop: 'var(--space-1)',
  },

  // Confirmation
  confirmText: {
    fontSize:   '13px',
    color:      'var(--color-text-secondary)',
    lineHeight: 1.4,
  },
}
