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

/* 12-month LTCG threshold: equity MF, equity hybrid MF, direct stocks, ULIP (taxed like equity u/s 111A/112A) */
const LTCG_SPLIT = new Set(['equity_mf', 'hybrid_mf', 'direct_stocks', 'ulip'])

/* Show LTCG/STCG breakdown rows in table and corpus card chips */
const SHOW_SPLIT_ROWS = new Set(['equity_mf', 'hybrid_mf', 'direct_stocks', 'digital_gold', 'ulip'])

/* Asset classes not offered by Taru yet */
const NON_MF_TYPES = new Set(['direct_stocks', 'digital_gold', 'fd_rd', 'ulip'])

/* Child's basic exemption under the new tax regime, FY 2026-27 (₹0–4L @ nil).
   Section 198 (erstwhile 112A) adds a further ₹1.25L LTCG-only exemption for
   equity-type assets, on top of whatever's left of the ₹4L after STCG. */
const CHILD_BASIC_EXEMPTION   = 400000
const CHILD_112A_EXEMPTION    = 125000

/* New tax regime slabs, FY 2026-27 — used for the child's own slab-rate income
   (e.g. debt MF gains realised after they're no longer a minor). */
const NEW_REGIME_SLABS = [
  { upto: 400000,   rate: 0    },
  { upto: 800000,   rate: 0.05 },
  { upto: 1200000,  rate: 0.10 },
  { upto: 1600000,  rate: 0.15 },
  { upto: 2000000,  rate: 0.20 },
  { upto: 2400000,  rate: 0.25 },
  { upto: Infinity, rate: 0.30 },
]

/* Bracket-by-bracket slab computation, exposed for the "how is this
   calculated" breakdown UI on debt MF and gold's STCG (both taxed as
   ordinary slab-rate income for the child under the new-regime slabs +
   Section 156 rebate — unlike equity's special-rate STCG/LTCG). */
function slabTaxBreakdown(income) {
  let prev = 0
  const brackets = []
  for (const { upto, rate } of NEW_REGIME_SLABS) {
    if (income <= prev) break
    const to      = Math.min(income, upto)
    const taxable = to - prev
    brackets.push({ from: prev, to, rate, taxable, tax: taxable * rate })
    prev = upto
  }
  const grossTax = brackets.reduce((sum, b) => sum + b.tax, 0)
  const rebate   = income <= 1200000 ? Math.min(grossTax, 60000) : 0
  return { brackets, grossTax, rebate, netTax: grossTax - rebate }
}

/* Progressive slab tax with Section 156 (erstwhile 87A) rebate — nil tax up to ₹12L total income */
function slabTaxWithRebate(income) {
  return slabTaxBreakdown(income).netTax
}

/* Shared child-side tax for all equity-taxed assets (equity MF, hybrid MF,
   direct stocks, ULIP) — STCG under Sec 196 (erstwhile 111A), LTCG under
   Sec 198 (erstwhile 112A).
   The child's ₹4L basic-exemption shortfall (they have no other income) is
   applied FIRST against STCG — the first proviso to each section allows the
   shortfall to offset that section's own gains, and applying it to the
   20%-taxed STCG before the 12.5%-taxed LTCG minimises total tax, which is
   both the economically rational choice and how ITR utilities sequence the
   adjustment. Any leftover then reduces LTCG, on top of LTCG's own fixed
   ₹1.25L Section 198 exemption (which is available regardless of income). */
