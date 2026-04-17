/**
 * Children routes — Step 5
 *
 * POST /api/children/:childId/token          → generate + store child JWT
 * POST /api/children/:childId/token/regenerate → invalidate old, issue new JWT
 */

const express = require('express')
const jwt     = require('jsonwebtoken')

const router = express.Router()

// ── Helpers ───────────────────────────────────────────────────

function signChildToken(childId, parentId) {
  return jwt.sign(
    { child_id: childId, parent_id: parentId },
    process.env.CHILD_TOKEN_SECRET,
    { expiresIn: '90d' }
  )
}

async function generateAndStore(sb, childId, parentId, res) {
  // Verify the child belongs to this parent (security check at query level)
  const { data: child, error: fetchErr } = await sb
    .from('children')
    .select('id, parent_id')
    .eq('id', childId)
    .eq('parent_id', parentId)   // enforces ownership — not just route protection
    .maybeSingle()

  if (fetchErr || !child) {
    return res.status(404).json({ error: 'Child not found or not yours' })
  }

  const token = signChildToken(childId, parentId)

  const { error: updateErr } = await sb
    .from('children')
    .update({ child_token: token })
    .eq('id', childId)

  if (updateErr) {
    return res.status(500).json({ error: 'Failed to store child token' })
  }

  return res.json({
    child_token: token,
    garden_url:  `${process.env.FRONTEND_URL || 'http://localhost:5173'}/child/${token}`,
    expires_in:  '90 days',
  })
}

// ── Update goal fields ────────────────────────────────────────
router.patch('/:childId', async (req, res) => {
  const { childId } = req.params
  const sb = req.supabase

  // Verify ownership at query level — not just route protection
  const { data: existing, error: fetchErr } = await sb
    .from('children')
    .select('id')
    .eq('id', childId)
    .eq('parent_id', req.parentId)
    .maybeSingle()

  if (fetchErr || !existing) {
    return res.status(404).json({ error: 'Child not found or not yours' })
  }

  const { goal_name, goal_amount, goal_date } = req.body

  const name = typeof goal_name === 'string' ? goal_name.trim() : ''
  if (!name) {
    return res.status(400).json({ error: 'goal_name is required' })
  }
  const amount = parseFloat(goal_amount)
  if (!goal_amount || isNaN(amount) || amount <= 0 || amount > 9999999) {
    return res.status(400).json({ error: 'goal_amount must be a positive number up to 9999999' })
  }
  if (!goal_date) {
    return res.status(400).json({ error: 'goal_date is required' })
  }

  const { data: updated, error: updateErr } = await sb
    .from('children')
    .update({ goal_name: name, goal_amount: amount, goal_date })
    .eq('id', childId)
    .select()
    .single()

  if (updateErr) {
    return res.status(500).json({ error: 'Failed to update goal' })
  }

  return res.json({ child: updated })
})

// ── Generate token (first-time) ───────────────────────────────
router.post('/:childId/token', async (req, res) => {
  const { childId } = req.params
  await generateAndStore(req.supabase, childId, req.parentId, res)
})

// ── Regenerate token (invalidates previous) ───────────────────
// Old token is invalidated the moment we overwrite children.child_token.
// The backend always validates the token against the DB value — so the old
// JWT is worthless even if it hasn't expired by signature.
router.post('/:childId/token/regenerate', async (req, res) => {
  const { childId } = req.params
  await generateAndStore(req.supabase, childId, req.parentId, res)
})

module.exports = router
