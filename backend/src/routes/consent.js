const { Router } = require('express')

const router = Router()

// POST /api/consent
// Body: { userId, eulaVersion, acceptedAt }
// Upserts into consent_log; idempotent on (user_id, eula_version)
router.post('/', async (req, res) => {
  const { userId, eulaVersion, acceptedAt } = req.body

  if (!userId || !eulaVersion || !acceptedAt) {
    return res.status(400).json({ error: 'Missing required fields' })
  }

  const { error } = await req.supabaseAdmin
    .from('consent_log')
    .upsert(
      { user_id: userId, eula_version: eulaVersion, accepted_at: acceptedAt },
      { onConflict: 'user_id,eula_version', ignoreDuplicates: true }
    )

  if (error) {
    console.error('[consent] upsert error:', error.message)
    return res.status(500).json({ error: 'Failed to record consent' })
  }

  res.json({ ok: true })
})

module.exports = router
