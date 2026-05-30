import { useState, useRef, useCallback } from 'react'
import ReactMarkdown from 'react-markdown'
import { eulaContent, EULA_VERSION } from '../legal/index.js'
import { supabase } from '../lib/supabase.js'

export default function EulaModal({ onAccepted }) {
  const [canAgree, setCanAgree] = useState(false)
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState(null)
  const contentRef = useRef(null)

  const handleScroll = useCallback(() => {
    const el = contentRef.current
    if (!el) return
    if (el.scrollTop + el.clientHeight >= el.scrollHeight - 10) {
      setCanAgree(true)
    }
  }, [])

  async function handleAgree() {
    if (!canAgree || submitting) return
    setSubmitting(true)
    setError(null)

    try {
      const { data: { user } } = await supabase.auth.getUser()
      if (!user) throw new Error('Not authenticated')

      const res = await fetch(`${import.meta.env.VITE_API_BASE_URL}/api/consent`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: user.id,
          eulaVersion: EULA_VERSION,
          acceptedAt: new Date().toISOString(),
        }),
      })

      if (!res.ok) throw new Error('Failed to record consent')
      onAccepted()
    } catch (err) {
      setError('Something went wrong. Please try again.')
      setSubmitting(false)
    }
  }

  return (
    <div style={styles.overlay}>
      <div style={styles.modal}>
        <h2 style={styles.title}>Before you continue</h2>

        <div
          ref={contentRef}
          onScroll={handleScroll}
          style={styles.content}
        >
          <ReactMarkdown>{eulaContent}</ReactMarkdown>
        </div>

        {!canAgree && (
          <p style={styles.scrollHint}>Scroll to the bottom to enable the button</p>
        )}

        {error && <p style={styles.errorText}>{error}</p>}

        <button
          onClick={handleAgree}
          disabled={!canAgree || submitting}
          style={{
            ...styles.agreeBtn,
            opacity: canAgree && !submitting ? 1 : 0.45,
            cursor: canAgree && !submitting ? 'pointer' : 'not-allowed',
          }}
        >
          {submitting ? 'Recording…' : 'I Agree'}
        </button>
      </div>
    </div>
  )
}

const styles = {
  overlay: {
    position: 'fixed',
    inset: 0,
    background: 'rgba(11,22,40,0.72)',
    zIndex: 1000,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '16px',
  },
  modal: {
    background: '#fff',
    borderRadius: '16px',
    width: '100%',
    maxWidth: '600px',
    maxHeight: '90vh',
    display: 'flex',
    flexDirection: 'column',
    overflow: 'hidden',
    boxShadow: '0 8px 32px rgba(11,22,40,0.24)',
  },
  title: {
    fontFamily: "'Cormorant Garamond', Georgia, serif",
    fontWeight: 600,
    fontSize: '1.5rem',
    color: 'var(--color-navy, #0B1628)',
    margin: 0,
    padding: '20px 24px 12px',
    borderBottom: '1px solid var(--color-border, #E2E8F0)',
    flexShrink: 0,
  },
  content: {
    flex: 1,
    overflowY: 'auto',
    padding: '16px 24px',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontSize: '0.9rem',
    lineHeight: 1.65,
    color: 'var(--color-text-primary, #0B1628)',
  },
  scrollHint: {
    textAlign: 'center',
    fontSize: '0.78rem',
    color: 'var(--color-text-secondary, #64748B)',
    margin: '4px 0',
    flexShrink: 0,
  },
  errorText: {
    textAlign: 'center',
    fontSize: '0.82rem',
    color: 'var(--color-error, #DC2626)',
    margin: '4px 16px',
    flexShrink: 0,
  },
  agreeBtn: {
    margin: '12px 24px 20px',
    padding: '14px',
    background: 'var(--color-navy, #0B1628)',
    color: '#fff',
    border: 'none',
    borderRadius: '10px',
    fontFamily: "'DM Sans', system-ui, sans-serif",
    fontWeight: 600,
    fontSize: '1rem',
    minHeight: '44px',
    flexShrink: 0,
    transition: 'opacity 0.2s',
  },
}
