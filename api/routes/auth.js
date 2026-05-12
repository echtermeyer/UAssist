const { Router } = require('express');
const { getDb } = require('../lib/db');
const { hashPassword, verifyPassword, signToken } = require('../lib/auth');

const router = Router();

// POST /auth/login
router.post('/login', async (req, res, next) => {
    const { username, password } = req.body;
    if (!username || !password) return res.status(400).json({ error: 'username and password required' });
    try {
        const user = await getDb().collection('users').findOne({ username });
        if (!user || !(await verifyPassword(password, user.passwordHash))) {
            return res.status(401).json({ error: 'Invalid credentials' });
        }
        const token = signToken({ userId: user._id, username: user.username, tenantId: user.tenantId, role: user.role });
        res.json({ token, tenantId: user.tenantId, role: user.role });
    } catch (err) {
        next(err);
    }
});

// POST /auth/register — admin only, creates a new user
router.post('/register', async (req, res, next) => {
    const { username, password, tenantId, role } = req.body;
    if (!username || !password || !tenantId) return res.status(400).json({ error: 'username, password and tenantId required' });
    if (req.user?.role !== 'admin') return res.status(403).json({ error: 'Admin only' });
    try {
        const existing = await getDb().collection('users').findOne({ username });
        if (existing) return res.status(409).json({ error: 'Username already exists' });
        const passwordHash = await hashPassword(password);
        const result = await getDb().collection('users').insertOne({
            username,
            passwordHash,
            tenantId,
            role: role === 'admin' ? 'admin' : 'user',
            _createdAt: new Date(),
        });
        res.status(201).json({ id: result.insertedId, username, tenantId });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
