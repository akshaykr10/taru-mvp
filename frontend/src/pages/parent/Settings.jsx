import { useEffect, useState } from 'react'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import { BACKEND_URL } from '../../lib/api.js'
import '../../styles/parent.css'

function deriveAgeStage(dob) {
  const age = Math.floor((Date.now() - new Date(dob)) / (365.25 * 24 * 60 * 60 * 1000))
  if (age <= 8)  return 'seed'
  if (age <= 11) return 'sprout'
  if (age <= 14) return 'growth'
  return 'investor'
}

const STAGE_LABELS = {
  seed:     'Seed (ages 5–8)',
  sprout:   'Sprout (ages 9–11)',
  growth:   'Growth (ages 12–14)',
  investor: 'Investor (ages 15–17)',
}

const FREQUENCY_LABELS = {
  'one-time': 'One-time',
  'weekly':   'Weekly',
  'custom':   'Custom',
}

async function getAuthHeaders() {
  const { data: { session } } = await supabase.auth.getSession()
  return {
    'Content-Type':  'application/json',
    'Authorization': `Bearer ${session?.access_token}`,
  }
}

// ── Quick-assign presets ─────────────────────────────────────
const QUICK_TASKS = [
  { label: '🧹 Tidy Room',    coins: 20, freq: 'weekly'   },
  { label: '📚 Homework',     coins: 30, freq: 'weekly'   },
  { label: '🐕 Dog Walking',  coins: 25, freq: 'weekly'   },
  { label: '🍽️ Clear Table',  coins: 15, freq: 'weekly'   },
  { label: '🛏️ Make Bed',     coins: 10, freq: 'weekly'   },
  { label: '🌱 Water Plants', coins: 20, freq: 'one-time' },
]

