import { useState } from 'react'
import content from '../../data/content.json'
import { getWeekContent, getAppText } from '../../data/weeklyContent.js'
import { useActivityOnView } from '../../hooks/useActivityOnView.js'
import Bridge from '../../components/learn/Bridge.jsx'
import { BACKEND_URL } from '../../lib/api.js'

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

// ── Penny mascot — squirrel emoji for card header ─────────────
function PennyIcon() {
  return (
    <span className="learn-week-card__penny" aria-hidden="true">🐿️</span>
  )
}

// ── CurrentWeekCard ────────────────────────────────────────────
function CurrentWeekCard({ weekContent, ageStage, weekNum, token, cardRef, onXpEarned, weekCompletedAt }) {
  const [markedDone,    setMarkedDone]    = useState(!!weekCompletedAt)
  const [showReward,    setShowReward]    = useState(false)
  const [advanceError,  setAdvanceError]  = useState(false)

  async function handleMarkDone() {
    // Immediate UI feedback — these run regardless of DB outcome
    setMarkedDone(true)
    setShowReward(true)
    onXpEarned(50)
    setTimeout(() => setShowReward(false), 1400)

    // Step 1 + 2 + 3 + 4 — single backend call handles all DB writes in sequence.
    // The backend handles steps 1–3 as best-effort and only fails if step 4 fails.
    try {
      const res = await fetch(`${BACKEND_URL}/api/child/week-complete`, {
        method:  'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Child-Token': token,
        },
        body: JSON.stringify({
          current_week:  weekNum,
          dinner_prompt: weekContent.dinner_prompt,
          topic:         weekContent.topic,
        }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        console.error('[week-complete] step 4 failed:', body.error || res.status)
        setAdvanceError(true)
      }
    } catch (err) {
      console.error('[week-complete] network error:', err)
      setAdvanceError(true)
    }
  }

  const appText = getAppText(weekContent, ageStage)

  // Capitalise first letter only, e.g. "co-discoverer" → "Co-discoverer"
  const modeLabel = weekContent.penny_mode
    ? weekContent.penny_mode.charAt(0).toUpperCase() + weekContent.penny_mode.slice(1)
    : ''

  return (
    <div ref={cardRef} className="learn-week-card">

      {/* Floating reward burst */}
      {showReward && (
        <div className="learn-reward-burst" aria-hidden="true">
          +50 XP! 🌟
        </div>
      )}

      {/* Header: week badge + Penny */}
      <div className="learn-week-card__header">
        <div className="learn-card__week-badge">Week {weekNum}</div>
        <PennyIcon />
      </div>

      {/* Topic — what this week is about */}
      {weekContent.topic && (
        <h3 className="learn-week-card__title">{weekContent.topic}</h3>
      )}

      {/* a. Penny Moment — italic, tinted blue box */}
      <div className="learn-week-card__speech">
        {weekContent.penny_moment}
        {modeLabel && (
          <span className="learn-week-card__penny-mode">{modeLabel}</span>
        )}
      </div>

      {/* b. App Text — age-appropriate content */}
      <p className="learn-week-card__body">{appText}</p>

      {/* c. Portfolio Moment Placeholder */}
      {weekContent.portfolio_status !== 'NOT APPLICABLE' && (
        <div
          className="learn-week-card__portfolio-placeholder"
          data-portfolio-status={weekContent.portfolio_status}
        >
          📊 Portfolio insight loading...
        </div>
      )}

      {/* d. Dinner Prompt Teaser */}
      <div className="learn-week-card__dinner">
        <span className="learn-week-card__dinner-label">Tonight at dinner 🌙</span>
        <p className="learn-week-card__dinner-prompt">{weekContent.dinner_prompt}</p>
      </div>

      {/* e. Mark as Done — keep existing handler */}
      <button
        className="btn-kid-done"
        onClick={handleMarkDone}
        disabled={markedDone}
        aria-pressed={markedDone}
      >
        {markedDone ? '✓ 50 XP Earned!' : 'Mark as done ✓'}
      </button>

      {/* Step 4 error only — shown if week advancement failed */}
      {advanceError && (
        <p className="learn-week-card__advance-error">
          Couldn't save your progress. Try again in a moment.
        </p>
      )}
    </div>
  )
}

// ── TriggerCard — unchanged ────────────────────────────────────
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
      {card.body && (
        <p className="learn-card__body">{card.body}</p>
      )}
    </div>
  )
}

// ── Main Learn component ───────────────────────────────────────
/**
 * Vertical layout:
 *   1. "This Week" section heading
 *   2. Bridge block (prior week callback, hidden for W1/W25/consolidation weeks)
 *   3. CurrentWeekCard (Penny moment, app text, portfolio placeholder, dinner prompt, CTA)
 *   4. "Recent Updates" + TriggerCard(s)
 *
 * @param {object} props
 * @param {string}      props.ageStage        - 'seed'|'sprout'|'growth'|'investor'
 * @param {number}      props.currentWeek     - from learning_state.current_week (1-based)
 * @param {string|null} props.lastTriggerType - from learning_state.last_trigger_type
 * @param {string}      props.token           - child JWT, forwarded to activity hook
 * @param {function}    props.onXpEarned      - callback when Mark as Done pressed
 */
export default function Learn({ ageStage, currentWeek, lastTriggerType, weekCompletedAt, token, onXpEarned }) {
  const week        = currentWeek || 1
  const weekContent = getWeekContent(week)

  // Fires child_learn_card_viewed after 3-second dwell (CLAUDE.md spec)
  const weekCardRef = useActivityOnView(
    'child',
    'child_learn_card_viewed',
    { childToken: token, metadata: { week } },
    3000
  )

  // Phase 0: learning_state stores only the most recent trigger.
  const triggerCards = []
  if (lastTriggerType) {
    const tc = getTriggerCard(lastTriggerType, ageStage)
    if (tc) triggerCards.push(tc)
  }

  return (
    <div className="garden-learn">

      {/* 1. "This Week" section heading — unchanged */}
      <div>
        <h2 className="learn-section-heading">This Week</h2>
        <p className="learn-section-sub">Week {week} · {ageStage} stage</p>
      </div>

      {/* 2. Bridge block — prior week callback */}
      {weekContent && (
        <Bridge weekContent={weekContent} ageStage={ageStage} />
      )}

      {/* 3. Current week card */}
      {weekContent ? (
        <CurrentWeekCard
          weekContent={weekContent}
          ageStage={ageStage}
          weekNum={week}
          token={token}
          cardRef={weekCardRef}
          onXpEarned={onXpEarned}
          weekCompletedAt={weekCompletedAt}
        />
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

      {/* 4. Past trigger cards — timeline section */}
      {triggerCards.length > 0 && (
        <>
          <div className="learn-section-label">Recent updates</div>
          {triggerCards.map((card, i) => (
            <TriggerCard key={`${card.type}-${i}`} card={card} />
          ))}
        </>
      )}

    </div>
  )
}
