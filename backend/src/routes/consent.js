const { Router } = require('express')
const { requireParentAuth } = require('../middleware/auth')

const router = Router()

// GET /api/consent/status
// Auth: Supabase JWT required
// Returns { accepted: boolean } — whether the authenticated user has accepted
// the current EULA version. Uses service role key so RLS is not a factor.
router.get('/status', requireParentAuth, async (req, res) => {
  const { eulaVersion } = req.query
  if (!eulaVersion) {
    return res.status(400).json({ error: 'Missing eulaVersion query param' })
  }

  const { data, error } = await req.supabaseAdmin
    .from('consent_log')
    .select('id')
    .eq('user_id', req.parentId)
    .eq('eula_version', eulaVersion)
    .maybeSingle()

  if (error) {
    console.error('[consent/status] error:', error.message)
    return res.status(500).json({ error: 'Failed to check consent status' })
  }

  res.json({ accepted: !!data })
})

// POST /api/consent
// Body: { userId, eulaVersion, acceptedAt }
// Idempotent: if a record already exists for (user_id, eula_version), returns ok immediately.
router.post('/', async (req, res) => {
  const { userId, eulaVersion, acceptedAt } = req.body

  if (!userId || !eulaVersion || !acceptedAt) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const sb = req.supabaseAdmin

  // Check for existing acceptance — avoids relying on a unique constraint for upsert
  const { data: existing } = await sb
    .from('consent_log')
    .select('id')
    .eq('user_id', userId)
    .eq('eula_version', eulaVersion)
    .maybeSingle()

  if (existing) return res.json({ ok: true })

  const { error } = await sb
    .from('consent_log')
    .insert({ user_id: userId, eula_version: eulaVersion, accepted_at: acceptedAt })

  // Log but don't block — consent is already scrolled/agreed; a DB hiccup
  // should not force the user to repeat the flow.
  if (error) {
    console.error('[consent] insert error (non-fatal):', error.message)
  }

  res.json({ ok: true })
})

module.exports = router
