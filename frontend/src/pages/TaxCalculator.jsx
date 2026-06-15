import { useState, useRef, useEffect } from 'react'
import { Link } from 'react-router-dom'
import { Helmet } from 'react-helmet-async'
import '../styles/landing.css'
import '../styles/taxcalculator.css'

/* ─────────────────────────────────────────────────────────
   Constants
   ───────────────────────────────────────────────────────── */

const ASSET_CLASSES = [
  { id: 'equity_mf',     label: 'Equity MF' },
  { id: 'debt_mf',       label: 'Debt MF' },
  { id: 'hybrid_mf',     label: 'Equity Hybrid MF' },
  { id: 'direct_stocks', label: 'Direct Stocks' },
  { id: 'digital_gold',  label: 'Digital Gold' },
  { id: 'fd_rd',         label: 'FD / RD' },
  { id: 'ulip',          label: 'ULIP' },
]

/* 12-month LTCG threshold: equity MF, equity hybrid MF, direct stocks */
const LTCG_SPLIT = new Set(['equity_mf', 'hybrid_mf', 'direct_stocks'])

/* Show LTCG/STCG breakdown rows in table and corpus card chips */
const SHOW_SPLIT_ROWS = new Set(['equity_mf', 'hybrid_mf', 'direct_stocks', 'digital_gold', 'ulip'])

/* Asset classes not offered by Taru yet */
const NON_MF_TYPES = new Set(['direct_stocks', 'digital_gold', 'fd_rd', 'ulip'])

/* ─────────────────────────────────────────────────────────
   Core SIP formula
   FV = P × [((1+r)^n − 1) / r] × (1+r)
   ───────────────────────────────────────────────────────── */

function sipFV(monthly, annualReturnPct, years) {
  const r = annualReturnPct / 100 / 12
  const n = years * 12
  if (r === 0 || n === 0) return monthly * n
  return monthly * ((Math.pow(1 + r, n) - 1) / r) * (1 + r)
}

/* ─────────────────────────────────────────────────────────
   Tax calculation
   ───────────────────────────────────────────────────────── */

