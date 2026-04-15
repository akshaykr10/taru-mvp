import { shouldShowBridge, getBridge } from '../../data/weeklyContent.js'

/**
 * Bridge block — shown above the week card for all weeks except W1, W25,
 * and consolidation weeks (W18, W24, W42, W48).
 *
 * Renders the age-appropriate callback to the previous week so the child
 * feels continuity before seeing new content. No interaction required.
 */
export default function Bridge({ weekContent, ageStage }) {
  if (!shouldShowBridge(weekContent)) return null

  const text = getBridge(weekContent, ageStage)
  if (!text) return null

  return (
    <div className="learn-bridge" aria-label="Last week's thread">
      <p className="learn-bridge__text">{text}</p>
    </div>
  )
}
