/**
 * CASParser routes — Step 4
 *
 * POST /api/casparser/token          → get short-lived SDK access token
 * POST /api/casparser/parse-pdf      → upload PDF, parse via CASParser, store + process
 * POST /api/casparser/process-widget → called after SDK widget succeeds, process + store
 * GET  /api/casparser/fund-tags      → return current fund_tags for the parent
 * PATCH /api/casparser/fund-tags/:isin → toggle is_visible_to_child
 */

const express  = require('express')
const multer   = require('multer')
const fetch    = require('node-fetch')
const FormData = require('form-data')

const router = express.Router()

const CASPARSER_BASE = 'https://api.casparser.in'

// Keep PDF in memory (max 20 MB) — we forward it to CASParser, never write to disk
const upload = multer({
  storage: multer.memoryStorage(),
  limits:  { fileSize: 20 * 1024 * 1024 },
  fileFilter: (_req, file, cb) => {
    if (file.mimetype === 'application/pdf') cb(null, true)
    else cb(new Error('Only PDF files are accepted'))
  },
})

// ── Token endpoint ────────────────────────────────────────────
// Returns a short-lived at_... access token to the frontend SDK.
// Auth: Supabase session JWT required (already validated by requireParentAuth middleware)
router.post('/token', async (req, res) => {
  if (!process.env.CASPARSER_API_KEY) {
    console.error('[casparser] token: CASPARSER_API_KEY is not set in environment')
    return res.status(500).json({ error: 'CASParser API key not configured on server' })
  }

  try {
    const response = await fetch(`${CASPARSER_BASE}/v1/token`, {
      method:  'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-API-Key':    process.env.CASPARSER_API_KEY,
      },
      body: JSON.stringify({ api_key: process.env.CASPARSER_API_KEY }),
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error('[casparser] token upstream error — HTTP', response.status, '| parentId:', req.parentId, '| CASParser response:', detail)
      return res.status(502).json({ error: 'Failed to get CASParser token', detail })
    }

    const data = await response.json()
    if (!data.access_token) {
      console.error('[casparser] token: CASParser returned OK but no access_token in response:', JSON.stringify(data))
      return res.status(502).json({ error: 'CASParser returned no access token' })
    }
    res.json({ access_token: data.access_token, expires_at: data.expires_at })
  } catch (err) {
    console.error('[casparser] token unexpected error — parentId:', req.parentId, '|', err.message, err.stack)
    res.status(500).json({ error: 'Internal error fetching CASParser token' })
  }
})

// ── PDF parse endpoint ────────────────────────────────────────
// Accepts multipart/form-data { pdf_file, password? }
// Forwards to CASParser, stores result, runs processing pipeline.
router.post('/parse-pdf', upload.single('pdf_file'), async (req, res) => {
  console.log('A. Received PDF upload request')
  if (!req.file) return res.status(400).json({ error: 'No PDF file uploaded' })

  if (!process.env.CASPARSER_API_KEY) {
    console.error('[casparser] parse-pdf: CASPARSER_API_KEY is not set in environment')
    return res.status(500).json({ error: 'CASParser API key not configured on server' })
  }

  try {
    const form = new FormData()
    form.append('file', req.file.buffer, {
      filename:    req.file.originalname || 'statement.pdf',
      contentType: 'application/pdf',
    })
    if (req.body.password) {
      form.append('password', req.body.password)
    }

    const response = await fetch(`${CASPARSER_BASE}/v4/smart/parse`, {
      method:  'POST',
      headers: {
        'X-API-Key': process.env.CASPARSER_API_KEY,
        ...form.getHeaders(),
      },
      body: form,
    })

    if (!response.ok) {
      const detail = await response.text()
      console.error(
        '[casparser] parse-pdf upstream error — HTTP', response.status,
        '| parentId:', req.parentId,
        '| file:', req.file.originalname,
        '| size:', req.file.size,
        '| CASParser response:', detail,
      )
      if (response.status === 413) {
        return res.status(413).json({ error: 'File is too large. Please upload a smaller CAS.' })
      }
      return res.status(502).json({ error: 'CASParser failed to parse the PDF', detail })
    }

    const casData = await response.json()
    console.log('B. CASParser API returned data. Found mutual_funds array length:', casData.mutual_funds?.length)
    const result  = await processPortfolioData(req.supabase, req.parentId, casData, 'pdf_upload')
    res.json(result)
  } catch (err) {
    console.error('[casparser] parse-pdf unexpected error — parentId:', req.parentId, '|', err.message, err.stack)
    res.status(500).json({ error: err.message || 'Failed to parse PDF' })
  }
})

