require('dotenv').config()
const express   = require('express')
const cors      = require('cors')
const { createClient } = require('@supabase/supabase-js')

const { requireParentAuth, supabase } = require('./middleware/auth')
const casparsersRouter = require('./routes/casparser')
const casRouter        = require('./routes/cas')
const activityRouter   = require('./routes/activity')
const childrenRouter   = require('./routes/children')
const tasksRouter      = require('./routes/tasks')

const app  = express()
const PORT = process.env.PORT || 3001

// ── Middleware ────────────────────────────────────────────────
app.use(cors({
  origin: process.env.FRONTEND_URL || 'http://localhost:5173',
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

// CASParser legacy routes (preserved)
app.use('/api/casparser', requireParentAuth, casparsersRouter)

// CASParser production routes — rate-limited, richer schema
app.use('/api/cas', requireParentAuth, casRouter)

// Activity logging — resolves actor internally (parent JWT or child token)
app.use('/api/activity', activityRouter)

// Children — token generation (parent auth required)
app.use('/api/children', requireParentAuth, childrenRouter)

// Tasks — mixed auth: child endpoints validate X-Child-Token internally;
// parent endpoints require Supabase JWT (middleware applied per-route in router)
app.use('/api/tasks', tasksRouter)

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
    .select('isin, scheme_type, current_value, show_in_child_app')
    .eq('user_id', payload.parent_id)
    .eq('show_in_child_app', true)

  const taggedTotal = (casFunds || [])
    .reduce((sum, f) => sum + (parseFloat(f.current_value) || 0), 0)

  const { data: learningState } = await supabase
    .from('learning_state')
    .select('current_week, coins_total, xp_total, last_trigger_type, week_completed_at, current_week_started_at')
    .eq('child_id', child.id)
    .maybeSingle()

  res.json({
    child: {
      name:        child.name,
      age_stage:   child.age_stage,
      goal_name:   child.goal_name,
      goal_amount: child.goal_amount,
    },
    tagged_total:   taggedTotal,
    fund_count:     (casFunds || []).length,
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

  const { current_week, dinner_prompt, topic } = req.body
  if (!current_week || typeof current_week !== 'number') {
    return res.status(400).json({ error: 'current_week (number) is required' })
  }

  // Guard: read current DB state to enforce once-per-week rule
  const { data: ls } = await supabase
    .from('learning_state')
    .select('week_completed_at, current_week_started_at')
    .eq('child_id', child.id)
    .maybeSingle()

  // Already marked done this week — idempotent no-op
  if (ls?.week_completed_at) {
    return res.json({ ok: true, already_done: true })
  }

  // 7-day gate: only allow advancing if a week has passed since the week started
  if (ls?.current_week_started_at) {
    const startedAt    = new Date(ls.current_week_started_at)
    const msElapsed    = Date.now() - startedAt.getTime()
    const sevenDaysMs  = 7 * 24 * 60 * 60 * 1000
    if (msElapsed < sevenDaysMs) {
      const availableAt = new Date(startedAt.getTime() + sevenDaysMs).toISOString()
      return res.status(429).json({ error: 'Week not ready yet', available_at: availableAt })
    }
  }

  const now = new Date().toISOString()

  // Step 1: Mark week_completed_at on learning_state
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
        parent_id:      child.parent_id,
        child_id:       child.id,
        week_number:    current_week,
        prompt_text:    dinner_prompt || '',
        marked_done_at: now,
      },
      { onConflict: 'parent_id,week_number' }
    )
  if (s2Err) console.error('[week-complete] step 2 error:', s2Err.message)

  // Step 3: Activity event — fire-and-forget, non-blocking
  supabase
    .from('activity_events')
    .insert({
      actor_type:  'child',
      child_id:    child.id,
      parent_id:   child.parent_id,
      event_type:  'week_completed',
      section:     'learn',
      occurred_at: now,
      metadata:    { week_number: current_week, topic: topic || null },
    })
    .then(({ error }) => {
      if (error) console.error('[week-complete] step 3 error:', error.message)
    })

  // Step 4: Advance current_week — this is the critical step
  const { error: s4Err } = await supabase
    .from('learning_state')
    .update({
      current_week:            current_week + 1,
      current_week_started_at: now,
      week_completed_at:       null,
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
