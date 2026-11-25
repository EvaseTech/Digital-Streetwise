// POST /api/request-login  { email }
// If that email has a purchase on file, emails a one-time login link.
// Always returns the same generic response either way, so this endpoint
// can't be used to check which emails have purchased (email enumeration).

const { createToken } = require('../lib/token');
const { hasPurchased } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { email } = req.body || {};
    if (!email || typeof email !== 'string' || !email.includes('@')) {
      return res.status(400).json({ error: 'Enter a valid email address.' });
    }

    const paid = await hasPurchased(email);

    if (paid) {
      const token = createToken(email);
      const origin = req.headers.origin || `https://${req.headers.host}`;
      const loginUrl = `${origin}/?login_token=${encodeURIComponent(token)}`;

      const r = await fetch('https://api.resend.com/emails', {
        method: 'POST',
        headers: {
          Authorization: `Bearer ${process.env.RESEND_API_KEY}`,
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          from: process.env.EMAIL_FROM || 'Digital Streetwise <onboarding@resend.dev>',
          to: email,
          subject: 'Your Digital Streetwise login link',
          html: `<p>Click below to unlock Digital Streetwise on this device:</p>
                 <p><a href="${loginUrl}">${loginUrl}</a></p>
                 <p>This link expires in 15 minutes. If you didn't request this, you can ignore it.</p>`,
        }),
      });

      if (!r.ok) {
        const errText = await r.text();
        console.error('Resend error:', errText);
        // Don't leak email-sending failures to the client either — log server-side only.
      }
    }

    // Same response whether or not the email was found.
    return res.status(200).json({ ok: true, message: 'If that email has purchased, a login link is on its way.' });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong. Try again in a moment.' });
  }
};
