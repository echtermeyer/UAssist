require('dotenv').config();
const express = require('express');
const cookieParser = require('cookie-parser');
const rateLimit = require('express-rate-limit');
const { connect, getGlobalDb } = require('./lib/db');
const { verifyToken } = require('./lib/auth');
const authRouter = require('./routes/auth');
const messagesRouter = require('./routes/messages');
const sendRouter = require('./routes/send');
const onboardRouter = require('./routes/onboard');
const streamRouter = require('./routes/stream');

const app = express();
app.use(express.json());
app.use(cookieParser());

const CORS_ORIGIN = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);

app.use((req, res, next) => {
    const origin = req.headers.origin || '';
    if (CORS_ORIGIN.length === 0 || CORS_ORIGIN.includes(origin)) {
        res.set('Access-Control-Allow-Origin', origin || '*');
        res.set('Access-Control-Allow-Credentials', 'true');
    }
    res.set('Access-Control-Allow-Methods', 'GET,POST,PUT,DELETE,OPTIONS');
    res.set('Access-Control-Allow-Headers', 'Content-Type,Authorization');
    if (req.method === 'OPTIONS') return res.sendStatus(204);
    next();
});

const authLimiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 10,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many attempts, try again later' },
});

function authenticate(req, res, next) {
    const cookieToken = req.cookies?.ua_token;
    const header = req.headers.authorization;
    const token = cookieToken || (header?.startsWith('Bearer ') ? header.slice(7) : null);
    if (!token) return res.status(401).json({ error: 'Authentication required' });
    try {
        req.user = verifyToken(token);
        next();
    } catch {
        res.status(401).json({ error: 'Invalid or expired token' });
    }
}

app.use('/auth/login', authLimiter);
app.use('/auth/signup', authLimiter);

app.use('/auth', authRouter);
app.use('/messages', authenticate, messagesRouter);
app.use('/send', authenticate, sendRouter);
app.use('/onboard', authenticate, onboardRouter);
app.use('/stream', authenticate, streamRouter);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

connect().then(async () => {
    const { hashPassword } = require('./lib/auth');
    const db = getGlobalDb();
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