export function calculateTaxSavings(monthlyAmount, childAge, returnRate, assetClass) {
  const years       = 18 - childAge
  const totalMonths = years * 12

  let corpus, totalInvested, gains
  let ltcgGains = 0, stcgGains = 0
  let ltcgMonths = 0, stcgMonths = 0

  if (LTCG_SPLIT.has(assetClass)) {
    // 12-month holding threshold
    ltcgMonths = Math.max(0, totalMonths - 12)
    stcgMonths = Math.min(12, totalMonths)

    const ltcgInvested = monthlyAmount * ltcgMonths
    const stcgInvested = monthlyAmount * stcgMonths
    const ltcgCorpus   = ltcgMonths > 0 ? sipFV(monthlyAmount, returnRate, ltcgMonths / 12) : 0
    // Simple linear approximation for the short STCG window (≤12 months)
    const stcgCorpus   = stcgInvested * (1 + (returnRate / 100) * (stcgMonths / 12))

    ltcgGains     = Math.max(0, ltcgCorpus - ltcgInvested)
    stcgGains     = Math.max(0, stcgCorpus - stcgInvested)
    corpus        = ltcgCorpus + stcgCorpus
    totalInvested = monthlyAmount * totalMonths
    gains         = ltcgGains + stcgGains

  } else if (assetClass === 'digital_gold') {
    // 24-month holding threshold for gold — STCG taxed at slab rate, LTCG at 12.5%
    ltcgMonths = Math.max(0, totalMonths - 24)
    stcgMonths = Math.min(24, totalMonths)

    const ltcgInvested = monthlyAmount * ltcgMonths
    const stcgInvested = monthlyAmount * stcgMonths
    const ltcgCorpus   = ltcgMonths > 0 ? sipFV(monthlyAmount, returnRate, ltcgMonths / 12) : 0
    // Simple linear approximation for the STCG window (≤24 months)
    const stcgCorpus   = stcgInvested * (1 + (returnRate / 100) * (stcgMonths / 12))

    ltcgGains     = Math.max(0, ltcgCorpus - ltcgInvested)
    stcgGains     = Math.max(0, stcgCorpus - stcgInvested)
    corpus        = ltcgCorpus + stcgCorpus
    totalInvested = monthlyAmount * totalMonths
    gains         = ltcgGains + stcgGains

  } else {
    // No split — single pool (debt MF, FD/RD, ULIP)
    ltcgMonths    = totalMonths
    stcgMonths    = 0
    corpus        = sipFV(monthlyAmount, returnRate, years)
    totalInvested = monthlyAmount * totalMonths
    gains         = Math.max(0, corpus - totalInvested)
    ltcgGains     = gains
  }

  /* ── Tax per asset class ── */
  let parentTax          = 0, childTax      = 0
  let parentStcgTax      = 0, parentLtcgTax = 0
  let childStcgTax       = 0, childLtcgTax  = 0
  let childLtcgExemption = 0   // amount of LTCG shielded for child by exemption
  let explanation        = ''
  let noSavingReason     = ''

  switch (assetClass) {
    case 'equity_mf':
      parentStcgTax      = stcgGains * 0.20
      parentLtcgTax      = ltcgGains * 0.125
      parentTax          = parentStcgTax + parentLtcgTax
      childStcgTax       = stcgGains * 0.20
      childLtcgExemption = Math.min(425000, ltcgGains)
      childLtcgTax       = Math.max(0, ltcgGains - 425000) * 0.125
      childTax           = childStcgTax + childLtcgTax
      explanation        = "Equity mutual funds use two tax rates: STCG at 20% for units held under 12 months, and LTCG at 12.5% for units held over 12 months. In a SIP redeemed at age 18, the last 12 monthly instalments qualify as STCG; all earlier instalments qualify as LTCG. In your child's name, their ₹4.25 lakh tax-free threshold (₹3L basic exemption + ₹1.25L LTCG exemption under Section 112A) applies to LTCG — both are fresh since the child has no other income. STCG is taxed at the same 20% rate in both names."
      break

    case 'hybrid_mf':
      parentStcgTax      = stcgGains * 0.20
      parentLtcgTax      = ltcgGains * 0.125
      parentTax          = parentStcgTax + parentLtcgTax
      childStcgTax       = stcgGains * 0.20
      childLtcgExemption = Math.min(425000, ltcgGains)
      childLtcgTax       = Math.max(0, ltcgGains - 425000) * 0.125
      childTax           = childStcgTax + childLtcgTax
      explanation        = "Equity-oriented hybrid funds (more than 65% in equities) are taxed exactly like equity mutual funds — STCG at 20% and LTCG at 12.5%. In your child's name, their ₹4.25 lakh tax-free threshold (₹3L basic exemption + ₹1.25L LTCG exemption under Section 112A) applies to LTCG, both fresh since the child has no other income."
      break

    case 'direct_stocks':
      parentStcgTax      = stcgGains * 0.20
      parentLtcgTax      = ltcgGains * 0.125
      parentTax          = parentStcgTax + parentLtcgTax
      childStcgTax       = stcgGains * 0.20
      childLtcgExemption = Math.min(425000, ltcgGains)
      childLtcgTax       = Math.max(0, ltcgGains - 425000) * 0.125
      childTax           = childStcgTax + childLtcgTax
      explanation        = "Listed equity shares follow the same STCG / LTCG rules as equity mutual funds — 20% for units held under 12 months, 12.5% for units held over 12 months. In your child's name, their ₹4.25 lakh tax-free threshold (₹3L basic exemption + ₹1.25L LTCG exemption) applies to LTCG, fresh since the child has no other income."
      break

    case 'debt_mf':
      parentTax      = gains * 0.30
      childTax       = gains * 0.30
      parentLtcgTax  = parentTax
      childLtcgTax   = childTax
      explanation    = "Debt mutual fund gains (purchased on or after April 1, 2023) are taxed at your income tax slab rate under Section 50AA — this applies whether the investment is in your name or your child's name, because of income tax clubbing rules that apply until your child turns 18. There is no tax advantage to investing debt funds in your child's name."
      noSavingReason = "Income is clubbed with yours until your child turns 18"
      break

    case 'digital_gold':
      // STCG (last 24 months): slab rate 30% for both parent and child — no saving on STCG portion
      // LTCG (held >24 months): 12.5% flat; child gets ₹3L basic exemption (not Section 112A)
      parentStcgTax      = stcgGains * 0.30
      parentLtcgTax      = ltcgGains * 0.125
      parentTax          = parentStcgTax + parentLtcgTax
      childStcgTax       = stcgGains * 0.30
      childLtcgExemption = Math.min(300000, ltcgGains)
      childLtcgTax       = Math.max(0, ltcgGains - 300000) * 0.125
      childTax           = childStcgTax + childLtcgTax
      explanation        = "Digital gold uses a 24-month holding threshold: SIP instalments held under 24 months qualify as STCG, taxed at the income tax slab rate (30% assumed here) — same rate for both parent and child. Instalments held over 24 months qualify as LTCG at 12.5% flat. In your child's name, their ₹3 lakh basic exemption shields the first ₹3 lakh of LTCG gains. Note: the ₹1.25L LTCG exemption under Section 112A applies only to equity assets — not gold."
      break

    case 'fd_rd':
      parentTax      = gains * 0.30
      childTax       = gains * 0.30
      parentLtcgTax  = parentTax
      childLtcgTax   = childTax
      explanation    = "Fixed deposit and recurring deposit interest is taxed annually as it accrues — not at redemption. During your child's minority, this interest is clubbed with your income and taxed at your slab rate regardless of whose name the FD is in. There is no tax advantage to FDs in your child's name."
      noSavingReason = "Interest is taxed annually and clubbed with your income until age 18"
      break

    case 'ulip':
      parentTax          = gains * 0.125
      childLtcgExemption = Math.min(300000, ltcgGains)
      childTax           = Math.max(0, gains - 300000) * 0.125
      parentLtcgTax      = parentTax
      childLtcgTax       = childTax
      explanation        = "For ULIPs with annual premium above ₹2.5 lakh, gains are taxed as capital gains at 12.5%. In your child's name, their ₹3 lakh basic exemption shields the first ₹3 lakh of gains from tax."
      break

    default:
      break
  }

  const taxSaving = Math.max(0, parentTax - childTax)

  return {
    monthsInvested: totalMonths,
    totalInvested,
    corpus,
    gains,
    ltcgGains,
    stcgGains,
    ltcgMonths,
    stcgMonths,
    parentTax,
    childTax,
    parentStcgTax,
    parentLtcgTax,
    childStcgTax,
    childLtcgTax,
    taxSaving,
    parentNetCorpus:    corpus - parentTax,
    childNetCorpus:     corpus - childTax,
    childLtcgExemption,
    explanation,
    noSavingReason,
  }
}

