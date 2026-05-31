require('dotenv').config()
const express = require('express')
const cors = require('cors')
const { createClient } = require('@supabase/supabase-js')

const { requireParentAuth, supabase } = require('./middleware/auth')
const { guardNarration } = require('./lib/narrationGuard')
const casRouter        = require('./routes/cas')
const activityRouter   = require('./routes/activity')
const childrenRouter   = require('./routes/children')
const tasksRouter      = require('./routes/tasks')
const cronRouter       = require('./routes/cron')
const waitlistRouter   = require('./routes/waitlist')
const consentRouter    = require('./routes/consent')

const app = express()
const PORT = process.env.PORT || 3001

// ── Middleware ────────────────────────────────────────────────
const allowedOrigins = [
  process.env.FRONTEND_URL,
  'https://taru.money',
  'https://www.taru.money',
  'http://localhost:5173',
].filter(Boolean)

app.use(cors({
  origin: (origin, callback) => {
    // Allow requests with no origin (curl, Render cron, health checks)
    if (!origin) return callback(null, true)
    if (allowedOrigins.includes(origin)) return callback(null, true)
    callback(new Error(`CORS: origin ${origin} not allowed`))
  },
  credentials: true,
}))
app.use(express.json({ limit: '2mb' }))

// Attach the Supabase admin client to every request
// (activity route and child routes need it without requireParentAuth)
app.use((req, _res, next) => {
  req.supabaseAdmin = supabase
  next()
})

// ── Health check ──────────────────────────────────────────────
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() })
})

// ── Routes ────────────────────────────────────────────────────

// CASParser production routes — rate-limited, richer schema
app.use('/api/cas', requireParentAuth, casRouter)

// Activity logging — resolves actor internally (parent JWT or child token)
app.use('/api/activity', activityRouter)

// Children — token generation (parent auth required)
app.use('/api/children', requireParentAuth, childrenRouter)

// Tasks — mixed auth: child endpoints validate X-Child-Token internally;
// parent endpoints require Supabase JWT (middleware applied per-route in router)
app.use('/api/tasks', tasksRouter)

// Cron — protected by CRON_SECRET bearer token, no Supabase auth
app.use('/api/cron', cronRouter)

// Waitlist — public, no auth required
app.use('/api/waitlist', waitlistRouter)

// Consent — public POST (userId from request body, validated by service role)
app.use('/api/consent', consentRouter)

// ── Child garden data (Step 8) ────────────────────────────────
// Token-gated: child sees only visible fund_tags for their parent.
const jwt = require('jsonwebtoken')

app.get('/api/child/garden', async (req, res) => {
  const token = req.headers['x-child-token']
  if (!token) return res.status(401).json({ error: 'Missing X-Child-Token header' })

  let payload
  try {
    payload = jwt.verify(token, process.env.CHILD_TOKEN_SECRET)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired child token' })
  }

  // Validate token matches DB — single source of truth for revocation
  const { data: child, error: childErr } = await supabase
    .from('children')
    .select('id, name, age_stage, goal_name, goal_amount, goal_date, child_token')
    .eq('id', payload.child_id)
    .maybeSingle()

  if (childErr || !child || child.child_token !== token) {
    return res.status(401).json({ error: 'Child token revoked or invalid' })
  }

  // Return ONLY funds visible to child — query cas_funds, enforce at query level
  const { data: casFunds } = await supabase
    .from('cas_funds')
    .select('isin, scheme_type, current_value, cost, inception_nav, show_in_child_app')
    .eq('user_id', payload.parent_id)
    .eq('show_in_child_app', true)

  const taggedTotal = (casFunds || [])
    .reduce((sum, f) => sum + (parseFloat(f.current_value) || 0), 0)

  const taggedCost = (casFunds || [])
    .reduce((sum, f) => sum + (parseFloat(f.cost) || 0), 0)

  const inceptionGainAbsolute = Math.round(taggedTotal - taggedCost)
  const inceptionGainDirection = inceptionGainAbsolute >= 0 ? 'up' : 'down'

  const { data: learningState } = await supabase
    .from('learning_state')
    .select('current_week, coins_total, xp_total, last_trigger_type, week_completed_at, current_week_started_at')
    .eq('child_id', child.id)
    .maybeSingle()

  // ── Narration guard ────────────────────────────────────────────
  // TODAY: this response contains no strings constructed from cas_funds data —
  // only raw numeric fields (tagged_total, fund_count) and the child's own name.
  // The frontend selects Penny copy entirely from weeklyContent.js and content.json
  // using these numbers as inputs. There is nothing for the guard to intercept right now.
  //
  // PROACTIVE WIRING: the guard is placed here — at the response builder — because
  // this is the natural point where a future developer would add fund-aware text
  // (e.g. "Your [fund name] grew ₹X this month"). When that happens, pass the
  // candidate string through guardNarration() before including it in the response:
  //
  //   const pennyText = guardNarration(candidateText, 'growth_happened')
  //
  // Valid intents: growth_happened | dip_is_normal | streak_milestone |
  //               save_regularly | generic_encouragement
  // guardNarration never throws and always returns a safe renderable string.
  //
  // DO NOT add a fund name, AMC name, ISIN, return projection, or advisory phrase
  // to this response without passing it through guardNarration first.

  res.json({
    child: {
      name: child.name,
      age_stage: child.age_stage,
      goal_name: child.goal_name,
      goal_amount: child.goal_amount,
    },
    tagged_total: taggedTotal,
    fund_count: (casFunds || []).length,
    learning_state: learningState,
  })
})

