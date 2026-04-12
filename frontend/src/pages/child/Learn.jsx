import { useState, useRef } from 'react'
import content from '../../data/content.json'
import { useActivityOnView } from '../../hooks/useActivityOnView.js'

// ── Trigger type display config ────────────────────────────────
const TRIGGER_META = {
  sip:           { icon: '💰', label: 'New investment' },
  nav_change:    { icon: '📈', label: 'Portfolio moved' },
  milestone:     { icon: '🎉', label: 'Milestone reached' },
  task_approved: { icon: '🪙', label: 'Coins earned' },
}

function getWeekCard(week, ageStage) {
  const entry = content.weekly_concepts.find(w => w.week === week)
  if (!entry) return null
  const card  = entry[ageStage]
  if (!card)  return null
  return { ...card, week }
}

function getTriggerCard(triggerType, ageStage) {
  const group = content.triggers[triggerType]
  if (!group) return null
  const card  = group[ageStage]
  if (!card)  return null
  return { ...card, type: triggerType }
}

// ── Wise Gilli SVG mascot — learning-context owl ──────────────
// Distinct from Penny (garden squirrel). Purely decorative.
function WiseGilliSVG() {
  return (
    <svg
      className="learn-week-card__gilli"
      viewBox="0 0 56 56"
      fill="none"
      xmlns="http://www.w3.org/2000/svg"
      aria-hidden="true"
    >
      {/* Body */}
      <ellipse cx="28" cy="36" rx="14" ry="13" style={{ fill: 'var(--sky)' }} />
      {/* Head */}
      <circle cx="28" cy="22" r="14" style={{ fill: 'var(--sky)' }} />
      {/* Wing left */}
      <ellipse cx="14" cy="37" rx="5" ry="9" style={{ fill: 'var(--sky-md)' }} transform="rotate(-15 14 37)" />
      {/* Wing right */}
      <ellipse cx="42" cy="37" rx="5" ry="9" style={{ fill: 'var(--sky-md)' }} transform="rotate(15 42 37)" />
      {/* Ear tufts */}
      <polygon points="20,11 17,4 23,9" style={{ fill: 'var(--sky)' }} />
      <polygon points="36,11 33,9 39,4" style={{ fill: 'var(--sky)' }} />
      {/* Eye whites */}
      <circle cx="22" cy="22" r="5.5" fill="white" />
      <circle cx="34" cy="22" r="5.5" fill="white" />
      {/* Pupils */}
      <circle cx="22" cy="22" r="3" style={{ fill: 'var(--forest)' }} />
      <circle cx="34" cy="22" r="3" style={{ fill: 'var(--forest)' }} />
      {/* Eye shine */}
      <circle cx="23.5" cy="20.5" r="1" fill="white" opacity="0.9" />
      <circle cx="35.5" cy="20.5" r="1" fill="white" opacity="0.9" />
      {/* Beak */}
      <polygon points="28,26 25,30 31,30" style={{ fill: 'var(--amber)' }} />
      {/* Chest highlight */}
      <ellipse cx="28" cy="38" rx="7" ry="6" style={{ fill: 'var(--sky-md)' }} opacity="0.45" />
    </svg>
  )
}

// ── CurrentWeekCard — sky-lt themed, Wise Gilli, Mark as Done ──
function CurrentWeekCard({ card, cardRef }) {
  const [markedDone,  setMarkedDone]  = useState(false)
  const [showReward,  setShowReward]  = useState(false)

  function handleMarkDone() {
    setMarkedDone(true)
    setShowReward(true)
    setTimeout(() => setShowReward(false), 1400)
  }

  return (
    <div ref={cardRef} className="learn-week-card">

      {/* Floating reward burst */}
      {showReward && (
        <div className="learn-reward-burst" aria-hidden="true">
          +XP! 🌟
        </div>
      )}

      {/* Header: week badge + Wise Gilli */}
      <div className="learn-week-card__header">
        <div className="learn-card__week-badge">Week {card.week}</div>
        <WiseGilliSVG />
      </div>

      {/* Concept title */}
      <h2 className="learn-week-card__title">{card.title}</h2>

      {/* Gilli's speech */}
      <div className="learn-week-card__speech">
        {card.penny_says}
      </div>

      {/* Optional body */}
      {card.body && (
        <p className="learn-week-card__body">{card.body}</p>
      )}

      {/* Optional question — reuses amber question style */}
      {card.question && (
        <div className="learn-card__question">
          <p>{card.question}</p>
        </div>
      )}

      {/* Mark as Done / Done state */}
      {markedDone ? (
        <div className="learn-done-state">✓ Done this week!</div>
      ) : (
        <button className="btn-kid-done" onClick={handleMarkDone}>
          Mark as done ✓
        </button>
      )}
    </div>
  )
}

// ── TriggerCard — unchanged, Penny stays here ─────────────────
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
 * Vertical timeline layout:
 *   1. "This Week" section heading  ← clear hierarchy via --font-display
 *   2. CurrentWeekCard              ← sky-lt card, Wise Gilli, Mark as Done
 *   3. "Recent Updates" divider     ← only rendered if trigger cards exist
 *   4. TriggerCard(s)               ← subtly muted bg to de-emphasise past
 *
 * @param {object} props
 * @param {string}      props.ageStage        - 'seed'|'sprout'|'growth'|'investor'
 * @param {number}      props.currentWeek     - from learning_state.current_week (1-based)
 * @param {string|null} props.lastTriggerType - from learning_state.last_trigger_type
 * @param {string}      props.token           - child JWT, forwarded to activity hook
 */
export default function Learn({ ageStage, currentWeek, lastTriggerType, token }) {
  const week     = currentWeek || 1
  const weekCard = getWeekCard(week, ageStage)

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

      {/* ── "This Week" section heading ───────────────── */}
      <div>
        <h2 className="learn-section-heading">This Week</h2>
        <p className="learn-section-sub">Week {week} · {ageStage} stage</p>
      </div>

      {/* ── Current week card ─────────────────────────── */}
      {weekCard ? (
        <CurrentWeekCard card={weekCard} cardRef={weekCardRef} />
      ) : (
        <div ref={weekCardRef} className="learn-week-card learn-card--empty">
          <div className="learn-week-card__header">
            <div className="learn-card__week-badge">Week {week}</div>
            <WiseGilliSVG />
          </div>
          <div className="learn-week-card__speech">
            Something interesting is happening with your portfolio.
          </div>
        </div>
      )}

      {/* ── Past trigger cards — timeline section ─────── */}
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
