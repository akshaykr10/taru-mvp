require('dotenv').config()
const express   = require('express')
const cors      = require('cors')
const { createClient } = require('@supabase/supabase-js')

const { requireParentAuth, supabase } = require('./middleware/auth')
const casparsersRouter = require('./routes/casparser')
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

// CASParser — all endpoints require parent auth
app.use('/api/casparser', requireParentAuth, casparsersRouter)

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

  // Return ONLY visible fund_tags — enforced at query level, not just route
  const { data: fundTags } = await supabase
    .from('fund_tags')
    .select('isin, fund_type, is_visible_to_child')
    .eq('parent_id', payload.parent_id)
    .eq('is_visible_to_child', true)

  const taggedTotal = (fundTags || []).reduce((sum, f) => sum + 0, 0) // ₹ values in Step 8

  const { data: learningState } = await supabase
    .from('learning_state')
    .select('current_week, coins_total, xp_total, last_trigger_type')
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
    fund_count:     (fundTags || []).length,
    learning_state: learningState,
  })
})

// ── Start server ──────────────────────────────────────────────
app.listen(PORT, () => {
  console.log(`Taru backend running on http://localhost:${PORT}`)
})
