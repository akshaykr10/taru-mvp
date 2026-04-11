import { useEffect, useRef, useState } from 'react'

// ── Static coin positions ──────────────────────────────────────
// Deterministic positions so the rain is consistent across renders.
const RAIN_COINS = [
  { left: '7%',  delay: 0,   size: 22 },
  { left: '16%', delay: 100, size: 18 },
  { left: '26%', delay: 55,  size: 26 },
  { left: '36%', delay: 210, size: 20 },
  { left: '45%', delay: 30,  size: 24 },
  { left: '54%', delay: 170, size: 18 },
  { left: '63%', delay: 80,  size: 22 },
  { left: '73%', delay: 260, size: 20 },
  { left: '83%', delay: 115, size: 26 },
  { left: '91%', delay: 330, size: 18 },
  { left: '31%', delay: 295, size: 20 },
  { left: '69%', delay: 410, size: 16 },
]

// ── Coin SVG ───────────────────────────────────────────────────
// Inline SVG — no external asset. Uses design-system amber values
// via fill attributes (SVG fill can't use CSS variables directly).
function CoinSVG() {
  return (
    <svg viewBox="0 0 32 32" fill="none" xmlns="http://www.w3.org/2000/svg" aria-hidden="true">
      <circle cx="16" cy="16" r="15" fill="#E8920A" />
      <circle cx="16" cy="16" r="12" fill="#F9C84A" />
      <circle cx="16" cy="16" r="8.5" fill="none" stroke="#E8920A" strokeWidth="1.5" />
      <circle cx="11" cy="11" r="2.5" fill="white" opacity="0.28" />
    </svg>
  )
}

// ── Coin rain overlay ──────────────────────────────────────────
function CoinRain() {
  return (
    <div className="coin-rain" aria-hidden="true">
      {RAIN_COINS.map((c, i) => (
        <span
          key={i}
          className="coin-rain__coin"
          style={{
            left:           c.left,
            width:          c.size,
            height:         c.size,
            animationDelay: `${c.delay}ms`,
          }}
        >
          <CoinSVG />
        </span>
      ))}
    </div>
  )
}

// ── Gullak ────────────────────────────────────────────────────
/**
 * Shows the child's coin total with a celebration animation.
 * Milestone badges have moved to Garden.jsx (under the Goal Card)
 * where they sit alongside the portfolio progress they represent.
 *
 * @param {object} props
 * @param {number} props.coinsTotal   - from learning_state.coins_total
 * @param {number} props.taggedTotal  - current tagged portfolio value (₹)
 * @param {number} props.goalAmount   - parent's goal target (₹), 0 if unset
 */
export default function Gullak({ coinsTotal, taggedTotal, goalAmount }) {
  const [showRain, setShowRain] = useState(false)
  // prevCoins: null on first mount, then tracks previous value.
  // Rain fires on first mount if coins > 0, and whenever coins increase.
  const prevCoins = useRef(null)

  useEffect(() => {
    const isFirstMount   = prevCoins.current === null
    const coinsIncreased = prevCoins.current !== null && coinsTotal > prevCoins.current

    if (coinsTotal > 0 && (isFirstMount || coinsIncreased)) {
      setShowRain(true)
      // Rain lasts 1800 ms — last coin has delay 410 ms + 1200 ms fall
      const t = setTimeout(() => setShowRain(false), 1800)
      prevCoins.current = coinsTotal
      return () => clearTimeout(t)
    }

    prevCoins.current = coinsTotal
  }, [coinsTotal])

  return (
    <div className="gullak">
      {showRain && <CoinRain />}

      {/* ── Coin counter ──────────────────────────────── */}
      <div className="gullak-counter">
        <span className="gullak-counter__jar" aria-hidden="true">🪙</span>
        {/* key forces the pop animation to replay when coins change */}
        <div className="gullak-counter__number" key={coinsTotal}>
          {coinsTotal}
        </div>
        <div className="gullak-counter__label">coins earned</div>
      </div>

      {/* ── Info note ─────────────────────────────────── */}
      <div className="gullak-info">
        <div className="gullak-info__header">How to earn more</div>
        <div className="gullak-info__body">
          <span aria-hidden="true">✅</span>
          <p>Complete tasks and ask a parent to approve them. Each approved task earns you coins.</p>
        </div>
      </div>
    </div>
  )
}