// ── Widget data endpoint ──────────────────────────────────────
// Called from frontend after the CASParser SDK widget succeeds.
// Body: { data: <full CASParser response> }
router.post('/process-widget', async (req, res) => {
  const casData = req.body?.data
  if (!casData) return res.status(400).json({ error: 'Missing data field in request body' })

  try {
    const result = await processPortfolioData(req.supabase, req.parentId, casData, 'casparser_widget')
    res.json(result)
  } catch (err) {
    console.error('process-widget error:', err.message)
    res.status(500).json({ error: 'Failed to process portfolio data' })
  }
})

// ── Get fund tags ─────────────────────────────────────────────
router.get('/fund-tags', async (req, res) => {
  const { data, error } = await req.supabase
    .from('fund_tags')
    .select('id, isin, fund_name, fund_type, is_visible_to_child')
    .eq('parent_id', req.parentId)
    .order('fund_type')
    .order('fund_name')

  if (error) return res.status(500).json({ error: error.message })
  res.json({ fund_tags: data })
})

// ── Toggle fund visibility ────────────────────────────────────
router.patch('/fund-tags/:isin', async (req, res) => {
  const { isin } = req.params
  const { is_visible_to_child } = req.body

  if (typeof is_visible_to_child !== 'boolean') {
    return res.status(400).json({ error: 'is_visible_to_child must be a boolean' })
  }

  const { data, error } = await req.supabase
    .from('fund_tags')
    .update({ is_visible_to_child })
    .eq('parent_id', req.parentId)  // RLS-equivalent enforcement at query level
    .eq('isin', isin)
    .select()
    .single()

  if (error) return res.status(500).json({ error: error.message })
  res.json({ fund_tag: data })
})

