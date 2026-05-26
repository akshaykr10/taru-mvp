import { useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../../lib/supabase.js'
import { useAuth } from '../../context/AuthContext.jsx'
import '../../styles/parent.css'

// Derived from DOB — parent cannot override (CLAUDE.md spec)
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

// ── Goal presets ──────────────────────────────────────────────
const GOAL_PRESETS = [
  { emoji: '🎓', label: 'College / IIT fees' },
  { emoji: '🏍️', label: 'First bike' },
  { emoji: '💻', label: 'Laptop' },
  { emoji: '✈️', label: 'Europe trip' },
  { emoji: '🎮', label: 'Gaming PC' },
  { emoji: '🌍', label: 'Study abroad' },
]

const MONTHS = [
  'January','February','March','April','May','June',
  'July','August','September','October','November','December',
]

const CURRENT_YEAR = new Date().getFullYear()
const GOAL_YEARS   = Array.from({ length: 21 }, (_, i) => CURRENT_YEAR + 1 + i)

// Format digits as Indian-system number (1,00,000)
function formatIndian(raw) {
  const digits = String(raw).replace(/[^0-9]/g, '')
  if (!digits) return ''
  return Number(digits).toLocaleString('en-IN')
}

// Short human-readable form: 2.5 lakh, 1 crore, etc.
function toWords(raw) {
  const n = parseInt(String(raw).replace(/[^0-9]/g, ''), 10)
  if (!n) return ''
  if (n >= 10000000) return `${(n / 10000000).toFixed(1).replace(/\.0$/, '')} crore`
  if (n >= 100000)   return `${(n / 100000).toFixed(1).replace(/\.0$/, '')} lakh`
  if (n >= 1000)     return `${(n / 1000).toFixed(1).replace(/\.0$/, '')} thousand`
  return `${n}`
}

// Build YYYY-MM-DD for storage.
// Year-only → Dec 31; year + month → last day of that month.
function buildGoalDate(year, month) {
  if (!year) return ''
  if (!month) return `${year}-12-31`
  const lastDay = new Date(Number(year), Number(month), 0).getDate()
  return `${year}-${String(month).padStart(2, '0')}-${lastDay}`
}

const TOTAL_STEPS = 3 // steps 1–3; step 0 is the intro (no dots)

// ── Value proposition bullets ─────────────────────────────────
const VALUE_PROPS = [
  {
    icon: '📈',
    title: 'Your portfolio, their garden',
    body: 'Real investments shown as a growing plant — not a number they can\'t relate to.',
  },
  {
    icon: '🐿️',
    title: 'Penny explains every move',
    body: 'Market up or down? Penny the Squirrel turns it into a story that fits their age.',
  },
  {
    icon: '🪙',
    title: 'Earn coins, build habits',
    body: 'Assign tasks. They complete them. Coins connect effort to money in a way that sticks.',
  },
  {
    icon: '💬',
    title: 'Weekly conversation starters',
    body: 'One prompt each week — so money talks happen naturally at dinner, not awkwardly.',
  },
]

export default function ParentOnboarding() {
  const navigate = useNavigate()
  const { user } = useAuth()

  const [step,   setStep]   = useState(0) // 0 = intro, 1–3 = wizard steps
  const [error,  setError]  = useState('')
  const [saving, setSaving] = useState(false)

  // Step 1 — child basics
  const [childName, setChildName] = useState('')
  const [dob,       setDob]       = useState('')

  // Step 2 — goal (all optional)
  const [goalPreset, setGoalPreset] = useState('')        // preset label or '__custom__'
  const [goalCustom, setGoalCustom] = useState('')        // text when custom selected
  const [amountRaw,  setAmountRaw]  = useState('')        // digit-only string
  const [goalYear,   setGoalYear]   = useState('')
  const [goalMonth,  setGoalMonth]  = useState('')

  // Derived values
  const goalName   = goalPreset === '__custom__' ? goalCustom.trim() : goalPreset
  const goalAmount = amountRaw.replace(/[^0-9]/g, '')
  const goalDate   = buildGoalDate(goalYear, goalMonth)
  const ageStage   = dob ? deriveAgeStage(dob) : null

  // DOB bounds: ages 5–17
  const today  = new Date()
  const maxDob = new Date(today.getFullYear() - 5,  today.getMonth(), today.getDate()).toISOString().split('T')[0]
  const minDob = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate()).toISOString().split('T')[0]

  function handleAmountChange(e) {
    setAmountRaw(e.target.value.replace(/[^0-9]/g, ''))
  }

  function handleNext(e) {
    e.preventDefault()
    setError('')
    if (step === 1) {
      if (!childName.trim()) { setError('Please enter your child\'s name.'); return }
      if (!dob)              { setError('Please enter your child\'s date of birth.'); return }
    }
    setStep(s => s + 1)
  }

  function handleBack() {
    setError('')
    setStep(s => s - 1)
  }

  async function handleFinish() {
    setSaving(true)
    setError('')

    const stage = deriveAgeStage(dob)

    const { data: child, error: childErr } = await supabase
      .from('children')
      .insert({
        parent_id:   user.id,
        name:        childName.trim(),
        dob,
        age_stage:   stage,
        goal_name:   goalName   || null,
        goal_amount: goalAmount ? parseFloat(goalAmount) : null,
        goal_date:   goalDate   || null,
      })
      .select()
      .single()

    if (childErr) {
      setSaving(false)
      setError('Something went wrong. Please try again.')
      return
    }

    await supabase.from('learning_state').insert({ child_id: child.id })
    navigate('/parent/dashboard', { replace: true })
  }

  return (
    <div className="onboarding-page">

      {/* ── Header ── show progress dots only for steps 1–3 ── */}
      <div className="onboarding-header">
        <span className="onboarding-header__logo">Taru</span>
        {step > 0 && (
          <>
            <div className="onboarding-progress">
              {Array.from({ length: TOTAL_STEPS }).map((_, i) => (
                <div
                  key={i}
                  className={`onboarding-progress__dot${i < step ? ' done' : ''}`}
                />
              ))}
            </div>
            <span style={{ color: 'rgba(255,255,255,0.4)', fontSize: '12px' }}>
              {step}/{TOTAL_STEPS}
            </span>
          </>
        )}
      </div>

      {/* ══ Step 0 — Value proposition ══════════════════════════ */}
      {step === 0 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="onboarding-body">
            <div className="onboarding-intro-icon">🌱</div>
            <h1 className="onboarding-step-title">Your child's money garden</h1>
            <p className="onboarding-step-sub">
              Connect your mutual funds. Your child watches them grow — and
              learns why money moves the way it does. Takes 2 minutes to set up.
            </p>

            <div className="value-props">
              {VALUE_PROPS.map(({ icon, title, body }) => (
                <div key={title} className="value-prop-row">
                  <div className="value-prop-row__icon">{icon}</div>
                  <div className="value-prop-row__text">
                    <div className="value-prop-row__title">{title}</div>
                    <div className="value-prop-row__body">{body}</div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          <div className="onboarding-footer">
            <button
              type="button"
              className="btn btn-navy"
              style={{ flex: 1 }}
              onClick={() => setStep(1)}
            >
              Set up your garden →
            </button>
          </div>
        </div>
      )}

      {/* ══ Step 1 — Child details ══════════════════════════════ */}
      {step === 1 && (
        <form onSubmit={handleNext} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="onboarding-body">
            <h1 className="onboarding-step-title">Tell us about your child</h1>
            <p className="onboarding-step-sub">
              Their age decides how Penny the Squirrel talks to them about money.
            </p>

            <div className="onboarding-form">
              <div className="onboarding-field">
                <label htmlFor="child-name">Child's first name</label>
                <input
                  id="child-name"
                  type="text"
                  placeholder="Arjun"
                  value={childName}
                  onChange={e => { setChildName(e.target.value); setError('') }}
                  autoFocus
                />
              </div>

              <div className="onboarding-field">
                <label htmlFor="dob">Child's date of birth</label>
                <input
                  id="dob"
                  type="date"
                  value={dob}
                  min={minDob}
                  max={maxDob}
                  onChange={e => { setDob(e.target.value); setError('') }}
                />
                {ageStage && (
                  <span className="age-badge">{STAGE_LABELS[ageStage]}</span>
                )}
                <span className="hint">
                  Not yours — your child's! We use this to set their learning stage (ages 5–17).
                </span>
              </div>

              {error && <div className="onboarding-error">{error}</div>}
            </div>
          </div>

          <div className="onboarding-footer">
            <button type="button" className="btn btn-outline" onClick={handleBack}>
              Back
            </button>
            <button type="submit" className="btn btn-navy" style={{ flex: 1 }}>
              Continue
            </button>
          </div>
        </form>
      )}

      {/* ══ Step 2 — Goal (optional) ════════════════════════════ */}
      {step === 2 && (
        <form onSubmit={handleNext} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="onboarding-body">
            <h1 className="onboarding-step-title">What are you saving for?</h1>
            <p className="onboarding-step-sub">
              A named goal gives {childName || 'your child'} something real to watch grow toward.
              You can skip this and set it later.
            </p>

            <div className="onboarding-form">

              {/* Goal name — presets + custom */}
              <div className="onboarding-field">
                <label>Goal</label>
                <div className="quick-assign-rail quick-assign-rail--wrap">
                  {GOAL_PRESETS.map(p => (
                    <button
                      key={p.label}
                      type="button"
                      className={`quick-assign-chip${goalPreset === p.label ? ' quick-assign-chip--active' : ''}`}
                      onClick={() => { setGoalPreset(p.label); setGoalCustom('') }}
                    >
                      {p.emoji} {p.label}
                    </button>
                  ))}
                  <button
                    type="button"
                    className={`quick-assign-chip${goalPreset === '__custom__' ? ' quick-assign-chip--active' : ''}`}
                    onClick={() => setGoalPreset('__custom__')}
                  >
                    ✏️ Other
                  </button>
                </div>
                {goalPreset === '__custom__' && (
                  <input
                    type="text"
                    placeholder="Type your goal…"
                    value={goalCustom}
                    onChange={e => setGoalCustom(e.target.value)}
                    autoFocus
                    maxLength={40}
                    style={{ marginTop: 'var(--sp2)' }}
                  />
                )}
              </div>

              {/* Target amount */}
              <div className="onboarding-field">
                <label htmlFor="goal-amount">Target amount (optional)</label>
                <div className="amount-input-wrap">
                  <span className="amount-input-wrap__prefix">₹</span>
                  <input
                    id="goal-amount"
                    type="text"
                    inputMode="numeric"
                    placeholder="5,00,000"
                    value={amountRaw ? formatIndian(amountRaw) : ''}
                    onChange={handleAmountChange}
                    className="amount-input-wrap__input"
                  />
                </div>
                {amountRaw && (
                  <span className="hint" style={{ color: 'var(--forest)', fontWeight: 500 }}>
                    ₹{toWords(amountRaw)}
                  </span>
                )}
              </div>

              {/* Target year + optional month */}
              <div className="onboarding-field">
                <label>Target year (optional)</label>
                <div style={{ display: 'flex', gap: 'var(--sp3)' }}>
                  <select
                    value={goalYear}
                    onChange={e => { setGoalYear(e.target.value); setGoalMonth('') }}
                    style={{ flex: 1 }}
                  >
                    <option value="">Select year</option>
                    {GOAL_YEARS.map(y => (
                      <option key={y} value={y}>{y}</option>
                    ))}
                  </select>
                  {goalYear && (
                    <select
                      value={goalMonth}
                      onChange={e => setGoalMonth(e.target.value)}
                      style={{ flex: 1 }}
                    >
                      <option value="">Any month</option>
                      {MONTHS.map((m, i) => (
                        <option key={m} value={String(i + 1).padStart(2, '0')}>{m}</option>
                      ))}
                    </select>
                  )}
                </div>
                {goalYear && (
                  <span className="hint">
                    Target: {goalMonth
                      ? `${MONTHS[parseInt(goalMonth, 10) - 1]} ${goalYear}`
                      : `End of ${goalYear}`}
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="onboarding-footer">
            <button type="button" className="btn btn-outline" onClick={handleBack}>
              Back
            </button>
            <button type="submit" className="btn btn-navy" style={{ flex: 1 }}>
              {goalName || goalAmount ? 'Continue' : 'Skip for now'}
            </button>
          </div>
        </form>
      )}

      {/* ══ Step 3 — Review & confirm ═══════════════════════════ */}
      {step === 3 && (
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="onboarding-body">
            <h1 className="onboarding-step-title">You're all set!</h1>
            <p className="onboarding-step-sub">
              Here's what we've got. You can change any of this later in Settings.
            </p>

            <div className="card" style={{ marginTop: 0 }}>
              <div className="summary-row">
                <span className="summary-row__label">Child's name</span>
                <span className="summary-row__value">{childName}</span>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Date of birth</span>
                <span className="summary-row__value">
                  {new Date(dob + 'T00:00:00').toLocaleDateString('en-IN', {
                    day: 'numeric', month: 'long', year: 'numeric',
                  })}
                </span>
              </div>
              <div className="summary-row">
                <span className="summary-row__label">Learning stage</span>
                <span className="summary-row__value">{STAGE_LABELS[ageStage]}</span>
              </div>
              {goalName && (
                <div className="summary-row">
                  <span className="summary-row__label">Goal</span>
                  <span className="summary-row__value">{goalName}</span>
                </div>
              )}
              {goalAmount && (
                <div className="summary-row">
                  <span className="summary-row__label">Target</span>
                  <span className="summary-row__value">
                    ₹{Number(goalAmount).toLocaleString('en-IN')}
                    {' '}
                    <span style={{ fontSize: '12px', color: 'var(--color-text-secondary)' }}>
                      ({toWords(goalAmount)})
                    </span>
                  </span>
                </div>
              )}
              {goalYear && (
                <div className="summary-row">
                  <span className="summary-row__label">By when</span>
                  <span className="summary-row__value">
                    {goalMonth
                      ? `${MONTHS[parseInt(goalMonth, 10) - 1]} ${goalYear}`
                      : goalYear}
                  </span>
                </div>
              )}
            </div>

            {error && <div className="onboarding-error" style={{ marginTop: 'var(--space-4)' }}>{error}</div>}
          </div>

          <div className="onboarding-footer">
            <button type="button" className="btn btn-outline" onClick={handleBack} disabled={saving}>
              Back
            </button>
            <button
              type="button"
              className="btn btn-gold"
              style={{ flex: 1 }}
              onClick={handleFinish}
              disabled={saving}
            >
              {saving ? 'Saving…' : 'Go to dashboard →'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
