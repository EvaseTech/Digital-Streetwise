// Signs and verifies short-lived "magic link" login tokens.
// No database table needed for the tokens themselves — the token carries
// its own email + expiry, signed with MAGIC_LINK_SECRET so it can't be forged.

const crypto = require('crypto');

const TOKEN_TTL_MS = 15 * 60 * 1000; // 15 minutes

function base64url(input) {
  return Buffer.from(input).toString('base64url');
}

function sign(payloadB64) {
  const secret = process.env.MAGIC_LINK_SECRET;
  if (!secret) throw new Error('MAGIC_LINK_SECRET is not set');
  return crypto.createHmac('sha256', secret).update(payloadB64).digest('base64url');
}

function createToken(email) {
  const payload = { email: String(email).toLowerCase().trim(), exp: Date.now() + TOKEN_TTL_MS };
  const payloadB64 = base64url(JSON.stringify(payload));
  const sig = sign(payloadB64);
  return `${payloadB64}.${sig}`;
}

// Returns the email if the token is valid and unexpired, otherwise null.
function verifyToken(token) {
  try {
    const [payloadB64, sig] = String(token).split('.');
    if (!payloadB64 || !sig) return null;

    const expected = sign(payloadB64);
    const a = Buffer.from(sig);
    const b = Buffer.from(expected);
    if (a.length !== b.length || !crypto.timingSafeEqual(a, b)) return null;

    const payload = JSON.parse(Buffer.from(payloadB64, 'base64url').toString('utf8'));
    if (!payload.email || !payload.exp || Date.now() > payload.exp) return null;

    return payload.email;
  } catch (e) {
    return null;
  }
}

module.exports = { createToken, verifyToken };