// ── Portfolio processing pipeline ─────────────────────────────
async function processPortfolioData(sb, parentId, casData, casType) {
  // 1. Store full CASParser response
  let snapshot
  try {
    const { data, error: snapErr } = await sb
      .from('portfolio_snapshots')
      .insert({
        parent_id:        parentId,
        cas_type:         casType,
        raw_json:         casData,
        statement_period: casData.statement_period
          ? `${casData.statement_period.from} to ${casData.statement_period.to}`
          : null,
      })
      .select('id')
      .single()

    if (snapErr) {
      console.error('[casparser] portfolio_snapshots insert failed | parentId:', parentId, '| message:', snapErr.message, '| details:', snapErr.details, '| hint:', snapErr.hint, '| code:', snapErr.code)
      throw new Error(`Snapshot insert failed: ${snapErr.message}`)
    }
    if (!data?.id) {
      console.error('[casparser] portfolio_snapshots insert returned no row — possible RLS policy block | parentId:', parentId)
      throw new Error('Snapshot insert returned no data — check RLS policies')
    }
    snapshot = data
  } catch (err) {
    if (err.message.startsWith('Snapshot insert')) throw err
    console.error('[casparser] portfolio_snapshots insert unexpected error | parentId:', parentId, '|', err.message)
    throw err
  }

  // 2. Flatten all schemes — handle both CASParser response shapes:
  //    Production : casData.folios[n].schemes[n]  (isin lowercase)
  //    Sandbox    : casData.mutual_funds[n]        (ISIN may be uppercase)
  //    Sandbox alt: casData.mutual_funds[n].schemes[n]
  const schemes = []

  for (const folio of (casData.folios || [])) {
    for (const scheme of (folio.schemes || [])) {
      const isin = scheme.isin || scheme.ISIN
      if (isin) schemes.push({ ...scheme, isin })   // normalise to lowercase key
    }
  }

  for (const fund of (casData.mutual_funds || [])) {
    // Sandbox flat shape — fund object itself is the scheme
    const isin = fund.isin || fund.ISIN
    if (isin) {
      schemes.push({ ...fund, isin })
    } else {
      // Sandbox nested shape — fund has its own .schemes array
      for (const scheme of (fund.schemes || [])) {
        const schemeIsin = scheme.isin || scheme.ISIN
        if (schemeIsin) schemes.push({ ...scheme, isin: schemeIsin })
      }
    }
  }

  console.log('[casparser] schemes extracted:', schemes.length, '| folios in payload:', (casData.folios || []).length, '| mutual_funds in payload:', (casData.mutual_funds || []).length)

  // 3. Load existing fund_tags to preserve is_visible_to_child
  const { data: existing } = await sb
    .from('fund_tags')
    .select('isin, is_visible_to_child')
    .eq('parent_id', parentId)

  const existingMap = Object.fromEntries(
    (existing || []).map(t => [t.isin, t.is_visible_to_child])
  )

  // 4. Upsert fund_tags — default new Equity → visible, others → hidden
  const upsertRows = schemes.map(scheme => {
    const fundType  = classifyFundType(scheme.fund_type || scheme.type || scheme.category)
    const isVisible = scheme.isin in existingMap
      ? existingMap[scheme.isin]
      : fundType === 'Equity'

    return {
      parent_id:           parentId,
      isin:                scheme.isin,
      fund_name:           scheme.scheme || scheme.name || scheme.fund_name || scheme.isin,
      fund_type:           fundType,
      is_visible_to_child: isVisible,
    }
  })

  if (upsertRows.length > 0) {
    console.log('Mapped fund:', upsertRows[0])
  }

  if (upsertRows.length > 0) {
    try {
      const { error: upsertErr } = await sb
        .from('fund_tags')
        .upsert(upsertRows, { onConflict: 'parent_id,isin' })

      if (upsertErr) {
        console.error('[casparser] fund_tags upsert failed | parentId:', parentId, '| rows:', upsertRows.length, '| message:', upsertErr.message, '| details:', upsertErr.details, '| hint:', upsertErr.hint, '| code:', upsertErr.code)
        throw new Error(`Fund tag upsert failed: ${upsertErr.message}`)
      }
    } catch (err) {
      if (err.message.startsWith('Fund tag upsert')) throw err
      console.error('[casparser] fund_tags upsert unexpected error | parentId:', parentId, '|', err.message)
      throw err
    }
  }

  // 5. Compute tagged portfolio total (sum of value for visible funds)
  const { data: visibleTags } = await sb
    .from('fund_tags')
    .select('isin')
    .eq('parent_id', parentId)
    .eq('is_visible_to_child', true)

  const visibleIsins = new Set((visibleTags || []).map(f => f.isin))

  const taggedTotal = schemes
    .filter(s => visibleIsins.has(s.isin))
    .reduce((sum, s) => {
      // Try every known field name across production and sandbox response shapes.
      // Production : s.value | s.valuation.value | s.close_balance_value
      // Sandbox    : s.current_value | s.market_value | fallback nav × units
      const direct = parseFloat(
        s.current_value ??   // sandbox primary
        s.value ??           // production primary
        s.valuation?.value ??
        s.market_value ??
        s.close_balance_value ??
        NaN
      )
      if (!isNaN(direct) && direct > 0) return sum + direct

      // Last resort: compute from NAV × units when no pre-computed value exists
      const nav   = parseFloat(s.nav   ?? s.last_nav     ?? 0)
      const units = parseFloat(s.units ?? s.close_balance ?? s.balance ?? 0)
      return sum + (nav > 0 && units > 0 ? nav * units : 0)
    }, 0)

  // 6. Check goal milestone (25/50/75/100%)
  await checkGoalMilestone(sb, parentId, taggedTotal)

  // 7. Check NAV change trigger (>1% vs previous snapshot, any tagged scheme)
  await checkNavChangeTrigger(sb, parentId, schemes, snapshot.id)

  // 8. Check SIP transaction trigger
  await checkSipTrigger(sb, parentId, schemes)

  console.log('C. Finished processing. Number of funds upserted:', upsertRows.length)
  return {
    snapshot_id:   snapshot.id,
    schemes_found: schemes.length,
    tagged_total:  taggedTotal,
    tags_upserted: upsertRows.length,
  }
}

