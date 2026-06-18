/**
 * Gullak (coin wallet) routes
 *
 * Child endpoints (X-Child-Token validated internally):
 *   GET  /api/child/gullak            → coin balance + recent transactions
 *   POST /api/child/gullak/redeem     → submit a redemption request
 *
 * Parent endpoints (requireParentAuth applied in index.js):
 *   GET  /api/tasks/redemptions              → pending redemption requests
 *   POST /api/tasks/redemptions/:id/complete → mark a redemption done
 */

const express = require('express')
const jwt     = require('jsonwebtoken')
const { requireParentAuth } = require('../middleware/auth')

const router = express.Router()

// ── Helpers ───────────────────────────────────────────────────

/**
 * Resolve child identity from X-Child-Token header.
 * Returns { childId, parentId } or null on any failure.
 * Fail-closed: never returns a partial/default identity.
 */
async function resolveChildToken(req) {
  const token = req.headers['x-child-token']
  if (!token) return null

  let payload
  try {
    payload = jwt.verify(token, process.env.CHILD_TOKEN_SECRET)
  } catch {
    return null
  }

  const { data: child } = await req.supabaseAdmin
    .from('children')
    .select('id, parent_id, child_token')
    .eq('id', payload.child_id)
    .maybeSingle()

  if (!child || child.child_token !== token) return null
  return { childId: child.id, parentId: child.parent_id }
}

// ── Child: coin balance + recent transactions ─────────────────
router.get('/child/gullak', async (req, res) => {
  const actor = await resolveChildToken(req)
  if (!actor) return res.status(401).json({ error: 'Invalid or expired child token' })

  const sb = req.supabaseAdmin

  const [txResult, lsResult] = await Promise.all([
    sb
      .from('coin_transactions')
      .select('id, type, coins, label, emoji, status, created_at')
      .eq('child_id', actor.childId)
      .order('created_at', { ascending: false })
      .limit(20),
    sb
      .from('learning_state')
      .select('coins_total')
      .eq('child_id', actor.childId)
      .maybeSingle(),
  ])

  if (txResult.error) {
    console.error('[gullak] GET transactions error:', txResult.error.message)
    // Non-fatal: continue with empty transactions rather than failing the whole request
  }

  const transactions = txResult.data || []
  const spendable    = lsResult.data?.coins_total ?? 0

  // lifetime_earned = sum of all positive coin entries for this child (all time, not just recent 20)
  let sumFromTx = 0
  if (!txResult.error) {
    const { data: earnedRows, error: earnedErr } = await sb
      .from('coin_transactions')
      .select('coins')
      .eq('child_id', actor.childId)
      .gt('coins', 0)

    if (earnedErr) {
      console.error('[gullak] GET lifetime_earned error:', earnedErr.message)
      // Non-fatal: fall back to spendable balance below
    } else {
      sumFromTx = (earnedRows || []).reduce((sum, r) => sum + r.coins, 0)
    }
  }

  // Fall back to coins_total when coin_transactions has no history yet (new table)
  const lifetime_earned = Math.max(spendable, sumFromTx)

  res.json({ spendable, lifetime_earned, transactions })
})