/* ─────────────────────────────────────────────────────────
   Helpers
   ───────────────────────────────────────────────────────── */

function fmt(n) {
  return '₹' + Math.round(n).toLocaleString('en-IN')
}

function fmtLakh(n) {
  const l    = n / 100000
  const disp = Math.round(l * 10) / 10
  return '₹' + disp + 'L'
}

function sliderFill(value, min, max) {
  return `${(((value - min) / (max - min)) * 100).toFixed(1)}%`
}

function milestones(netCorpus) {
  const collegeYrs   = Math.min(10, Math.floor(netCorpus / 300000))
  const collegeLabel = collegeYrs >= 10
    ? 'Covers 10+ years of college tuition (at ₹3L/yr)'
    : `Covers ${collegeYrs} year${collegeYrs !== 1 ? 's' : ''} of college tuition (at ₹3L/yr)`

  const abroadGoal  = 2500000
  const abroadReady = netCorpus >= abroadGoal
  const abroadLabel = abroadReady
    ? '✓ Covers a year of studying abroad'
    : `${fmtLakh(abroadGoal - netCorpus)} more to cover study abroad`

  const seedGoal  = 1500000
  const seedReady = netCorpus >= seedGoal
  const seedLabel = seedReady
    ? '✓ Enough for startup seed capital'
    : `${fmtLakh(seedGoal - netCorpus)} more for startup seed capital`

  return [
    { label: collegeLabel, done: collegeYrs > 0 },
    { label: abroadLabel,  done: abroadReady },
    { label: seedLabel,    done: seedReady },
  ]
}

const EQUITY_TYPES = new Set(['equity_mf', 'hybrid_mf', 'direct_stocks', 'ulip'])

