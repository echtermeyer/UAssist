const { OAuth2Client } = require('google-auth-library');

const AUTH_DISABLED = process.env.AUTH_DISABLED === 'true';
const AUDIENCE = process.env.AGENT_AUDIENCE;
const ALLOWED_SA_EMAILS = (process.env.ALLOWED_SA_EMAILS || '')
    .split(',').map(s => s.trim()).filter(Boolean);

const client = new OAuth2Client();

async function authenticate(req, res, next) {
    if (AUTH_DISABLED) return next();

    const header = req.headers.authorization || '';
    const token = header.startsWith('Bearer ') ? header.slice(7) : null;
    if (!token) return res.status(401).json({ error: 'Authentication required' });

    try {
        const ticket = await client.verifyIdToken({ idToken: token, audience: AUDIENCE });
        const payload = ticket.getPayload();
        if (!payload.email_verified || !ALLOWED_SA_EMAILS.includes(payload.email)) {
            return res.status(403).json({ error: 'Caller not allowed' });
        }
        next();
    } catch {
        res.status(401).json({ error: 'Invalid token' });
    }
}

module.exports = { authenticate };
