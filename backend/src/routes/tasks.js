/**
 * Task rules + approval flow — Step 9
 *
 * Parent endpoints (requireParentAuth applied in index.js):
 *   GET    /api/tasks                              → list task rules
 *   POST   /api/tasks                              → create task rule (max 3)
 *   PATCH  /api/tasks/:id                          → update rule (name/coins/frequency/status)
 *   DELETE /api/tasks/:id                          → delete rule
 *   GET    /api/tasks/pending                      → list pending completions for approval
 *   POST   /api/tasks/completions/:cid/approve     → approve completion → award coins
 *   POST   /api/tasks/completions/:cid/reject      → reject completion
 *
 * Child endpoint (X-Child-Token validated internally):
 *   GET    /api/tasks/child                        → list active rules for child
 *   POST   /api/tasks/:id/complete                 → submit completion request
 */

const express = require('express')
const jwt     = require('jsonwebtoken')
const { requireParentAuth } = require('../middleware/auth')

const router = express.Router()

// ── Helpers ───────────────────────────────────────────────────

/** Resolve child identity from X-Child-Token header. Returns null if invalid. */
async function resolveChildToken(req) {
  const token = req.headers['x-child-token']
  if (!token) return null

  let payload
  try {
    payload = jwt.verify(token, process.env.CHILD_TOKEN_SECRET)
  } catch {
    return null
  }

  const sb = req.supabaseAdmin
  const { data: child } = await sb
    .from('children')
    .select('id, parent_id, child_token')
    .eq('id', payload.child_id)
    .maybeSingle()

  if (!child || child.child_token !== token) return null
  return { childId: child.id, parentId: child.parent_id }
}

/** Verify a task rule belongs to the requesting parent. */
async function ownedRule(sb, ruleId, parentId) {
  const { data, error } = await sb
    .from('task_rules')
    .select('*')
    .eq('id', ruleId)
    .eq('parent_id', parentId)
    .maybeSingle()
  return error ? null : data
}

// ── Child: list active rules ──────────────────────────────────
// Must appear before /:id routes to avoid "child" being interpreted as an id.
router.get('/child', async (req, res) => {
  const actor = await resolveChildToken(req)
  if (!actor) return res.status(401).json({ error: 'Invalid child token' })

  const sb = req.supabaseAdmin

  // Get child's parent_id so we can look up rules
  const { data: rules, error } = await sb
    .from('task_rules')
    .select('id, task_name, reward_coins, frequency, status')
    .eq('parent_id', actor.parentId)
    .eq('child_id', actor.childId)
    .eq('status', 'active')
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: 'Failed to fetch tasks' })

  // For each rule, derive UI state:
  //   has_pending — a completion is awaiting parent approval right now
  //   locked      — frequency window prevents a new submission
  //                 one-time : ever approved once → locked forever
  //                 weekly   : approved within the last 7 days → locked
  //                 custom   : never auto-locked (parent controls manually)
  const ruleIds = (rules || []).map(r => r.id)
  let pendingSet = new Set()
  let lockedSet  = new Set()

  if (ruleIds.length > 0) {
    // Pending check — null approved_at AND null rejected_at
    const { data: pending } = await sb
      .from('task_completions')
      .select('task_rule_id')
      .in('task_rule_id', ruleIds)
      .is('approved_at', null)
      .is('rejected_at', null)

    pendingSet = new Set((pending || []).map(p => p.task_rule_id))

    // Frequency-window lock check — only need approved completions
    const { data: approved } = await sb
      .from('task_completions')
      .select('task_rule_id, approved_at')
      .in('task_rule_id', ruleIds)
      .not('approved_at', 'is', null)

    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000)
    const ruleMap = Object.fromEntries((rules || []).map(r => [r.id, r]))

    for (const c of (approved || [])) {
      const rule = ruleMap[c.task_rule_id]
      if (!rule) continue
      if (rule.frequency === 'one-time') {
        lockedSet.add(rule.id)                                   // locked forever once approved
      } else if (rule.frequency === 'weekly') {
        if (new Date(c.approved_at) >= weekAgo) {
          lockedSet.add(rule.id)                                 // locked until 7-day window passes
        }
      }
      // 'custom' frequency: no automatic lock
    }
  }

  const enriched = (rules || []).map(r => ({
    ...r,
    has_pending: pendingSet.has(r.id),
    locked:      lockedSet.has(r.id),
  }))

  res.json({ rules: enriched })
})

