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
