/**
 * Activity logging — Step 6 stub, wired into index.js now.
 *
 * POST /api/activity
 * Accepts both parent JWT (Authorization header) and child token (X-Child-Token header).
 * The server sets occurred_at — never trusted from the client.
 */

const express = require('express')
const jwt     = require('jsonwebtoken')

const router = express.Router()

router.post('/', async (req, res) => {
  const sb           = req.supabaseAdmin          // set in index.js
  const { event_type, section, metadata } = req.body

  if (!event_type) return res.status(400).json({ error: 'event_type is required' })

  let parentId = null
  let childId  = null
  let actorType = null

  // Resolve actor from parent JWT
  const authHeader = req.headers.authorization
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7)
    try {
      const { data: { user } } = await sb.auth.getUser(token)
      if (user) {
        parentId  = user.id
        actorType = 'parent'
      }
    } catch (_) {
      return res.status(401).json({ error: 'Failed to validate session' })
    }
  }

  // Resolve actor from child token (X-Child-Token header)
  const childTokenHeader = req.headers['x-child-token']
  if (!actorType && childTokenHeader) {
    try {
      const payload = jwt.verify(childTokenHeader, process.env.CHILD_TOKEN_SECRET)
      // Validate against DB-stored token
      const { data: child } = await sb
        .from('children')
        .select('id, parent_id, child_token')
        .eq('id', payload.child_id)
        .maybeSingle()

      if (child && child.child_token === childTokenHeader) {
        childId   = child.id
        parentId  = child.parent_id
        actorType = 'child'
      }
    } catch (_) {
      // invalid child token — silently ignore
    }
  }

  if (!actorType) return res.status(401).json({ error: 'Unresolvable actor' })

  // Sanitise metadata — strip any PII keys just in case
  const safeMeta = metadata
    ? Object.fromEntries(
        Object.entries(metadata).filter(([k]) =>
          !['name', 'email', 'pan', 'mobile', 'phone', 'fund_name'].includes(k.toLowerCase())
        )
      )
    : null

  const { error } = await sb.from('activity_events').insert({
    actor_type:  actorType,
    parent_id:   parentId,
    child_id:    childId,
    event_type,
    section:     section || null,
    metadata:    safeMeta,
    // occurred_at defaults to now() in the DB — never client-set
  })

  if (error) {
    console.error('Activity log insert failed:', error.message)
    return res.status(500).json({ error: 'Failed to log event' })
  }

  res.json({ ok: true })
})

module.exports = router
