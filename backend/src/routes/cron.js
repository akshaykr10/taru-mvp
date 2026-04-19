const express        = require('express')
const { updateAllNavs } = require('../jobs/updateNavs')

const router = express.Router()

// POST /api/cron/update-navs
// Called by the Render daily cron job (or manually for debugging).
// Protected by CRON_SECRET — no Supabase auth involved.
router.post('/update-navs', async (req, res) => {
  console.log('[cron] hit: POST /api/cron/update-navs')
  const secret = process.env.CRON_SECRET
  if (!secret) {
    console.error('[cron] CRON_SECRET env var is not set')
    return res.status(500).json({ error: 'CRON_SECRET not configured on server' })
  }

  const auth = req.headers['authorization'] || ''
  if (auth !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' })
  }

  try {
    const summary = await updateAllNavs()
    res.json({ ok: true, ...summary })
  } catch (err) {
    console.error('[cron] update-navs failed:', err.message)
    res.status(500).json({ ok: false, error: err.message })
  }
})

module.exports = router
