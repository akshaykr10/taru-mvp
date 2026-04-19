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
  const controller = new AbortController()
  const timeout    = setTimeout(() => controller.abort(), 10_000)

  let res
  try {
    res = await fetch(AMFI_NAV_URL, {
      signal:  controller.signal,
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36' },
    })
  } finally {
    clearTimeout(timeout)
  }

  console.log(`[nav-update] AMFI HTTP status: ${res.status}`)
  if (!res.ok) throw new Error(`AMFI fetch failed: HTTP ${res.status}`)

  const text = await res.text()
  console.log(`[nav-update] AMFI response length: ${text.length} chars`)
  console.log(`[nav-update] AMFI response preview: ${text.slice(0, 500)}`)

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

  return { navMap, rawLength: text.length }
}

async function updateAllNavs() {
  // 1. Fetch AMFI NAV feed
  const { navMap, rawLength } = await fetchAmfiNavMap()
  const amfiCount = Object.keys(navMap).length
  console.log(`[nav-update] AMFI feed parsed: ${amfiCount} ISINs`)

  // 2. Load all cas_funds rows.
  //    We need the full row to build valid upsert records — fund_name is NOT NULL
  //    in the schema, so a partial upsert row would fail on any conflict-miss insert.
  //    inception_nav and inception_date are included so we can preserve them if set.
  const { data: funds, error: fundsErr } = await supabase
    .from('cas_funds')
    .select(
      'user_id, isin, folio_number, fund_name, amc, scheme_type, ' +
      'units, cost, gain_absolute, gain_percentage, show_in_child_app, portfolio_id, ' +
      'inception_nav, inception_date'
    )

  if (fundsErr) throw new Error(`Failed to query cas_funds: ${fundsErr.message}`)

  const allFunds   = funds || []
  const totalIsins = new Set(allFunds.map(f => f.isin)).size
  console.log(`[nav-update] cas_funds distinct ISINs: ${totalIsins}`)

  // Today's date in YYYY-MM-DD used for nav_history and first-time inception_date.
  const today = new Date().toISOString().split('T')[0]

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
      // Preserve inception_nav/date once set — never overwrite with a later value.
      // For new funds (inception_nav is null), today's NAV becomes the inception baseline.
      inception_nav:     fund.inception_nav  ?? newNav,
      inception_date:    fund.inception_date ?? today,
    })
  }

  const matchedIsins = new Set(rows.map(r => r.isin)).size
  console.log(`[nav-update] ISINs matched in AMFI feed: ${matchedIsins}`)

  if (rows.length === 0) {
    const summary = { amfi_isins: amfiCount, cas_isins: totalIsins, matched: 0, updated: 0, amfi_raw_length: rawLength }
    console.log('[nav-update] nothing to update:', summary)
    return summary
  }

  // 4. Record today's NAV in nav_history before overwriting cas_funds.
  //    insert() with count:'exact' returns the number of rows actually written.
  //    A unique-constraint error on re-run is logged but does not abort the job.
  const historyRows = rows.map(r => ({
    user_id:      r.user_id,
    isin:         r.isin,
    folio_number: r.folio_number,
    nav:          r.nav,
    nav_date:     today,
  }))
  const { error: histErr, count: histCount } = await supabase
    .from('nav_history')
    .insert(historyRows, { count: 'exact' })
  if (histErr) console.error('[nav-update] nav_history insert failed:', histErr.message)
  else console.log(`[nav-update] nav_history inserted: ${histCount} rows`)

  // 5. Single batched upsert — one DB round-trip for all matched rows
  const { error: upsertErr } = await supabase
    .from('cas_funds')
    .upsert(rows, { onConflict: 'user_id,isin,folio_number' })

  if (upsertErr) throw new Error(`NAV upsert failed: ${upsertErr.message}`)

  const summary = {
    amfi_isins:      amfiCount,
    cas_isins:       totalIsins,
    matched:         matchedIsins,
    updated:         rows.length,
    amfi_raw_length: rawLength,
  }
  console.log('[nav-update] complete:', summary)
  return summary
}

module.exports = { updateAllNavs }