// ── Child: submit completion ──────────────────────────────────
router.post('/:id/complete', async (req, res) => {
  const actor = await resolveChildToken(req)
  if (!actor) return res.status(401).json({ error: 'Invalid child token' })

  const sb = req.supabaseAdmin

  // Verify the rule is active and belongs to this child/parent
  const { data: rule, error: ruleErr } = await sb
    .from('task_rules')
    .select('id, task_name, reward_coins, frequency, status')
    .eq('id', req.params.id)
    .eq('parent_id', actor.parentId)
    .eq('child_id', actor.childId)
    .eq('status', 'active')
    .maybeSingle()

  if (ruleErr || !rule) {
    return res.status(404).json({ error: 'Task rule not found or not active' })
  }

  // Block submission if a completion is already pending
  const { data: existingPending } = await sb
    .from('task_completions')
    .select('id')
    .eq('task_rule_id', rule.id)
    .is('approved_at', null)
    .is('rejected_at', null)
    .maybeSingle()

  if (existingPending) {
    return res.status(409).json({ error: 'A completion request is already pending for this task' })
  }

  // Block submission if the frequency window hasn't reset yet
  if (rule.frequency === 'one-time') {
    const { data: anyApproved } = await sb
      .from('task_completions')
      .select('id')
      .eq('task_rule_id', rule.id)
      .not('approved_at', 'is', null)
      .limit(1)
      .maybeSingle()

    if (anyApproved) {
      return res.status(409).json({ error: 'This one-time task has already been completed' })
    }
  }

  if (rule.frequency === 'weekly') {
    const weekAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString()
    const { data: recentApproved } = await sb
      .from('task_completions')
      .select('id')
      .eq('task_rule_id', rule.id)
      .not('approved_at', 'is', null)
      .gte('approved_at', weekAgo)
      .limit(1)
      .maybeSingle()

    if (recentApproved) {
      return res.status(409).json({ error: 'This task was already completed this week' })
    }
  }

  const { data: completion, error: insertErr } = await sb
    .from('task_completions')
    .insert({ task_rule_id: rule.id })
    .select('id, completed_at')
    .single()

  if (insertErr) return res.status(500).json({ error: 'Failed to submit completion' })

  res.json({ completion_id: completion.id, submitted_at: completion.completed_at })
})

// ── Parent: list task rules ───────────────────────────────────
router.get('/', requireParentAuth, async (req, res) => {
  const sb = req.supabaseAdmin

  const { data: rules, error } = await sb
    .from('task_rules')
    .select('id, task_name, reward_coins, frequency, status, child_id, created_at')
    .eq('parent_id', req.parentId)
    .order('created_at', { ascending: true })

  if (error) return res.status(500).json({ error: 'Failed to fetch task rules' })
  res.json({ rules: rules || [] })
})

// ── Parent: create task rule ──────────────────────────────────
router.post('/', requireParentAuth, async (req, res) => {
  const { task_name, reward_coins, frequency, child_id } = req.body

  if (!task_name || !reward_coins || !frequency || !child_id) {
    return res.status(400).json({ error: 'task_name, reward_coins, frequency, and child_id are required' })
  }

  if (!['one-time', 'weekly', 'custom'].includes(frequency)) {
    return res.status(400).json({ error: 'frequency must be one-time, weekly, or custom' })
  }

  const coins = parseInt(reward_coins, 10)
  if (isNaN(coins) || coins < 1 || coins > 100) {
    return res.status(400).json({ error: 'reward_coins must be between 1 and 100' })
  }

  try {
    const sb = req.supabaseAdmin

    // Verify the child belongs to this parent
    const { data: child, error: childErr } = await sb
      .from('children')
      .select('id')
      .eq('id', child_id)
      .eq('parent_id', req.parentId)
      .maybeSingle()

    if (childErr) {
      console.error('[tasks] POST / child lookup error — parentId:', req.parentId, 'childId:', child_id, '|', childErr.message, childErr.details)
      return res.status(500).json({ error: 'Failed to verify child', detail: childErr.message })
    }
    if (!child) return res.status(404).json({ error: 'Child not found' })

    // Enforce max 3 rules per parent
    const { count, error: countErr } = await sb
      .from('task_rules')
      .select('id', { count: 'exact', head: true })
      .eq('parent_id', req.parentId)

    if (countErr) {
      console.error('[tasks] POST / count error — parentId:', req.parentId, '|', countErr.message, countErr.details)
      return res.status(500).json({ error: 'Failed to count task rules', detail: countErr.message })
    }

    if (count >= 3) {
      return res.status(422).json({ error: 'Maximum of 3 task rules allowed per family' })
    }

    const { data: rule, error: insertErr } = await sb
      .from('task_rules')
      .insert({
        parent_id:    req.parentId,
        child_id,
        task_name:    task_name.trim(),
        reward_coins: coins,
        frequency,
        status:       'active',
      })
      .select('id, task_name, reward_coins, frequency, status, child_id, created_at')
      .single()

    if (insertErr) {
      console.error('[tasks] POST / insert error — parentId:', req.parentId, '|', insertErr.message, insertErr.details, insertErr.hint)
      return res.status(500).json({ error: 'Failed to create task rule', detail: insertErr.message })
    }
    res.status(201).json({ rule })
  } catch (err) {
    console.error('[tasks] POST / unexpected error — parentId:', req.parentId, '|', err.message, err.stack)
    res.status(500).json({ error: 'Unexpected server error', detail: err.message })
  }
})

