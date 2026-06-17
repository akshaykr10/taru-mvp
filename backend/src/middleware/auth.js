const { createClient } = require('@supabase/supabase-js')

// Local dev only: Node's bundled CA list doesn't trust the intermediate cert
// used by Supabase on some Windows machines, causing UNABLE_TO_VERIFY_LEAF_SIGNATURE.
// Disable TLS verification for outbound requests in non-production only.
if (process.env.NODE_ENV !== 'production') {
  process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0'
}

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
