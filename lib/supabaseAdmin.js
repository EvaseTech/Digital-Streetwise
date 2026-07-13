// Server-side only. Uses the Supabase SERVICE ROLE key, which bypasses
// Row Level Security entirely — never import this file into anything that
// runs in the browser, and never expose SUPABASE_SERVICE_ROLE_KEY client-side.

const { createClient } = require('@supabase/supabase-js');

const supabaseAdmin = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_SERVICE_ROLE_KEY
);

async function upsertPurchase({ email, stripeCustomerId, sessionId }) {
  const normalized = String(email).toLowerCase().trim();
  const { error } = await supabaseAdmin.from('purchases').upsert({
    email: normalized,
    stripe_customer_id: stripeCustomerId || null,
    session_id: sessionId || null,
    paid_at: new Date().toISOString(),
  });
  if (error) throw error;
}

module.exports = { upsertPurchase };
