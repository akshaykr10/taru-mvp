/**
 * NAV update job.
 *
 * Daily frequency is correct: AMFI declares each fund's NAV exactly once per
 * business day (post market close, ~7–8pm IST). Running more frequently would
 * re-fetch the same data; less frequently would show stale values to children
 * the next morning.
 */
const fetch   = require('node-fetch')
const { supabase } = require('../middleware/auth')

const AMFI_NAV_URL = 'https://www.amfiindia.com/spages/NAVAll.txt'

// Returns a map of { isin -> nav } parsed from the AMFI NAVAll.txt feed.
async function fetchAmfiNavMap() {
  const res = await fetch(AMFI_NAV_URL)
  if (!res.ok) throw new Error(`AMFI fetch failed: HTTP ${res.status}`)

  const text   = await res.text()
  const navMap = {}

  // File is pipe-delimited with Windows line endings (\r\n).
  // Data line format: SchemeCode|ISINGrowth|ISINDivReinvestment|SchemeName|NAV|Date
  // Non-data lines (section headers, blank lines) either lack pipes or have < 5 fields.
  for (const rawLine of text.split('\r\n')) {
    const line = rawLine.trim()
    if (!line || !line.includes('|')) continue

    const parts = line.split('|')
    if (parts.length < 5) continue

    const isinGrowth   = parts[1].trim()
    const isinDivReinv = parts[2].trim()
    const navStr       = parts[4].trim()

    // "N.A." appears for schemes with no declared NAV (e.g. suspended/wind-down)
    if (!navStr || navStr === 'N.A.') continue

    const nav = parseFloat(navStr)
    if (isNaN(nav)) continue

    if (isinGrowth   && isinGrowth   !== '-') navMap[isinGrowth]   = nav
    if (isinDivReinv && isinDivReinv !== '-' && isinDivReinv !== isinGrowth) {
      navMap[isinDivReinv] = nav
    }
  }

  return navMap
}

async function updateAllNavs() {
  // 1. Fetch AMFI NAV feed
  const navMap    = await fetchAmfiNavMap()
  const amfiCount = Object.keys(navMap).length
  console.log(`[nav-update] AMFI feed parsed: ${amfiCount} ISINs`)

  // 2. Load all cas_funds rows.
  //    We need the full row to build valid upsert records — fund_name is NOT NULL
  //    in the schema, so a partial upsert row would fail on any conflict-miss insert.
  const { data: funds, error: fundsErr } = await supabase
    .from('cas_funds')
    .select(
      'user_id, isin, folio_number, fund_name, amc, scheme_type, ' +
      'units, cost, gain_absolute, gain_percentage, show_in_child_app, portfolio_id'
    )

  if (fundsErr) throw new Error(`Failed to query cas_funds: ${fundsErr.message}`)

  const allFunds   = funds || []
  const totalIsins = new Set(allFunds.map(f => f.isin)).size
  console.log(`[nav-update] cas_funds distinct ISINs: ${totalIsins}`)

  // 3. Build upsert rows only for ISINs that match the AMFI feed.
  //    ISINs with no match (stale/delisted funds) are left untouched.
  const rows = []
  for (const fund of allFunds) {
    const newNav = navMap[fund.isin]
    if (newNav === undefined) continue

    rows.push({
      user_id:           fund.user_id,
      isin:              fund.isin,
      folio_number:      fund.folio_number,
      fund_name:         fund.fund_name,
      amc:               fund.amc,
      scheme_type:       fund.scheme_type,
      units:             fund.units,
      cost:              fund.cost,
      gain_absolute:     fund.gain_absolute,
      gain_percentage:   fund.gain_percentage,
      show_in_child_app: fund.show_in_child_app,
      portfolio_id:      fund.portfolio_id,
      nav:               newNav,
      current_value:     fund.units != null ? parseFloat(fund.units) * newNav : null,
    })
  }

  const matchedIsins = new Set(rows.map(r => r.isin)).size
  console.log(`[nav-update] ISINs matched in AMFI feed: ${matchedIsins}`)

  if (rows.length === 0) {
    const summary = { amfi_isins: amfiCount, cas_isins: totalIsins, matched: 0, updated: 0 }
    console.log('[nav-update] nothing to update:', summary)
    return summary
  }

  // 4. Single batched upsert — one DB round-trip for all matched rows
  const { error: upsertErr } = await supabase
    .from('cas_funds')
    .upsert(rows, { onConflict: 'user_id,isin,folio_number' })

  if (upsertErr) throw new Error(`NAV upsert failed: ${upsertErr.message}`)

  const summary = {
    amfi_isins: amfiCount,
    cas_isins:  totalIsins,
    matched:    matchedIsins,
    updated:    rows.length,
  }
  console.log('[nav-update] complete:', summary)
  return summary
}

module.exports = { updateAllNavs }