// ── Goal edit card ────────────────────────────────────────────
function GoalEditCard({ child, onSaved }) {
  const [editing,    setEditing]    = useState(false)
  const [goalName,   setGoalName]   = useState(child?.goal_name   || '')
  const [goalAmount, setGoalAmount] = useState(child?.goal_amount ? String(child.goal_amount) : '')
  const [goalDate,   setGoalDate]   = useState(child?.goal_date   || '')
  const [saving,     setSaving]     = useState(false)
  const [errors,     setErrors]     = useState({})
  const [saveError,  setSaveError]  = useState('')
  const [saved,      setSaved]      = useState(false)

  const todayStr = new Date().toISOString().split('T')[0]

  // Max date = child's 18th birthday
  const maxGoalDate = child?.dob
    ? (() => {
        const d = new Date(child.dob + 'T00:00:00')
        d.setFullYear(d.getFullYear() + 18)
        return d.toISOString().split('T')[0]
      })()
    : ''

  function startEdit() {
    setGoalName(child?.goal_name   || '')
    setGoalAmount(child?.goal_amount ? String(child.goal_amount) : '')
    setGoalDate(child?.goal_date   || '')
    setErrors({})
    setSaveError('')
    setEditing(true)
  }

  function cancel() {
    setEditing(false)
    setErrors({})
    setSaveError('')
  }

  async function save() {
    const errs  = {}
    const name   = goalName.trim()
    const amount = parseFloat(goalAmount)

    if (!name || name.length > 40)
      errs.name = 'Give the goal a name.'
    if (!goalAmount || isNaN(amount) || amount <= 0 || amount > 9999999)
      errs.amount = 'Enter a valid amount.'
    if (!goalDate || goalDate <= todayStr)
      errs.date = 'Pick a future date.'

    if (Object.keys(errs).length) { setErrors(errs); return }

    setSaving(true)
    setSaveError('')
    try {
      const res  = await fetch(`${BACKEND_URL}/api/children/${child.id}`, {
        method:  'PATCH',
        headers: await getAuthHeaders(),
        body:    JSON.stringify({ goal_name: name, goal_amount: amount, goal_date: goalDate }),
      })
      const data = await res.json()
      if (!res.ok) { setSaveError("Couldn't save — try again."); return }
      onSaved(data.child)
      setEditing(false)
      setSaved(true)
      setTimeout(() => setSaved(false), 2000)
    } catch {
      setSaveError("Couldn't save — try again.")
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="card">
      {editing ? (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp4)' }}>
          <div>
            <label className="form-label" htmlFor="goal-name-edit">Goal name</label>
            <input
              id="goal-name-edit"
              className="form-input"
              type="text"
              placeholder="e.g. IIT fees, Europe trip, first bike"
              maxLength={40}
              value={goalName}
              onChange={e => setGoalName(e.target.value)}
              autoFocus
            />
            {errors.name && (
              <p style={{ fontSize: '13px', color: 'var(--coral)', marginTop: 'var(--sp1)', fontFamily: 'var(--font-parent)' }}>
                {errors.name}
              </p>
            )}
          </div>

          <div>
            <label className="form-label" htmlFor="goal-amount-edit">Target amount</label>
            <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--sp2)' }}>
              <span style={{ fontSize: '15px', color: 'var(--ink)', fontFamily: 'var(--font-parent)', flexShrink: 0 }}>₹</span>
              <input
                id="goal-amount-edit"
                className="form-input"
                type="number"
                inputMode="numeric"
                placeholder="500000"
                min="1"
                max="9999999"
                step="1"
                value={goalAmount}
                onChange={e => setGoalAmount(e.target.value)}
                style={{ flex: 1 }}
              />
            </div>
            {errors.amount && (
              <p style={{ fontSize: '13px', color: 'var(--coral)', marginTop: 'var(--sp1)', fontFamily: 'var(--font-parent)' }}>
                {errors.amount}
              </p>
            )}
          </div>

          <div>
            <label className="form-label" htmlFor="goal-date-edit">Target date</label>
            <input
              id="goal-date-edit"
              className="form-input"
              type="date"
              min={todayStr}
              max={maxGoalDate}
              value={goalDate}
              onChange={e => setGoalDate(e.target.value)}
            />
            {errors.date && (
              <p style={{ fontSize: '13px', color: 'var(--coral)', marginTop: 'var(--sp1)', fontFamily: 'var(--font-parent)' }}>
                {errors.date}
              </p>
            )}
          </div>

          {saveError && (
            <p style={{ fontSize: '13px', color: 'var(--coral)', fontFamily: 'var(--font-parent)' }}>
              {saveError}
            </p>
          )}

          <div style={{ display: 'flex', gap: 'var(--sp3)' }}>
            <button className="btn btn-outline" style={{ flex: 1 }} onClick={cancel} disabled={saving}>
              Cancel
            </button>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={save} disabled={saving}>
              {saving ? 'Saving…' : 'Save goal'}
            </button>
          </div>
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', gap: 'var(--sp3)' }}>
          <div style={{ flex: 1 }}>
            {child?.goal_name ? (
              <>
                <div style={{ fontFamily: 'var(--font-display)', fontSize: '16px', color: 'var(--ink)', marginBottom: 'var(--sp1)' }}>
                  {child.goal_name}
                </div>
                <div style={{ fontFamily: 'var(--font-parent)', fontSize: '13px', color: 'var(--ink-60)' }}>
                  {child.goal_amount && `₹${Number(child.goal_amount).toLocaleString('en-IN')}`}
                  {child.goal_amount && child.goal_date && ' · '}
                  {child.goal_date && new Date(child.goal_date + 'T00:00:00').toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </div>
              </>
            ) : (
              <p style={{ fontFamily: 'var(--font-parent)', fontSize: '14px', color: 'var(--ink-60)', margin: 0 }}>
                No goal set yet.
              </p>
            )}
            {saved && (
              <p style={{ fontFamily: 'var(--font-parent)', fontSize: '13px', color: 'var(--forest)', marginTop: 'var(--sp2)', margin: `var(--sp2) 0 0` }}>
                Goal updated.
              </p>
            )}
          </div>
          <button
            onClick={startEdit}
            style={{
              background: 'none', border: 'none', padding: 0,
              cursor: 'pointer', fontSize: '13px', fontWeight: 500,
              color: 'var(--forest)', fontFamily: 'var(--font-parent)',
              flexShrink: 0, minHeight: '44px',
              display: 'flex', alignItems: 'center',
            }}
          >
            Edit
          </button>
        </div>
      )}
    </div>
  )
}

