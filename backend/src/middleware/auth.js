const { createClient } = require('@supabase/supabase-js')

// Supabase admin client — service role, server only
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

/**
 * Validates the Supabase Auth JWT sent by parent clients.
 * Attaches req.parentId and req.supabase on success.
 */
async function requireParentAuth(req, res, next) {
  const auth = req.headers.authorization
  if (!auth || !auth.startsWith('Bearer ')) {
    return res.status(401).json({ error: 'Missing authorization header' })
  }

  const token = auth.slice(7)
  const { data: { user }, error } = await supabase.auth.getUser(token)

  if (error || !user) {
    return res.status(401).json({ error: 'Invalid or expired session' })
  }

  req.parentId  = user.id
  req.supabase  = supabase   // re-use one client instance
  next()
}

module.exports = { requireParentAuth, supabase }
