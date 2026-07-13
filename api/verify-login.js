// POST /api/verify-login  { token }
// Verifies a magic-link token and confirms the email still has a purchase
// on file (in case of refunds/edits since the link was sent).

const { verifyToken } = require('../lib/token');
const { hasPurchased } = require('../lib/db');

module.exports = async (req, res) => {
  if (req.method !== 'POST') {
    res.setHeader('Allow', 'POST');
    return res.status(405).json({ error: 'Method not allowed' });
  }

  try {
    const { token } = req.body || {};
    const email = token ? verifyToken(token) : null;

    if (!email) {
      return res.status(400).json({ error: 'This login link is invalid or has expired.' });
    }

    const paid = await hasPurchased(email);
    if (!paid) {
      return res.status(403).json({ error: 'No active purchase found for this email.' });
    }

    return res.status(200).json({ ok: true, email });
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: 'Something went wrong. Try again in a moment.' });
  }
};
