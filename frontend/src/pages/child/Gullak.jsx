import { useEffect, useRef, useState } from 'react'

// ── Static coin positions ──────────────────────────────────────
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
          style={{ left: c.left, width: c.size, height: c.size, animationDelay: `${c.delay}ms` }}
        >
          <CoinSVG />
        </span>
      ))}
    </div>
  )
}

// ── Helpers ────────────────────────────────────────────────────
function fmtDate(iso) {
  const d = new Date(iso)
  return d.toLocaleDateString('en-IN', { day: 'numeric', month: 'short' })
}

// Compute dynamic pill values from coinsTotal.
// Returns array of pill descriptors: { key, label, value } | { key: 'custom' } | { key: 'all', value }
function buildPills(coinsTotal) {
  const pills = []

  const p1val = Math.floor((coinsTotal / 3) / 100) * 100
  const p2val = Math.floor((coinsTotal / 2) / 100) * 100

  if (coinsTotal >= 150 && p1val >= 100) {
    pills.push({ key: String(p1val), label: String(p1val), value: p1val })
  }
  if (coinsTotal >= 200 && p2val >= 100 && p2val !== p1val) {
    pills.push({ key: String(p2val), label: String(p2val), value: p2val })
  }

  pills.push({ key: 'custom', label: 'Custom' })
  pills.push({ key: 'all', label: 'All', value: coinsTotal })

  return pills
}

// ── Gullak ────────────────────────────────────────────────────
/**
 * @param {object}   props
 * @param {number}   props.coinsTotal      spendable balance (learning_state.coins_total)
 * @param {number}   props.lifetimeEarned  lifetime coins (from backend, already max'd against spendable)
 * @param {Array}    props.transactions    [{id, type, coins, label, emoji, status, created_at}]
 * @param {Function} props.onRedeem        (type: 'invest'|'cash', coins: number) => Promise<void>
 * @param {string}   props.childName
 */
