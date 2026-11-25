// POST /api/webhook
// Stripe calls this after a real payment completes, and again if you refund
// one. This is the source of truth for "did they actually pay" — don't
// trust the ?paid=1 URL param alone, since anyone could type that into the URL.
//
// In the Stripe Dashboard: Developers -> Webhooks -> Add endpoint
//   URL: https://YOUR-DOMAIN/api/webhook
//   Events: checkout.session.completed, charge.refunded
// Copy the "Signing secret" it gives you into STRIPE_WEBHOOK_SECRET.

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { upsertPurchase, revokeByCustomerId, revokeByEmail } = require('../lib/supabaseAdmin');

module.exports = { config: { api: { bodyParser: false } } };

module.exports.default = async (req, res) => {
  const sig = req.headers['stripe-signature'];
  const buf = await getRawBody(req);

  let event;
  try {
    event = stripe.webhooks.constructEvent(buf, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error('Webhook signature verification failed:', err.message);
    res.status(400).send(`Webhook Error: ${err.message}`);
    return;
  }

  if (event.type === 'checkout.session.completed') {
    const session = event.data.object;
    const email = session.customer_details?.email || session.customer_email;
    console.log('Payment completed for session:', session.id, email);

    if (email) {
      try {
        await upsertPurchase({ email, stripeCustomerId: session.customer, sessionId: session.id });
      } catch (err) {
        // Log but still 200 the webhook — Stripe will retry on non-2xx responses,
        // and we don't want infinite retries because of a DB hiccup.
        console.error('Failed to save purchase to DB:', err);
      }
    }
  }

  if (event.type === 'charge.refunded') {
    const charge = event.data.object;
    const customerId = charge.customer;
    const email = charge.receipt_email || charge.billing_details?.email;
    console.log('Refund processed:', customerId || email);

    try {
      if (customerId) {
        await revokeByCustomerId(customerId);
      } else if (email) {
        await revokeByEmail(email);
      }
    } catch (err) {
      console.error('Failed to revoke access after refund:', err);
    }
  }

  res.status(200).json({ received: true });
};

function getRawBody(req) {
  return new Promise((resolve, reject) => {
    const chunks = [];
    req.on('data', (c) => chunks.push(c));
    req.on('end', () => resolve(Buffer.concat(chunks)));
    req.on('error', reject);
  });
}
