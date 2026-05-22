require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');

async function run() {
  const supabase = createClient(
    process.env.SUPABASE_URL,
    process.env.SUPABASE_SERVICE_ROLE_KEY
  );

  const { data: funds, error } = await supabase
    .from('cas_funds')
    .select('id, isin, fund_name')
    .is('scheme_code', null);

  if (error) throw error;
  console.log(`[backfill] ${funds.length} funds to resolve`);

  for (const fund of funds) {
    try {
      const query = encodeURIComponent(fund.fund_name);
      const res = await fetch(`https://api.mfapi.in/mf/search?q=${query}`);
      if (!res.ok) {
        console.warn(`[backfill] mfapi search failed for "${fund.fund_name}": ${res.status}`);
        continue;
      }
      const results = await res.json();
      if (!results.length) {
        console.warn(`[backfill] No scheme found for: ${fund.fund_name}`);
        continue;
      }

      // DRY RUN — log top 3 matches, no DB writes
      console.log(`\n[backfill] "${fund.fund_name}" top matches:`);
      results.slice(0, 3).forEach((r, i) =>
        console.log(`  ${i + 1}. [${r.schemeCode}] ${r.schemeName}`)
      );

      await new Promise(r => setTimeout(r, 300));
    } catch (err) {
      console.error(`[backfill] failed for "${fund.fund_name}":`, err.message);
    }
  }

  console.log('\n[backfill] dry run done — no DB writes made');
}

run().catch(console.error);