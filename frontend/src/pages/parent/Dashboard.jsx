import { useEffect, useState, useCallback } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { logActivity } from '../../lib/activity.js'
import { useActivityOnView } from '../../hooks/useActivityOnView.js'
import { BACKEND_URL } from '../../lib/api.js'
import { getWeekContent } from '../../data/weeklyContent.js'
import { getParentWeekPrompt } from '../../data/parentWeeklyPrompts.js'
import '../../styles/parent.css'

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  }
}

// ── Portfolio empty state — shown when no CAS has been imported yet ──
function PortfolioEmptyState() {
  const MOCK_FUNDS = [
    ['Axis Bluechip Fund',       '██,██,███'],
    ['Mirae Asset ELSS',         '█,██,███'],
    ['Parag Parikh Flexi Cap',   '███,██,███'],
  ]

  return (
    <div className="portfolio-empty">
      {/* Blurred mock in the background — purely decorative */}
      <div className="portfolio-empty__mock" aria-hidden="true">
        <div className="portfolio-empty__mock-label">Tagged portfolio</div>
        <div className="portfolio-empty__mock-total">₹ ██,██,███</div>
        {MOCK_FUNDS.map(([name, val]) => (
          <div key={name} className="portfolio-empty__mock-row">
            <span>{name}</span>
            <span className="portfolio-empty__mock-val">{val}</span>
          </div>
        ))}
      </div>

      {/* Focused overlay with the CTA */}
      <div className="portfolio-empty__overlay">
        <div className="portfolio-empty__icon" aria-hidden="true">🌱</div>
        <p className="portfolio-empty__headline">
          Your child's financial forest starts with a single seed.
        </p>
        <p className="portfolio-empty__sub">
          Connect your portfolio in one click.
        </p>
        <Link to="/parent/portfolio" className="btn btn-gold">
          Connect portfolio →
        </Link>
      </div>
    </div>
  )
}

function ChildOverview({ child, portfolioTotal, pendingCount }) {
  if (!child) return null

  const goalAmount = child.goal_amount ? Number(child.goal_amount) : null
  const saved      = portfolioTotal?.rupees ?? null
  const pct        = (goalAmount && saved !== null)
    ? Math.min(Math.round((saved / goalAmount) * 100), 100)
    : 0

  const fmtInr = n => `₹${Number(n).toLocaleString('en-IN', { maximumFractionDigits: 0 })}`

  return (
    <div className="child-overview">
      <div className="child-overview__header">
        <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp2)' }}>
          <span className="child-overview__name">{child.name}</span>
          <span className="age-badge">{child.age_stage}</span>
        </div>
        {pendingCount > 0 ? (
          <span className="child-overview__tasks-pill child-overview__tasks-pill--pending">
            {pendingCount} pending
          </span>
        ) : (
          <span className="child-overview__tasks-pill child-overview__tasks-pill--clear">
            All clear ✓
          </span>
        )}
      </div>

      {child.goal_name ? (
        <>
          <div className="child-overview__goal-label">{child.goal_name}</div>
          <div className="child-overview__progress-track">
            <div
              className="child-overview__progress-fill"
              style={{ width: `${pct}%` }}
              role="progressbar"
              aria-valuenow={pct}
              aria-valuemin={0}
              aria-valuemax={100}
            />
          </div>
          <div className="child-overview__progress-labels">
            <span>{saved !== null ? fmtInr(saved) : '—'} saved</span>
            <span>{goalAmount ? `of ${fmtInr(goalAmount)}` : 'No target set'} · {pct}%</span>
          </div>
        </>
      ) : (
        <p className="child-overview__no-goal">
          No savings goal set.{' '}
          <Link to="/parent/settings" style={{ color: 'var(--forest)', fontWeight: 500 }}>
            Add one →
          </Link>
        </p>
      )}
    </div>
  )
}

// ── DinnerPromptCard — appears when child has completed the current week ──
function DinnerPromptCard({ row, childName, onDismiss, dismissing }) {
  const weekContent = getWeekContent(row.week_number)
  const topic = weekContent?.topic || `Week ${row.week_number}`

  return (
    <div className="dinner-prompt-card">
      <div className="dinner-prompt-card__label">Tonight at dinner</div>
      <div className="dinner-prompt-card__meta">
        {childName} completed Week {row.week_number} — {topic}
      </div>
      <p className="dinner-prompt-card__text">{row.prompt_text}</p>
      <button
        className="dinner-prompt-card__btn"
        onClick={onDismiss}
        disabled={dismissing}
      >
        {dismissing ? '…' : 'We talked about this ✓'}
      </button>
    </div>
  )
}