// ── Trigger checks ────────────────────────────────────────────

function classifyFundType(raw) {
  if (!raw) return 'Other'
  const r = raw.toLowerCase()
  if (r.includes('equity'))                              return 'Equity'
  if (r.includes('debt') || r.includes('liquid') ||
      r.includes('money market') || r.includes('gilt')) return 'Debt'
  if (r.includes('hybrid') || r.includes('balanced') ||
      r.includes('arbitrage'))                          return 'Hybrid'
  return 'Other'
}

async function checkGoalMilestone(sb, parentId, taggedTotal) {
  const { data: child } = await sb
    .from('children')
    .select('id, goal_amount')
    .eq('parent_id', parentId)
    .maybeSingle()

  if (!child?.goal_amount || taggedTotal <= 0) return

  const progress = (taggedTotal / parseFloat(child.goal_amount)) * 100
  const milestones = [25, 50, 75, 100]
  const crossed = [...milestones].reverse().find(m => progress >= m)

  if (crossed) {
    await sb
      .from('learning_state')
      .update({ last_trigger_type: `goal_${crossed}pct` })
      .eq('child_id', child.id)
  }
}

async function checkNavChangeTrigger(sb, parentId, currentSchemes, currentSnapshotId) {
  // Find the previous snapshot
  const { data: prev } = await sb
    .from('portfolio_snapshots')
    .select('id, raw_json')
    .eq('parent_id', parentId)
    .neq('id', currentSnapshotId)
    .order('fetched_at', { ascending: false })
    .limit(1)
    .maybeSingle()

  if (!prev) return

  const prevSchemes = []
  for (const folio of (prev.raw_json?.folios || [])) {
    for (const scheme of (folio.schemes || [])) {
      if (scheme.isin) prevSchemes.push(scheme)
    }
  }

  const prevMap = Object.fromEntries(prevSchemes.map(s => [s.isin, s]))

  for (const scheme of currentSchemes) {
    const prevScheme = prevMap[scheme.isin]
    if (!prevScheme) continue

    const currentNav = parseFloat(scheme.nav ?? scheme.last_nav ?? 0)
    const prevNav    = parseFloat(prevScheme.nav ?? prevScheme.last_nav ?? 0)

    if (prevNav > 0 && Math.abs((currentNav - prevNav) / prevNav) > 0.01) {
      // >1% NAV change on a tagged scheme — update trigger
      const { data: child } = await sb
        .from('children')
        .select('id')
        .eq('parent_id', parentId)
        .maybeSingle()

      if (child) {
        await sb
          .from('learning_state')
          .update({ last_trigger_type: 'nav_change' })
          .eq('child_id', child.id)
      }
      break // one trigger per parse is enough
    }
  }
}

async function checkSipTrigger(sb, parentId, currentSchemes) {
  // Find new PURCHASE_SIP transactions vs previous snapshot
  const { data: prev } = await sb
    .from('portfolio_snapshots')
    .select('raw_json, fetched_at')
    .eq('parent_id', parentId)
    .order('fetched_at', { ascending: false })
    .limit(2)

  if (!prev || prev.length < 2) return

  const prevFetchedAt = new Date(prev[1].fetched_at)

  const hasSip = currentSchemes.some(scheme =>
    (scheme.transactions || []).some(tx => {
      const isSip  = tx.type === 'PURCHASE_SIP' || tx.transaction_type === 'PURCHASE_SIP'
      const isNew  = tx.date ? new Date(tx.date) > prevFetchedAt : false
      return isSip && isNew
    })
  )

  if (hasSip) {
    const { data: child } = await sb
      .from('children')
      .select('id')
      .eq('parent_id', parentId)
      .maybeSingle()

    if (child) {
      await sb
        .from('learning_state')
        .update({ last_trigger_type: 'sip_purchase' })
        .eq('child_id', child.id)
    }
  }
}

module.exports = router