// ── Parent: list pending completions ─────────────────────────
// Must appear before /:id to avoid 'pending' being treated as an id.
router.get('/pending', requireParentAuth, async (req, res) => {
  const sb = req.supabaseAdmin

  // Join via task_rules to ensure parent ownership
  const { data: completions, error } = await sb
    .from('task_completions')
    .select(`
      id,
      completed_at,
      task_rule_id,
      task_rules!inner (
        task_name,
        reward_coins,
        parent_id,
        child_id,
        children ( name )
      )
    `)
    .eq('task_rules.parent_id', req.parentId)
    .is('approved_at', null)
    .is('rejected_at', null)
    .order('completed_at', { ascending: true })

  if (error) return res.status(500).json({ error: 'Failed to fetch pending completions' })
  res.json({ completions: completions || [] })
})

// ── Parent: approve completion ────────────────────────────────
router.post('/completions/:cid/approve', requireParentAuth, async (req, res) => {
  const sb = req.supabaseAdmin

  // Fetch completion + verify parent owns the rule
  const { data: comp, error: fetchErr } = await sb
    .from('task_completions')
    .select(`id, approved_at, rejected_at, task_rule_id, task_rules!inner ( reward_coins, parent_id, child_id )`)
    .eq('id', req.params.cid)
    .eq('task_rules.parent_id', req.parentId)
    .maybeSingle()

  if (fetchErr || !comp) return res.status(404).json({ error: 'Completion not found' })
  if (comp.approved_at || comp.rejected_at) {
    return res.status(409).json({ error: 'Completion already actioned' })
  }

  const rule    = comp.task_rules
  const childId = rule.child_id
  const coins   = rule.reward_coins

  // Approve
  const { error: updateErr } = await sb
    .from('task_completions')
    .update({ approved_at: new Date().toISOString() })
    .eq('id', comp.id)

  if (updateErr) return res.status(500).json({ error: 'Failed to approve completion' })

  // Award coins — upsert learning_state
  const { data: ls } = await sb
    .from('learning_state')
    .select('id, coins_total')
    .eq('child_id', childId)
    .maybeSingle()

  if (ls) {
    await sb
      .from('learning_state')
      .update({ coins_total: (ls.coins_total || 0) + coins })
      .eq('id', ls.id)
  } else {
    await sb
      .from('learning_state')
      .insert({ child_id: childId, coins_total: coins })
  }

  res.json({ ok: true, coins_awarded: coins })
})

// ── Parent: reject completion ─────────────────────────────────
router.post('/completions/:cid/reject', requireParentAuth, async (req, res) => {
  const sb = req.supabaseAdmin

  const { data: comp, error: fetchErr } = await sb
    .from('task_completions')
    .select(`id, approved_at, rejected_at, task_rules!inner ( parent_id )`)
    .eq('id', req.params.cid)
    .eq('task_rules.parent_id', req.parentId)
    .maybeSingle()

  if (fetchErr || !comp) return res.status(404).json({ error: 'Completion not found' })
  if (comp.approved_at || comp.rejected_at) {
    return res.status(409).json({ error: 'Completion already actioned' })
  }

  const { error } = await sb
    .from('task_completions')
    .update({ rejected_at: new Date().toISOString() })
    .eq('id', comp.id)

  if (error) return res.status(500).json({ error: 'Failed to reject completion' })
  res.json({ ok: true })
})

// ── Parent: update task rule ──────────────────────────────────
router.patch('/:id', requireParentAuth, async (req, res) => {
  const rule = await ownedRule(req.supabaseAdmin, req.params.id, req.parentId)
  if (!rule) return res.status(404).json({ error: 'Task rule not found' })

  const allowed = ['task_name', 'reward_coins', 'frequency', 'status']
  const updates = {}
  for (const key of allowed) {
    if (req.body[key] !== undefined) updates[key] = req.body[key]
  }

  if (updates.status && !['active', 'paused'].includes(updates.status)) {
    return res.status(400).json({ error: 'status must be active or paused' })
  }
  if (updates.reward_coins) {
    updates.reward_coins = parseInt(updates.reward_coins, 10)
    if (isNaN(updates.reward_coins) || updates.reward_coins < 1 || updates.reward_coins > 100) {
      return res.status(400).json({ error: 'reward_coins must be between 1 and 100' })
    }
  }
  if (updates.task_name) updates.task_name = updates.task_name.trim()

  if (!Object.keys(updates).length) {
    return res.status(400).json({ error: 'No valid fields to update' })
  }

  const { data: updated, error } = await req.supabaseAdmin
    .from('task_rules')
    .update(updates)
    .eq('id', req.params.id)
    .select('id, task_name, reward_coins, frequency, status, child_id, created_at')
    .single()

  if (error) return res.status(500).json({ error: 'Failed to update task rule' })
  res.json({ rule: updated })
})

// ── Parent: delete task rule ──────────────────────────────────
router.delete('/:id', requireParentAuth, async (req, res) => {
  const rule = await ownedRule(req.supabaseAdmin, req.params.id, req.parentId)
  if (!rule) return res.status(404).json({ error: 'Task rule not found' })

  const { error } = await req.supabaseAdmin
    .from('task_rules')
    .delete()
    .eq('id', req.params.id)

  if (error) return res.status(500).json({ error: 'Failed to delete task rule' })
  res.json({ ok: true })
})

module.exports = router