export default function Gullak({ coinsTotal, lifetimeEarned, transactions = [], onRedeem, childName }) {
  // ── Coin rain ────────────────────────────────────────────────
  const [showRain, setShowRain] = useState(false)
  const prevCoins = useRef(null)

  useEffect(() => {
    const isFirstMount   = prevCoins.current === null
    const coinsIncreased = prevCoins.current !== null && coinsTotal > prevCoins.current

    if (coinsTotal > 0 && (isFirstMount || coinsIncreased)) {
      setShowRain(true)
      const t = setTimeout(() => setShowRain(false), 1800)
      prevCoins.current = coinsTotal
      return () => clearTimeout(t)
    }
    prevCoins.current = coinsTotal
  }, [coinsTotal])

  // ── Transaction list expand ──────────────────────────────────
  const [txExpanded, setTxExpanded] = useState(false)
  const visibleTx = txExpanded ? transactions : transactions.slice(0, 3)

  // ── Redeem flow ──────────────────────────────────────────────
  // step: null | 'choose' | 'amount' | 'success'
  const [redeemStep, setRedeemStep] = useState(null)
  const [redeemType, setRedeemType] = useState(null)   // 'invest' | 'cash'
  const [selectedPill, setSelectedPill] = useState(null) // pill key string | null
  const [customAmount, setCustomAmount] = useState('')
  const [submitting, setSubmitting]     = useState(false)

  const redeemOpen = redeemStep !== null
  const pills      = buildPills(coinsTotal)

  function openRedeem() {
    setRedeemStep('choose')
    setRedeemType(null)
    setSelectedPill(null)
    setCustomAmount('')
  }

  function cancelRedeem() {
    setRedeemStep(null)
    setRedeemType(null)
    setSelectedPill(null)
    setCustomAmount('')
  }

  function chooseType(type) {
    setRedeemType(type)
    setSelectedPill('all')   // default to All
    setCustomAmount('')
    setRedeemStep('amount')
  }

  function handlePillClick(pill) {
    setSelectedPill(pill.key)
    if (pill.key !== 'custom') setCustomAmount('')
  }

  function resolvedCoins() {
    if (!selectedPill) return null
    if (selectedPill === 'all') return coinsTotal
    if (selectedPill === 'custom') {
      const n = parseInt(customAmount, 10)
      return (!isNaN(n) && n >= 1 && n <= coinsTotal) ? n : null
    }
    return parseInt(selectedPill, 10)
  }

  const coins          = resolvedCoins()
  const confirmEnabled = !!coins && !submitting

  async function confirmRedeem() {
    if (!confirmEnabled) return
    setSubmitting(true)
    try {
      await onRedeem(redeemType, coins)
      setRedeemStep('success')
    } finally {
      setSubmitting(false)
    }
  }

  function confirmBtnLabel() {
    if (submitting) return 'Sending…'
    if (!coins) return 'Pick an amount first'
    return redeemType === 'invest'
      ? `Plant ${coins} coins →`
      : `Send ${coins} coins to parent →`
  }

  // ── Render ───────────────────────────────────────────────────
  return (
    <div className="gullak">
      {showRain && <CoinRain />}

      {/* ── Hero card ──────────────────────────────────────── */}
      <div className="gullak-hero">
        <div className="gullak-hero__eyebrow">
          🐿️ {childName ? `${childName}'s gullak` : 'My gullak'} · {coinsTotal} coins
        </div>
        <div className="gullak-hero__number" key={coinsTotal}>
          {coinsTotal}
        </div>
        <div className="gullak-hero__sub">ready to plant or spend</div>
      </div>

      {/* ── Default view (no redeem open) ──────────────────── */}
      {!redeemOpen && (
        <>
          <button
            className="gullak-redeem-btn"
            onClick={openRedeem}
            disabled={coinsTotal <= 0}
          >
            Redeem my coins →
          </button>

          {/* Balance card — hidden while redeem flow is active */}
          <div className="gullak-balance" role="region" aria-label="Coin balance summary">
            <div className="gullak-balance__col">
              <div className="gullak-balance__label">Ready now</div>
              <div className="gullak-balance__value">{coinsTotal}</div>
              <div className="gullak-balance__unit">coins</div>
            </div>
            <div className="gullak-balance__col">
              <div className="gullak-balance__label">Lifetime earned</div>
              <div className="gullak-balance__value">{lifetimeEarned}</div>
              <div className="gullak-balance__unit">coins</div>
            </div>
          </div>
        </>
      )}

      {/* ── Redeem section ─────────────────────────────────── */}
      {redeemOpen && (
        <div className="gullak-redeem-section">

          {/* ── Choose step ────────────────────────────────── */}
          {redeemStep === 'choose' && (
            <>
              {/* Back — inside choose step, above Penny bubble */}
              <button className="gullak-redeem-section__back" onClick={cancelRedeem}>
                ← Back
              </button>

              <div className="penny-bubble-wrap">
                <span className="penny-bubble-wrap__squirrel" aria-hidden="true">🐿️</span>
                <div className="penny-bubble">
                  <p className="penny-bubble__text">
                    You've got {coinsTotal} coins ready! What do you want to do?
                  </p>
                </div>
              </div>

              <button className="gullak-choice-card" onClick={() => chooseType('invest')}>
                <span className="gullak-choice-card__icon" aria-hidden="true">🌱</span>
                <div>
                  <div className="gullak-choice-card__title">Plant in my garden</div>
                  <div className="gullak-choice-card__sub">
                    Ask a parent to invest it. Watch your garden grow!
                  </div>
                </div>
              </button>

              <button className="gullak-choice-card" onClick={() => chooseType('cash')}>
                <span className="gullak-choice-card__icon" aria-hidden="true">💰</span>
                <div>
                  <div className="gullak-choice-card__title">Take as pocket money</div>
                  <div className="gullak-choice-card__sub">
                    Ask a parent to send it to you to spend
                  </div>
                </div>
              </button>
            </>
          )}

          {/* ── Amount step ────────────────────────────────── */}
          {redeemStep === 'amount' && (
            <>
              {/* Back — inside amount step, above Penny bubble */}
              <button className="gullak-redeem-section__back" onClick={() => setRedeemStep('choose')}>
                ← Back
              </button>

              <div className="penny-bubble-wrap">
                <span className="penny-bubble-wrap__squirrel" aria-hidden="true">🐿️</span>
                <div className="penny-bubble">
                  <p className="penny-bubble__text">
                    {redeemType === 'invest'
                      ? 'How many coins should I ask your parent to plant? 🌱'
                      : 'How many coins do you want as pocket money? 💰'}
                  </p>
                </div>
              </div>

              <div>
                <div className="gullak-amount-label">Choose an amount</div>
                <div className="gullak-pills">
                  {pills.map((pill) => {
                    if (pill.key === 'custom' && selectedPill === 'custom') {
                      // Custom pill transforms into an inline input when active
                      return (
                        <input
                          key="custom"
                          type="number"
                          min={1}
                          max={coinsTotal}
                          value={customAmount}
                          onChange={e => {
                            const raw = e.target.value
                            // Clamp to max on input so user can't type above balance
                            if (raw === '') { setCustomAmount(''); return }
                            const n = parseInt(raw, 10)
                            if (!isNaN(n)) setCustomAmount(String(Math.min(n, coinsTotal)))
                          }}
                          placeholder={`max ${coinsTotal}`}
                          className="gullak-pill gullak-pill--selected gullak-pill--input"
                          autoFocus
                          aria-label={`Enter custom coin amount, max ${coinsTotal}`}
                        />
                      )
                    }
                    return (
                      <button
                        key={pill.key}
                        className={`gullak-pill${selectedPill === pill.key ? ' gullak-pill--selected' : ''}`}
                        onClick={() => handlePillClick(pill)}
                        aria-label={pill.key === 'all' ? `All ${coinsTotal} coins` : pill.label}
                      >
                        {pill.label}
                      </button>
                    )
                  })}
                </div>
              </div>

              <button
                className="gullak-confirm-btn"
                onClick={confirmRedeem}
                disabled={!confirmEnabled}
              >
                {confirmBtnLabel()}
              </button>
            </>
          )}

          {/* ── Success step ───────────────────────────────── */}
          {redeemStep === 'success' && (
            <div className="gullak-success">
              <div className="gullak-success__icon">🐿️</div>
              <div className="gullak-success__title">Sent to your parent!</div>
              <div className="gullak-success__sub">
                They'll action it soon 🐿️
              </div>
              <button className="gullak-redeem-btn" style={{ marginTop: 8 }} onClick={cancelRedeem}>
                Back to my gullak
              </button>
            </div>
          )}

        </div>
      )}

      {/* ── Recent coins — always visible ──────────────────── */}
      {transactions.length > 0 && (
        <div className="gullak-tx-section">
          <div className="gullak-tx-header">Recent coins</div>
          <div className="gullak-tx-list">
            {visibleTx.map((tx) => (
              <div key={tx.id} className="gullak-tx-item">
                <span className="gullak-tx-item__emoji" aria-hidden="true">{tx.emoji}</span>
                <div className="gullak-tx-item__info">
                  <div className="gullak-tx-item__label">{tx.label}</div>
                  <div className="gullak-tx-item__date">{fmtDate(tx.created_at)}</div>
                </div>
                {tx.status === 'pending' ? (
                  <span className="gullak-tx-item__pending-chip">⏳ Pending</span>
                ) : (
                  <span className={`gullak-tx-item__coins${tx.coins < 0 ? ' gullak-tx-item__coins--negative' : ''}`}>
                    {tx.coins > 0 ? `+${tx.coins}` : tx.coins === 0 ? '' : tx.coins}
                  </span>
                )}
              </div>
            ))}
          </div>

          {transactions.length > 3 && (
            <button
              className="gullak-tx-view-more"
              onClick={() => setTxExpanded(e => !e)}
            >
              {txExpanded ? 'Show less ↑' : `View ${transactions.length - 3} more ↓`}
            </button>
          )}
        </div>
      )}
    </div>
  )
}
