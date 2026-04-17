/**
 * CASParser production routes — /api/cas/*
 *
 * GET  /api/cas/status      → rate-limit state + fund count
 * POST /api/cas/token       → short-lived SDK access token (rate-limit gated)
 * POST /api/cas/save        → store SDK onSuccess payload
 * POST /api/cas/upload      → PDF upload → parse → store
 * GET  /api/cas/funds       → list cas_funds for parent
 * PATCH /api/cas/funds/:id  → toggle show_in_child_app
 */

const express  = require('express')
const multer   = require('multer')
const fetch    = require('node-fetch')
const FormData = require('form-data')

const router = express.Router()

const CASPARSER_BASE  = 'https://api.casparser.in'
const RATE_LIMIT_DAYS = 14
const RATE_LIMIT_MS   = RATE_LIMIT_DAYS * 24 * 60 * 60 * 1000

const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files are accepted'))
  },
})

// ── Rate-limit helper ─────────────────────────────────────────
// Returns the status of the 14-day rolling window for this user.
// Only status='success' rows count toward the quota.
async function getRateLimitStatus(sb, userId) {
  const windowStart = new Date(Date.now() - RATE_LIMIT_MS).toISOString()
  const { data } = await sb
    .from('cas_fetch_log')
    .select('fetched_at')
    .eq('user_id', userId)
    .eq('status', 'success')
    .gte('fetched_at', windowStart)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!data) return { is_rate_limited: false }

  const lastFetchedAt   = new Date(data.fetched_at)
  const nextAvailableAt = new Date(lastFetchedAt.getTime() + RATE_LIMIT_MS)
  return {
    is_rate_limited:   true,
    last_fetched_at:   lastFetchedAt.toISOString(),
    next_available_at: nextAvailableAt.toISOString(),
  }
}

// ── GET /api/cas/status ───────────────────────────────────────
router.get('/status', async (req, res) => {
  try {
    const [rateStatus, countResult] = await Promise.all([
      getRateLimitStatus(req.supabase, req.parentId),
      req.supabase
        .from('cas_funds')
        .select('id', { count: 'exact', head: true })
        .eq('user_id', req.parentId),
    ])
    res.json({ ...rateStatus, fund_count: countResult.count || 0 })
  } catch (err) {
    console.error('[cas] status error:', err.message)
    res.status(500).json({ error: 'Failed to load portfolio status' })
  }
})

// ── POST /api/cas/token ───────────────────────────────────────
router.post('/token', async (req, res) => {
  if (!process.env.CASPARSER_API_KEY) {
    console.error('[cas] token: CASPARSER_API_KEY not set')
    return res.status(500).json({ error: 'CASParser API key not configured on server' })
  }

  const rateStatus = await getRateLimitStatus(req.supabase, req.parentId)
  if (rateStatus.is_rate_limited) {
    return res.status(429).json(rateStatus)
  }

  try {
    const response = await fetch(`${CASPARSER_BASE}/v1/token`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key':    process.env.CASPARSER_API_KEY,
      },
      body: JSON.stringify({ expiry_minutes: 60 }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('[cas] token upstream error HTTP', response.status, '| parentId:', req.parentId, '|', detail)
      return res.status(502).json({ error: 'Failed to get CASParser token', detail })
    }

    const data = await response.json()
    if (!data.access_token) {
      console.error('[cas] token: CASParser returned no access_token:', JSON.stringify(data))
      return res.status(502).json({ error: 'CASParser returned no access token' })
    }

    res.json({ access_token: data.access_token, expires_at: data.expires_at })
  } catch (err) {
    console.error('[cas] token unexpected error | parentId:', req.parentId, '|', err.message)
    res.status(500).json({ error: 'Internal error fetching token' })
  }
})

// ── POST /api/cas/save ────────────────────────────────────────
// Called by frontend after SDK onSuccess fires.
// Body: full CASParser response object.
router.post('/save', async (req, res) => {
  const casData = req.body
  if (!casData || (!casData.mutual_funds && !casData.folios)) {
    return res.status(400).json({ error: 'Invalid CASParser response — missing fund data' })
  }

  try {
    const result = await saveCasData(req.supabase, req.parentId, casData, 'sdk')
    res.json(result)
  } catch (err) {
    await req.supabase
      .from('cas_fetch_log')
      .insert({ user_id: req.parentId, method: 'sdk', status: 'failed' })
    console.error('[cas] save error | parentId:', req.parentId, '|', err.message)
    res.status(500).json({ error: err.message || 'Failed to save portfolio' })
  }
})

