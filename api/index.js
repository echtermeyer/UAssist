require('dotenv').config();
const express = require('express');
const { connect } = require('./lib/db');
const { verifyToken } = require('./lib/auth');
const authRouter = require('./routes/auth');
const messagesRouter = require('./routes/messages');
const sendRouter = require('./routes/send');
const onboardRouter = require('./routes/onboard');
const streamRouter = require('./routes/stream');

const app = express();
app.use(express.json());

// CORS — allow the frontend origin
app.use((req, res, next) => {
    const allowed = (process.env.CORS_ORIGIN || '*').split(',').map(s => s.trim());
    const origin = req.headers.origin || '';
    if (allowed.includes('*') || allowed.includes(origin)) {
        res.set('Access-Control-Allow-Origin', allowed.includes('*') ? '*' : origin);
    }
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

// JWT auth middleware — attaches req.user if token is valid
function authenticate(req, res, next) {
    const header = req.headers.authorization;
    if (!header || !header.startsWith('Bearer ')) {
        return res.status(401).json({ error: 'Bearer token required' });
    }
    try {
        req.user = verifyToken(header.slice(7));
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

// /auth/login is public; everything else requires a valid JWT
app.use('/auth', authRouter);
app.use('/messages', authenticate, messagesRouter);
app.use('/send', authenticate, sendRouter);
app.use('/onboard', authenticate, onboardRouter);
app.use('/stream', authenticate, streamRouter);

// /auth/register also needs the token (admin check is inside the route)
app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

connect().then(async () => {
    // Seed an initial admin user if no users exist yet
    const { getDb } = require('./lib/db');
    const { hashPassword } = require('./lib/auth');
    const db = getDb();
    const count = await db.collection('users').countDocuments();
    if (count === 0) {
        const adminPass = process.env.ADMIN_PASS || 'changeme';
        const hash = await hashPassword(adminPass);
        await db.collection('users').insertOne({
            username: 'admin',
            passwordHash: hash,
            tenantId: 'admin',
            role: 'admin',
            _createdAt: new Date(),
        });
        console.log(`✅ Seeded admin user (password: ${adminPass})`);
    }
    app.listen(3000, () => console.log('✅ API running on port 3000'));
}).catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
