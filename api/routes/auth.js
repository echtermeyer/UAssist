const { Router } = require('express');
const { getGlobalDb, provisionTenantDb } = require('../lib/db');
const { hashPassword, verifyPassword, signToken, verifyToken } = require('../lib/auth');

const router = Router();

const COOKIE_OPTS = {
    httpOnly: true,
    secure: process.env.NODE_ENV !== 'development',
    sameSite: 'strict',
    maxAge: 7 * 24 * 60 * 60 * 1000,
    path: '/',
};

function setAuthCookie(res, token) {
    res.cookie('ua_token', token, COOKIE_OPTS);
}

router.post('/signup', async (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    if (password.length < 6) return res.status(400).json({ error: 'password must be at least 6 characters' });
    try {
        const db = getGlobalDb();
        const existing = await db.collection('users').findOne({ username });
        if (existing) return res.status(409).json({ error: 'Username already taken' });
        const passwordHash = await hashPassword(password);
        const tenantId = username.toLowerCase().replace(/[^a-z0-9]/g, '_');

        const tenantDbInfo = await provisionTenantDb(tenantId);

        const result = await db.collection('users').insertOne({
            username,
            passwordHash,
            tenantId,
            role: 'user',
            onboarding: { whatsapp: 'pending', signal: 'pending', email: 'pending' },
            encryptedMongoUrl: tenantDbInfo?.encryptedMongoUrl || null,
            _createdAt: new Date(),
        });
        const token = signToken({ userId: result.insertedId, username, tenantId, role: 'user' });
        setAuthCookie(res, token);
        res.status(201).json({ tenantId, role: 'user' });
    } catch (err) {
        next(err);
    }
});

router.post('/login', async (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    try {
        const user = await getGlobalDb().collection('users').findOne({ username });
        if (!user || !(await verifyPassword(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = signToken({ userId: user._id, username: user.username, tenantId: user.tenantId, role: user.role });
        setAuthCookie(res, token);
        res.json({ tenantId: user.tenantId, role: user.role });
    } catch (err) {
        next(err);
    }
});

router.post('/logout', (req, res) => {
    res.clearCookie('ua_token', { path: '/' });
    res.json({ ok: true });
});

router.post('/register', async (req, res, next) => {
    const { username, password, tenantId, role } = req.body;
    if (!username || !password || !tenantId) return res.status(400).json({ error: 'username, password and tenantId required' });
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    try {
        const db = getGlobalDb();
        const existing = await db.collection('users').findOne({ username });
        if (existing) return res.status(409).json({ error: 'Username already exists' });
        const passwordHash = await hashPassword(password);

        const tenantDbInfo = await provisionTenantDb(tenantId);

        const result = await db.collection('users').insertOne({
            username,
            passwordHash,
            tenantId,
            role: role === 'admin' ? 'admin' : 'user',
            encryptedMongoUrl: tenantDbInfo?.encryptedMongoUrl || null,
            _createdAt: new Date(),
        });
        res.status(201).json({ id: result.insertedId, username, tenantId });
    } catch (err) {
        next(err);
    }
});

router.get('/me', (req, res) => {
    const token = req.cookies?.ua_token ||
        (req.headers.authorization?.startsWith('Bearer ') ? req.headers.authorization.slice(7) : null);
    if (!token) return res.status(401).json({ error: 'Not authenticated' });
    try {
        const user = verifyToken(token);
        res.json({ userId: user.userId, username: user.username, tenantId: user.tenantId, role: user.role });
    } catch {
        res.status(401).json({ error: 'Not authenticated' });
    }
});

module.exports = router;