// ── Child week completion (Step 10) ──────────────────────────
// Handles all DB writes when a child marks a week as done.
// Steps 1–3 are best-effort; step 4 (week advance) controls the response code.
app.post('/api/child/week-complete', async (req, res) => {
  const token = req.headers['x-child-token']
  if (!token) return res.status(401).json({ error: 'Missing X-Child-Token header' })

  let payload
  try {
    payload = jwt.verify(token, process.env.CHILD_TOKEN_SECRET)
  } catch {
    return res.status(401).json({ error: 'Invalid or expired child token' })
  }

  const { data: child } = await supabase
    .from('children')
    .select('id, parent_id, child_token')
    .eq('id', payload.child_id)
    .maybeSingle()

  if (!child || child.child_token !== token) {
    return res.status(401).json({ error: 'Child token revoked or invalid' })
  }

  const { dinner_prompt, topic } = req.body

  // Guard: read current DB state
  const { data: ls } = await supabase
    .from('learning_state')
    .select('current_week, week_completed_at, current_week_started_at')
    .eq('child_id', child.id)
    .maybeSingle()

  const current_week = ls?.current_week ?? 1

  // Already marked done this week — idempotent no-op
  if (ls?.week_completed_at) {
    return res.json({ ok: true, already_done: true })
  }

  const now = new Date().toISOString()

  // Step 1: Persist week_completed_at now — before the 7-day gate — so the
  // button stays disabled on refresh even when the week hasn't advanced yet.
  const { error: s1Err } = await supabase
    .from('learning_state')
    .update({ week_completed_at: now })
    .eq('child_id', child.id)
  if (s1Err) console.error('[week-complete] step 1 error:', s1Err.message)

  // Step 2: Upsert conversation_log — re-completing the same week updates in place
  const { error: s2Err } = await supabase
    .from('conversation_log')
    .upsert(
      {
        parent_id: child.parent_id,
        child_id: child.id,
        week_number: current_week,
        prompt_text: dinner_prompt || '',
        marked_done_at: now,
      },
      { onConflict: 'parent_id,week_number' }
    )
  if (s2Err) console.error('[week-complete] step 2 error:', s2Err.message)

  // Step 3: Activity event — fire-and-forget, non-blocking
  supabase
    .from('activity_events')
    .insert({
      actor_type: 'child',
      child_id: child.id,
      parent_id: child.parent_id,
      event_type: 'week_completed',
      section: 'learn',
      occurred_at: now,
      metadata: { week_number: current_week, topic: topic || null },
    })
    .then(({ error }) => {
      if (error) console.error('[week-complete] step 3 error:', error.message)
    })

  // Step 4: Advance current_week immediately on completion
  const { error: s4Err } = await supabase
    .from('learning_state')
    .update({
      current_week: current_week + 1,
      current_week_started_at: now,
      week_completed_at: null,
    })
    .eq('child_id', child.id)

  if (s4Err) {
    console.error('[week-complete] step 4 error:', s4Err.message)
    return res.status(500).json({ error: 'Failed to advance week' })
  }

  res.json({ ok: true, next_week: current_week + 1 })
})

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Taru backend running on http://localhost:${PORT}`)
})