// ── POST /api/cas/upload ──────────────────────────────────────
// Accepts multipart { pdf_file, password? }, parses via CASParser,
// then runs the same save pipeline as /save.
router.post('/upload', upload.single('pdf_file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' })

  if (!process.env.CASPARSER_API_KEY) {
    console.error('[cas] upload: CASPARSER_API_KEY not set')
    return res.status(500).json({ error: 'CASParser API key not configured on server' })
  }

  const rateStatus = await getRateLimitStatus(req.supabase, req.parentId)
  if (rateStatus.is_rate_limited) {
    return res.status(429).json(rateStatus)
  }

  try {
    const form = new FormData()
    form.append('file', req.file.buffer, {
      filename:    req.file.originalname || 'statement.pdf',
      contentType: 'application/pdf',
    })
    if (req.body.password) form.append('password', req.body.password)

    const response = await fetch(`${CASPARSER_BASE}/v4/smart/parse`, {
      method:  'POST',
      headers: {
        'x-api-key': process.env.CASPARSER_API_KEY,
        ...form.getHeaders(),
      },
      body: form,
    })

    if (!response.ok) {
      const detail = await response.text()
      await req.supabase
        .from('cas_fetch_log')
        .insert({ user_id: req.parentId, method: 'pdf', status: 'failed' })
      console.error('[cas] upload upstream HTTP', response.status, '| parentId:', req.parentId, '|', detail)
      if (response.status === 413) {
        return res.status(413).json({ error: 'File is too large. Please upload a smaller CAS.' })
      }
      return res.status(502).json({ error: 'CASParser failed to parse the PDF', detail })
    }

    const casData = await response.json()
    const result  = await saveCasData(req.supabase, req.parentId, casData, 'pdf')
    res.json(result)
  } catch (err) {
    await req.supabase
      .from('cas_fetch_log')
      .insert({ user_id: req.parentId, method: 'pdf', status: 'failed' })
    console.error('[cas] upload unexpected error | parentId:', req.parentId, '|', err.message)
    res.status(500).json({ error: err.message || 'Failed to parse PDF' })
  }
})

// ── GET /api/cas/funds ────────────────────────────────────────
router.get('/funds', async (req, res) => {
  const { data, error } = await req.supabase
    .from('cas_funds')
    .select('id, folio_number, amc, fund_name, isin, scheme_type, units, nav, current_value, show_in_child_app')
    .eq('user_id', req.parentId)
    .order('scheme_type')
    .order('fund_name')

  if (error) return res.status(500).json({ error: error.message })
  res.json({ funds: data || [] })
})

// ── PATCH /api/cas/funds/:id ──────────────────────────────────
router.patch('/funds/:id', async (req, res) => {
  const { id } = req.params
  const { show_in_child_app } = req.body

  if (typeof show_in_child_app !== 'boolean') {
    return res.status(400).json({ error: 'show_in_child_app must be a boolean' })
  }

  const { data, error } = await req.supabase
    .from('cas_funds')
    .update({ show_in_child_app })
    .eq('user_id', req.parentId)  // ownership enforced at query level
    .eq('id', id)
    .select('id, show_in_child_app')
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ fund: data })
})