// ── Child: submit redemption ──────────────────────────────────
router.post('/child/gullak/redeem', async (req, res) => {
  const actor = await resolveChildToken(req)
  if (!actor) return res.status(401).json({ error: 'Invalid or expired child token' })

  const { type, coins } = req.body

  if (!['invest', 'cash'].includes(type)) {
    return res.status(400).json({ error: 'type must be "invest" or "cash"' })
  }

  const amount = parseInt(coins, 10)
  if (!Number.isInteger(amount) || amount <= 0) {
    return res.status(400).json({ error: 'coins must be a positive integer' })
  }

  const sb = req.supabaseAdmin

  // Check current balance
  const { data: ls, error: lsErr } = await sb
    .from('learning_state')
    .select('id, coins_total')
    .eq('child_id', actor.childId)
    .maybeSingle()

  if (lsErr) {
    console.error('[gullak] redeem learning_state fetch error:', lsErr.message)
    return res.status(500).json({ error: 'Failed to fetch balance' })
  }

  const currentBalance = ls?.coins_total ?? 0
  if (amount > currentBalance) {
    return res.status(422).json({ error: 'Insufficient coins', spendable: currentBalance })
  }

  const txType  = type === 'invest' ? 'redeem_invest' : 'redeem_cash'
  const label   = type === 'invest' ? 'Plant in garden' : 'Pocket money request'
  const emoji   = type === 'invest' ? '🌱' : '💰'
  const newBal  = currentBalance - amount

  // Insert pending redemption transaction
  const { error: txErr } = await sb
    .from('coin_transactions')
    .insert({
      child_id:  actor.childId,
      parent_id: actor.parentId,
      type:      txType,
      coins:     -amount,
      label,
      emoji,
      status:    'pending',
    })

  if (txErr) {
    console.error('[gullak] redeem insert error:', txErr.message)
    return res.status(500).json({ error: 'Failed to submit redemption' })
  }

  // Decrement balance
  const updateOp = ls
    ? sb.from('learning_state').update({ coins_total: newBal }).eq('id', ls.id)
    : sb.from('learning_state').insert({ child_id: actor.childId, coins_total: 0 })

  const { error: updateErr } = await updateOp
  if (updateErr) {
    console.error('[gullak] redeem balance update error:', updateErr.message)
    return res.status(500).json({ error: 'Failed to update balance' })
  }

  res.json({ success: true, new_balance: newBal })
})

// ── Parent: list pending redemptions ─────────────────────────
router.get('/tasks/redemptions', requireParentAuth, async (req, res) => {
  const sb = req.supabaseAdmin

  const { data, error } = await sb
    .from('coin_transactions')
    .select('id, type, coins, label, emoji, created_at, children ( name )')
    .eq('parent_id', req.parentId)
    .eq('status', 'pending')
    .order('created_at', { ascending: true })

  if (error) {
    console.error('[gullak] GET redemptions error:', error.message)
    return res.status(500).json({ error: 'Failed to fetch redemptions' })
  }

  const redemptions = (data || []).map(r => ({
    id:         r.id,
    type:       r.type,
    coins:      r.coins,
    label:      r.label,
    emoji:      r.emoji,
    created_at: r.created_at,
    child_name: r.children?.name ?? null,
  }))

  res.json({ redemptions })
})

// ── Parent: complete a redemption ─────────────────────────────
router.post('/tasks/redemptions/:id/complete', requireParentAuth, async (req, res) => {
  const sb = req.supabaseAdmin

  // Fetch and verify ownership
  const { data: tx, error: fetchErr } = await sb
    .from('coin_transactions')
    .select('id, type, child_id, parent_id, status')
    .eq('id', req.params.id)
    .eq('parent_id', req.parentId)
    .maybeSingle()

  if (fetchErr || !tx) return res.status(404).json({ error: 'Redemption not found' })
  if (tx.status !== 'pending') return res.status(409).json({ error: 'Redemption already actioned' })

  // Mark original transaction completed
  const { error: updateErr } = await sb
    .from('coin_transactions')
    .update({ status: 'completed' })
    .eq('id', tx.id)

  if (updateErr) {
    console.error('[gullak] complete update error:', updateErr.message)
    return res.status(500).json({ error: 'Failed to complete redemption' })
  }

  // Insert informational confirmation transaction (no balance change)
  const isInvest  = tx.type === 'redeem_invest'
  const doneType  = isInvest ? 'redeem_invest_done' : 'redeem_cash_done'
  const doneLabel = isInvest ? 'Garden planted! 🌳' : 'Pocket money sent! 💰'
  const doneEmoji = isInvest ? '🌳' : '💰'

  sb.from('coin_transactions').insert({
    child_id:  tx.child_id,
    parent_id: tx.parent_id,
    type:      doneType,
    coins:     0,
    label:     doneLabel,
    emoji:     doneEmoji,
    status:    'completed',
  }).then(({ error: confErr }) => {
    if (confErr) console.error('[gullak] confirmation insert error:', confErr.message)
  })

  res.json({ success: true })
})

module.exports = router