export default function ParentDashboard() {
  const { user, session } = useAuth()
  const [child, setChild]                   = useState(null)
  const [portfolioTotal, setPortfolioTotal] = useState(null)
  const [loadingChild, setLoadingChild]     = useState(true)
  const [promptDone, setPromptDone]         = useState(false)
  const [currentWeek, setCurrentWeek]       = useState(1)
  const [pendingApprovals, setPendingApprovals] = useState([])
  const [actioning, setActioning]           = useState({}) // { completionId: 'approve'|'reject' }
  const [dinnerPrompt, setDinnerPrompt]     = useState(null)  // conversation_log row | null
  const [dismissing, setDismissing]         = useState(false)

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

  // Load the most recently completed dinner prompt for this parent
  const loadDinnerPrompt = useCallback(async () => {
    if (!user?.id) return
    const { data } = await supabase
      .from('conversation_log')
      .select('id, week_number, prompt_text, marked_done_at')
      .eq('parent_id', user.id)
      .not('marked_done_at', 'is', null)
      .order('marked_done_at', { ascending: false })
      .limit(1)
      .maybeSingle()
    setDinnerPrompt(data || null)
  }, [user?.id])

  useEffect(() => { loadDinnerPrompt() }, [loadDinnerPrompt])

  async function handleDismissDinnerPrompt() {
    if (!dinnerPrompt) return
    setDismissing(true)
    await supabase
      .from('conversation_log')
      .update({ marked_done_at: null })
      .eq('id', dinnerPrompt.id)
    setDismissing(false)
    setDinnerPrompt(null)
  }

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

  // Load child's current curriculum week from learning_state, then check whether
  // the parent has already marked this week's prompt as done in conversation_log.
  useEffect(() => {
    if (!child?.id || !user?.id) return
    supabase
      .from('learning_state')
      .select('current_week')
      .eq('child_id', child.id)
      .maybeSingle()
      .then(async ({ data }) => {
        const week = data?.current_week || 1
        setCurrentWeek(week)

        const { data: log } = await supabase
          .from('conversation_log')
          .select('marked_done_at')
          .eq('parent_id', user.id)
          .eq('week_number', week)
          .not('marked_done_at', 'is', null)
          .limit(1)
          .maybeSingle()
        setPromptDone(!!log)
      })
  }, [child?.id, user?.id])

  async function handlePromptDone() {
    const newDone = !promptDone
    setPromptDone(newDone)

    const weekPrompt  = getParentWeekPrompt(currentWeek)
    const nowIso      = new Date().toISOString()

    // Check for an existing row for this week so we can update vs insert
    const { data: existing } = await supabase
      .from('conversation_log')
      .select('id')
      .eq('parent_id', user.id)
      .eq('week_number', currentWeek)
      .limit(1)
      .maybeSingle()

    if (existing) {
      await supabase
        .from('conversation_log')
        .update({ marked_done_at: newDone ? nowIso : null })
        .eq('id', existing.id)
    } else if (newDone) {
      await supabase
        .from('conversation_log')
        .insert({
          parent_id:      user.id,
          week_number:    currentWeek,
          prompt_text:    weekPrompt.dinnerPrompt,
          marked_done_at: nowIso,
        })
    }

    if (newDone && session?.access_token) {
      logActivity('parent', 'weekly_prompt_marked_done', {
        authToken: session.access_token,
        metadata: {
          week:             currentWeek,
          topic:            weekPrompt.topic,
          portfolio_status: weekPrompt.portfolioStatus,
          child_id:         child?.id ?? null,
        },
      })
    }
  }

  // Load tagged portfolio total from cas_funds (new production tables).
  // Sum current_value directly from rows where show_in_child_app = true.
  // Also fetch last_updated from cas_fetch_log for the portfolio card subtitle.
  useEffect(() => {
    if (!user?.id || !session?.access_token) return

    async function loadPortfolio() {
      const [fundsResult, logResult] = await Promise.all([
        supabase
          .from('cas_funds')
          .select('current_value, show_in_child_app')
          .eq('user_id', user.id),
        supabase
          .from('cas_fetch_log')
          .select('fetched_at')
          .eq('user_id', user.id)
          .eq('status', 'success')
          .order('fetched_at', { ascending: false })
          .limit(1)
          .maybeSingle(),
      ])

      const allFunds    = fundsResult.data || []
      const visibleFunds = allFunds.filter(f => f.show_in_child_app)

      if (allFunds.length === 0) {
        setPortfolioTotal({ rupees: 0, count: 0, last_updated: null })
        return
      }

      const total      = visibleFunds.reduce((sum, f) => sum + (parseFloat(f.current_value) || 0), 0)
      const lastUpdated = logResult.data?.fetched_at || null

      setPortfolioTotal({ rupees: total, count: visibleFunds.length, last_updated: lastUpdated })
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

      {/* Dinner prompt — only when child has completed a week */}
      {dinnerPrompt && (
        <DinnerPromptCard
          row={dinnerPrompt}
          childName={child?.name || 'Your child'}
          onDismiss={handleDismissDinnerPrompt}
          dismissing={dismissing}
        />
      )}

      {/* Portfolio card — premium empty state until a CAS is imported */}
      {portfolioTotal === null ? (
        <div className="card card--gold">
          <div className="card__label">Tagged portfolio</div>
          <div className="card__value">—</div>
          <div className="card__sub">Loading…</div>
        </div>
      ) : portfolioTotal.count === 0 ? (
        <PortfolioEmptyState />
      ) : (
        <div className="card card--gold">
          <div className="card__label">Tagged portfolio</div>
          <div className="card__value">
            {portfolioTotal.rupees > 0
              ? `₹\u00A0${portfolioTotal.rupees.toLocaleString('en-IN', { maximumFractionDigits: 0 })}`
              : '₹ —'}
          </div>
          <div className="card__sub">
            {`${portfolioTotal.count} fund${portfolioTotal.count !== 1 ? 's' : ''} shared with ${child?.name || 'your child'}`}
            {portfolioTotal.last_updated && (
              <span style={{ display: 'block', fontSize: '11px', marginTop: '2px', opacity: 0.7 }}>
                Updated {new Date(portfolioTotal.last_updated).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })}
              </span>
            )}
          </div>
        </div>
      )}

      {/* Child overview */}
      {!loadingChild && !child && (
        <div className="card">
          <div className="empty-state" style={{ padding: 'var(--space-5) 0' }}>
            <div className="empty-state__icon">🌱</div>
            <div className="empty-state__title">No child added yet</div>
            <div className="empty-state__body">
              <Link to="/parent/settings" style={{ color: 'var(--color-navy)', fontWeight: 500 }}>
                Add a child in Settings →
              </Link>
            </div>
          </div>
        </div>
      )}
      {!loadingChild && child && (
        <ChildOverview
          child={child}
          portfolioTotal={portfolioTotal}
          pendingCount={pendingApprovals.length}
        />
      )}

      {/* Weekly conversation prompt */}
      <div className="section-header">
        <span className="section-title">Weekly Learning</span>
      </div>

      {(() => {
        const weekPrompt = getParentWeekPrompt(currentWeek)
        return (
          <div ref={promptCardRef} className="prompt-card">
            <div className="prompt-card__week">Week {currentWeek}</div>
            <p className="prompt-card__text">{weekPrompt.dinnerPrompt}</p>
            <p className="prompt-card__topic">This week: {weekPrompt.topic}</p>
            {weekPrompt.portfolioStatus === 'REQUIRED' && (
              <div className="prompt-card__portfolio-nudge--required">
                📈 Open your portfolio together — this week's prompt connects directly to what's happening there.
              </div>
            )}
            {weekPrompt.portfolioStatus === 'OPTIONAL' && (
              <p className="prompt-card__portfolio-nudge--optional">
                📊 If you've been tracking your portfolio, this is a good week to look at it together.
              </p>
            )}
            <div className="prompt-card__action">
              <button
                className="btn btn-outline"
                style={{ fontSize: '13px', height: '36px', padding: '0 var(--space-4)' }}
                onClick={handlePromptDone}
              >
                {promptDone ? '✓ Done' : 'Mark as done'}
              </button>
            </div>
          </div>
        )
      })()}

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

      {pendingApprovals.length === 0 ? (
        <p className="approval-empty">
          No pending approvals.{' '}
          <Link to="/parent/settings" style={{ color: 'var(--forest)', fontWeight: 500 }}>
            Set up assigned tasks →
          </Link>
        </p>
      ) : (
        pendingApprovals.map(comp => {
          const rule        = comp.task_rules
          const childName   = rule?.children?.name || 'your child'
          const taskName    = rule?.task_name || 'Unknown task'
          const coins       = rule?.reward_coins || 0
          const isActioning = !!actioning[comp.id]
          return (
            <div key={comp.id} className="approval-card">
              <div className="approval-card__body">
                <div className="approval-card__task">{taskName}</div>
                <div className="approval-card__meta">
                  {childName} · 🪙 {coins} ·{' '}
                  {new Date(comp.completed_at).toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })}
                </div>
              </div>
              <div className="approval-card__actions">
                <button
                  className="ac-btn-reject"
                  disabled={isActioning}
                  onClick={() => {
                    if (!window.confirm('Are you sure you want to un-mark this task?')) return
                    handleApproval(comp.id, 'reject')
                  }}
                >
                  {actioning[comp.id] === 'reject' ? '…' : 'Reject'}
                </button>
                <button
                  className="ac-btn-approve"
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
  )
}
