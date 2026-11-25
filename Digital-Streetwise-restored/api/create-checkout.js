// POST /api/create-checkout
// Creates a Stripe Checkout Session for the $15 one-time unlock and
// returns the session URL for the browser to redirect to.

const Stripe = require('stripe');
const stripe = Stripe(process.env.STRIPE_SECRET_KEY);

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.status(405).json({ error: 'Method not allowed' });
    return;
  }

  try {
    // Prefer a Price ID you created in the Stripe Dashboard (Products -> your $15 price).
    // Set it as an env var: STRIPE_PRICE_ID=price_xxx
    const priceId = process.env.STRIPE_PRICE_ID;

    const origin = req.headers.origin || `https://${req.headers.host}`;

    const session = await stripe.checkout.sessions.create({
      mode: 'payment',
      line_items: [
        priceId
          ? { price: priceId, quantity: 1 }
          : {
              quantity: 1,
              price_data: {
                currency: 'usd',
                unit_amount: 1500, // $15.00 in cents
                product_data: { name: 'Digital Streetwise — Full Unlock' },
              },
            },
      ],
      success_url: `${origin}/?paid=1&session_id={CHECKOUT_SESSION_ID}`,
      cancel_url: `${origin}/?paid=0`,
    });

    res.status(200).json({ url: session.url });
  } catch (err) {
    console.error(err);
    res.status(500).json({ error: err.message });
  }
};
