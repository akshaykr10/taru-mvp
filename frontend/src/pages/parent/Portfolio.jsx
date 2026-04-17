import { useEffect, useRef, useState } from 'react'
import { PortfolioConnect } from '@cas-parser/connect'
import { supabase } from '../../lib/supabase.js'
import { BACKEND_URL } from '../../lib/api.js'
import FundTagList from '../../components/FundTagList.jsx'
import '../../styles/parent.css'
import '../../styles/portfolio.css'

const TABS = [
  { id: 'widget', label: '🔗 Portfolio Connect' },
  { id: 'pdf',    label: '📄 Upload PDF CAS'    },
]

const SDK_CONFIG = {
  enableGenerator: true,   // CAMS/KFintech email-based fetch
  enableCdslFetch: false,
  enableInbox:     false,
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return { Authorization: `Bearer ${session?.access_token}` }
}

function fmtDate(iso) {
  if (!iso) return ''
  return new Date(iso).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
}

export default function ParentPortfolio() {
  const [activeTab,    setActiveTab]    = useState('widget')
  const [funds,        setFunds]        = useState([])
  const [loadingFunds, setLoadingFunds] = useState(true)

  // Rate-limit state — loaded once on mount
  const [rateLimit, setRateLimit] = useState(null) // null = loading

  // Shown at top when SDK falls back to PDF tab
  const [fallbackMsg, setFallbackMsg] = useState('')

  // ── Widget tab state ───────────────────────────────────────
  const [widgetToken,        setWidgetToken]        = useState(null)
  const [widgetTokenLoading, setWidgetTokenLoading] = useState(false)
  const [widgetTokenError,   setWidgetTokenError]   = useState('')
  const [widgetProcessing,   setWidgetProcessing]   = useState(false)
  const [widgetError,        setWidgetError]        = useState('')
  const [widgetDone,         setWidgetDone]         = useState(false)

  // ── PDF tab state ──────────────────────────────────────────
  const [file,        setFile]        = useState(null)
  const [password,    setPassword]    = useState('')
  const [dragging,    setDragging]    = useState(false)
  const [uploading,   setUploading]   = useState(false)
  const [uploadError, setUploadError] = useState('')
  const [uploadDone,  setUploadDone]  = useState(false)

  const fileInputRef = useRef(null)

  // ── Load status + funds on mount ───────────────────────────
  useEffect(() => {
    loadStatus()
    loadFunds()
  }, [])

  async function loadStatus() {
    try {
      const headers = await getAuthHeaders()
      const res  = await fetch(`${BACKEND_URL}/api/cas/status`, { headers })
      const data = await res.json()
      if (res.ok) setRateLimit(data)
    } catch {
      setRateLimit({ is_rate_limited: false, fund_count: 0 })
    }
  }

  async function loadFunds() {
    setLoadingFunds(true)
    try {
      const headers = await getAuthHeaders()
      const res  = await fetch(`${BACKEND_URL}/api/cas/funds`, { headers })
      const data = await res.json()
      if (res.ok) setFunds(data.funds || [])
    } catch {
      // Silent — fund list stays as-is
    } finally {
      setLoadingFunds(false)
    }
  }

  function handleFundUpdate(id, newValue) {
    setFunds(prev => prev.map(f => f.id === id ? { ...f, show_in_child_app: newValue } : f))
  }

  // ── Widget: fetch short-lived access token ─────────────────
  useEffect(() => {
    if (activeTab !== 'widget') return
    if (rateLimit?.is_rate_limited) return
    if (widgetToken || widgetTokenLoading) return

    async function fetchToken() {
      setWidgetTokenLoading(true)
      setWidgetTokenError('')
      try {
        const headers = await getAuthHeaders()
        const res  = await fetch(`${BACKEND_URL}/api/cas/token`, {
          method: 'POST',
          headers,
        })
        const body = await res.json()

        if (res.status === 429) {
          setRateLimit(body)
          return
        }
        if (!res.ok || !body.access_token) {
          setWidgetTokenError(body.error || 'Could not get a Portfolio Connect token.')
          return
        }
        setWidgetToken(body.access_token)
      } catch {
        setWidgetTokenError('Network error getting token. Check your connection.')
      } finally {
        setWidgetTokenLoading(false)
      }
    }

    fetchToken()
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [activeTab, rateLimit?.is_rate_limited])

  // ── Widget: SDK onSuccess ──────────────────────────────────
  async function handleWidgetSuccess(data) {
    if (data?.status === 'failed') {
      setWidgetError('Portfolio Connect returned a failed parse. Try the PDF upload instead.')
      return
    }

    setWidgetProcessing(true)
    setWidgetError('')

    try {
      const headers = {
        ...(await getAuthHeaders()),
        'Content-Type': 'application/json',
      }
      const res  = await fetch(`${BACKEND_URL}/api/cas/save`, {
        method: 'POST',
        headers,
        body:   JSON.stringify(data),
      })
      const body = await res.json()

      if (!res.ok) {
        setWidgetError(body.error || 'Failed to save portfolio data. Please try again.')
        return
      }

      setWidgetDone(true)
      await Promise.all([loadFunds(), loadStatus()])
    } catch {
      setWidgetError('Network error saving your portfolio. Try again.')
    } finally {
      setWidgetProcessing(false)
    }
  }

  // ── Widget: SDK onError ────────────────────────────────────
  function handleWidgetError(err) {
    console.error('[PortfolioConnect] SDK error:', err?.code, err?.message)
    setFallbackMsg(
      'Portfolio Connect ran into an issue — you can import your portfolio using a PDF instead.'
    )
    setActiveTab('pdf')
  }

  function switchToPdf() {
    setFallbackMsg('')
    setActiveTab('pdf')
  }

  // ── PDF: drag-and-drop ─────────────────────────────────────
  function handleDragOver(e)  { e.preventDefault(); setDragging(true)  }
  function handleDragLeave()  { setDragging(false) }
  function handleDrop(e) {
    e.preventDefault()
    setDragging(false)
    const dropped = e.dataTransfer.files[0]
    if (dropped?.type === 'application/pdf') pickFile(dropped)
    else setUploadError('Please drop a PDF file.')
  }

  const MAX_PDF_BYTES = 5 * 1024 * 1024

  function pickFile(f) {
    if (f.size > MAX_PDF_BYTES) {
      setUploadError('File is too large (max 5 MB). Please use a smaller CAS PDF.')
      return
    }
    setFile(f)
    setUploadError('')
    setUploadDone(false)
  }

  // ── PDF: upload + parse ────────────────────────────────────
  async function handleUpload(e) {
    e.preventDefault()
    if (!file) { setUploadError('Please select a PDF file.'); return }

    setUploading(true)
    setUploadError('')

    const form = new FormData()
    form.append('pdf_file', file)
    if (password) form.append('password', password)

    try {
      const headers = await getAuthHeaders()
      const res  = await fetch(`${BACKEND_URL}/api/cas/upload`, {
        method: 'POST',
        headers,
        body:   form,
      })
      const data = await res.json()

      if (res.status === 429) {
        setRateLimit(data)
        setUploadError('') // rate limit banner handles messaging
        return
      }
      if (!res.ok) {
        setUploadError(data.error || 'Failed to parse PDF. Please try again.')
        return
      }

      setUploadError('')
      setFallbackMsg('')
      setWidgetError('')
      setFile(null)
      setPassword('')
      setUploadDone(true)
      await Promise.all([loadFunds(), loadStatus()])
    } catch {
      setUploadError('Network error. Check your connection and try again.')
    } finally {
      setUploading(false)
    }
  }

  // ── Tab switch ─────────────────────────────────────────────
  function handleTabSwitch(id) {
    setActiveTab(id)
    setUploadError('')
    setUploadDone(false)
    setWidgetError('')
    if (id !== 'pdf') setFallbackMsg('')
  }

  const isRateLimited = rateLimit?.is_rate_limited === true

  return (
    <div className="page">
      <h1 className="page-title">Portfolio</h1>

      {/* Rate-limit banner */}
      {isRateLimited && (
        <div className="import-rate-limit-banner">
          Portfolio last updated on {fmtDate(rateLimit.last_fetched_at)}.
          Next refresh available on {fmtDate(rateLimit.next_available_at)}.
        </div>
      )}

      {/* Fallback notification — shown after SDK error redirects to PDF tab */}
      {fallbackMsg && (
        <div className="import-fallback-notice">
          <span>{fallbackMsg}</span>
          <button
            aria-label="Dismiss"
            className="import-fallback-notice__dismiss"
            onClick={() => setFallbackMsg('')}
          >
            ✕
          </button>
        </div>
      )}

      {/* Tab bar */}
      <div className="import-tabs">
        {TABS.map(tab => (
          <button
            key={tab.id}
            className={`import-tab${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => handleTabSwitch(tab.id)}
          >
            {tab.label}
          </button>
        ))}
      </div>

      {/* ── Portfolio Connect (SDK) tab ────────────────────── */}
      {activeTab === 'widget' && (
        <div className="card">
          {widgetDone ? (
            <div className="import-status">
              <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>✅</div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-success)' }}>
                Portfolio imported!
              </div>
              <div className="import-status__text" style={{ marginTop: 'var(--space-2)' }}>
                Your funds are listed below. Toggle which ones your child can see.
              </div>
              <button
                className="btn btn-outline"
                style={{ marginTop: 'var(--space-4)' }}
                onClick={() => { setWidgetDone(false); setWidgetToken(null) }}
              >
                Import again
              </button>
            </div>

          ) : widgetProcessing ? (
            <div className="import-status">
              <div className="import-status__spinner">⚙️</div>
              <div className="import-status__text">Saving your portfolio data…</div>
            </div>

          ) : (
            <>
              <div className="card__label">One-click import</div>
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.6, margin: 'var(--space-2) 0 var(--space-4)' }}>
                Fetches your CAS directly using your email registered with CAMS or KFintech.
                No PDF needed.
              </p>

              {widgetError && (
                <div className="auth-error" style={{ marginBottom: 'var(--space-3)' }}>
                  {widgetError}
                  <button
                    className="btn-link"
                    style={{ marginLeft: 'var(--space-3)', fontSize: '13px' }}
                    onClick={switchToPdf}
                  >
                    Use PDF upload instead →
                  </button>
                </div>
              )}

              {widgetTokenLoading ? (
                <div className="import-status" style={{ padding: 'var(--space-5) 0' }}>
                  <div className="import-status__spinner">⚙️</div>
                  <div className="import-status__text">Connecting to Portfolio Connect…</div>
                </div>

              ) : widgetTokenError ? (
                <div>
                  <div className="auth-error" style={{ marginBottom: 'var(--space-4)' }}>
                    {widgetTokenError}
                  </div>
                  <button className="btn btn-outline" style={{ width: '100%' }} onClick={switchToPdf}>
                    Use PDF upload instead
                  </button>
                </div>

              ) : widgetToken && !isRateLimited ? (
                <PortfolioConnect
                  accessToken={widgetToken}
                  config={SDK_CONFIG}
                  onSuccess={handleWidgetSuccess}
                  onError={handleWidgetError}
                >
                  {({ open, isReady }) => (
                    <button
                      className="btn btn-navy"
                      style={{ width: '100%' }}
                      onClick={open}
                      disabled={!isReady || isRateLimited}
                      aria-label="Open Portfolio Connect"
                    >
                      {isReady ? 'Open Portfolio Connect' : 'Connecting…'}
                    </button>
                  )}
                </PortfolioConnect>

              ) : !isRateLimited ? null : null}

              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 'var(--space-3)', textAlign: 'center' }}>
                Powered by CASParser · No PDF required
              </p>
            </>
          )}
        </div>
      )}

      {/* ── PDF upload tab ─────────────────────────────────── */}
      {activeTab === 'pdf' && (
        <div className="card">
          {uploading ? (
            <div className="import-status">
              <div className="import-status__spinner">⚙️</div>
              <div className="import-status__text">Parsing your CAS… this takes about 10 seconds.</div>
            </div>
          ) : uploadDone ? (
            <div className="import-status">
              <div style={{ fontSize: '32px', marginBottom: 'var(--space-3)' }}>✅</div>
              <div style={{ fontSize: '15px', fontWeight: 500, color: 'var(--color-success)' }}>
                Portfolio imported!
              </div>
              <div className="import-status__text" style={{ marginTop: 'var(--space-2)' }}>
                Your funds are listed below. Toggle which ones your child can see.
              </div>
              <button
                className="btn btn-outline"
                style={{ marginTop: 'var(--space-4)' }}
                onClick={() => setUploadDone(false)}
              >
                Import another
              </button>
            </div>
          ) : (
            <form onSubmit={handleUpload} className="import-form">
              <div
                className={`drop-zone${dragging ? ' dragging' : ''}`}
                onClick={() => fileInputRef.current?.click()}
                onDragOver={handleDragOver}
                onDragLeave={handleDragLeave}
                onDrop={handleDrop}
              >
                <div className="drop-zone__icon">📂</div>
                <div className="drop-zone__title">
                  {file ? 'PDF selected' : 'Drop your CAS PDF here'}
                </div>
                <div className="drop-zone__sub">
                  {file ? '' : 'or click to browse — CAMS, KFintech, or any combined CAS'}
                </div>
                {file && (
                  <div className="drop-zone__file-name">📄 {file.name}</div>
                )}
                <input
                  ref={fileInputRef}
                  type="file"
                  accept="application/pdf"
                  onChange={e => pickFile(e.target.files[0])}
                />
              </div>

              <div className="import-field">
                <label htmlFor="pdf-password">PDF password (if any)</label>
                <input
                  id="pdf-password"
                  type="password"
                  autoComplete="off"
                  placeholder="Leave blank if not password-protected"
                  value={password}
                  onChange={e => setPassword(e.target.value)}
                />
              </div>

              {uploadError && (
                <div className="auth-error">{uploadError}</div>
              )}

              <button
                type="submit"
                className="btn btn-navy"
                style={{ width: '100%' }}
                disabled={!file || uploading || isRateLimited}
              >
                Parse portfolio
              </button>

              <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', textAlign: 'center', lineHeight: 1.5 }}>
                Your CAS PDF is sent to CASParser and immediately discarded after parsing.
                We store only the fund list and values — never your PAN or folio numbers.
              </p>
            </form>
          )}
        </div>
      )}

      {/* ── Fund tag list ──────────────────────────────────── */}
      <div className="section-header" style={{ marginTop: 'var(--space-2)' }}>
        <span className="section-title">
          {funds.length > 0 ? `Your funds (${funds.length})` : 'Your funds'}
        </span>
      </div>

      {loadingFunds ? null : funds.length === 0 ? (
        <div className="card">
          <div className="empty-state" style={{ padding: 'var(--space-4) 0' }}>
            <div className="empty-state__icon">📂</div>
            <div className="empty-state__title">No funds imported yet</div>
            <div className="empty-state__body">
              Import your CAS above — your mutual fund holdings will appear here.
            </div>
          </div>
        </div>
      ) : (
        <FundTagList funds={funds} onUpdate={handleFundUpdate} />
      )}
    </div>
  )
}