// ── Core save pipeline ────────────────────────────────────────
async function saveCasData(sb, userId, casData, method) {
  // 1. Store full CASParser snapshot
  const casType = casData.meta?.cas_type || (method === 'pdf' ? 'pdf_upload' : 'casparser_widget')
  const { data: portfolio, error: portfolioErr } = await sb
    .from('cas_portfolio')
    .insert({ user_id: userId, cas_type: casType, raw_json: casData })
    .select('id')
    .single()

  if (portfolioErr) throw new Error(`Portfolio insert failed: ${portfolioErr.message}`)

  // 2. Flatten schemes from production (folios[]) and sandbox (mutual_funds[]) shapes
  const schemes = flattenSchemes(casData)

  if (schemes.length === 0) {
    await sb.from('cas_fetch_log').insert({ user_id: userId, method, status: 'success' })
    return { portfolio_id: portfolio.id, funds_saved: 0, tagged_total: 0 }
  }

  // 3. Load existing show_in_child_app values so upsert doesn't reset them
  const { data: existing } = await sb
    .from('cas_funds')
    .select('isin, folio_number, show_in_child_app')
    .eq('user_id', userId)

  const existingMap = {}
  for (const row of (existing || [])) {
    existingMap[`${row.isin}::${row.folio_number}`] = row.show_in_child_app
  }

  // 4. Build upsert rows — Equity visible by default, others hidden
  const rows = schemes.map(s => {
    const key        = `${s.isin}::${s.folio_number}`
    const defaultVis = s.scheme_type === 'Equity'
    return {
      portfolio_id:      portfolio.id,
      user_id:           userId,
      folio_number:      s.folio_number,
      amc:               s.amc || null,
      fund_name:         s.fund_name,
      isin:              s.isin,
      scheme_type:       s.scheme_type,
      units:             s.units,
      nav:               s.nav,
      current_value:     s.current_value,
      cost:              s.cost,
      gain_absolute:     s.gain_absolute,
      gain_percentage:   s.gain_percentage,
      show_in_child_app: key in existingMap ? existingMap[key] : defaultVis,
    }
  })

  // Deduplicate within the batch — same ISIN can appear multiple times in a CAS
  // (e.g. duplicate scheme entries). Keep the last occurrence of each key.
  const rowMap = new Map()
  for (const row of rows) rowMap.set(`${row.isin}::${row.folio_number}`, row)
  const dedupedRows = Array.from(rowMap.values())

  const { error: upsertErr } = await sb
    .from('cas_funds')
    .upsert(dedupedRows, { onConflict: 'user_id,isin,folio_number' })

  if (upsertErr) throw new Error(`Fund upsert failed: ${upsertErr.message}`)

  // 5. Log success
  await sb.from('cas_fetch_log').insert({ user_id: userId, method, status: 'success' })

  // 6. Compute tagged total for trigger checks
  const { data: visibleFunds } = await sb
    .from('cas_funds')
    .select('current_value')
    .eq('user_id', userId)
    .eq('show_in_child_app', true)

  const taggedTotal = (visibleFunds || [])
    .reduce((sum, f) => sum + (parseFloat(f.current_value) || 0), 0)

  // 7. Trigger checks (goal milestone, NAV change, SIP purchase)
  await Promise.all([
    checkGoalMilestone(sb, userId, taggedTotal),
    checkNavChangeTrigger(sb, userId, schemes, portfolio.id),
    checkSipTrigger(sb, userId, schemes),
  ])

  console.log('[cas] save complete | parentId:', userId, '| funds:', dedupedRows.length, '| tagged_total:', taggedTotal)
  return { portfolio_id: portfolio.id, funds_saved: dedupedRows.length, tagged_total: taggedTotal }
}

// ── Scheme flattening ─────────────────────────────────────────
// Handles production (folios[].schemes[]) and sandbox (mutual_funds[]) shapes.
function flattenSchemes(casData) {
  const schemes = []

  for (const folio of (casData.folios || [])) {
    const folioNumber = folio.folio || folio.folio_number || ''
    const amc         = folio.amc || folio.registrar || null
    for (const scheme of (folio.schemes || [])) {
      const isin = scheme.isin || scheme.ISIN
      if (isin) schemes.push(normaliseScheme(scheme, folioNumber, amc))
    }
  }

  for (const fund of (casData.mutual_funds || [])) {
    const isin = fund.isin || fund.ISIN
    if (isin) {
      schemes.push(normaliseScheme(fund, '', null))
    } else {
      for (const scheme of (fund.schemes || [])) {
        const schemeIsin = scheme.isin || scheme.ISIN
        if (schemeIsin) schemes.push(normaliseScheme(scheme, '', fund.amc || null))
      }
    }
  }

  return schemes
}

