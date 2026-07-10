// POST /api/webhook
// Stripe calls this after a real payment completes. This is the
// source of truth for "did they actually pay" — don't trust the
// ?paid=1 URL param alone, since anyone could type that into the URL.
//
// In the Stripe Dashboard: Developers -> Webhooks -> Add endpoint
//   URL: https://YOUR-DOMAIN/api/webhook
//   Event: checkout.session.completed
// Copy the "Signing secret" it gives you into STRIPE_WEBHOOK_SECRET.
//
// NOTE: this currently just logs the event. To actually persist
// "this customer paid" across devices, you'll want a database here —
// see the comment at the bottom.

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

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
    console.log('Payment completed for session:', session.id, session.customer_email);

    // TODO: save to a database, e.g.:
    //   await db.purchases.insert({ email: session.customer_email, sessionId: session.id, paidAt: new Date() });
    // Without this, "purchased" only lives in the buyer's browser (localStorage) —
    // fine for launch, but it means switching devices/browsers loses access.
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