function getAssumptions(assetClass) {
  const always = [
    'Child has no other income at 18 — their full basic exemption (₹3L) is available.',
    'Returns shown are assumed, not guaranteed — actual returns will vary.',
    'Tax laws are as per current Indian income tax rules and may change.',
  ]

  const equityExtra = [
    'All SIP instalments held over 12 months qualify as LTCG; last 12 months qualify as STCG.',
    "Parent's ₹1.25L LTCG exemption is already used by their own investments.",
    "Child's LTCG exemption: ₹1.25L under Section 112A, plus ₹3L basic exemption — total ₹4.25L shielded.",
  ]

  switch (assetClass) {
    case 'equity_mf':
    case 'direct_stocks':
    case 'ulip':
      return [...always, ...equityExtra]

    case 'hybrid_mf':
      return [
        ...always,
        ...equityExtra,
        'Assumes fund has ≥65% equity exposure, qualifying it as equity-oriented. Conservative hybrid funds are taxed differently.',
      ]

    case 'digital_gold':
      return [
        ...always,
        'SIP instalments held over 24 months qualify as LTCG at 12.5%; last 24 months qualify as STCG taxed at income tax slab rate.',
        "Child's ₹3L basic exemption applies to LTCG gains. No separate Section 112A exemption — that is equity-only.",
      ]

    case 'debt_mf':
      return [
        ...always,
        'Debt MF gains are taxed at your income tax slab rate under Section 50AA, regardless of holding period. This calculator assumes 30% slab.',
        "Debt MF and FD/RD gains are clubbed with the parent's income during the child's minority — no tax benefit in child's name.",
      ]

    case 'fd_rd':
      return [
        ...always,
        'FD/RD interest is taxed at your income tax slab rate. This calculator assumes 30% slab.',
        "Debt MF and FD/RD gains are clubbed with the parent's income during the child's minority — no tax benefit in child's name.",
      ]

    default:
      return always
  }
}

/* ─────────────────────────────────────────────────────────
   Component
   ───────────────────────────────────────────────────────── */