// ── Task rule form ────────────────────────────────────────────
function TaskRuleForm({ childId, onSave, onCancel }) {
  const [name,      setName]      = useState('')
  const [coins,     setCoins]     = useState('10')
  const [freq,      setFreq]      = useState('weekly')
  const [saving,    setSaving]    = useState(false)
  const [error,     setError]     = useState('')

  async function submit(e) {
    e.preventDefault()
    const n = name.trim()
    if (!n) { setError('Task name is required.'); return }
    const c = parseInt(coins, 10)
    if (isNaN(c) || c < 1 || c > 100) { setError('Coins must be 1–100.'); return }

    setSaving(true)
    setError('')
    try {
      const res  = await fetch(`${BACKEND_URL}/api/tasks`, {
        method:  'POST',
        headers: await getAuthHeaders(),
        body:    JSON.stringify({ task_name: n, reward_coins: c, frequency: freq, child_id: childId }),
      })
      const data = await res.json()
      if (!res.ok) { setError(data.error || 'Failed to create task.'); return }
      onSave(data.rule)
    } catch {
      setError('Network error. Please try again.')
    } finally {
      setSaving(false)
    }
  }

  return (
    <form onSubmit={submit} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp4)' }}>
      {error && <div className="auth-error">{error}</div>}

      {/* Quick assign chip rail */}
      <div className="quick-assign-section">
        <div className="quick-assign-label">Quick assign</div>
        <div className="quick-assign-rail">
          {QUICK_TASKS.map(t => (
            <button
              key={t.label}
              type="button"
              className={`quick-assign-chip${name === t.label ? ' quick-assign-chip--active' : ''}`}
              onClick={() => { setName(t.label); setCoins(String(t.coins)); setFreq(t.freq) }}
            >
              {t.label} · {t.coins}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="form-label" htmlFor="task-name">Task name</label>
        <input
          id="task-name"
          className="form-input"
          type="text"
          placeholder="e.g. Read for 20 minutes"
          maxLength={80}
          value={name}
          onChange={e => setName(e.target.value)}
          autoFocus
        />
      </div>

      <div className="task-form-grid">
        <div>
          <label className="form-label" htmlFor="task-coins">Coins reward</label>
          <input
            id="task-coins"
            className="form-input"
            type="number"
            min="1"
            max="100"
            value={coins}
            onChange={e => setCoins(e.target.value)}
          />
        </div>
        <div>
          <label className="form-label" htmlFor="task-freq">Frequency</label>
          <select
            id="task-freq"
            className="form-input"
            value={freq}
            onChange={e => setFreq(e.target.value)}
          >
            <option value="weekly">Weekly</option>
            <option value="one-time">One-time</option>
            <option value="custom">Custom</option>
          </select>
        </div>
      </div>

      <div style={{ display: 'flex', gap: 'var(--space-2)', marginTop: 'var(--space-1)' }}>
        <button type="button" className="btn btn-outline" style={{ flex: 1 }} onClick={onCancel} disabled={saving}>
          Cancel
        </button>
        <button type="submit" className="btn btn-primary" style={{ flex: 1 }} disabled={saving}>
          {saving ? 'Saving…' : 'Add task'}
        </button>
      </div>
    </form>
  )
}

// ── Task rule row ─────────────────────────────────────────────
function TaskRuleRow({ rule, onToggle, onDelete }) {
  const [toggling,  setToggling]  = useState(false)
  const [deleting,  setDeleting]  = useState(false)
  const [confirmDel, setConfirmDel] = useState(false)

  async function toggle() {
    setToggling(true)
    const newStatus = rule.status === 'active' ? 'paused' : 'active'
    try {
      const res  = await fetch(`${BACKEND_URL}/api/tasks/${rule.id}`, {
        method:  'PATCH',
        headers: await getAuthHeaders(),
        body:    JSON.stringify({ status: newStatus }),
      })
      const data = await res.json()
      if (res.ok) onToggle(rule.id, data.rule)
    } finally {
      setToggling(false)
    }
  }

  async function deleteRule() {
    setDeleting(true)
    try {
      const res = await fetch(`${BACKEND_URL}/api/tasks/${rule.id}`, {
        method:  'DELETE',
        headers: await getAuthHeaders(),
      })
      if (res.ok) onDelete(rule.id)
    } finally {
      setDeleting(false)
      setConfirmDel(false)
    }
  }

  return (
    <div className="task-rule-row">
      <div className="task-rule-row__info">
        <div className="task-rule-row__name">{rule.task_name}</div>
        <div className="task-rule-row__meta">
          <span className="task-rule-row__coins">🪙 {rule.reward_coins}</span>
          <span className="task-rule-row__freq">{FREQUENCY_LABELS[rule.frequency]}</span>
          {rule.status === 'paused' && (
            <span className="task-rule-row__paused">Paused</span>
          )}
        </div>
      </div>
      <div className="task-rule-row__actions">
        {rule.frequency !== 'one-time' && (
          <button
            className="btn-ghost"
            onClick={toggle}
            disabled={toggling}
          >
            {toggling ? '…' : rule.status === 'active' ? 'Pause' : 'Resume'}
          </button>
        )}

        {!confirmDel ? (
          <button
            className="btn-danger"
            onClick={() => setConfirmDel(true)}
          >
            Delete
          </button>
        ) : (
          <button
            className="btn-danger btn-danger--filled"
            onClick={deleteRule}
            disabled={deleting}
          >
            {deleting ? '…' : 'Confirm'}
          </button>
        )}
      </div>
    </div>
  )
}

// ── Main settings page ────────────────────────────────────────
export default function ParentSettings() {
  const { user } = useAuth()
  const [child,      setChild]      = useState(null)
  const [loading,    setLoading]    = useState(true)
  const [rules,      setRules]      = useState([])
  const [rulesLoading, setRulesLoading] = useState(true)
  const [showForm,   setShowForm]   = useState(false)

  // Add Child modal state
  const [showAddChild,    setShowAddChild]    = useState(false)
  const [addChildName,    setAddChildName]    = useState('')
  const [addChildDob,     setAddChildDob]     = useState('')
  const [addChildError,   setAddChildError]   = useState('')
  const [addChildSaving,  setAddChildSaving]  = useState(false)

  // Garden link state
  const [generatingLink, setGeneratingLink] = useState(false)
  const [linkError,      setLinkError]      = useState('')
  const [copied,         setCopied]         = useState(false)
  const [confirmRegen,   setConfirmRegen]   = useState(false)

  useEffect(() => {
    if (!user?.id) return
    supabase
      .from('children')
      .select('*')
      .eq('parent_id', user.id)
      .maybeSingle()
      .then(({ data }) => { setChild(data); setLoading(false) })
  }, [user?.id])

  useEffect(() => {
    async function loadRules() {
      const headers = await getAuthHeaders()
      const res     = await fetch(`${BACKEND_URL}/api/tasks`, { headers })
      if (res.ok) {
        const data = await res.json()
        setRules(data.rules || [])
      }
      setRulesLoading(false)
    }
    loadRules()
  }, [])

  // ── Token generation ─────────────────────────────────────────
  async function generateLink(isRegen = false) {
    if (!child?.id) return
    setGeneratingLink(true)
    setLinkError('')
    const endpoint = isRegen
      ? `${BACKEND_URL}/api/children/${child.id}/token/regenerate`
      : `${BACKEND_URL}/api/children/${child.id}/token`
    try {
      const res  = await fetch(endpoint, { method: 'POST', headers: await getAuthHeaders() })
      const data = await res.json()
      if (!res.ok) { setLinkError(data.error || 'Failed to generate link.'); return }
      setChild(prev => ({ ...prev, child_token: data.child_token }))
      setConfirmRegen(false)
    } catch {
      setLinkError('Network error. Please try again.')
    } finally {
      setGeneratingLink(false)
    }
  }

  async function copyLink() {
    const url = `${window.location.origin}/child/${child.child_token}`
    await navigator.clipboard.writeText(url)
    setCopied(true)
    setTimeout(() => setCopied(false), 2500)
  }

  function handleGoalSaved(updatedChild) {
    setChild(updatedChild)
  }

  function handleRuleSaved(newRule) {
    setRules(prev => [...prev, newRule])
    setShowForm(false)
  }

  function handleRuleToggle(id, updated) {
    setRules(prev => prev.map(r => r.id === id ? updated : r))
  }

  function handleRuleDelete(id) {
    setRules(prev => prev.filter(r => r.id !== id))
  }

  const today  = new Date()
  const maxDob = new Date(today.getFullYear() - 5,  today.getMonth(), today.getDate()).toISOString().split('T')[0]
  const minDob = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate()).toISOString().split('T')[0]

  async function handleAddChild(e) {
    e.preventDefault()
    const name = addChildName.trim()
    if (!name)        { setAddChildError('Please enter your child\'s name.'); return }
    if (!addChildDob) { setAddChildError('Please enter your child\'s date of birth.'); return }

    setAddChildSaving(true)
    setAddChildError('')
    const stage = deriveAgeStage(addChildDob)

    const { data: newChild, error } = await supabase
      .from('children')
      .insert({ parent_id: user.id, name, dob: addChildDob, age_stage: stage })
      .select()
      .single()

    setAddChildSaving(false)

    if (error) {
      setAddChildError('Failed to add child. Please try again.')
      return
    }

    setChild(newChild)
    setShowAddChild(false)
    setAddChildName('')
    setAddChildDob('')
  }

  if (loading) return null

  const gardenUrl = child?.child_token
    ? `${window.location.origin}/child/${child.child_token}`
    : null

  return (
    <div className="page">
      <h1 className="page-title">Settings</h1>

      {/* ── Child profile ──────────────────────────────────── */}
      <div className="section-header">
        <span className="section-title">Child profile</span>
      </div>

      {child ? (
        <div className="card">
          <div className="summary-row">
            <span className="summary-row__label">Name</span>
            <span className="summary-row__value">{child.name}</span>
          </div>
          <div className="summary-row">
            <span className="summary-row__label">Date of birth</span>
            <span className="summary-row__value">
              {new Date(child.dob + 'T00:00:00').toLocaleDateString('en-IN', {
                day: 'numeric', month: 'long', year: 'numeric',
              })}
            </span>
          </div>
          <div className="summary-row">
            <span className="summary-row__label">Learning stage</span>
            <span className="summary-row__value">{STAGE_LABELS[child.age_stage]}</span>
          </div>
        </div>
      ) : (
        <div className="card">
          <div className="empty-state" style={{ padding: 'var(--sp4) 0' }}>
            <div className="empty-state__icon">🌱</div>
            <div className="empty-state__title">No child added yet</div>
            <div className="empty-state__body" style={{ marginBottom: 'var(--sp6)' }}>
              Add your child to set up their Money Garden.
            </div>
            <button
              className="btn btn-primary"
              style={{ width: '100%' }}
              onClick={() => setShowAddChild(true)}
            >
              + Add Child
            </button>
          </div>
        </div>
      )}

      {/* ── Savings goal ───────────────────────────────────── */}
      <div className="section-header" style={{ marginTop: 'var(--space-2)' }}>
        <span className="section-title">Savings goal</span>
      </div>

      {child ? (
        <GoalEditCard child={child} onSaved={handleGoalSaved} />
      ) : (
        <div className="card">
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Add a child profile first.
          </p>
        </div>
      )}

      {/* ── Task rules ─────────────────────────────────────── */}
      <div className="section-header" style={{ marginTop: 'var(--space-2)' }}>
        <span className="section-title">Assigned Tasks</span>
        <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
          {rules.length}/3 used
        </span>
      </div>

      <div className="card">
        {rulesLoading ? (
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>Loading…</p>
        ) : (
          <>
            {rules.length === 0 && !showForm && (
              <div className="empty-state" style={{ padding: 'var(--space-3) 0' }}>
                <div className="empty-state__icon">📋</div>
                <div className="empty-state__title">No assigned tasks yet</div>
                <div className="empty-state__body">
                  Create tasks that {child?.name || 'your child'} can complete to earn coins.
                </div>
              </div>
            )}

            {rules.map(rule => (
              <TaskRuleRow
                key={rule.id}
                rule={rule}
                onToggle={handleRuleToggle}
                onDelete={handleRuleDelete}
              />
            ))}

            {showForm ? (
              <div style={{ marginTop: rules.length > 0 ? 'var(--space-4)' : 0, borderTop: rules.length > 0 ? '1px solid var(--color-border)' : 'none', paddingTop: rules.length > 0 ? 'var(--space-4)' : 0 }}>
                <TaskRuleForm
                  childId={child?.id}
                  onSave={handleRuleSaved}
                  onCancel={() => setShowForm(false)}
                />
              </div>
            ) : rules.length < 3 && child && (
              <button
                className="btn btn-outline"
                style={{ width: '100%', marginTop: rules.length > 0 ? 'var(--space-3)' : 0 }}
                onClick={() => setShowForm(true)}
              >
                + Add assigned task
              </button>
            )}
          </>
        )}
      </div>

      {/* ── Child's garden link ─────────────────────────────── */}
      <div className="section-header" style={{ marginTop: 'var(--space-2)' }}>
        <span className="section-title">
          {child?.name ? `${child.name}'s garden link` : "Child's garden link"}
        </span>
      </div>

      <div className="card">
        {!child ? (
          <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)' }}>
            Add a child profile first.
          </p>
        ) : !gardenUrl ? (
          <div>
            <p style={{ fontSize: '14px', color: 'var(--color-text-secondary)', lineHeight: 1.55, marginBottom: 'var(--space-4)' }}>
              Generate a private link for {child.name}. It works for 90 days without
              any login — just open and explore.
            </p>
            {linkError && (
              <div className="auth-error" style={{ marginBottom: 'var(--space-3)' }}>{linkError}</div>
            )}
            <button
              className="btn btn-navy"
              style={{ width: '100%' }}
              onClick={() => generateLink(false)}
              disabled={generatingLink}
            >
              {generatingLink ? 'Generating…' : `Generate garden link for ${child.name}`}
            </button>
          </div>
        ) : (
          <div>
            <p style={{ fontSize: '13px', color: 'var(--color-text-secondary)', marginBottom: 'var(--space-3)' }}>
              Share this link with {child.name}. Valid for 90 days — no login needed.
            </p>
            <div style={{
              background: 'var(--color-surface)', border: '1px solid var(--color-border)',
              borderRadius: 'var(--radius-sm)', padding: 'var(--space-3) var(--space-4)',
              fontSize: '12px', wordBreak: 'break-all', color: 'var(--color-navy)',
              fontFamily: 'monospace', marginBottom: 'var(--space-3)', lineHeight: 1.5,
            }}>
              {gardenUrl}
            </div>
            <button
              className="btn btn-gold"
              style={{ width: '100%', marginBottom: 'var(--space-3)' }}
              onClick={copyLink}
            >
              {copied ? '✓ Copied!' : '📋 Copy link'}
            </button>
            {!confirmRegen ? (
              <button
                className="btn btn-outline"
                style={{ width: '100%', fontSize: '13px' }}
                onClick={() => setConfirmRegen(true)}
              >
                Regenerate link
              </button>
            ) : (
              <div style={{ background: '#FEF2F2', border: '1px solid #FECACA', borderRadius: 'var(--radius-sm)', padding: 'var(--space-4)' }}>
                <p style={{ fontSize: '14px', color: '#991B1B', marginBottom: 'var(--space-3)', lineHeight: 1.5 }}>
                  This will invalidate the old link immediately.
                  {child.name} won't be able to open the old link anymore.
                </p>
                <div style={{ display: 'flex', gap: 'var(--space-2)' }}>
                  <button className="btn btn-outline" style={{ flex: 1 }} onClick={() => setConfirmRegen(false)} disabled={generatingLink}>
                    Cancel
                  </button>
                  <button className="btn btn-navy" style={{ flex: 1 }} onClick={() => generateLink(true)} disabled={generatingLink}>
                    {generatingLink ? 'Regenerating…' : 'Yes, regenerate'}
                  </button>
                </div>
                {linkError && <div className="auth-error" style={{ marginTop: 'var(--space-3)' }}>{linkError}</div>}
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Add Child modal ────────────────────────────────── */}
      {showAddChild && (
        <div
          className="add-child-overlay"
          role="dialog"
          aria-modal="true"
          aria-label="Add child"
          onClick={e => { if (e.target === e.currentTarget) setShowAddChild(false) }}
        >
          <div className="add-child-sheet">
            <div className="add-child-sheet__handle" aria-hidden="true" />
            <h2 className="add-child-sheet__title">Add your child</h2>
            <p className="add-child-sheet__sub">
              Their learning stage is set automatically from their date of birth.
            </p>

            <form onSubmit={handleAddChild} style={{ display: 'flex', flexDirection: 'column', gap: 'var(--sp4)' }}>
              {addChildError && (
                <div className="auth-error">{addChildError}</div>
              )}

              <div>
                <label className="form-label" htmlFor="add-child-name">Child's name</label>
                <input
                  id="add-child-name"
                  className="form-input"
                  type="text"
                  placeholder="e.g. Arya"
                  maxLength={60}
                  value={addChildName}
                  onChange={e => setAddChildName(e.target.value)}
                  autoFocus
                />
              </div>

              <div>
                <label className="form-label" htmlFor="add-child-dob">Date of birth</label>
                <input
                  id="add-child-dob"
                  className="form-input"
                  type="date"
                  min={minDob}
                  max={maxDob}
                  value={addChildDob}
                  onChange={e => setAddChildDob(e.target.value)}
                />
                {addChildDob && (
                  <p style={{ fontSize: '12px', color: 'var(--color-text-secondary)', marginTop: 'var(--sp1)' }}>
                    Stage: {STAGE_LABELS[deriveAgeStage(addChildDob)]}
                  </p>
                )}
              </div>

              <div style={{ display: 'flex', gap: 'var(--sp3)', marginTop: 'var(--sp2)' }}>
                <button
                  type="button"
                  className="btn btn-outline"
                  style={{ flex: 1 }}
                  onClick={() => { setShowAddChild(false); setAddChildError('') }}
                  disabled={addChildSaving}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn btn-primary"
                  style={{ flex: 1 }}
                  disabled={addChildSaving}
                >
                  {addChildSaving ? 'Saving…' : 'Add child'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  )
}
