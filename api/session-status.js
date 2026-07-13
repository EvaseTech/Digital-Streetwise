// GET /api/session-status?session_id=cs_...
// Called right after Stripe redirects back with ?paid=1. Confirms directly
// with Stripe that the session actually paid (never trust the URL param
// alone), and also writes the purchase to the DB immediately — a safety net
// alongside the webhook, in case the webhook is delayed or misses. Returns
// the buyer's email so the frontend can remember who's logged in and
// re-check purchase status later (e.g. after a refund).

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);
const { upsertPurchase } = require('../lib/supabaseAdmin');

module.exports = async (req, res) => {
  if (req.method !== 'GET') {
    res.setHeader('Allow', 'GET');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const sessionId = req.query?.session_id;
    if (!sessionId) {
      return res.status(400).json({ error: 'Missing session_id' });
    }

    const session = await stripe.checkout.sessions.retrieve(sessionId);
    const email = session.customer_details?.email || session.customer_email;

    if (session.payment_status === 'paid' && email) {
      await upsertPurchase({ email, stripeCustomerId: session.customer, sessionId: session.id });
      return res.status(200).json({ purchased: true, email });
    }

    return res.status(200).json({ purchased: false });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong confirming your purchase.' });
  }
};