export default function TaxCalculator() {
  const navRef = useRef(null)

  const [monthly,    setMonthly]    = useState(10000)
  const [childAge,   setChildAge]   = useState(5)
  const [returnRate, setReturnRate] = useState(12)
  const [assetClass, setAssetClass] = useState('equity_mf')
  const [explOpen,   setExplOpen]   = useState(false)

  const results       = calculateTaxSavings(monthly, childAge, returnRate, assetClass)
  const investYears   = 18 - childAge
  const activeAsset   = ASSET_CLASSES.find(a => a.id === assetClass)
  const growthMulti   = (results.corpus / results.totalInvested).toFixed(1)
  const chips         = milestones(results.childNetCorpus)
  const showSplitRows = SHOW_SPLIT_ROWS.has(assetClass)
  const hasStcg       = results.stcgGains > 0
  const assumptions   = getAssumptions(assetClass)

  const stcgRateLabel = assetClass === 'digital_gold'
    ? 'STCG tax at slab rate (30%)'
    : 'STCG tax @ 20%'
  const ltcgRateLabel = 'LTCG tax @ 12.5%'

  // Equity types that show the two-row exemption explanation
  const EQUITY_EXEMPTION = new Set(['equity_mf', 'hybrid_mf', 'direct_stocks', 'ulip'])
  const showLtcgExemptionRows = EQUITY_EXEMPTION.has(assetClass) && results.childLtcgExemption > 0
  const showGoldExemptionRow  = assetClass === 'digital_gold' && results.childLtcgExemption > 0
  const childLtcgTaxable      = Math.max(0, results.ltcgGains - results.childLtcgExemption)

  const explanationPrefix = `At ${returnRate}% annual return over ${investYears} year${investYears !== 1 ? 's' : ''}, ₹${monthly.toLocaleString('en-IN')}/month grows to ${fmt(results.corpus)} — a ${growthMulti}× multiple on your investment. `
  const fullExplanation   = explanationPrefix + results.explanation

  useEffect(() => {
    const nav = navRef.current
    if (!nav) return
    const onScroll = () => nav.classList.toggle('scrolled', window.scrollY > 24)
    window.addEventListener('scroll', onScroll, { passive: true })
    onScroll()
    return () => window.removeEventListener('scroll', onScroll)
  }, [])

  function handleMonthlyInput(e) {
    const raw = Number(e.target.value)
    if (!isNaN(raw)) setMonthly(Math.max(500, Math.min(100000, raw)))
  }

  return (
    <div className="landing-page">

      <Helmet>
        <title>Child Investment Tax Calculator — Save Tax by Investing in Your Child&apos;s Name | Taru</title>
        <meta name="description" content="Calculate how much tax you save by investing in your child's name vs your own. Compare Equity MF, Debt MF, Digital Gold and more. Free calculator, no signup needed." />
        <meta property="og:title" content="The best investment you'll ever make is in your child's name." />
        <meta property="og:description" content="See your corpus, your tax bill, and exactly how much you save by investing in your child's name. Live, with your numbers." />
        <meta property="og:url" content="https://taru.money/tax-calculator" />
        <meta property="og:type" content="website" />
      </Helmet>

      {/* ── Navbar ── */}
      <nav className="top" ref={navRef}>
        <div className="inner">
          <Link to="/" className="logo">taru<span className="dot">.</span></Link>
          <div className="nav-links">
            <Link to="/blog">Blogs</Link>
            <Link to="/tax-calculator" style={{ opacity: 1, fontWeight: 500 }}>Tax calculator</Link>
            <Link to="/signup" className="btn primary">Get started</Link>
          </div>
        </div>
      </nav>

      {/* ── Page hero ── */}
      <header className="tc-hero">
        <div className="wrap">
          <h1 className="tc-hero__title serif">
            The best investment you&apos;ll ever make is in your child&apos;s name.
          </h1>
          <p className="tc-hero__sub">
            See your corpus, your tax bill, and exactly how much you save by investing in your child&apos;s name. Live, with your numbers.
          </p>
        </div>
      </header>

      {/* ── Calculator body ── */}
      <section className="tc-section">
        <div className="wrap">
          <div className="tc-page-grid">

            {/* ════ LEFT PANEL — Inputs (+ Assumptions on desktop) ════ */}
            <div className="tc-left-panel">

              <div className="tc-inputs">

                {/* Monthly SIP */}
                <div className="tc-field">
                  <div className="tc-field__header">
                    <label className="tc-label">Monthly SIP amount</label>
                    <div className="tc-value-box">
                      <span className="tc-rupee-prefix">₹</span>
                      <input
                        type="number"
                        className="tc-number-input"
                        value={monthly}
                        min={500}
                        max={100000}
                        step={500}
                        onChange={handleMonthlyInput}
                      />
                    </div>
                  </div>
                  <input
                    type="range"
                    className="tc-slider"
                    style={{ '--fill': sliderFill(monthly, 500, 100000) }}
                    min={500}
                    max={100000}
                    step={500}
                    value={monthly}
                    onChange={e => setMonthly(Number(e.target.value))}
                  />
                  <div className="tc-slider-bounds">
                    <span>₹500</span>
                    <span>₹1,00,000</span>
                  </div>
                </div>

                {/* Child age */}
                <div className="tc-field">
                  <div className="tc-field__header">
                    <label className="tc-label">Child&apos;s current age</label>
                    <span className="tc-value-pill">Age {childAge}</span>
                  </div>
                  <input
                    type="range"
                    className="tc-slider"
                    style={{ '--fill': sliderFill(childAge, 0, 17) }}
                    min={0}
                    max={17}
                    step={1}
                    value={childAge}
                    onChange={e => setChildAge(Number(e.target.value))}
                  />
                  <div className="tc-slider-bounds">
                    <span>Age 0</span>
                    <span>Invests until child turns 18</span>
                    <span>Age 17</span>
                  </div>
                </div>

                {/* Expected return */}
                <div className="tc-field">
                  <div className="tc-field__header">
                    <label className="tc-label">Expected annual return</label>
                    <span className="tc-value-pill tc-value-pill--amber">{returnRate}%</span>
                  </div>
                  <input
                    type="range"
                    className="tc-slider"
                    style={{ '--fill': sliderFill(returnRate, 8, 18) }}
                    min={8}
                    max={18}
                    step={0.5}
                    value={returnRate}
                    onChange={e => setReturnRate(Number(e.target.value))}
                  />
                  <div className="tc-slider-bounds">
                    <span>8%</span>
                    <span className="tc-not-guarantee">Assumed — not a guarantee</span>
                    <span>18%</span>
                  </div>
                </div>

                {/* Asset class */}
                <div className="tc-field">
                  <label className="tc-label">Asset class</label>
                  <div className="tc-pills">
                    {ASSET_CLASSES.map(ac => (
                      <button
                        key={ac.id}
                        type="button"
                        className={`tc-pill${assetClass === ac.id ? ' tc-pill--active' : ''}`}
                        onClick={() => { setAssetClass(ac.id); setExplOpen(false) }}
                      >
                        {ac.label}
                      </button>
                    ))}
                  </div>
                </div>

              </div>{/* /tc-inputs */}

              {/* Assumptions — desktop only (hidden on mobile via CSS) */}
              <div className="tc-assumptions tc-assumptions--desktop">
                <div className="tc-assumptions__heading">Assumptions</div>
                <ul className="tc-assumptions__list">
                  {assumptions.map((a, i) => (
                    <li key={i}>{a}</li>
                  ))}
                </ul>
              </div>

            </div>{/* /tc-left-panel */}

            {/* ════ RIGHT PANEL — Three zones ════ */}
            <div className="tc-right-panel">

              {/* ── ZONE A: Corpus card ── */}
              <div className="tc-corpus-card">
                <div className="tc-corpus__label">Corpus at 18</div>
                <div className="tc-corpus__big">{fmt(results.corpus)}</div>
                <div className="tc-corpus__sub">
                  Invested {fmt(results.totalInvested)} over {investYears} yr{investYears !== 1 ? 's' : ''} · Grew {growthMulti}× at {returnRate}% p.a.
                </div>

                {/* Invested → corpus stat row with gain chips grouped below arrow */}
                <div className="tc-corpus-stat-row">
                  <span className="tc-corpus-stat-row__num">
                    {fmt(results.totalInvested)}
                    <small>invested</small>
                  </span>
                  <div className="tc-corpus-stat-row__mid">
                    <span className="tc-corpus-stat-row__arrow">→</span>
                    {showSplitRows && (
                      <div className="tc-gains-chips">
                        {results.ltcgGains > 0 && (
                          <span className="tc-chip-ltcg">LTCG {fmt(results.ltcgGains)}</span>
                        )}
                        {results.stcgGains > 0 && (
                          <span className="tc-chip-stcg">STCG {fmt(results.stcgGains)}</span>
                        )}
                      </div>
                    )}
                  </div>
                  <span className="tc-corpus-stat-row__num">
                    {fmt(results.corpus)}
                    <small>corpus</small>
                  </span>
                </div>
              </div>

              {/* ── ZONE B: Tax comparison card ── */}
              <div className="tc-tax-card">
                <div className="tc-tax-card__header">What tax does to it</div>

                {/* Mobile-only: two stacked scenario cards */}
                <div className="tc-mobile-tax-cards">
                  {[
                    {
                      heading: 'Invested in your name',
                      stcgTax: results.parentStcgTax,
                      ltcgTax: results.parentLtcgTax,
                      totalTax: results.parentTax,
                      netCorpus: results.parentNetCorpus,
                      exemption: null,
                      isChild: false,
                    },
                    {
                      heading: "Invested in child's name",
                      stcgTax: results.childStcgTax,
                      ltcgTax: results.childLtcgTax,
                      totalTax: results.childTax,
                      netCorpus: results.childNetCorpus,
                      exemption: results.childLtcgExemption > 0 ? results.childLtcgExemption : null,
                      isChild: true,
                    },
                  ].map((card) => (
                    <div key={card.heading} className="tc-mobile-card">
                      <div className="tc-mobile-card__heading">{card.heading}</div>
                      <div className="tc-mobile-card__divider" />
                      {showSplitRows && (
                        <>
                          {hasStcg && (
                            <div className="tc-mobile-row">
                              <span>STCG gains</span>
                              <span>{fmt(results.stcgGains)}</span>
                            </div>
                          )}
                          <div className="tc-mobile-row">
                            <span>LTCG gains</span>
                            <span>{fmt(results.ltcgGains)}</span>
                          </div>
                          {card.isChild && showLtcgExemptionRows && (
                            <>
                              <div className="tc-mobile-row tc-mobile-row--explain">
                                <span>Less: exemption</span>
                                <span className="tc-expl-exemption">−{fmt(results.childLtcgExemption)}</span>
                              </div>
                              <div className="tc-mobile-row tc-mobile-row--explain">
                                <span>LTCG taxable after exemption</span>
                                <span className="tc-expl-muted">{fmt(childLtcgTaxable)}</span>
                              </div>
                            </>
                          )}
                          {!card.isChild && showLtcgExemptionRows && (
                            <div className="tc-mobile-row tc-mobile-row--explain">
                              <span>Less: exemption</span>
                              <span className="tc-expl-muted">— (already used)</span>
                            </div>
                          )}
                          {card.isChild && showGoldExemptionRow && (
                            <div className="tc-mobile-row tc-mobile-row--explain">
                              <span>Less: basic exemption</span>
                              <span className="tc-expl-exemption">−{fmt(results.childLtcgExemption)}</span>
                            </div>
                          )}
                          {hasStcg && (
                            <div className="tc-mobile-row">
                              <span>{stcgRateLabel}</span>
                              <span className={card.isChild ? '' : 'tc-tax-bad'}>{fmt(card.stcgTax)}</span>
                            </div>
                          )}
                          <div className="tc-mobile-row">
                            <span>{ltcgRateLabel}</span>
                            <span className={card.isChild && results.taxSaving > 0 ? 'tc-tax-good' : (!card.isChild ? 'tc-tax-bad' : '')}>
                              {fmt(card.ltcgTax)}
                            </span>
                          </div>
                        </>
                      )}
                      <div className="tc-mobile-row">
                        <span>Total tax on gains</span>
                        <span className={card.isChild && results.taxSaving > 0 ? 'tc-tax-good' : (!card.isChild ? 'tc-tax-bad' : '')}>
                          {fmt(card.totalTax)}
                        </span>
                      </div>
                      <div className="tc-mobile-card__divider tc-mobile-card__divider--bold" />
                      <div className="tc-mobile-row tc-mobile-row--keep">
                        <span><strong>You keep</strong></span>
                        <span className={card.isChild && results.taxSaving > 0 ? 'tc-tax-good tc-tax-bold' : ''}>
                          <strong>{fmt(card.netCorpus)}</strong>
                        </span>
                      </div>
                    </div>
                  ))}
                </div>

                {/* Desktop-only: three-column table */}
                <table className="tc-comparison-table tc-comparison-table--desktop">
                  <thead>
                    <tr>
                      <th></th>
                      <th>Invested in your name</th>
                      <th className="tc-col-child">Invested in child&apos;s name</th>
                    </tr>
                  </thead>
                  <tbody>

                    {/* ROW GROUP 1 — Taxable gains [equity-type assets only] */}
                    {showSplitRows && (
                      <>
                        <tr className="tc-group-header">
                          <td colSpan={3}>Taxable gains</td>
                        </tr>
                        {hasStcg && (
                          <tr>
                            <td>STCG gains</td>
                            <td>{fmt(results.stcgGains)}</td>
                            <td className="tc-col-child">{fmt(results.stcgGains)}</td>
                          </tr>
                        )}
                        <tr>
                          <td>LTCG gains</td>
                          <td>{fmt(results.ltcgGains)}</td>
                          <td className="tc-col-child">{fmt(results.ltcgGains)}</td>
                        </tr>

                        {/* Exemption explanation rows — equity / ulip */}
                        {showLtcgExemptionRows && (
                          <>
                            <tr className="tc-row-explain">
                              <td>Less: exemption</td>
                              <td className="tc-expl-muted">— (already used)</td>
                              <td className="tc-col-child tc-expl-exemption">−{fmt(results.childLtcgExemption)}</td>
                            </tr>
                            <tr className="tc-row-explain">
                              <td>LTCG taxable after exemption</td>
                              <td className="tc-expl-muted">{fmt(results.ltcgGains)}</td>
                              <td className="tc-col-child tc-expl-muted">{fmt(childLtcgTaxable)}</td>
                            </tr>
                          </>
                        )}

                        {/* Exemption explanation row — digital gold (single row) */}
                        {showGoldExemptionRow && (
                          <tr className="tc-row-explain">
                            <td>Less: basic exemption</td>
                            <td className="tc-expl-muted">—</td>
                            <td className="tc-col-child tc-expl-exemption">−{fmt(results.childLtcgExemption)}</td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* ROW GROUP 2 — Tax applied */}
                    {showSplitRows && (
                      <>
                        <tr className="tc-group-header tc-group-header--sep">
                          <td colSpan={3}>Tax applied</td>
                        </tr>
                        {hasStcg && (
                          <tr>
                            <td>{stcgRateLabel}</td>
                            <td className="tc-tax-bad">{fmt(results.parentStcgTax)}</td>
                            <td className="tc-col-child">{fmt(results.childStcgTax)}</td>
                          </tr>
                        )}
                        <tr>
                          <td>{ltcgRateLabel}</td>
                          <td className="tc-tax-bad">{fmt(results.parentLtcgTax)}</td>
                          <td className={`tc-col-child${results.taxSaving > 0 ? ' tc-tax-good' : ''}`}>
                            {fmt(results.childLtcgTax)}
                          </td>
                        </tr>
                      </>
                    )}

                    {/* Total tax — end of group 2 for equity, only row for debt/fd */}
                    <tr className={showSplitRows ? 'tc-row-total' : ''}>
                      <td>Total tax on gains</td>
                      <td className="tc-tax-bad">{fmt(results.parentTax)}</td>
                      <td className={`tc-col-child${results.taxSaving > 0 ? ' tc-tax-good' : ''}`}>
                        {fmt(results.childTax)}
                      </td>
                    </tr>

                    {/* ROW GROUP 3 — Result */}
                    <tr className="tc-row-keep">
                      <td><strong>You keep</strong></td>
                      <td><strong>{fmt(results.parentNetCorpus)}</strong></td>
                      <td className={`tc-col-child${results.taxSaving > 0 ? ' tc-tax-good tc-tax-bold' : ''}`}>
                        <strong>{fmt(results.childNetCorpus)}</strong>
                      </td>
                    </tr>

                  </tbody>
                </table>

                {results.taxSaving > 0 ? (
                  <div className="tc-saving-banner">
                    Investing in your child&apos;s name saves <strong>{fmt(results.taxSaving)}</strong> in taxes
                  </div>
                ) : (
                  <div className="tc-no-saving-banner">
                    No tax advantage for <strong>{activeAsset?.label}</strong> in child&apos;s name
                    {results.noSavingReason && (
                      <span className="tc-no-saving__reason"> · {results.noSavingReason}</span>
                    )}
                  </div>
                )}

                {results.explanation && (
                  <div className="tc-expl">
                    <button
                      type="button"
                      className="tc-expl__toggle"
                      onClick={() => setExplOpen(o => !o)}
                      aria-expanded={explOpen}
                    >
                      <span>How is this calculated?</span>
                      <span className={`tc-expl__chevron${explOpen ? ' tc-expl__chevron--open' : ''}`}>▾</span>
                    </button>
                    {explOpen && (
                      <p className="tc-expl__body">{fullExplanation}</p>
                    )}
                  </div>
                )}
              </div>

              {/* ── ZONE C: Milestones card ── */}
              <div className="tc-milestone-card" style={{ '--amber-pale': '#FEF9EC' }}>
                <div className="tc-milestone-card__header">What this corpus can fund</div>
                <div className="tc-milestone-rows">
                  {chips.map((chip, i) => (
                    <div
                      key={i}
                      className={`tc-milestone-row${chip.done ? ' tc-milestone-row--done' : ''}`}
                    >
                      {chip.label}
                    </div>
                  ))}
                </div>
                <div className="tc-milestone-note">
                  (illustrative benchmarks — not financial advice)
                </div>
              </div>

              {/* ── CTA block ── */}
              <div className="tc-cta-block">
                <h3 className="tc-cta-block__heading serif">Start building this corpus today</h3>
                <Link to="/signup" className="btn primary tc-cta-block__btn">
                  Open your child&apos;s investment account
                </Link>
                {NON_MF_TYPES.has(assetClass) && (
                  <p className="tc-cta-block__coming-soon">
                    Taru offers mutual funds today. Gold, stocks, and more coming soon.
                  </p>
                )}
                <p className="tc-cta-block__disclaimer">
                  All calculations are illustrative. Consult a tax advisor for your specific situation.
                </p>
              </div>

            </div>{/* /tc-right-panel */}

          </div>{/* /tc-page-grid */}

          {/* ════ MOBILE-ONLY: Assumptions (after results) ════ */}
          <div className="tc-assumptions tc-assumptions--mobile">
            <div className="tc-assumptions__heading">Assumptions</div>
            <ul className="tc-assumptions__list">
              {assumptions.map((a, i) => (
                <li key={i}>{a}</li>
              ))}
            </ul>
          </div>
        </div>
      </section>

      {/* ── Footer ── */}
      <footer>
        <div className="inner">
          <div className="f-left">
            <Link to="/" className="logo">taru<span className="dot">.</span></Link>
            <div className="copy">&copy; 2026 Taru Money Pvt. Ltd.</div>
          </div>
          <div className="fnav">
            <Link to="/blog">Blogs</Link>
            <Link to="/privacy">Privacy</Link>
            <Link to="/terms">Terms</Link>
          </div>
          <div className="made-tag">
            <span className="flag-dot"></span>
            Made in India, for India
          </div>
        </div>
      </footer>

      <p className="tc-seo-text">
        Investing in your child&apos;s name can significantly reduce your tax burden on capital gains. Under current Indian income tax rules, a child who has turned 18 gets a fresh ₹3 lakh basic exemption and ₹1.25 lakh LTCG exemption under Section 112A — savings that are unavailable when the same investment is held in a parent&apos;s name. This calculator shows you the exact difference across asset classes.
      </p>
    </div>
  )
}
