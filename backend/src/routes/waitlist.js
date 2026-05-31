/**
 * Waitlist endpoint
 *
 * POST /api/waitlist
 * Body: { email: string, source?: string, consent_given?: boolean }
 *
 * source defaults to 'landing' when absent (landing page sends only { email }).
 * consent_given defaults to false when absent.
 *
 * Validates the email, inserts into `waitlist_emails`, and handles
 * duplicate entries gracefully (idempotent — re-joining is not an error).
 *
 * Uses the same supabaseAdmin pattern as every other route file.
 */

const express = require('express')

const router = express.Router()

// Very lightweight email sanity check (no external deps needed)
function isValidEmail(value) {
  if (typeof value !== 'string') return false
  const trimmed = value.trim()
  // Must contain exactly one @, something before it, a dot after the @
  const parts = trimmed.split('@')
  if (parts.length !== 2) return false
  const [local, domain] = parts
  return local.length > 0 && domain.includes('.') && domain.length > 3
}

router.post('/', async (req, res) => {
  const sb = req.supabaseAdmin   // attached in backend/src/index.js

  const rawEmail = req.body?.email
  if (!rawEmail || !isValidEmail(rawEmail)) {
    return res.status(400).json({ error: 'A valid email address is required.' })
  }

  const email         = rawEmail.trim().toLowerCase()
  const source        = typeof req.body?.source === 'string' ? req.body.source : 'landing'
  const consent_given = req.body?.consent_given === true

  const { error } = await sb
    .from('waitlist_emails')
    .insert({ email, source, consent_given })

  if (error) {
    // Postgres unique-constraint violation code — treat duplicate as success
    if (error.code === '23505') {
      return res.json({ ok: true, message: 'Already on the waitlist.' })
    }
    console.error('[waitlist] insert error:', error.message)
    return res.status(500).json({ error: 'Could not save your email. Please try again.' })
  }

  return res.status(201).json({ ok: true, message: 'Added to waitlist.' })
})

module.exports = router
