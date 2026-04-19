#!/usr/bin/env node
/**
 * One-time script: delete all data for a parent email (including Supabase Auth user).
 * Usage: node scripts/delete-parent.js <email>
 *
 * Deleting from `parents` cascades to: children, portfolio_snapshots, fund_tags,
 * task_rules, task_completions, learning_state, conversation_log, activity_events.
 */

require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

const email = process.argv[2];
if (!email) {
  console.error('Usage: node scripts/delete-parent.js <email>');
  process.exit(1);
}

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY,
);

async function run() {
  console.log(`Looking up parent: ${email}`);

  // 1. Find auth user by email
  const { data: { users }, error: listErr } = await supabase.auth.admin.listUsers();
  if (listErr) throw listErr;

  const authUser = users.find(u => u.email === email);

  // 2. Delete from parents table (cascades everything else)
  const { data: parentRow, error: fetchErr } = await supabase
    .from('parents')
    .select('id')
    .eq('email', email)
    .single();

  if (fetchErr && fetchErr.code !== 'PGRST116') throw fetchErr;

  if (parentRow) {
    const { error: deleteErr } = await supabase
      .from('parents')
      .delete()
      .eq('id', parentRow.id);
    if (deleteErr) throw deleteErr;
    console.log(`Deleted parents row + all cascaded data for id=${parentRow.id}`);
  } else {
    console.log('No row found in parents table for this email.');
  }

  // 3. Delete Supabase Auth user
  if (authUser) {
    const { error: authErr } = await supabase.auth.admin.deleteUser(authUser.id);
    if (authErr) throw authErr;
    console.log(`Deleted Supabase Auth user id=${authUser.id}`);
  } else {
    console.log('No Supabase Auth user found for this email.');
  }

  console.log('Done. The email can now re-register fresh.');
}

run().catch(err => {
  console.error('Error:', err.message);
  process.exit(1);
});
