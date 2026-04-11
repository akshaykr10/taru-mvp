import { useRef } from 'react'
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

// ── CurrentWeekCard ────────────────────────────────────────────
function CurrentWeekCard({ card, cardRef }) {
  return (
    <div ref={cardRef} className="learn-card learn-card--current">
      <div className="learn-card__week-badge">Week {card.week}</div>
      <h2 className="learn-card__title">{card.title}</h2>
      <div className="learn-card__penny-row">
        <span className="learn-card__penny-icon">🐿️</span>
        <p className="learn-card__penny-says">{card.penny_says}</p>
      </div>
      {card.body && (
        <p className="learn-card__body">{card.body}</p>
      )}
      {card.question && (
        <div className="learn-card__question">
          <p>{card.question}</p>
        </div>
      )}
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
 *   2. CurrentWeekCard              ← prominent, left accent border
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
        <div ref={weekCardRef} className="learn-card learn-card--current learn-card--empty">
          <div className="learn-card__penny-row">
            <span className="learn-card__penny-icon">🐿️</span>
            <p className="learn-card__penny-says">
              Something interesting is happening with your portfolio.
            </p>
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
