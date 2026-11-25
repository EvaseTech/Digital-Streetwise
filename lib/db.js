// Thin wrapper around Vercel Postgres for the one table this app needs:
// "who paid". Run the migration in db/schema.sql once before using this.

const { sql } = require('@vercel/postgres');

async function upsertPurchase({ email, stripeCustomerId, sessionId }) {
  const normalized = String(email).toLowerCase().trim();
  await sql`
    INSERT INTO purchases (email, stripe_customer_id, session_id, paid_at)
    VALUES (${normalized}, ${stripeCustomerId || null}, ${sessionId || null}, now())
    ON CONFLICT (email) DO UPDATE
      SET stripe_customer_id = EXCLUDED.stripe_customer_id,
          session_id = EXCLUDED.session_id,
          paid_at = now();
  `;
}

async function hasPurchased(email) {
  const normalized = String(email).toLowerCase().trim();
  const { rows } = await sql`SELECT 1 FROM purchases WHERE email = ${normalized} LIMIT 1;`;
  return rows.length > 0;
}

module.exports = { upsertPurchase, hasPurchased };
