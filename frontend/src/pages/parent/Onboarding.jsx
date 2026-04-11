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

const TOTAL_STEPS = 3

export default function ParentOnboarding() {
  const navigate = useNavigate()
  const { user, session } = useAuth()

  const [step, setStep]     = useState(1)
  const [error, setError]   = useState('')
  const [saving, setSaving] = useState(false)

  // Step 1 — child basics
  const [childName, setChildName] = useState('')
  const [dob, setDob]             = useState('')

  // Step 2 — goal (all optional)
  const [goalName,   setGoalName]   = useState('')
  const [goalAmount, setGoalAmount] = useState('')
  const [goalDate,   setGoalDate]   = useState('')

  const ageStage = dob ? deriveAgeStage(dob) : null

  // Compute min/max DOB: age 5–17
  const today     = new Date()
  const maxDob    = new Date(today.getFullYear() - 5,  today.getMonth(), today.getDate()).toISOString().split('T')[0]
  const minDob    = new Date(today.getFullYear() - 17, today.getMonth(), today.getDate()).toISOString().split('T')[0]

  function handleNext(e) {
    e.preventDefault()
    setError('')

    if (step === 1) {
      if (!childName.trim()) { setError('Please enter your child\'s name.'); return }
      if (!dob)              { setError('Please enter your child\'s date of birth.'); return }
    }
    // Step 2 is optional — no validation needed
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

    // Insert child record
    const { data: child, error: childErr } = await supabase
      .from('children')
      .insert({
        parent_id:   user.id,
        name:        childName.trim(),
        dob:         dob,
        age_stage:   stage,
        goal_name:   goalName.trim()   || null,
        goal_amount: goalAmount ? parseFloat(goalAmount) : null,
        goal_date:   goalDate  || null,
      })
      .select()
      .single()

    if (childErr) {
      setSaving(false)
      setError('Something went wrong. Please try again.')
      return
    }

    // Also seed a learning_state row for this child (backend will do this in later steps
    // via trigger, but we do it here proactively for Phase 0 simplicity)
    await supabase.from('learning_state').insert({ child_id: child.id }).select().single()

    navigate('/parent/dashboard', { replace: true })
  }

  return (
    <div className="onboarding-page">
      {/* Header with progress dots */}
      <div className="onboarding-header">
        <span className="onboarding-header__logo">Taru</span>
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
      </div>

      {/* Step 1 — Child details */}
      {step === 1 && (
        <form onSubmit={handleNext} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="onboarding-body">
            <h1 className="onboarding-step-title">Tell us about your child</h1>
            <p className="onboarding-step-sub">
              Taru uses your child's age to choose the right way to talk about money.
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
                <label htmlFor="dob">Date of birth</label>
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
                <span className="hint">We support ages 5–17 in Phase 0.</span>
              </div>

              {error && <div className="onboarding-error">{error}</div>}
            </div>
          </div>

          <div className="onboarding-footer">
            <button type="submit" className="btn btn-navy" style={{ flex: 1 }}>
              Continue
            </button>
          </div>
        </form>
      )}

      {/* Step 2 — Goal (optional) */}
      {step === 2 && (
        <form onSubmit={handleNext} style={{ flex: 1, display: 'flex', flexDirection: 'column' }}>
          <div className="onboarding-body">
            <h1 className="onboarding-step-title">What are you saving for?</h1>
            <p className="onboarding-step-sub">
              A named goal gives {childName || 'your child'} something to watch grow toward.
              You can skip this and set it later.
            </p>

            <div className="onboarding-form">
              <div className="onboarding-field">
                <label htmlFor="goal-name">Goal name</label>
                <input
                  id="goal-name"
                  type="text"
                  placeholder="College fund, first car, world trip…"
                  value={goalName}
                  onChange={e => setGoalName(e.target.value)}
                />
              </div>

              <div className="onboarding-field">
                <label htmlFor="goal-amount">Target amount (₹)</label>
                <input
                  id="goal-amount"
                  type="number"
                  inputMode="numeric"
                  placeholder="e.g. 500000"
                  min="1"
                  value={goalAmount}
                  onChange={e => setGoalAmount(e.target.value)}
                />
              </div>

              <div className="onboarding-field">
                <label htmlFor="goal-date">Target date (optional)</label>
                <input
                  id="goal-date"
                  type="date"
                  min={new Date().toISOString().split('T')[0]}
                  value={goalDate}
                  onChange={e => setGoalDate(e.target.value)}
                />
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

      {/* Step 3 — Review & confirm */}
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
