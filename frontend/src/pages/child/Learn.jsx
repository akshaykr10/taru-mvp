import { useState, useRef, useEffect } from 'react'
import content from '../../data/content.json'
import { getWeekContent, getAppText, getBridge, shouldShowBridge } from '../../data/weeklyContent.js'
import { useActivityOnView } from '../../hooks/useActivityOnView.js'
import { BACKEND_URL } from '../../lib/api.js'
import { logActivity } from '../../lib/activity.js'

const TOTAL_WEEKS = 48

// ── Trigger type display config ────────────────────────────────
const TRIGGER_META = {
  sip:           { icon: '💰', label: 'New investment' },
  nav_change:    { icon: '📈', label: 'Portfolio moved' },
  milestone:     { icon: '🎉', label: 'Milestone reached' },
  task_approved: { icon: '🪙', label: 'Coins earned' },
}

function getTriggerCard(triggerType, ageStage) {
  const group = content.triggers[triggerType]
  if (!group) return null
  const card  = group[ageStage]
  if (!card)  return null
  return { ...card, type: triggerType }
}

// ── Penny icon — kept for fallback empty card ──────────────────
function PennyIcon() {
  return <span className="learn-week-card__penny" aria-hidden="true">🐿️</span>
}

// ── Lesson bottom sheet ────────────────────────────────────────
// Handles both past weeks (read-only) and the current week (with XP button).
// showMarkDone=true only when opened from the current week teaser card.
function LessonSheet({
  weekNum, ageStage, onClose,
  showMarkDone = false,
  token, onXpEarned, weekCompletedAt, onWeekAdvanced,
}) {
  const wc = getWeekContent(weekNum)

  const [markedDone,   setMarkedDone]   = useState(!!weekCompletedAt)
  const [showReward,   setShowReward]   = useState(false)
  const [advanceError, setAdvanceError] = useState(false)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  if (!wc) return null

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  async function handleMarkDone() {
    setMarkedDone(true)
    setShowReward(true)
    onXpEarned(50)
    setTimeout(() => setShowReward(false), 1400)

    try {
      const res = await fetch(`${BACKEND_URL}/api/child/week-complete`, {
        method:  'POST',
        headers: { 'Content-Type': 'application/json', 'X-Child-Token': token },
        body:    JSON.stringify({
          current_week:  weekNum,
          dinner_prompt: wc.dinner_prompt,
          topic:         wc.topic,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[week-complete] failed:', body.error || res.status)
        setAdvanceError(true)
        return
      }
      const body = await res.json().catch(() => ({}))
      if (body.next_week && onWeekAdvanced) onWeekAdvanced(body.next_week)
    } catch (err) {
      console.error('[week-complete] network error:', err)
      setAdvanceError(true)
    }
  }

  const appText = getAppText(wc, ageStage)

  return (
    <div className="lesson-sheet-backdrop" onClick={handleBackdropClick}>
      <div className="lesson-sheet" role="dialog" aria-modal="true" aria-label={`Week ${weekNum}: ${wc.topic}`}>
        <div className="lesson-sheet__handle" />

        {/* Scrollable content area */}
        <div className="lesson-sheet__scroll">
          <div className="lesson-sheet__header">
            <div className="learn-card__week-badge">Week {weekNum}</div>
            <button className="lesson-sheet__close" onClick={onClose} aria-label="Close">✕</button>
          </div>

          {wc.topic && <h3 className="lesson-sheet__title">{wc.topic}</h3>}

          {/* Penny speech */}
          <div className="learn-week-card__speech">
            {wc.penny_moment}
          </div>

          {/* Age-appropriate text */}
          <p className="learn-week-card__body">{appText}</p>

          {/* Portfolio placeholder */}
          {wc.portfolio_status !== 'NOT APPLICABLE' && (
            <div className="learn-week-card__portfolio-placeholder" data-portfolio-status={wc.portfolio_status}>
              📊 Portfolio insight loading...
            </div>
          )}

          {/* Dinner prompt */}
          <div className="learn-week-card__dinner">
            <span className="learn-week-card__dinner-label">Tonight at dinner 🌙</span>
            <p className="learn-week-card__dinner-prompt">{wc.dinner_prompt}</p>
          </div>
        </div>

        {/* Sticky XP footer — only for current week */}
        {showMarkDone && (
          <div className="lesson-sheet__sticky-footer">
            {showReward && (
              <div className="learn-reward-burst" aria-hidden="true">+50 XP! 🌟</div>
            )}
            <button
              className="btn-kid-done"
              onClick={handleMarkDone}
              disabled={markedDone}
              aria-pressed={markedDone}
            >
              {markedDone ? '✓ 50 XP Earned!' : 'Mark as done ✓'}
            </button>
            {advanceError && (
              <p className="learn-week-card__advance-error">
                Couldn't save your progress. Try again in a moment.
              </p>
            )}
          </div>
        )}
      </div>
    </div>
  )
}

// ── BridgeQuote — warm accent card shown above the lesson card ─
// Renders the prior-week callback in a cream card with gold left border.
// Returns null for W1, W25, and consolidation weeks (no bridge text).
function BridgeQuote({ weekContent, ageStage }) {
  if (!shouldShowBridge(weekContent)) return null
  const text = getBridge(weekContent, ageStage)
  if (!text) return null
  return (
    <div className="learn-bridge-quote">
      <p className="learn-bridge-quote__text">{text}</p>
    </div>
  )
}

// ── WeekTeaserCard — collapsed lesson card ─────────────────────
// Shows: week badge + squirrel (header row) · topic · "Read this week →"
// Entire card is tappable; cardRef kept for child_learn_card_viewed event.
function WeekTeaserCard({ weekContent, weekNum, cardRef, onOpenSheet }) {
  return (
    <div ref={cardRef} className="learn-week-card learn-week-card--teaser" onClick={onOpenSheet}>
      <div className="learn-week-card__header">
        <div className="learn-card__week-badge">Week {weekNum}</div>
        <span className="learn-week-card__penny" aria-hidden="true">🐿️</span>
      </div>
      {weekContent.topic && (
        <h3 className="learn-week-card__title">{weekContent.topic}</h3>
      )}
      <div className="learn-week-card__tap-row">
        <span className="learn-week-card__tap-label">Read this week</span>
        <span className="learn-week-card__tap-chevron" aria-hidden="true">→</span>
      </div>
    </div>
  )
}

// ── TriggerCard ────────────────────────────────────────────────
function TriggerCard({ card }) {
  const meta = TRIGGER_META[card.type] || { icon: '💡', label: 'Update' }
  return (
    <div className="learn-card learn-card--trigger">
      <div className="learn-card__trigger-badge">
        <span>{meta.icon}</span>
        <span>{meta.label}</span>
      </div>
      <h3 className="learn-card__title learn-card__title--sm">{card.title}</h3>
      <div className="learn-card__penny-row">
        <span className="learn-card__penny-icon">🐿️</span>
        <p className="learn-card__penny-says">{card.penny_says}</p>
      </div>
      {card.body && <p className="learn-card__body">{card.body}</p>}
    </div>
  )
}

// ── Learning path rail ─────────────────────────────────────────
// Renders a contextual window of pills: currentWeek-2 through currentWeek+3,
// clamped to 1–48. Active pill is always visible without scrolling.
function LearningPathRail({ currentWeek, onOpenSheet }) {
  const windowStart = Math.max(1, currentWeek - 2)
  const windowEnd   = Math.min(TOTAL_WEEKS, currentWeek + 3)
  const weeks       = Array.from(
    { length: windowEnd - windowStart + 1 },
    (_, i) => windowStart + i
  )

  function truncate(str, max) {
    if (!str) return ''
    return str.length > max ? str.slice(0, max - 1) + '…' : str
  }

  function pillState(week) {
    if (week < currentWeek) return 'done'
    if (week === currentWeek) return 'active'
    return 'upcoming'
  }

  return (
    <div className="learn-path-rail-wrap">
      <div className="learn-path-rail">
        {weeks.map(week => {
          const state = pillState(week)
          const wc    = getWeekContent(week)
          return (
            <button
              key={week}
              className={`learn-path-pill learn-path-pill--${state}`}
              data-active={state === 'active' ? 'true' : undefined}
              onClick={() => { if (state !== 'upcoming') onOpenSheet(week) }}
              aria-label={`Week ${week}: ${wc?.topic || ''}`}
            >
              <span className="learn-path-pill__week">
                {state === 'done' ? '✓' : week}
              </span>
              <span className="learn-path-pill__topic">
                {truncate(wc?.topic || '', 13)}
              </span>
              {state === 'active' && (
                <span className="learn-path-pill__dot" aria-hidden="true" />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}

// ── Compounding Visualiser ─────────────────────────────────────

const PENNY_COMPOUND_COPY = {
  seed:     'If you put coins away and don\'t touch them, they slowly become more coins. Try changing the numbers and watch what happens!',
  sprout:   'If you put coins away and don\'t touch them, they slowly become more coins. Try changing the numbers and watch what happens!',
  growth:   'This is what your money is actually doing right now. Change the monthly amount or the years and watch the curve change.',
  investor: 'Adjust the SIP amount, rate, and tenure. The gap between what you put in and what you get out is the compounding premium. That gap is the whole argument for investing early.',
}

function formatLakh(amount) {
  return '₹' + (amount / 100000).toFixed(2) + ' lakh'
}

function formatInr(amount) {
  return '₹' + amount.toLocaleString('en-IN')
}

function calcSipFV(monthly, years, annualRate) {
  const n = years * 12
  const r = annualRate / 12 / 100
  if (r === 0) return monthly * n
  return monthly * (((Math.pow(1 + r, n) - 1) / r) * (1 + r))
}

function CompoundingSheet({ ageStage, onClose }) {
  const [monthly, setMonthly] = useState(1000)
  const [years,   setYears]   = useState(10)
  const [rate,    setRate]    = useState(12)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  const totalInvested = monthly * 12 * years
  const fv            = calcSipFV(monthly, years, rate)
  const freeGrowth    = fv - totalInvested
  const investedPct   = (totalInvested / fv) * 100
  const growthPct     = 100 - investedPct
  const pennyCopy     = PENNY_COMPOUND_COPY[ageStage] || PENNY_COMPOUND_COPY.sprout

  return (
    <div className="lesson-sheet-backdrop" onClick={handleBackdropClick}>
      <div className="lesson-sheet" role="dialog" aria-modal="true" aria-label="Compounding Visualiser">
        <div className="lesson-sheet__handle" />
        <div className="lesson-sheet__scroll">
          <div className="lesson-sheet__header">
            <span className="learn-tool-sheet-title">📈 Compounding Visualiser</span>
            <button className="lesson-sheet__close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="penny-bubble-wrap">
            <div className="penny-bubble-wrap__squirrel" aria-hidden="true">🐿️</div>
            <div className="penny-bubble"><p className="penny-bubble__text">{pennyCopy}</p></div>
          </div>
          <div className="compound-inputs">
            <div className="compound-input-row">
              <div className="compound-input-label">
                <span>Monthly amount</span>
                <span className="compound-input-value">{formatInr(monthly)}</span>
              </div>
              <input type="range" className="compound-slider" min={500} max={10000} step={500}
                value={monthly} onChange={e => setMonthly(Number(e.target.value))}
                aria-label="Monthly SIP amount" />
            </div>
            <div className="compound-input-row">
              <div className="compound-input-label">
                <span>Years</span>
                <span className="compound-input-value">{years} years</span>
              </div>
              <input type="range" className="compound-slider" min={1} max={20} step={1}
                value={years} onChange={e => setYears(Number(e.target.value))}
                aria-label="Investment tenure in years" />
            </div>
            <div className="compound-input-row">
              <div className="compound-input-label">
                <span>Expected return</span>
                <span className="compound-input-value">{rate}% per year</span>
              </div>
              <input type="range" className="compound-slider" min={6} max={18} step={1}
                value={rate} onChange={e => setRate(Number(e.target.value))}
                aria-label="Expected annual return rate" />
              <p className="compound-disclaimer">
                Mutual fund returns vary — 12% is a long-term average, not a guarantee.
              </p>
            </div>
          </div>
          <div className="compound-output">
            <div className="compound-output-numbers">
              <div className="compound-output-col">
                <span className="compound-output-label">You put in</span>
                <span className="compound-output-value">{formatLakh(totalInvested)}</span>
              </div>
              <div className="compound-output-divider" />
              <div className="compound-output-col">
                <span className="compound-output-label">It becomes</span>
                <span className="compound-output-value compound-output-value--gold">{formatLakh(fv)}</span>
              </div>
            </div>
            <p className="compound-free-growth">Free growth: {formatLakh(freeGrowth)}</p>
            <div className="compound-bars">
              <div className="compound-bars__track">
                <div className="compound-bars__segment compound-bars__segment--invested" style={{ width: `${investedPct}%` }} />
                <div className="compound-bars__segment compound-bars__segment--growth"   style={{ width: `${growthPct}%` }} />
              </div>
              <div className="compound-bars__labels">
                <span className="compound-bars__label">Invested</span>
                <span className="compound-bars__label">Growth</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── SIP Step-Up Calculator ─────────────────────────────────────

const PENNY_STEPUP_COPY = {
  seed:     "What if every year you saved just a little more than before? Even a tiny bit extra, every year, adds up to something big.",
  sprout:   "What if every year you saved just a little more than before? Even a tiny bit extra, every year, adds up to something big.",
  growth:   "A step-up SIP means you invest a bit more each year as you earn more. See how much extra it produces compared to keeping the same amount forever.",
  investor: "Model the incremental return from annual SIP step-ups. The delta between flat and stepped SIP widens non-linearly — this is the compounding-on-compounding effect.",
}

function stepUpSIPFutureValue(monthlyStart, stepUpPct, years, annualReturnPct) {
  const monthlyRate = annualReturnPct / 12 / 100
  let fv = 0, totalInvested = 0
  for (let y = 0; y < years; y++) {
    const monthlyAmount = monthlyStart * Math.pow(1 + stepUpPct / 100, y)
    for (let m = 0; m < 12; m++) {
      const monthsRemaining = (years - y) * 12 - m
      fv += monthlyAmount * Math.pow(1 + monthlyRate, monthsRemaining)
      totalInvested += monthlyAmount
    }
  }
  return { fv, totalInvested }
}

function SipStepUpSheet({ ageStage, onClose }) {
  const [monthly, setMonthly] = useState(1000)
  const [stepUp,  setStepUp]  = useState(10)
  const [years,   setYears]   = useState(10)
  const [rate,    setRate]    = useState(12)

  useEffect(() => {
    function onKey(e) { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  function handleBackdropClick(e) {
    if (e.target === e.currentTarget) onClose()
  }

  const { fv: stepUpFV, totalInvested } = stepUpSIPFutureValue(monthly, stepUp, years, rate)
  const flatFV       = calcSipFV(monthly, years, rate)
  const flatInvested = monthly * 12 * years
  const stepUpExtra  = stepUpFV - flatFV
  const investedPct  = (flatInvested  / stepUpFV) * 100
  const flatGrowthPct = ((flatFV - flatInvested) / stepUpFV) * 100
  const boostPct     = (stepUpExtra   / stepUpFV) * 100
  const pennyCopy    = PENNY_STEPUP_COPY[ageStage] || PENNY_STEPUP_COPY.sprout

  return (
    <div className="lesson-sheet-backdrop" onClick={handleBackdropClick}>
      <div className="lesson-sheet" role="dialog" aria-modal="true" aria-label="SIP Step-Up Calculator">
        <div className="lesson-sheet__handle" />
        <div className="lesson-sheet__scroll">
          <div className="lesson-sheet__header">
            <span className="learn-tool-sheet-title">⬆️ SIP Step-Up Calculator</span>
            <button className="lesson-sheet__close" onClick={onClose} aria-label="Close">✕</button>
          </div>
          <div className="penny-bubble-wrap">
            <div className="penny-bubble-wrap__squirrel" aria-hidden="true">🐿️</div>
            <div className="penny-bubble"><p className="penny-bubble__text">{pennyCopy}</p></div>
          </div>
          <div className="compound-inputs">
            <div className="compound-input-row">
              <div className="compound-input-label">
                <span>Starting monthly amount</span>
                <span className="compound-input-value">{formatInr(monthly)}</span>
              </div>
              <input type="range" className="compound-slider" min={500} max={10000} step={500}
                value={monthly} onChange={e => setMonthly(Number(e.target.value))}
                aria-label="Starting monthly SIP amount" />
            </div>
            <div className="compound-input-row">
              <div className="compound-input-label">
                <span>Step-up each year</span>
                <span className="compound-input-value">{stepUp}% more each year</span>
              </div>
              <input type="range" className="compound-slider" min={5} max={30} step={5}
                value={stepUp} onChange={e => setStepUp(Number(e.target.value))}
                aria-label="Annual step-up percentage" />
            </div>
            <div className="compound-input-row">
              <div className="compound-input-label">
                <span>Years</span>
                <span className="compound-input-value">{years} years</span>
              </div>
              <input type="range" className="compound-slider" min={5} max={20} step={1}
                value={years} onChange={e => setYears(Number(e.target.value))}
                aria-label="Investment tenure in years" />
            </div>
            <div className="compound-input-row">
              <div className="compound-input-label">
                <span>Expected return</span>
                <span className="compound-input-value">{rate}% per year</span>
              </div>
              <input type="range" className="compound-slider" min={6} max={18} step={1}
                value={rate} onChange={e => setRate(Number(e.target.value))}
                aria-label="Expected annual return rate" />
              <p className="compound-disclaimer">
                Mutual fund returns vary — 12% is a long-term average, not a guarantee.
              </p>
            </div>
          </div>
          <div className="compound-output">
            <div className="compound-output-numbers compound-output-numbers--three">
              <div className="compound-output-col">
                <span className="compound-output-label">You put in</span>
                <span className="compound-output-value">{formatLakh(totalInvested)}</span>
              </div>
              <div className="compound-output-divider" />
              <div className="compound-output-col">
                <span className="compound-output-label">Step-up total</span>
                <span className="compound-output-value compound-output-value--gold">{formatLakh(stepUpFV)}</span>
              </div>
              <div className="compound-output-divider" />
              <div className="compound-output-col">
                <span className="compound-output-label">Without step-up</span>
                <span className="compound-output-value compound-output-value--muted">{formatLakh(flatFV)}</span>
              </div>
            </div>
            <p className="compound-free-growth">Step-up earns {formatLakh(stepUpExtra)} extra</p>
            <div className="compound-bars">
              <div className="compound-bars__track">
                <div className="compound-bars__segment compound-bars__segment--invested" style={{ width: `${investedPct}%` }} />
                <div className="compound-bars__segment compound-bars__segment--growth"   style={{ width: `${flatGrowthPct}%` }} />
                <div className="compound-bars__segment compound-bars__segment--stepup"   style={{ width: `${boostPct}%` }} />
              </div>
              <div className="compound-bars__labels compound-bars__labels--three">
                <span className="compound-bars__label">Invested</span>
                <span className="compound-bars__label">Flat growth</span>
                <span className="compound-bars__label">Step-up boost</span>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  )
}

// ── Money tools grid ───────────────────────────────────────────
// Tools are hidden entirely until unlock condition is met.
// Unlock is based on current_week (lesson completion), not age.
// Returns null when no tools are unlocked — no DOM at all.
const ALL_TOOLS = [
  { id: 'compound',   emoji: '📈', name: 'Compounding Visualiser',  unlockAfterWeek: 3 },
  { id: 'sip-stepup', emoji: '⬆️', name: 'SIP Step-Up Calculator', unlockAfterWeek: 6 },
]

function MoneyToolsGrid({ currentWeek, showToast, onOpenCompound, onOpenSipStepUp }) {
  const visibleTools = ALL_TOOLS.filter(t => currentWeek > t.unlockAfterWeek)

  // Nudge only renders when visibleTools.length === 0, which means currentWeek <= 3.
  // At week 4+ compound is visible; at week 7+ both are visible. Copy is fixed for this state.
  if (visibleTools.length === 0) {
    return (
      <div className="learn-penny-nudge">
        <span className="learn-penny-nudge__icon" aria-hidden="true">🐿️</span>
        <div className="learn-penny-nudge__body">
          <p className="learn-penny-nudge__text">Finish this week and Penny will show you something cool.</p>
          <p className="learn-penny-nudge__hint">A tool that shows how your money grows by itself unlocks next.</p>
        </div>
      </div>
    )
  }

  function handleToolTap(toolId) {
    if (toolId === 'compound')   return onOpenCompound()
    if (toolId === 'sip-stepup') return onOpenSipStepUp()
    showToast('Coming soon')
  }

  return (
    <div className="learn-tools-grid">
      {visibleTools.map(tool => (
        <button key={tool.id} className="learn-tool-card" onClick={() => handleToolTap(tool.id)}>
          <span className="learn-tool-card__emoji">{tool.emoji}</span>
          <span className="learn-tool-card__name">{tool.name}</span>
        </button>
      ))}
    </div>
  )
}

// ── Inline toast ───────────────────────────────────────────────
function InlineToast({ msg }) {
  if (!msg) return null
  return <div className="learn-toast" role="status" aria-live="polite">{msg}</div>
}

// ── Main Learn component ───────────────────────────────────────
/**
 * @param {string}      ageStage        - 'seed'|'sprout'|'growth'|'investor'
 * @param {number}      currentWeek     - from learning_state.current_week (1-based)
 * @param {string|null} lastTriggerType - from learning_state.last_trigger_type
 * @param {string}      token           - child JWT
 * @param {function}    onXpEarned      - callback when Mark as Done pressed
 * @param {function}    onWeekAdvanced  - callback(nextWeek)
 */
export default function Learn({ ageStage, currentWeek, lastTriggerType, weekCompletedAt, token, onXpEarned, onWeekAdvanced }) {
  const week        = currentWeek || 1
  const weekContent = getWeekContent(week)

  const [sheetWeek,     setSheetWeek]     = useState(null)
  const [showCompound,  setShowCompound]  = useState(false)
  const [showSipStepUp, setShowSipStepUp] = useState(false)
  const [toast,         setToast]         = useState(null)
  const toastTimer = useRef(null)

  function showToast(msg) {
    setToast(msg)
    clearTimeout(toastTimer.current)
    toastTimer.current = setTimeout(() => setToast(null), 2200)
  }

  function handleOpenCompound() {
    setShowCompound(true)
    logActivity('child', 'child_tab_visit', { section: 'child/learn/compounding', childToken: token })
  }

  function handleOpenSipStepUp() {
    setShowSipStepUp(true)
    logActivity('child', 'child_tab_visit', { section: 'child/learn/sip-stepup', childToken: token })
  }

  function handlePillTap(pillWeek) {
    if (pillWeek > week) {
      showToast(`Opens in Week ${pillWeek}`)
      return
    }
    setSheetWeek(pillWeek)
  }

  // Fires child_learn_card_viewed after 3-second dwell (CLAUDE.md spec)
  const weekCardRef = useActivityOnView(
    'child',
    'child_learn_card_viewed',
    { childToken: token, metadata: { week } },
    3000
  )

  const triggerCards = []
  if (lastTriggerType) {
    const tc = getTriggerCard(lastTriggerType, ageStage)
    if (tc) triggerCards.push(tc)
  }

  return (
    <div className="garden-learn">

      {/* Section heading */}
      <div>
        <h2 className="learn-section-heading">This Week</h2>
        <p className="learn-section-sub">Week {week} · {ageStage} stage</p>
      </div>

      {/* Section A — Bridge quote + lesson teaser card (12px gap between them) */}
      {weekContent ? (
        <div className="learn-lesson-group">
          <BridgeQuote weekContent={weekContent} ageStage={ageStage} />
          <WeekTeaserCard
            weekContent={weekContent}
            weekNum={week}
            cardRef={weekCardRef}
            onOpenSheet={() => setSheetWeek(week)}
          />
        </div>
      ) : (
        <div ref={weekCardRef} className="learn-week-card learn-card--empty">
          <div className="learn-week-card__header">
            <div className="learn-card__week-badge">Week {week}</div>
            <PennyIcon />
          </div>
          <div className="learn-week-card__speech">
            Something interesting is happening with your portfolio.
          </div>
        </div>
      )}

      {/* Section B — Learning path rail (no label) */}
      <LearningPathRail
        currentWeek={week}
        onOpenSheet={handlePillTap}
      />

      {/* Section C — Money tools (renders nothing if week ≤ 3) */}
      <MoneyToolsGrid
        currentWeek={week}
        showToast={showToast}
        onOpenCompound={handleOpenCompound}
        onOpenSipStepUp={handleOpenSipStepUp}
      />

      {/* Trigger cards */}
      {triggerCards.length > 0 && (
        <>
          <div className="learn-section-label">Recent updates</div>
          {triggerCards.map((card, i) => (
            <TriggerCard key={`${card.type}-${i}`} card={card} />
          ))}
        </>
      )}

      {/* Inline toast */}
      <InlineToast msg={toast} />

      {/* Lesson bottom sheet — showMarkDone only when viewing current week */}
      {sheetWeek !== null && (
        <LessonSheet
          weekNum={sheetWeek}
          ageStage={ageStage}
          onClose={() => setSheetWeek(null)}
          showMarkDone={sheetWeek === week}
          token={token}
          onXpEarned={onXpEarned}
          weekCompletedAt={weekCompletedAt}
          onWeekAdvanced={onWeekAdvanced}
        />
      )}

      {/* Compounding Visualiser sheet */}
      {showCompound && (
        <CompoundingSheet
          ageStage={ageStage}
          onClose={() => setShowCompound(false)}
        />
      )}

      {/* SIP Step-Up Calculator sheet */}
      {showSipStepUp && (
        <SipStepUpSheet
          ageStage={ageStage}
          onClose={() => setShowSipStepUp(false)}
        />
      )}

    </div>
  )
}
