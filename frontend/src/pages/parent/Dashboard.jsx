import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { logActivity } from '../../lib/activity.js'
import { useActivityOnView } from '../../hooks/useActivityOnView.js'
import { BACKEND_URL } from '../../lib/api.js'
import '../../styles/parent.css'

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  }
}

// Seed prompt shown before CASParser is connected (Step 4 will replace with real prompts)
const SEED_PROMPT = {
  week: 1,
  text: `Ask your child: "If you had ₹1,000 right now, what's the first thing you'd do with it?" — don't correct, just listen.`,
}

export default function ParentDashboard() {
  const { user, session } = useAuth()
  const [child, setChild]                   = useState(null)
  const [portfolioTotal, setPortfolioTotal] = useState(null)
  const [loadingChild, setLoadingChild]     = useState(true)
  const [promptDone, setPromptDone]         = useState(false)
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [actioning, setActioning]           = useState({}) // { completionId: 'approve'|'reject' }

  const displayName = user?.user_metadata?.name || user?.email?.split('@')[0] || 'there'

  // parent_prompt_viewed — fires once when the prompt card enters the viewport
  // No dwell time required for this event (fires on first intersection)
  const promptCardRef = useActivityOnView(
    'parent',
    'parent_prompt_viewed',
    { authToken: session?.access_token },
    0   // fire immediately on scroll-into-view
  )

  // Fire parent_app_open on mount
  useEffect(() => {
    if (!session?.access_token) return
    logActivity('parent', 'parent_app_open', { authToken: session.access_token })
  }, [session])

  // Load pending task approvals
  const loadPending = useCallback(async () => {
    const headers = await getAuthHeaders()
    const res = await fetch(`${BACKEND_URL}/api/tasks/pending`, { headers })
    if (res.ok) {
      const data = await res.json()
      setPendingApprovals(data.completions || [])
    }
  }, [])

  useEffect(() => { loadPending() }, [loadPending])

  async function handleApproval(completionId, action) {
    setActioning(a => ({ ...a, [completionId]: action }))
    try {
      const res = await fetch(`${BACKEND_URL}/api/tasks/completions/${completionId}/${action}`, {
        method:  'POST',
        headers: await getAuthHeaders(),
      })
      if (res.ok) {
        setPendingApprovals(prev => prev.filter(c => c.id !== completionId))
      }
    } finally {
      setActioning(a => { const next = { ...a }; delete next[completionId]; return next })
    }
  }

  // Load child record
  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('children')
      .select('id, name, age_stage, goal_name, goal_amount')
      .eq('parent_id', user.id)
      .maybeSingle()
      .then(({ data }) => {
        setChild(data)
        setLoadingChild(false)
      })
  }, [user?.id])

  // Load tagged portfolio total from fund_tags + latest snapshot
  // Shows fund count until a CAS is imported; afterwards the ₹ value is computed
  // by summing scheme.value for visible ISINs from the most recent snapshot.
  useEffect(() => {
    if (!user?.id || !session?.access_token) return

    async function loadPortfolio() {
      // 1. Get visible fund ISINs
      const { data: visibleFunds } = await supabase
        .from('fund_tags')
        .select('isin')
        .eq('parent_id', user.id)
        .eq('is_visible_to_child', true)

      if (!visibleFunds?.length) {
        setPortfolioTotal({ rupees: 0, count: 0 })
        return
      }

      const visibleIsins = new Set(visibleFunds.map(f => f.isin))

      // 2. Get latest snapshot to compute ₹ total
      const { data: snap } = await supabase
        .from('portfolio_snapshots')
        .select('raw_json')
        .eq('parent_id', user.id)
        .order('fetched_at', { ascending: false })
        .limit(1)
        .maybeSingle()

      if (!snap) {
        setPortfolioTotal({ rupees: 0, count: visibleFunds.length })
        return
      }

      // Sum value of visible schemes from snapshot
      let total = 0
      for (const folio of (snap.raw_json?.folios || [])) {
        for (const scheme of (folio.schemes || [])) {
          if (visibleIsins.has(scheme.isin)) {
            total += parseFloat(scheme.value ?? scheme.valuation?.value ?? 0) || 0
          }
        }
      }

      setPortfolioTotal({ rupees: total, count: visibleFunds.length })
    }

    loadPortfolio()
  }, [user?.id, session?.access_token])

  function getGreeting() {
    const h = new Date().getHours()
    if (h < 12) return 'Good morning'
    if (h < 17) return 'Good afternoon'
    return 'Good evening'
  }

  return (
    <div className="page">
      {/* Greeting */}
      <h1 className="page-title" style={{ marginBottom: 'var(--space-1)' }}>
        {getGreeting()},<br />{displayName}.
      </h1>

      {/* Portfolio card */}
      <div className="card card--gold">
        <div className="card__label">Tagged portfolio</div>
        <div className="card__value">
          {portfolioTotal === null
            ? '—'
            : portfolioTotal.rupees > 0
              ? `₹\u00A0${portfolioTotal.rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
              : '₹ —'}
        </div>
        <div className="card__sub">
          {!portfolioTotal || portfolioTotal.count === 0
            ? 'Connect your portfolio to see the value here.'
            : `${portfolioTotal.count} fund${portfolioTotal.count !== 1 ? 's' : ''} shared with ${child?.name || 'your child'}`}
        </div>
        {(!portfolioTotal || portfolioTotal.count === 0) && (
          <Link
            to="/parent/portfolio"
            className="btn btn-gold"
            style={{ marginTop: 'var(--space-4)', display: 'inline-flex' }}
          >
            Connect portfolio →
          </Link>
        )}
      </div>

      {/* Child card */}
      {!loadingChild && (child ? (
          <div className="card">
            <div className="section-header" style={{ marginBottom: 'var(--space-2)' }}>
              <span className="card__label" style={{ marginBottom: 0 }}>
                {child.name}'s garden
              </span>
              <span className="age-badge">{child.age_stage}</span>
            </div>
            {child.goal_name ? (
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.5 }}>
                Saving for <strong style={{ color: 'var(--color-text-primary)' }}>{child.goal_name}</strong>
                {child.goal_amount
                  ? ` — target ₹${Number(child.goal_amount).toLocaleString('en-IN')}`
                  : ''}
              </p>
            ) : (
              <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
                No goal set yet.{' '}
                <Link to="/parent/settings" style={{ color: 'var(--color-navy)', fontWeight: 500 }}>
                  Add one →
                </Link>
              </p>
            )}
          </div>
        ) : (
          <div className="card">
            <div className="empty-state" style={{ padding: 'var(--space-5) 0' }}>
              <div className="empty-state__icon">🌱</div>
              <div className="empty-state__title">No child added yet</div>
              <div className="empty-state__body">
                Something went wrong during setup.{' '}
                <Link to="/parent/onboarding" style={{ color: 'var(--color-navy)', fontWeight: 500 }}>
                  Run onboarding again →
                </Link>
              </div>
            </div>
          </div>
        )
      )}

      {/* Weekly conversation prompt */}
      <div className="section-header">
        <span className="section-title">Weekly prompt</span>
      </div>

      <div
        ref={promptCardRef}
        className="prompt-card"
      >
        <div className="prompt-card__week">Week {SEED_PROMPT.week}</div>
        <p className="prompt-card__text">{SEED_PROMPT.text}</p>
        <div className="prompt-card__action">
          <button
            className="btn btn-outline"
            style={{ fontSize: '13px', height: '36px', padding: '0 var(--space-4)' }}
            onClick={() => setPromptDone(d => !d)}
          >
            {promptDone ? '✓ Done' : 'Mark as done'}
          </button>
        </div>
      </div>

      {/* Pending task approvals */}
      <div className="section-header">
        <span className="section-title">Task approvals</span>
        {pendingApprovals.length > 0 && (
          <span style={{
            fontSize: '12px', fontWeight: 600,
            background: 'var(--color-gold)', color: 'var(--color-navy)',
            borderRadius: 'var(--radius-full)', padding: '1px 8px',
          }}>
            {pendingApprovals.length}
          </span>
        )}
      </div>

      <div className="card">
        {pendingApprovals.length === 0 ? (
          <div className="empty-state" style={{ padding: 'var(--space-4) 0' }}>
            <div className="empty-state__icon">✅</div>
            <div className="empty-state__title">All clear</div>
            <div className="empty-state__body">
              No pending task approvals.
              <br />
              <Link to="/parent/settings" style={{ color: 'var(--color-navy)', fontWeight: 500 }}>
                Set up task rules →
              </Link>
            </div>
          </div>
        ) : (
          pendingApprovals.map(comp => {
            const rule     = comp.task_rules
            const childName = rule?.children?.name || 'your child'
            const taskName  = rule?.task_name || 'Unknown task'
            const coins     = rule?.reward_coins || 0
            const isActioning = !!actioning[comp.id]
            return (
              <div key={comp.id} className="approval-row">
                <div className="approval-row__info">
                  <div className="approval-row__name">{taskName}</div>
                  <div className="approval-row__meta">
                    {childName} · 🪙 {coins} coins ·{' '}
                    {new Date(comp.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                  </div>
                </div>
                <div className="approval-row__actions">
                  <button
                    className="btn btn-outline"
                    style={{ fontSize: '12px', height: '32px', padding: '0 10px', color: 'var(--color-error)', borderColor: 'var(--color-error)' }}
                    disabled={isActioning}
                    onClick={() => handleApproval(comp.id, 'reject')}
                  >
                    {actioning[comp.id] === 'reject' ? '…' : 'Reject'}
                  </button>
                  <button
                    className="btn btn-navy"
                    style={{ fontSize: '12px', height: '32px', padding: '0 10px' }}
                    disabled={isActioning}
                    onClick={() => handleApproval(comp.id, 'approve')}
                  >
                    {actioning[comp.id] === 'approve' ? '…' : 'Approve'}
                  </button>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
