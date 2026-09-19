import { useState, useMemo } from 'react'
import { Helmet } from 'react-helmet-async'
import { BACKEND_URL } from '../lib/api.js'
import Footer from '../components/Footer.jsx'
import Header from '../components/Header.jsx'
import '../styles/landing.css'

/* ─────────────────────────────────────────────────────────
   Math — ported from design-reference.html's #calc-milestone
   script (~line 1794). Monthly compounding, contribution taken
   at the start of each month, step-up applied once every twelve
   months — the same annuity-due convention already used by the
   child-app tools in pages/child/Learn.jsx (stepUpSIPFutureValue),
   not the annual/monthly-mixing shortcut in the old wizard's
   sipFV() step-up branch. UNCHANGED from Phase 2/3 — this pass is
   about the page chrome/markup only.
   ───────────────────────────────────────────────────────── */

function futureValue(monthly, years, ratePct, stepUpPct) {
  const r = ratePct / 100 / 12
  let total = 0
  let amt = monthly
  const n = Math.round(years * 12)
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 12 === 0) amt *= 1 + (stepUpPct || 0) / 100
    total = (total + amt) * (1 + r)
  }
  return total
}

function totalInvested(monthly, years, stepUpPct) {
  let total = 0
  let amt = monthly
  const n = Math.round(years * 12)
  for (let i = 0; i < n; i++) {
    if (i > 0 && i % 12 === 0) amt *= 1 + (stepUpPct || 0) / 100
    total += amt
  }
  return total
}

// Monthly SIP needed to reach `target` — bisection, robust with step-up.
function solveSip(target, years, ratePct, stepUpPct) {
  if (years <= 0) return 0
  let lo = 0
  let hi = target
  let mid = 0
  for (let i = 0; i < 80; i++) {
    mid = (lo + hi) / 2
    if (futureValue(mid, years, ratePct, stepUpPct) < target) lo = mid
    else hi = mid
  }
  return hi
}

function inr(n) {
  n = Math.round(n)
  if (n >= 10000000) return '₹' + (n / 10000000).toFixed(2).replace(/\.00$/, '') + ' cr'
  if (n >= 100000) return '₹' + (n / 100000).toFixed(2).replace(/\.00$/, '') + ' lakh'
  return '₹' + n.toLocaleString('en-IN')
}

