import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'react-router-dom'
import { logActivity } from '../../lib/activity.js'
import { useActivityOnView } from '../../hooks/useActivityOnView.js'
import Learn   from './Learn.jsx'
import Gullak  from './Gullak.jsx'
import { BACKEND_URL } from '../../lib/api.js'
import '../../styles/child.css'

// Plant emoji by goal-progress stage (matches CLAUDE.md spec)
function getPlantStage(progressPct) {
  if (progressPct >= 100) return { emoji: '🌳', stage: 'bloom' }
  if (progressPct >= 75)  return { emoji: '🌿', stage: 'full' }
  if (progressPct >= 50)  return { emoji: '🌱', stage: 'small' }
  if (progressPct >= 25)  return { emoji: '🪴', stage: 'sprout' }
  return { emoji: '🌰', stage: 'seed' }
}

// Penny's greeting by age stage (voice rules from CLAUDE.md)
function getPennyGreeting(ageStage, goalName) {
  const goal = goalName || 'your goal'
  switch (ageStage) {
    case 'seed':
      return `Your money is growing! 🌱`
    case 'sprout':
      return `Your portfolio moved this week. Want to know what caused it?`
    case 'growth':
      return `Here's something most people find out way too late — money can grow on its own. Yours is doing exactly that right now.`
    case 'investor':
      return `Your portfolio data is in. The numbers are moving — let's look at what's driving it.`
    default:
      return `Something interesting is happening with ${goal}.`
  }
}

// Milestone definitions (moved here from Gullak — belongs with portfolio progress)
const MILESTONES = [
  { pct: 25,  label: 'Sprout',  icon: '🌱', lockedIcon: '🔒' },
  { pct: 50,  label: 'Growing', icon: '🌿', lockedIcon: '🔒' },
  { pct: 75,  label: 'Almost',  icon: '🌳', lockedIcon: '🔒' },
  { pct: 100, label: 'Bloom!',  icon: '🌸', lockedIcon: '🔒' },
]

function MilestoneBadge({ pct, label, icon, lockedIcon, achieved }) {
  return (
    <div
      className={`garden-milestone-badge${achieved ? ' garden-milestone-badge--unlocked' : ' garden-milestone-badge--locked'}`}
      aria-label={achieved ? `${label} — achieved` : `${label} — locked`}
    >
      <span className="garden-milestone-badge__icon" aria-hidden="true">
        {achieved ? icon : lockedIcon}
      </span>
      <span className="garden-milestone-badge__pct">{pct}%</span>
    </div>
  )
}

const NAV_TABS = [
  { id: 'learn',  label: 'Learn',  icon: '💡' },
  { id: 'garden', label: 'Garden', icon: '🌱' },
  { id: 'tasks',  label: 'Tasks',  icon: '✅' },
  { id: 'gullak', label: 'Gullak', icon: '🪙' },
]

