/**
 * Calculator lead capture
 *
 * POST /api/calculator-leads
 * Body: see calculator_leads table schema (migration 014)
 *
 * Public — no auth required.
 * Debounced: a second submission from the same email within 5 minutes
 * returns 200 without inserting again.
 */

const express = require('express')
const { isValidEmail } = require('../lib/validate')

const router = express.Router()

const VALID_GOAL_KEYS = ['edu', 'mar', 'house', 'startup']

router.post('/', async (req, res) => {
  const sb = req.supabaseAdmin

  // ── Validate required fields ──────────────────────────────────
  const rawEmail = req.body?.email
  if (!rawEmail || !isValidEmail(rawEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }

  const goal_key = req.body?.goal_key
  if (!VALID_GOAL_KEYS.includes(goal_key)) {
    return res.status(400).json({ error: `goal_key must be one of: ${VALID_GOAL_KEYS.join(', ')}.` })
  }

  const child_age = parseInt(req.body?.child_age, 10)
  if (isNaN(child_age) || child_age < 0 || child_age > 17) {
    return res.status(400).json({ error: 'child_age must be a number between 0 and 17.' })
  }

  const email = rawEmail.trim().toLowerCase()

  // ── Debounce: same email submitted within the last 5 minutes ──
  const fiveMinutesAgo = new Date(Date.now() - 5 * 60 * 1000).toISOString()

  const { data: recent, error: debounceErr } = await sb
    .from('calculator_leads')
    .select('id')
    .eq('email', email)
    .gte('created_at', fiveMinutesAgo)
    .limit(1)
    .maybeSingle()

  if (debounceErr) {
    console.error('[calculator-leads] debounce check error:', debounceErr.message)
    // Non-fatal: fall through and attempt the insert
  } else if (recent) {
    return res.json({ ok: true, message: 'Already submitted recently.' })
  }

  // ── Build row ─────────────────────────────────────────────────
  const b = req.body

  const row = {
    email,
    child_age,
    goal_key,
    goal_detail:               b.goal_detail               ?? null,
    target_age:                b.target_age != null         ? parseInt(b.target_age, 10)               : null,
    years_to_goal:             b.years_to_goal != null      ? parseInt(b.years_to_goal, 10)            : null,
    today_cost:                b.today_cost != null         ? parseFloat(b.today_cost)                 : null,
    target_corpus:             b.target_corpus != null      ? parseFloat(b.target_corpus)              : null,
    existing_savings_by_asset: b.existing_savings_by_asset ?? null,
    monthly_sip:               b.monthly_sip != null        ? parseFloat(b.monthly_sip)               : null,
    step_up_enabled:           b.step_up_enabled === true,
    step_up_pct:               b.step_up_pct != null        ? parseFloat(b.step_up_pct)               : null,
    on_track_corpus:           b.on_track_corpus != null    ? parseFloat(b.on_track_corpus)            : null,
    gap:                       b.gap != null                ? parseFloat(b.gap)                        : null,
    required_additional_sip:   b.required_additional_sip != null ? parseFloat(b.required_additional_sip) : null,
    funding_pct:               b.funding_pct != null        ? parseFloat(b.funding_pct)               : null,
    source:                    typeof b.source === 'string' ? b.source                                 : 'calculator',
    consent_given:             b.consent_given === true,
    utm_source:                typeof b.utm_source   === 'string' ? b.utm_source   : null,
    utm_medium:                typeof b.utm_medium   === 'string' ? b.utm_medium   : null,
    utm_campaign:              typeof b.utm_campaign === 'string' ? b.utm_campaign : null,
  }

  const { error } = await sb
    .from('calculator_leads')
    .insert(row)

  if (error) {
    console.error('[calculator-leads] insert error:', error.message)
    return res.status(500).json({ error: 'Could not save your details. Please try again.' })
  }

  return res.status(201).json({ ok: true, message: 'Lead captured.' })
})

module.exports = router