function inrExact(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

function parseMoney(v) {
  const n = parseFloat(String(v).replace(/[^0-9.]/g, ''))
  return isNaN(n) ? 0 : n
}

function clamp(v, lo, hi) {
  return Math.min(hi, Math.max(lo, v))
}

function isValidEmail(value) {
  if (typeof value !== 'string') return false
  const parts = value.trim().split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  return local.length > 0 && domain.includes('.') && domain.length > 3
}

const AGE_MIN = 0, AGE_MAX = 17
const AMOUNT_MIN = 500, AMOUNT_MAX = 200000
const TARGET_MIN = 100000, TARGET_MAX = 200000000       // text field bounds
const TARGET_SLIDER_MIN = 100000, TARGET_SLIDER_MAX = 10000000 // slider bounds (can differ — matches design-reference.html)
const RETURN_MIN = 4, RETURN_MAX = 18
const STEPUP_MIN = 0, STEPUP_MAX = 20

export default function MilestoneTool() {
  const [mode, setMode] = useState('fv') // 'fv' = grow-to-value, 'sip' = required-SIP
  const [age, setAge] = useState(4)
  const [amount, setAmount] = useState(5000)
  const [target, setTarget] = useState(2500000)
  const [returnRate, setReturnRate] = useState(12)
  const [stepUpPct, setStepUpPct] = useState(0)

  const [email, setEmail] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [submitted, setSubmitted] = useState(false)
  const [formError, setFormError] = useState('')

  const years = 18 - age

  const result = useMemo(() => {
    if (mode === 'fv') {
      const value = futureValue(amount, years, returnRate, stepUpPct)
      const invested = totalInvested(amount, years, stepUpPct)
      return {
        label: 'Value when they turn 18',
        big: inr(value),
        sub: inrExact(amount) + ' a month for ' + years + (years === 1 ? ' year' : ' years') +
          (stepUpPct ? ', rising ' + stepUpPct + '% a year' : ''),
        invested,
        growth: Math.max(0, value - invested),
      }
    }
    const need = solveSip(target, years, returnRate, stepUpPct)
    const invested = totalInvested(need, years, stepUpPct)
    return {
      label: 'You need to invest',
      big: years > 0 ? inrExact(Math.ceil(need / 100) * 100) + ' /mo' : '—',
      sub: years > 0 ? 'to reach ' + inr(target) + ' by the time they turn 18' : 'Your child is already 18.',
      invested,
      growth: Math.max(0, target - invested),
    }
  }, [mode, amount, target, years, returnRate, stepUpPct])

  const months = Math.round(years * 12)

  // "What a later start costs" — the monthly you'd need to end up in the same place.
  const delay = useMemo(() => {
    const base = mode === 'fv' ? amount : solveSip(target, years, returnRate, stepUpPct)
    const goal = mode === 'fv' ? futureValue(base, years, returnRate, stepUpPct) : target
    const rows = []
    for (const d of [2, 5]) {
      const y = years - d
      if (y <= 0) continue
      const need = solveSip(goal, y, returnRate, stepUpPct)
      rows.push({
        inYears: d,
        atAge: age + d,
        need: Math.ceil(need / 100) * 100,
        extra: Math.ceil((need - base) / 100) * 100,
      })
    }
    return { rows, goal }
  }, [mode, amount, target, years, age, returnRate, stepUpPct])

  function handleAmountBlur() {
    setAmount(v => clamp(v, AMOUNT_MIN, AMOUNT_MAX))
  }
  function handleTargetBlur() {
    setTarget(v => clamp(v, TARGET_MIN, TARGET_MAX))
  }

  async function handleSubmit(e) {
    e.preventDefault()
    const trimmed = email.trim().toLowerCase()
    if (!isValidEmail(trimmed)) {
      setFormError('Enter a valid email address.')
      return
    }
    setSubmitting(true)
    setFormError('')
    try {
      const res = await fetch(`${BACKEND_URL}/api/waitlist`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ email: trimmed, source: 'calculator' }),
      })
      const data = await res.json()
      if (!res.ok) {
        setFormError(data.error || 'Something went wrong. Please try again.')
      } else {
        if (typeof fbq !== 'undefined') {
          fbq('track', 'Lead')
        }
        if (typeof gtag_report_conversion !== 'undefined') {
          gtag_report_conversion()
        }
        setSubmitted(true)
        setEmail('')
      }
    } catch {
      setFormError('Could not connect. Please try again.')
    } finally {
      setSubmitting(false)
    }
  }

  return (
    <div className="landing-page">

      <Helmet>
        <title>Child SIP Calculator — What Your Investment Grows To | Taru</title>
        <meta name="description" content="See what a monthly SIP grows to by the time your child turns 18, or work out how much to invest to hit a target — plus what waiting costs you. No signup needed." />
        <meta name="keywords" content="child SIP calculator India, SIP calculator for child, how much will my SIP grow to, mutual fund calculator for children, cost of delaying SIP" />
        <link rel="canonical" href="https://taru.money/calculator/" />

        <meta property="og:title" content="Child SIP Calculator — Taru" />
        <meta property="og:description" content="See what a monthly SIP grows to by the time your child turns 18, or how much you need to invest to hit a target — and what waiting costs you." />
        <meta property="og:url" content="https://taru.money/calculator" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://taru.money/og-image.png" />

        <meta name="twitter:card" content="summary_large_image" />
        <meta name="twitter:title" content="Child SIP Calculator — Taru" />
        <meta name="twitter:description" content="See what a monthly SIP grows to by the time your child turns 18, or how much you need to invest to hit a target — and what waiting costs you." />
        <meta name="twitter:image" content="https://taru.money/og-image.png" />

        <script type="application/ld+json">{JSON.stringify({
          "@context": "https://schema.org",
          "@type": "WebApplication",
          "name": "Child SIP Calculator",
          "url": "https://taru.money/calculator",
          "description": "See what a monthly SIP grows to by the time your child turns 18, or how much you need to invest to hit a target — and what waiting costs you.",
          "applicationCategory": "FinanceApplication",
          "operatingSystem": "Web",
          "offers": {
            "@type": "Offer",
            "price": "0",
            "priceCurrency": "INR"
          },
          "provider": {
            "@type": "Organization",
            "name": "Taru",
            "url": "https://taru.money"
          }
        })}</script>
      </Helmet>

      <Header active="calculator" scrolledThreshold={10} />

      {/* ── Tools view, ported verbatim from design-reference.html's
          #view-tools / #calc-milestone (tools-head + the single-tab
          filters bar + calc markup). The mockup's own copy claims "Two
          calculators" while only ever implementing one — that
          inconsistency exists in the mockup itself and is ported as-is,
          not silently corrected. ── */}
      <div className="section-wrap tools-head">
        <h1>Run the numbers</h1>
        <p>Two calculators. No signup, no email, nothing stored.</p>
      </div>

      <div className="section-wrap">
        <div className="filters" role="group" aria-label="Choose a calculator" style={{ borderBottom: '1px solid var(--border)', paddingBottom: '0.5rem', marginBottom: '0.5rem' }}>
          <button type="button" aria-pressed="true" style={{ font: 'inherit', fontSize: '0.9375rem', cursor: 'default', color: 'var(--forest-dark)', fontWeight: 600, background: 'var(--mint)', border: 0, borderRadius: 4, padding: '0.5rem 0.75rem' }}>
            Milestone calculator
          </button>
        </div>
        <p className="tool-desc">What a monthly SIP grows to by the time your child turns 18, and what waiting costs.</p>

        <section id="calc-milestone">
          <div className="calc">
            <div className="calc-fields">

              <div className="ask">
                <span className="ask-n">1</span>
                <div className="ask-body">
                  <h3>What do you want to work out?</h3>
                  <div className="chips" role="group" aria-label="Choose what to calculate">
                    <button type="button" aria-pressed={mode === 'fv'} onClick={() => setMode('fv')}>How much will it grow to?</button>
                    <button type="button" aria-pressed={mode === 'sip'} onClick={() => setMode('sip')}>How much should I invest?</button>
                  </div>
                </div>
              </div>

              <div className="ask">
                <span className="ask-n">2</span>
                <div className="ask-body">
                  <div className="ask-top">
                    <h3>How old is your child?</h3>
                    <span className="value-box"><input type="number" min={AGE_MIN} max={AGE_MAX} step={1} value={age} onChange={e => setAge(Number(e.target.value))} aria-label="Child's age" /><span className="suf">yrs</span></span>
                  </div>
                  <input type="range" min={AGE_MIN} max={AGE_MAX} step={1} value={age} onChange={e => setAge(Number(e.target.value))} aria-label="Child's age" />
                  <div className="scale"><span>Newborn</span><span>{years > 0 ? `${years} year${years === 1 ? '' : 's'} to invest` : 'Already 18'}</span><span>17</span></div>
                </div>
              </div>

              {mode === 'fv' ? (
                <div className="ask">
                  <span className="ask-n">3</span>
                  <div className="ask-body">
                    <div className="ask-top">
                      <h3>How much can you invest a month?</h3>
                      <span className="value-box"><span className="pre">₹</span><input type="text" inputMode="numeric" value={amount.toLocaleString('en-IN')} onChange={e => setAmount(parseMoney(e.target.value))} onBlur={handleAmountBlur} aria-label="Monthly investment" /></span>
                    </div>
                    <input type="range" min={AMOUNT_MIN} max={AMOUNT_MAX} step={500} value={amount} onChange={e => setAmount(Number(e.target.value))} aria-label="Monthly investment" />
                    <div className="scale"><span>₹500</span><span></span><span>₹2 lakh</span></div>
                  </div>
                </div>
              ) : (
                <div className="ask">
                  <span className="ask-n">3</span>
                  <div className="ask-body">
                    <div className="ask-top">
                      <h3>How much should they have at 18?</h3>
                      <span className="value-box"><span className="pre">₹</span><input type="text" inputMode="numeric" value={target.toLocaleString('en-IN')} onChange={e => setTarget(parseMoney(e.target.value))} onBlur={handleTargetBlur} aria-label="Target amount" /></span>
                    </div>
                    <input type="range" min={TARGET_SLIDER_MIN} max={TARGET_SLIDER_MAX} step={100000} value={Math.min(target, TARGET_SLIDER_MAX)} onChange={e => setTarget(Number(e.target.value))} aria-label="Target amount" />
                    <div className="scale"><span>₹1 lakh</span><span>{inr(target)}</span><span>₹1 crore</span></div>
                  </div>
                </div>
              )}

              <div className="ask">
                <span className="ask-n">4</span>
                <div className="ask-body">
                  <div className="ask-top">
                    <label htmlFor="m-return">Assuming returns of</label>
                    <span className="value-box"><input type="number" id="m-return" min={RETURN_MIN} max={RETURN_MAX} step={0.5} value={returnRate} onChange={e => setReturnRate(Number(e.target.value))} aria-label="Expected return" /><span className="suf">% a year</span></span>
                  </div>
                  <input type="range" min={RETURN_MIN} max={RETURN_MAX} step={0.5} value={returnRate} onChange={e => setReturnRate(Number(e.target.value))} aria-label="Expected return" />
                  <div className="scale"><span>4%</span><span>An assumption, not a promise</span><span>18%</span></div>
                </div>
              </div>

              <div className="ask">
                <span className="ask-n">5</span>
                <div className="ask-body">
                  <div className="ask-top">
                    <label htmlFor="m-stepup">Raising it each year by</label>
                    <span className="value-box"><input type="number" id="m-stepup" min={STEPUP_MIN} max={STEPUP_MAX} step={1} value={stepUpPct} onChange={e => setStepUpPct(Number(e.target.value))} aria-label="Annual increase" /><span className="suf">%</span></span>
                  </div>
                  <input type="range" min={STEPUP_MIN} max={STEPUP_MAX} step={1} value={stepUpPct} onChange={e => setStepUpPct(Number(e.target.value))} aria-label="Annual increase" />
                  <div className="scale"><span>Leave at 0 if unsure</span><span></span><span>20%</span></div>
                </div>
              </div>

            </div>

            <div className="result" aria-live="polite">
              <span className="label">{result.label}</span>
              <div className="big">{result.big}</div>
              <p className="sub">{result.sub}</p>
              <dl>
                <div><dt>You invest</dt><dd>{inrExact(result.invested)}</dd></div>
                <div><dt>Growth</dt><dd>{inrExact(result.growth)}</dd></div>
                <div><dt>Months of investing</dt><dd>{months}</dd></div>
              </dl>
              <div className="delay">
                <span className="delay-head">{delay.rows.length ? `To still reach ${inr(delay.goal)}, starting later` : 'If you start later instead'}</span>
                <div>
                  {delay.rows.length ? delay.rows.map(row => (
                    <div className="delay-row" key={row.inYears}>
                      <span className="when">Start in {row.inYears} years<span className="at-age">when they&apos;re {row.atAge}</span></span>
                      <span className="vals"><span className="val">{inrExact(row.need)} /mo</span><span className="loss">{inrExact(row.extra)} more a month</span></span>
                    </div>
                  )) : (
                    <div className="delay-row"><span className="when">Not enough years left to compare</span></div>
                  )}
                </div>
              </div>
              <div className="result-cta">
                {submitted ? (
                  <p className="form-msg" data-state="ok" role="status" aria-live="polite">You&apos;re on the list. We&apos;ll email you when it opens.</p>
                ) : (
                  <>
                    <form className="signup mini" onSubmit={handleSubmit}>
                      <input type="email" name="email" placeholder="Email me when Taru opens" autoComplete="email" aria-label="Email address"
                        value={email} onChange={e => { setEmail(e.target.value); setFormError('') }} disabled={submitting} />
                      <button type="submit" aria-label="Join the waitlist" disabled={submitting} data-testid="calculator-lead-submit-button-v2">
                        <svg className="icon" viewBox="0 0 24 24" aria-hidden="true"><use href="#i-arrow" /></svg>
                      </button>
                    </form>
                    {formError && <p className="form-msg" data-state="error" role="status" aria-live="polite">{formError}</p>}
                  </>
                )}
              </div>
            </div>
          </div>

          <div className="assume-note">
            <b>How this is worked out</b>
            Contributions are taken at the start of each month and compounded monthly at the annual
            rate you set, until your child turns 18. A step-up, if you set one, is applied once every
            twelve months.
            <ul>
              <li>The rate you choose is an assumption, not a forecast. Past performance does not indicate future returns, and equity funds can and do lose money.</li>
              <li>Figures are before expense ratio, exit load, stamp duty and tax, so a real portfolio would finish lower.</li>
              <li>Figures are in today&apos;s rupees at face value and are not adjusted for inflation. What ₹25 lakh buys in eighteen years will be considerably less than what it buys today.</li>
              <li>This is an illustration, not advice, not a recommendation of any scheme, and not a projection of what you will actually receive.</li>
            </ul>
            <span className="reg">Taru is a brand of NextGenOS Financial Services Private Limited, an AMFI-registered mutual fund distributor (ARN 367667). Mutual fund investments are subject to market risks — read all scheme related documents carefully.</span>
          </div>
        </section>
      </div>

      <Footer showTaxCalculatorLink />

    </div>
  )
}