function equityStyleChildTax(stcgGains, ltcgGains) {
  const stcgExemption   = Math.min(CHILD_BASIC_EXEMPTION, stcgGains)
  const remainingBasic  = CHILD_BASIC_EXEMPTION - stcgExemption
  const ltcgExemption   = Math.min(CHILD_112A_EXEMPTION + remainingBasic, ltcgGains)
  const stcgTax         = (stcgGains - stcgExemption) * 0.20
  const ltcgTax         = Math.max(0, ltcgGains - ltcgExemption) * 0.125
  return { stcgExemption, ltcgExemption, stcgTax, ltcgTax, childTax: stcgTax + ltcgTax }
}

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
  let childStcgExemption = 0   // amount of STCG shielded for child by exemption
  let childSlabBreakdown = null // bracket-by-bracket detail, debt MF / gold STCG only
  let explanation        = ''
  let noSavingReason     = ''

  switch (assetClass) {
    case 'equity_mf': {
      parentStcgTax = stcgGains * 0.20
      parentLtcgTax = ltcgGains * 0.125
      parentTax     = parentStcgTax + parentLtcgTax
      const c = equityStyleChildTax(stcgGains, ltcgGains)
      childStcgTax = c.stcgTax; childLtcgTax = c.ltcgTax
      childStcgExemption = c.stcgExemption; childLtcgExemption = c.ltcgExemption
      childTax = c.childTax
      explanation = "Equity mutual funds use two tax rates: STCG at 20% (Section 196) for units held under 12 months, and LTCG at 12.5% (Section 198) for units held over 12 months. In a SIP redeemed at age 18, the last 12 monthly instalments qualify as STCG; all earlier instalments qualify as LTCG. Your child has no other income, so their ₹4L basic exemption is unused — the law applies that shortfall to STCG first (taxed at the higher 20% rate, so shielding it saves more), then any leftover tops up LTCG's own fixed ₹1.25L exemption. Together that shields up to ₹5.25L combined, split across both gain types rather than dumped entirely on LTCG."
      break
    }

    case 'hybrid_mf': {
      parentStcgTax = stcgGains * 0.20
      parentLtcgTax = ltcgGains * 0.125
      parentTax     = parentStcgTax + parentLtcgTax
      const c = equityStyleChildTax(stcgGains, ltcgGains)
      childStcgTax = c.stcgTax; childLtcgTax = c.ltcgTax
      childStcgExemption = c.stcgExemption; childLtcgExemption = c.ltcgExemption
      childTax = c.childTax
      explanation = "Equity-oriented hybrid funds (more than 65% in equities) are taxed exactly like equity mutual funds — STCG at 20% (Section 196) and LTCG at 12.5% (Section 198). Your child's unused ₹4L basic exemption is applied to STCG first, then any leftover tops up LTCG's own ₹1.25L exemption — together shielding up to ₹5.25L, since the child has no other income."
      break
    }

    case 'direct_stocks': {
      parentStcgTax = stcgGains * 0.20
      parentLtcgTax = ltcgGains * 0.125
      parentTax     = parentStcgTax + parentLtcgTax
      const c = equityStyleChildTax(stcgGains, ltcgGains)
      childStcgTax = c.stcgTax; childLtcgTax = c.ltcgTax
      childStcgExemption = c.stcgExemption; childLtcgExemption = c.ltcgExemption
      childTax = c.childTax
      explanation = "Listed equity shares follow the same STCG / LTCG rules as equity mutual funds — 20% (Section 196) for units held under 12 months, 12.5% (Section 198) for units held over 12 months. Your child's unused ₹4L basic exemption is applied to STCG first, then any leftover tops up LTCG's own ₹1.25L exemption — together shielding up to ₹5.25L, fresh since the child has no other income."
      break
    }

    case 'debt_mf':
      // Redemption happens at your child's 18th birthday — after they're no
      // longer a minor. Section 99 clubbing only applies to income earned
      // BY a minor, so this one-time gain is taxed as the child's own income,
      // not clubbed with yours. It's slab-rate income (Section 76, specified
      // mutual fund), so it gets the child's progressive new-regime slabs +
      // Section 156 rebate.
      parentTax      = gains * 0.30
      parentLtcgTax  = parentTax
      childSlabBreakdown = slabTaxBreakdown(gains)
      childTax       = childSlabBreakdown.netTax
      childLtcgTax   = childTax
      explanation    = "Debt mutual fund gains (funds with more than 65% in debt/money-market instruments, per the FY 2025-26 redefinition of “specified mutual fund”) are taxed at slab rate under Section 76 (erstwhile Section 50AA) — there's no separate LTCG/STCG rate. Because the corpus is redeemed on your child's 18th birthday, i.e. after they're no longer a minor, this gain is NOT clubbed with your income — Section 99 (erstwhile 64(1A)) clubbing only applies to income a minor earns. It's taxed as your child's own income: assuming they have no other income, the new-regime slabs (nil up to ₹4L, then 5/10/15/20/25/30%) apply, and the Section 156 rebate (erstwhile 87A) makes tax nil up to ₹12L of total income, because this gain is ordinary slab-rate income, not a special-rate one. Your own tax is assumed at the 30% top slab."
      break

    case 'digital_gold': {
      // STCG (last 24 months): ordinary slab-rate income for BOTH — parent assumed
      // at a flat 30% top slab; child gets the progressive new-regime slabs +
      // Section 156 rebate since they have no other income.
      // LTCG (held >24 months): 12.5% flat under Section 197 (erstwhile 112); the
      // child's basic-exemption shortfall (after whatever STCG already used of it)
      // can reduce LTCG — gold gets no equivalent of equity's extra ₹1.25L (Sec 198).
      parentStcgTax = stcgGains * 0.30
      parentLtcgTax = ltcgGains * 0.125
      parentTax     = parentStcgTax + parentLtcgTax

      childSlabBreakdown = slabTaxBreakdown(stcgGains)
      childStcgTax = childSlabBreakdown.netTax
      const shortfall = Math.max(0, CHILD_BASIC_EXEMPTION - stcgGains)
      childLtcgExemption = Math.min(shortfall, ltcgGains)
      childLtcgTax  = Math.max(0, ltcgGains - childLtcgExemption) * 0.125
      childTax      = childStcgTax + childLtcgTax
      explanation   = "Digital gold uses a 24-month holding threshold. Instalments held under 24 months qualify as STCG — this is ordinary slab-rate income, not a concessional rate, so your child (with no other income) pays new-regime slab rates with the Section 156 rebate, while your own tax is assumed at the 30% top slab. Instalments held over 24 months qualify as LTCG, taxed at 12.5% flat under Section 197. Whatever's left of your child's ₹4L basic exemption after covering STCG can shield LTCG too. Note: the extra ₹1.25L exemption under Section 198 applies only to equity-type assets — not gold."
      break
    }

    case 'fd_rd':
      // Interest is taxed annually as it accrues, not just at maturity — so
      // (unlike a redemption-based asset) almost all of it arises while your
      // child is still a minor and gets clubbed with your income every year.
      parentTax      = gains * 0.30
      childTax       = gains * 0.30
      parentLtcgTax  = parentTax
      childLtcgTax   = childTax
      explanation    = "FD/RD interest is taxed annually as it's earned, not at maturity. Since the deposit runs from your child's current age until they turn 18, almost all of that interest accrues while they're still a minor — and under Section 99 (erstwhile 64(1A)), a minor's income is clubbed with the higher-earning parent's income and taxed at their slab rate, regardless of whose name the account is in. Only interest earned after your child turns 18 would be taxed in their own hands, and by then this investment has already matured. So there's effectively no tax advantage to FD/RD in your child's name."
      noSavingReason = "Interest accrues annually and is clubbed with your income while your child is a minor"
      break

    case 'ulip': {
      parentStcgTax = stcgGains * 0.20
      parentLtcgTax = ltcgGains * 0.125
      parentTax     = parentStcgTax + parentLtcgTax
      const c = equityStyleChildTax(stcgGains, ltcgGains)
      childStcgTax = c.stcgTax; childLtcgTax = c.ltcgTax
      childStcgExemption = c.stcgExemption; childLtcgExemption = c.ltcgExemption
      childTax = c.childTax
      explanation = "For ULIPs with annual premium above ₹2.5 lakh, maturity proceeds lose the exemption under Schedule II, Clause 2 (erstwhile Section 10(10D)) and are instead taxed as capital gains under the same rules as equity mutual funds — STCG at 20% (Section 196) for units held under 12 months, LTCG at 12.5% (Section 198) for units held over 12 months. Your child's unused ₹4L basic exemption is applied to STCG first, then any leftover tops up LTCG's own ₹1.25L exemption — together shielding up to ₹5.25L, fresh since the child has no other income."
      break
    }

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
    childStcgExemption,
    childSlabBreakdown,
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

/* Small tap-to-toggle info affordance — deliberately not a hover tooltip,
   since this product is mobile-first and hover doesn't exist on touch.
   Scoped to the handful of exemption/rebate numbers that need context;
   not a sitewide tooltip system. Takes open state + toggle as props so the
   single "which note is open" slot lives in the parent component. */
function InfoIcon({ open, onToggle, text }) {
  return (
    <span className="tc-info-wrap">
      <button
        type="button"
        className="tc-info-icon"
        aria-label="More info"
        aria-expanded={open}
        onClick={(e) => { e.stopPropagation(); onToggle() }}
      >
        i
      </button>
      {open && <span className="tc-info-note">{text}</span>}
    </span>
  )
}

/* Bracket-by-bracket rows for the child's slab computation — desktop
   (3-column <tr>) and mobile (stacked <div>) variants. Parent column is
   always a flat rate, so these only ever populate the child's numbers.
   infoOpen/onInfoToggle are threaded through for the rebate row's InfoIcon. */
function slabBreakdownDesktopRows(breakdown, infoOpen, onInfoToggle) {
  if (!breakdown) return null
  return (
    <>
      {breakdown.brackets.map((b, i) => (
        <tr className="tc-row-explain" key={`slab-d-${i}`}>
          <td>{fmt(b.from)}–{fmt(b.to)} @ {(b.rate * 100).toFixed(0)}%</td>
          <td className="tc-expl-muted">—</td>
          <td className="tc-col-child tc-expl-muted">{fmt(b.tax)}</td>
        </tr>
      ))}
      {breakdown.rebate > 0 && (
        <tr className="tc-row-explain" key="slab-d-rebate">
          <td>
            Less: Section 156 rebate (nil tax up to ₹12L)
            <InfoIcon
              open={infoOpen === 'rebate'}
              onToggle={() => onInfoToggle('rebate')}
              text="This zeroes out tax when your child's total income for the year is ₹12L or less. It only applies to ordinary slab-rate income like this — not to equity's STCG/LTCG, which are taxed at special rates."
            />
          </td>
          <td className="tc-expl-muted">—</td>
          <td className="tc-col-child tc-expl-exemption">−{fmt(breakdown.rebate)}</td>
        </tr>
      )}
    </>
  )
}

function slabBreakdownMobileRows(breakdown, infoOpen, onInfoToggle) {
  if (!breakdown) return null
  return (
    <>
      {breakdown.brackets.map((b, i) => (
        <div className="tc-mobile-row tc-mobile-row--explain" key={`slab-m-${i}`}>
          <span>{fmt(b.from)}–{fmt(b.to)} @ {(b.rate * 100).toFixed(0)}%</span>
          <span>{fmt(b.tax)}</span>
        </div>
      ))}
      {breakdown.rebate > 0 && (
        <div className="tc-mobile-row tc-mobile-row--explain" key="slab-m-rebate">
          <span>
            Less: Section 156 rebate
            <InfoIcon
              open={infoOpen === 'rebate-m'}
              onToggle={() => onInfoToggle('rebate-m')}
              text="This zeroes out tax when your child's total income for the year is ₹12L or less. Only applies to ordinary slab-rate income like this — not equity's special-rate STCG/LTCG."
            />
          </span>
          <span className="tc-expl-exemption">−{fmt(breakdown.rebate)}</span>
        </div>
      )}
    </>
  )
}

const EQUITY_TYPES = new Set(['equity_mf', 'hybrid_mf', 'direct_stocks', 'ulip'])

function getAssumptions(assetClass) {
  const always = [
    'Child has no other income at 18 — their full basic exemption (₹4L, new regime FY26-27) is available.',
    'Returns shown are assumed, not guaranteed — actual returns will vary.',
    'Tax laws are as per current Indian income tax rules and may change.',
  ]

  const equityExtra = [
    'All SIP instalments held over 12 months qualify as LTCG; last 12 months qualify as STCG.',
    "Parent's ₹1.25L LTCG exemption is already used by their own investments.",
    "Child's unused ₹4L basic exemption is applied to STCG first (taxed at 20%, so it saves more there), then any leftover tops up LTCG's own fixed ₹1.25L exemption (Section 198) — up to ₹5.25L shielded in total.",
  ]

  switch (assetClass) {
    case 'equity_mf':
    case 'direct_stocks':
      return [...always, ...equityExtra]

    case 'hybrid_mf':
      return [
        ...always,
        ...equityExtra,
        'Assumes fund has ≥65% equity exposure, qualifying it as equity-oriented. Conservative hybrid funds are taxed differently.',
      ]

    case 'ulip':
      return [
        ...always,
        ...equityExtra,
        'Assumes annual premium exceeds ₹2.5L, so the policy loses its exemption under Schedule II, Clause 2 (erstwhile Section 10(10D)) and is taxed as capital gains instead.',
      ]

    case 'digital_gold':
      return [
        ...always,
        'SIP instalments held over 24 months qualify as LTCG at 12.5% (Section 197); last 24 months qualify as STCG.',
        "Gold's STCG is ordinary slab-rate income, not a concessional rate — the parent's is assumed at the 30% top slab, the child's uses progressive new-regime slabs. Whatever's left of the child's ₹4L basic exemption after covering STCG can shield LTCG too. No separate ₹1.25L exemption — that's equity-only (Section 198).",
      ]

    case 'debt_mf':
      return [
        ...always,
        'Debt MF gains are taxed at slab rate under Section 76 (erstwhile 50AA), regardless of holding period — this applies to funds with more than 65% in debt/money-market instruments. This calculator assumes you (the parent) are in the 30% bracket.',
        "Because redemption happens at your child's 18th birthday — after they're no longer a minor — this gain is NOT clubbed with your income. It's taxed as the child's own income under new-regime slabs, tax-free up to ₹12L thanks to the Section 156 rebate (erstwhile 87A) — this gain is ordinary slab-rate income, so the rebate applies (unlike equity's special-rate gains).",
      ]

    case 'fd_rd':
      return [
        ...always,
        'FD/RD interest is taxed annually as it accrues, at your income tax slab rate. This calculator assumes 30%.',
        "Because interest is taxed each year (not just at maturity), almost all of it accrues while your child is still a minor and gets clubbed with your income under Section 99 (erstwhile 64(1A)) — so there's no tax benefit to FD/RD in your child's name.",
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

  const [monthly,    setMonthly]    = useState(100000)
  const [childAge,   setChildAge]   = useState(5)
  const [returnRate, setReturnRate] = useState(12)
  const [assetClass, setAssetClass] = useState('equity_mf')
  const [explOpen,   setExplOpen]   = useState(false)
  const [gainsOpen,  setGainsOpen]  = useState(false)
  const [taxOpen,    setTaxOpen]    = useState(false)
  const [infoOpen,   setInfoOpen]   = useState(null) // key of the currently-open info note, or null
  const toggleInfo = (key) => setInfoOpen(o => (o === key ? null : key))

  const results       = calculateTaxSavings(monthly, childAge, returnRate, assetClass)
  const investYears   = 18 - childAge
  const activeAsset   = ASSET_CLASSES.find(a => a.id === assetClass)
  const growthMulti   = (results.corpus / results.totalInvested).toFixed(1)
  const chips         = milestones(results.childNetCorpus)
  const showSplitRows = SHOW_SPLIT_ROWS.has(assetClass)
  const hasStcg       = results.stcgGains > 0
  const isSlabAsset    = assetClass === 'debt_mf' // taxed as one slab-rate pool, no STCG/LTCG split
  const hasTaxDetail   = showSplitRows || isSlabAsset // whether "Total tax on gains" can expand at all
  const assumptions   = getAssumptions(assetClass)

  const stcgRateLabel = assetClass === 'digital_gold'
    ? 'STCG tax at slab rate'
    : 'STCG tax @ 20%'
  const ltcgRateLabel = 'LTCG tax @ 12.5%'

  // Equity types that show the two-row exemption explanation
  const EQUITY_EXEMPTION = new Set(['equity_mf', 'hybrid_mf', 'direct_stocks', 'ulip'])
  const showLtcgExemptionRows = EQUITY_EXEMPTION.has(assetClass) && results.childLtcgExemption > 0
  const showStcgExemptionRows = EQUITY_EXEMPTION.has(assetClass) && results.childStcgExemption > 0
  const showGoldExemptionRow  = assetClass === 'digital_gold' && results.childLtcgExemption > 0
  const childLtcgTaxable      = Math.max(0, results.ltcgGains - results.childLtcgExemption)
  const childStcgTaxable      = Math.max(0, results.stcgGains - results.childStcgExemption)

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
        <link rel="canonical" href="https://taru.money/tax-calculator/" />
        <meta property="og:title" content="The best investment you'll ever make is in your child's name." />
        <meta property="og:description" content="See your corpus, your tax bill, and exactly how much you save by investing in your child's name. Live, with your numbers." />
        <meta property="og:url" content="https://taru.money/tax-calculator/" />
        <meta property="og:type" content="website" />
        <meta property="og:image" content="https://taru.money/og-image.png" />

        <meta name="twitter:title" content="The best investment you'll ever make is in your child's name." />
        <meta name="twitter:description" content="See your corpus, your tax bill, and exactly how much you save by investing in your child's name. Live, with your numbers." />
        <meta name="twitter:image" content="https://taru.money/og-image.png" />
      </Helmet>

      {/* ── Navbar ── */}
      <nav className="top" ref={navRef}>
        <div className="inner">
          <Link to="/" className="logo">taru<span className="dot">.</span></Link>
          <div className="nav-links">
            <Link to="/tax-calculator" style={{ opacity: 1, fontWeight: 500 }}>Tax calculator</Link>
            <Link to="/calculator">Milestone calculator</Link>
            <Link to="/blog">Blogs</Link>
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
                        onClick={() => { setAssetClass(ac.id); setExplOpen(false); setGainsOpen(false); setTaxOpen(false); setInfoOpen(null) }}
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

              {/* ── ZONE A: Tax saving hero card ── */}
              <div className="tc-corpus-card">
                <div className="tc-corpus__label">
                  {results.taxSaving > 0 ? "Tax you save in your child's name" : 'Tax saving'}
                </div>
                <div className="tc-corpus__big">
                  {results.taxSaving > 0 ? fmt(results.taxSaving) : '₹0'}
                </div>
                <div className="tc-corpus__sub">
                  {results.taxSaving > 0
                    ? `On a ${fmt(results.corpus)} corpus at 18 — you keep ${fmt(results.childNetCorpus)} instead of ${fmt(results.parentNetCorpus)}`
                    : `No tax saving for ${activeAsset?.label} in your child's name · corpus at 18 is ${fmt(results.corpus)}`}
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
                    <small>corpus at 18</small>
                  </span>
                </div>
                <div className="tc-corpus__growth-note">
                  Grew {growthMulti}× at {returnRate}% p.a. over {investYears} yr{investYears !== 1 ? 's' : ''}
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

                      {/* Taxable gains — single row, expandable */}
                      <div className="tc-mobile-row tc-mobile-row--toggle">
                        {showSplitRows ? (
                          <button type="button" className="tc-row-toggle" onClick={() => setGainsOpen(o => !o)} aria-expanded={gainsOpen}>
                            Taxable gains
                            <span className={`tc-row-chevron${gainsOpen ? ' tc-row-chevron--open' : ''}`}>▾</span>
                          </button>
                        ) : <span className="tc-row-toggle">Taxable gains</span>}
                        <span>{fmt(results.gains)}</span>
                      </div>

                      {showSplitRows && gainsOpen && (
                        <>
                          {hasStcg && (
                            <div className="tc-mobile-row tc-mobile-row--explain">
                              <span>STCG gains</span>
                              <span>{fmt(results.stcgGains)}</span>
                            </div>
                          )}
                          {card.isChild && hasStcg && showStcgExemptionRows && (
                            <>
                              <div className="tc-mobile-row tc-mobile-row--explain">
                                <span>
                                  Less: exemption
                                  <InfoIcon
                                    open={infoOpen === 'stcg-exemption-m'}
                                    onToggle={() => toggleInfo('stcg-exemption-m')}
                                    text="Your child's unused ₹4L basic exemption is applied here first — STCG is taxed at 20% vs LTCG's 12.5%, so shielding STCG first saves more tax overall."
                                  />
                                </span>
                                <span className="tc-expl-exemption">−{fmt(results.childStcgExemption)}</span>
                              </div>
                              <div className="tc-mobile-row tc-mobile-row--explain">
                                <span>STCG taxable after exemption</span>
                                <span className="tc-expl-muted">{fmt(childStcgTaxable)}</span>
                              </div>
                            </>
                          )}
                          <div className="tc-mobile-row tc-mobile-row--explain">
                            <span>LTCG gains</span>
                            <span>{fmt(results.ltcgGains)}</span>
                          </div>
                          {card.isChild && showLtcgExemptionRows && (
                            <>
                              <div className="tc-mobile-row tc-mobile-row--explain">
                                <span>
                                  Less: exemption
                                  <InfoIcon
                                    open={infoOpen === 'ltcg-exemption-m'}
                                    onToggle={() => toggleInfo('ltcg-exemption-m')}
                                    text="Includes the ₹1.25L exemption every investor gets on equity LTCG each year (Section 198), plus whatever's left of your child's ₹4L basic exemption after it's used against STCG."
                                  />
                                </span>
                                <span className="tc-expl-exemption">−{fmt(results.childLtcgExemption)}</span>
                              </div>
                              <div className="tc-mobile-row tc-mobile-row--explain">
                                <span>LTCG taxable after exemption</span>
                                <span className="tc-expl-muted">{fmt(childLtcgTaxable)}</span>
                              </div>
                            </>
                          )}
                          {!card.isChild && (showLtcgExemptionRows || showStcgExemptionRows) && (
                            <div className="tc-mobile-row tc-mobile-row--explain">
                              <span>Less: exemption</span>
                              <span className="tc-expl-muted">— (already used)</span>
                            </div>
                          )}
                          {card.isChild && showGoldExemptionRow && (
                            <div className="tc-mobile-row tc-mobile-row--explain">
                              <span>
                                Less: basic exemption
                                <InfoIcon
                                  open={infoOpen === 'gold-exemption-m'}
                                  onToggle={() => toggleInfo('gold-exemption-m')}
                                  text="Whatever's left of your child's ₹4L basic exemption after covering their STCG can shield LTCG here. Gold doesn't get the extra ₹1.25L that equity investments get."
                                />
                              </span>
                              <span className="tc-expl-exemption">−{fmt(results.childLtcgExemption)}</span>
                            </div>
                          )}
                        </>
                      )}

                      {/* Total tax — single row, expandable */}
                      <div className="tc-mobile-row tc-mobile-row--toggle">
                        {hasTaxDetail ? (
                          <button type="button" className="tc-row-toggle" onClick={() => setTaxOpen(o => !o)} aria-expanded={taxOpen}>
                            <strong>Total tax on gains</strong>
                            <span className={`tc-row-chevron${taxOpen ? ' tc-row-chevron--open' : ''}`}>▾</span>
                          </button>
                        ) : <span className="tc-row-toggle"><strong>Total tax on gains</strong></span>}
                        <span className={card.isChild && results.taxSaving > 0 ? 'tc-tax-good' : (!card.isChild ? 'tc-tax-bad' : '')}>
                          <strong>{fmt(card.totalTax)}</strong>
                        </span>
                      </div>

                      {hasTaxDetail && taxOpen && (
                        <>
                          {showSplitRows && hasStcg && (
                            <div className="tc-mobile-row tc-mobile-row--explain">
                              <span>{stcgRateLabel}</span>
                              <span>{fmt(card.stcgTax)}</span>
                            </div>
                          )}
                          {showSplitRows && assetClass === 'digital_gold' && card.isChild &&
                            slabBreakdownMobileRows(results.childSlabBreakdown, infoOpen, toggleInfo)}
                          {showSplitRows && (
                            <div className="tc-mobile-row tc-mobile-row--explain">
                              <span>{ltcgRateLabel}</span>
                              <span>{fmt(card.ltcgTax)}</span>
                            </div>
                          )}
                          {isSlabAsset && !card.isChild && (
                            <div className="tc-mobile-row tc-mobile-row--explain">
                              <span>Flat 30% (assumed top slab)</span>
                              <span>{fmt(card.totalTax)}</span>
                            </div>
                          )}
                          {isSlabAsset && card.isChild &&
                            slabBreakdownMobileRows(results.childSlabBreakdown, infoOpen, toggleInfo)}
                        </>
                      )}

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

                    {/* Taxable gains — single row, expandable for split assets */}
                    <tr className="tc-row-summary">
                      <td>
                        {showSplitRows ? (
                          <button type="button" className="tc-row-toggle" onClick={() => setGainsOpen(o => !o)} aria-expanded={gainsOpen}>
                            Taxable gains
                            <span className={`tc-row-chevron${gainsOpen ? ' tc-row-chevron--open' : ''}`}>▾</span>
                          </button>
                        ) : <span className="tc-row-toggle">Taxable gains</span>}
                      </td>
                      <td>{fmt(results.gains)}</td>
                      <td className="tc-col-child">{fmt(results.gains)}</td>
                    </tr>

                    {showSplitRows && gainsOpen && (
                      <>
                        {hasStcg && (
                          <tr className="tc-row-explain">
                            <td>STCG gains</td>
                            <td>{fmt(results.stcgGains)}</td>
                            <td className="tc-col-child">{fmt(results.stcgGains)}</td>
                          </tr>
                        )}

                        {/* Exemption explanation rows — STCG, equity / ulip only */}
                        {hasStcg && showStcgExemptionRows && (
                          <>
                            <tr className="tc-row-explain">
                              <td>
                                Less: exemption
                                <InfoIcon
                                  open={infoOpen === 'stcg-exemption'}
                                  onToggle={() => toggleInfo('stcg-exemption')}
                                  text="Your child's unused ₹4L basic exemption is applied here first — STCG is taxed at 20% vs LTCG's 12.5%, so shielding STCG first saves more tax overall."
                                />
                              </td>
                              <td className="tc-expl-muted">— (already used)</td>
                              <td className="tc-col-child tc-expl-exemption">−{fmt(results.childStcgExemption)}</td>
                            </tr>
                            <tr className="tc-row-explain">
                              <td>STCG taxable after exemption</td>
                              <td className="tc-expl-muted">{fmt(results.stcgGains)}</td>
                              <td className="tc-col-child tc-expl-muted">{fmt(childStcgTaxable)}</td>
                            </tr>
                          </>
                        )}

                        <tr className="tc-row-explain">
                          <td>LTCG gains</td>
                          <td>{fmt(results.ltcgGains)}</td>
                          <td className="tc-col-child">{fmt(results.ltcgGains)}</td>
                        </tr>

                        {/* Exemption explanation rows — equity / ulip */}
                        {showLtcgExemptionRows && (
                          <>
                            <tr className="tc-row-explain">
                              <td>
                                Less: exemption
                                <InfoIcon
                                  open={infoOpen === 'ltcg-exemption'}
                                  onToggle={() => toggleInfo('ltcg-exemption')}
                                  text="Includes the ₹1.25L exemption every investor gets on equity LTCG each year (Section 198), plus whatever's left of your child's ₹4L basic exemption after it's used against STCG."
                                />
                              </td>
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
                            <td>
                              Less: basic exemption
                              <InfoIcon
                                open={infoOpen === 'gold-exemption'}
                                onToggle={() => toggleInfo('gold-exemption')}
                                text="Whatever's left of your child's ₹4L basic exemption after covering their STCG can shield LTCG here. Gold doesn't get the extra ₹1.25L that equity investments get — that's equity-only (Section 198)."
                              />
                            </td>
                            <td className="tc-expl-muted">—</td>
                            <td className="tc-col-child tc-expl-exemption">−{fmt(results.childLtcgExemption)}</td>
                          </tr>
                        )}
                      </>
                    )}

                    {/* Total tax on gains — single row, expandable for split + slab assets */}
                    <tr className="tc-row-summary tc-row-total">
                      <td>
                        {hasTaxDetail ? (
                          <button type="button" className="tc-row-toggle" onClick={() => setTaxOpen(o => !o)} aria-expanded={taxOpen}>
                            <strong>Total tax on gains</strong>
                            <span className={`tc-row-chevron${taxOpen ? ' tc-row-chevron--open' : ''}`}>▾</span>
                          </button>
                        ) : <span className="tc-row-toggle"><strong>Total tax on gains</strong></span>}
                      </td>
                      <td className="tc-tax-bad"><strong>{fmt(results.parentTax)}</strong></td>
                      <td className={`tc-col-child${results.taxSaving > 0 ? ' tc-tax-good' : ''}`}>
                        <strong>{fmt(results.childTax)}</strong>
                      </td>
                    </tr>

                    {hasTaxDetail && taxOpen && (
                      <>
                        {showSplitRows && hasStcg && (
                          <tr className="tc-row-explain">
                            <td>{stcgRateLabel}</td>
                            <td>{fmt(results.parentStcgTax)}</td>
                            <td className="tc-col-child">{fmt(results.childStcgTax)}</td>
                          </tr>
                        )}
                        {showSplitRows && assetClass === 'digital_gold' &&
                          slabBreakdownDesktopRows(results.childSlabBreakdown, infoOpen, toggleInfo)}
                        {showSplitRows && (
                          <tr className="tc-row-explain">
                            <td>{ltcgRateLabel}</td>
                            <td>{fmt(results.parentLtcgTax)}</td>
                            <td className="tc-col-child">{fmt(results.childLtcgTax)}</td>
                          </tr>
                        )}
                        {isSlabAsset && (
                          <tr className="tc-row-explain">
                            <td>Flat 30% (assumed top slab)</td>
                            <td>{fmt(results.parentTax)}</td>
                            <td className="tc-col-child tc-expl-muted">—</td>
                          </tr>
                        )}
                        {isSlabAsset &&
                          slabBreakdownDesktopRows(results.childSlabBreakdown, infoOpen, toggleInfo)}
                      </>
                    )}

                    {/* Result */}
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
            <div className="copy">&copy; 2026 NextGenOS Financial Services Private Limited</div>
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
        Investing in your child&apos;s name can significantly reduce your tax burden on capital gains. Under current Indian income tax rules, a child with no other income gets a fresh ₹4 lakh basic exemption plus a ₹1.25 lakh LTCG exemption under Section 198 (erstwhile Section 112A) — savings that are unavailable when the same investment is held in a parent&apos;s name. This calculator shows you the exact difference across asset classes.
      </p>
    </div>
  )
}