function normaliseScheme(scheme, folioNumber, amc) {
  const isin  = scheme.isin || scheme.ISIN
  const nav   = parseFloat(scheme.nav   ?? scheme.last_nav   ?? NaN)
  const units = parseFloat(scheme.units ?? scheme.close_balance ?? scheme.balance ?? NaN)

  let currentValue = parseFloat(
    scheme.value          ??
    scheme.valuation?.value ??
    scheme.current_value  ??
    scheme.market_value   ??
    scheme.close_balance_value ?? NaN
  )
  if (isNaN(currentValue) && !isNaN(nav) && !isNaN(units)) currentValue = nav * units

  const cost           = parseFloat(scheme.cost ?? scheme.invested_value ?? scheme.purchase_cost ?? NaN)
  const gainAbsolute   = parseFloat(scheme.gain?.absolute   ?? scheme.gain_absolute   ?? NaN)
  const gainPercentage = parseFloat(scheme.gain?.percentage ?? scheme.gain_percentage ?? NaN)

  return {
    isin,
    folio_number:    folioNumber,
    amc:             amc || scheme.amc || null,
    fund_name:       scheme.scheme || scheme.name || scheme.fund_name || isin,
    scheme_type:     classifyFundType(scheme.type || scheme.fund_type || scheme.category),
    units:           isNaN(units)           ? null : units,
    nav:             isNaN(nav)             ? null : nav,
    current_value:   isNaN(currentValue)    ? null : currentValue,
    cost:            isNaN(cost)            ? null : cost,
    gain_absolute:   isNaN(gainAbsolute)    ? null : gainAbsolute,
    gain_percentage: isNaN(gainPercentage)  ? null : gainPercentage,
    transactions:    scheme.transactions    || [],
  }
}

function classifyFundType(raw) {
  if (!raw) return 'Other'
  const r = raw.toLowerCase()
  if (r.includes('equity'))                                        return 'Equity'
  if (r.includes('debt') || r.includes('liquid') ||
      r.includes('money market') || r.includes('gilt'))           return 'Debt'
  if (r.includes('hybrid') || r.includes('balanced') ||
      r.includes('arbitrage'))                                     return 'Hybrid'
  return 'Other'
}

// ── Trigger checks ────────────────────────────────────────────

async function checkGoalMilestone(sb, userId, taggedTotal) {
  const { data: child } = await sb
    .from('children')
    .select('id, goal_amount')
    .eq('parent_id', userId)
    .maybeSingle()

  if (!child?.goal_amount || taggedTotal <= 0) return

  const progress = (taggedTotal / parseFloat(child.goal_amount)) * 100
  const crossed  = [100, 75, 50, 25].find(m => progress >= m)

  if (crossed) {
    await sb
      .from('learning_state')
      .update({ last_trigger_type: `goal_${crossed}pct` })
      .eq('child_id', child.id)
  }
}

async function checkNavChangeTrigger(sb, userId, currentSchemes, currentPortfolioId) {
  // Use the second-most-recent portfolio's raw_json for NAV comparison.
  // The current portfolio was just inserted so limit(2) gives [current, previous].
  const { data: portfolios } = await sb
    .from('cas_portfolio')
    .select('id, raw_json')
    .eq('user_id', userId)
    .order('fetched_at', { ascending: false })
    .limit(2)

  if (!portfolios || portfolios.length < 2) return

  const prevRaw     = portfolios[1].raw_json
  const prevSchemes = flattenSchemes(prevRaw)
  const prevNavMap  = Object.fromEntries(prevSchemes.map(s => [s.isin, s.nav]))

  for (const scheme of currentSchemes) {
    const prevNav    = prevNavMap[scheme.isin]
    const currentNav = scheme.nav
    if (!prevNav || !currentNav || prevNav === 0) continue
    if (Math.abs((currentNav - prevNav) / prevNav) > 0.01) {
      const { data: child } = await sb
        .from('children').select('id').eq('parent_id', userId).maybeSingle()
      if (child) {
        await sb.from('learning_state')
          .update({ last_trigger_type: 'nav_change' }).eq('child_id', child.id)
      }
      break
    }
  }
}

async function checkSipTrigger(sb, userId, currentSchemes) {
  // Get the previous successful fetch time to detect new SIP transactions
  const { data: prevLogs } = await sb
    .from('cas_fetch_log')
    .select('fetched_at')
    .eq('user_id', userId)
    .eq('status', 'success')
    .order('fetched_at', { ascending: false })
    .limit(2)

  if (!prevLogs || prevLogs.length < 2) return
  const prevFetchedAt = new Date(prevLogs[1].fetched_at)

  const hasSip = currentSchemes.some(scheme =>
    (scheme.transactions || []).some(tx => {
      const isSip = tx.type === 'PURCHASE_SIP' || tx.transaction_type === 'PURCHASE_SIP'
      const isNew = tx.date ? new Date(tx.date) > prevFetchedAt : false
      return isSip && isNew
    })
  )

  if (hasSip) {
    const { data: child } = await sb
      .from('children').select('id').eq('parent_id', userId).maybeSingle()
    if (child) {
      await sb.from('learning_state')
        .update({ last_trigger_type: 'sip_purchase' }).eq('child_id', child.id)
    }
  }
}

module.exports = router
