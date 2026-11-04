const { createClient } = require('@supabase/supabase-js')

// Supabase admin client (service role), server only. Used by the waitlist
// route to insert into waitlist_emails.
const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
)

module.exports = { supabase }