export default function ChildGarden() {
  const { token } = useParams()

  const [status,     setStatus]     = useState('loading') // 'loading' | 'error' | 'ready'
  const [errorMsg,   setErrorMsg]   = useState('')
  const [gardenData, setGardenData] = useState(null)
  const [activeTab,  setActiveTab]  = useState('learn')

  // Tasks tab state
  const [tasks,      setTasks]      = useState([])
  const [submitting, setSubmitting] = useState({}) // { ruleId: true }
  const [submitMsg,  setSubmitMsg]  = useState({}) // { ruleId: 'sent'|'pending'|'error' }

  useEffect(() => {
    async function load() {
      if (!token) { setStatus('error'); setErrorMsg('No link token found.'); return }

      try {
        const res = await fetch(
          `${BACKEND_URL}/api/child/garden`,
          { headers: { 'X-Child-Token': token } }
        )

        if (res.status === 401) {
          setErrorMsg('This link has expired or is no longer valid. Ask a parent to send a new one.')
          setStatus('error')
          return
        }

        if (!res.ok) {
          setErrorMsg('Something went wrong. Try again in a moment.')
          setStatus('error')
          return
        }

        const data = await res.json()
        setGardenData(data)
        setStatus('ready')

        // Fire child_app_open — fire-and-forget, no await
        logActivity('child', 'child_app_open', { childToken: token })

        loadTasks(token)
      } catch {
        setErrorMsg('Could not connect. Check your internet and try again.')
        setStatus('error')
      }
    }

    load()
  }, [token])

  const loadTasks = useCallback(async (tkn) => {
    try {
      const res = await fetch(`${BACKEND_URL}/api/tasks/child`, {
        headers: { 'X-Child-Token': tkn || token },
      })
      if (res.ok) {
        const data = await res.json()
        setTasks(data.rules || [])
      }
    } catch {
      // non-critical
    }
  }, [token])

  async function submitTask(ruleId) {
    setSubmitting(s => ({ ...s, [ruleId]: true }))
    setSubmitMsg(m => ({ ...m, [ruleId]: null }))
    try {
      const res = await fetch(`${BACKEND_URL}/api/tasks/${ruleId}/complete`, {
        method:  'POST',
        headers: { 'X-Child-Token': token, 'Content-Type': 'application/json' },
      })
      if (res.ok) {
        setSubmitMsg(m => ({ ...m, [ruleId]: 'sent' }))
        setTasks(prev => prev.map(t => t.id === ruleId ? { ...t, has_pending: true } : t))
      } else if (res.status === 409) {
        setSubmitMsg(m => ({ ...m, [ruleId]: 'pending' }))
      } else {
        setSubmitMsg(m => ({ ...m, [ruleId]: 'error' }))
      }
    } catch {
      setSubmitMsg(m => ({ ...m, [ruleId]: 'error' }))
    } finally {
      setSubmitting(s => ({ ...s, [ruleId]: false }))
    }
  }

  function handleTabClick(tabId) {
    setActiveTab(tabId)
    logActivity('child', 'child_tab_visit', {
      section:    `child/${tabId}`,
      childToken: token,
    })
  }

  // ── Loading ───────────────────────────────────────────────────
  if (status === 'loading') {
    return (
      <div className="child-shell">
        <div className="child-loading">
          <div className="child-loading__plant">🌱</div>
          <div className="child-loading__text">Getting your garden ready…</div>
        </div>
      </div>
    )
  }

  // ── Error — friendly, never a 500 ─────────────────────────────
  if (status === 'error') {
    return (
      <div className="child-shell">
        <div className="child-error">
          <div className="child-error__penny">🐿️</div>
          <h1 className="child-error__title">Penny can't find your garden</h1>
          <p className="child-error__body">{errorMsg}</p>
        </div>
      </div>
    )
  }

  // ── Garden ────────────────────────────────────────────────────
  const { child, tagged_total, fund_count, learning_state } = gardenData
  const goalAmount    = parseFloat(child.goal_amount) || 0
  const progressPct   = goalAmount > 0 ? Math.min((tagged_total / goalAmount) * 100, 100) : 0
  const plant         = getPlantStage(progressPct)
  const pennyGreeting = getPennyGreeting(child.age_stage, child.goal_name)

  return (
    <div className="child-shell">
      {/* Top bar */}
      <div className="garden-topbar">
        <span className="garden-topbar__logo">Taru</span>
        <span className="garden-topbar__greeting">Hi, {child.name} 👋</span>
      </div>

      {/* Main content — tabs */}
      <div className="garden-shell">

        {/* ── Garden tab ─────────────────────────────────── */}
        {activeTab === 'garden' && (
          <div className="garden-plant-area">
            {/* Plant emoji — seed gets pulse, others get float */}
            <div className={`garden-plant${plant.stage === 'seed' ? ' garden-plant--seed' : ''}`}>
              {plant.emoji}
            </div>

            {/* Goal Card — surface + shadow lifts it off the bg */}
            {(child.goal_name || goalAmount > 0) && (
              <div className="garden-goal-card">
                {/* Header row: goal name + age stage badge */}
                <div className="garden-goal-card__header">
                  {child.goal_name && (
                    <div className="garden-goal-name">{child.goal_name}</div>
                  )}
                  <div className="garden-stage-badge">{child.age_stage}</div>
                </div>

                {/* Progress bar */}
                {goalAmount > 0 && (
                  <div className="garden-progress-wrap">
                    <div className="garden-progress-bar">
                      <div
                        className="garden-progress-fill"
                        style={{ width: `${progressPct}%` }}
                      />
                    </div>
                    <div className="garden-progress-label">
                      <span>{Math.round(progressPct)}% there</span>
                      <span>₹{goalAmount.toLocaleString('en-IN', { maximumFractionDigits: 0 })}</span>
                    </div>
                  </div>
                )}

                {/* Milestones — moved from Gullak, belongs here with portfolio progress */}
                {goalAmount > 0 && (
                  <div className="garden-milestones">
                    <div className="garden-milestones__label">Milestones</div>
                    <div className="garden-milestone-grid">
                      {MILESTONES.map(m => (
                        <MilestoneBadge
                          key={m.pct}
                          {...m}
                          achieved={progressPct >= m.pct}
                        />
                      ))}
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Stage badge fallback — shown when no goal is set */}
            {!child.goal_name && goalAmount === 0 && (
              <div className="garden-stage-badge">{child.age_stage}</div>
            )}

            {/* Penny speech bubble */}
            <div className="penny-bubble">
              <div className="penny-bubble__penny">🐿️</div>
              <p className="penny-bubble__text">{pennyGreeting}</p>
            </div>
          </div>
        )}

        {/* ── Learn tab ──────────────────────────────────── */}
        {activeTab === 'learn' && (
          <Learn
            ageStage={child.age_stage}
            currentWeek={learning_state?.current_week ?? 1}
            lastTriggerType={learning_state?.last_trigger_type ?? null}
            token={token}
          />
        )}

        {/* ── Tasks tab ──────────────────────────────────── */}
        {activeTab === 'tasks' && (
          <div className="garden-tasks">
            <div className="garden-tasks__header">
              <div className="garden-tasks__title">Your tasks</div>
              <div className="garden-tasks__sub">
                Complete a task and ask a parent to approve it to earn coins.
              </div>
            </div>

            {tasks.length === 0 ? (
              <div className="child-tasks-empty">
                <div className="child-tasks-empty__icon">📋</div>
                <div className="child-tasks-empty__title">No tasks yet</div>
                <div className="child-tasks-empty__body">
                  Ask a parent to set up assigned tasks.
                </div>
              </div>
            ) : (
              tasks.map(task => {
                const isPending = task.has_pending
                const isSending = submitting[task.id]
                const msg       = submitMsg[task.id]

                return (
                  <div key={task.id} className="child-task-card">
                    <div className="child-task-card__info">
                      <div className="child-task-card__name">{task.task_name}</div>
                      <div className="child-task-card__coins">🪙 {task.reward_coins} coins · {task.frequency}</div>
                    </div>

                    {msg === 'sent' || isPending ? (
                      <div className="child-task-card__pending">Waiting for approval ⏳</div>
                    ) : (
                      <button
                        className="child-task-card__btn"
                        disabled={isSending}
                        onClick={() => submitTask(task.id)}
                      >
                        {isSending ? '…' : 'Done!'}
                      </button>
                    )}

                    {msg === 'error' && (
                      <div style={{ fontSize: '12px', color: 'var(--coral)', marginTop: 'var(--sp1)' }}>
                        Something went wrong. Try again.
                      </div>
                    )}
                  </div>
                )
              })
            )}
          </div>
        )}

        {/* ── Gullak tab ─────────────────────────────────── */}
        {activeTab === 'gullak' && (
          <Gullak
            coinsTotal={learning_state?.coins_total ?? 0}
            taggedTotal={tagged_total}
            goalAmount={goalAmount}
          />
        )}
      </div>

      {/* Bottom nav */}
      <nav className="garden-nav">
        {NAV_TABS.map(tab => (
          <button
            key={tab.id}
            className={`garden-nav__item${activeTab === tab.id ? ' active' : ''}`}
            onClick={() => handleTabClick(tab.id)}
          >
            <span className="garden-nav__icon">{tab.icon}</span>
            <span className="garden-nav__label">{tab.label}</span>
          </button>
        ))}
      </nav>
    </div>
  )
}
