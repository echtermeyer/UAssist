const { Router } = require('express');
const { getGlobalDb, getTenantDb } = require('../lib/db');
const { encryptWithKey } = require('../lib/crypto');
const { getUserDataKey } = require('../lib/userkey');
const { startTenantContainer, restartTenantContainer } = require('../lib/docker');

const router = Router();

// ── WhatsApp ──────────────────────────────────────────────────────────────────

router.post('/whatsapp', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const existing = await getTenantDb(tenantId).collection('onboarding').findOne({ service: 'whatsapp' });
        if (existing?.status === 'connected') {
            return res.json({ status: 'connected' });
        }
        await getTenantDb(tenantId).collection('onboarding').updateOne(
            { service: 'whatsapp' },
            { $set: { service: 'whatsapp', status: 'pending', qr: null, _updatedAt: new Date() } },
            { upsert: true }
        );
        await getGlobalDb().collection('users').updateOne(
            { tenantId },
            { $set: { 'onboarding.whatsapp': 'pending' } }
        );
        await restartTenantContainer(tenantId);
        res.json({ status: 'started' });
    } catch (err) {
        next(err);
    }
});

router.get('/whatsapp/status', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const doc = await getTenantDb(tenantId).collection('onboarding').findOne({ service: 'whatsapp' });
        if (!doc) return res.json({ status: 'idle' });
        res.json({ status: doc.status, qr: doc.qr || null });
    } catch (err) {
        next(err);
    }
});

// ── Signal ────────────────────────────────────────────────────────────────────

router.post('/signal', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        await getTenantDb(tenantId).collection('onboarding').updateOne(
            { service: 'signal' },
            { $set: { service: 'signal', status: 'pending', linkUri: null, _updatedAt: new Date() } },
            { upsert: true }
        );
        await getGlobalDb().collection('users').updateOne(
            { tenantId },
            { $set: { 'onboarding.signal': 'pending' } }
        );
        await restartTenantContainer(tenantId);
        res.json({ status: 'started' });
    } catch (err) {
        next(err);
    }
});

router.get('/signal/status', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const doc = await getTenantDb(tenantId).collection('onboarding').findOne({ service: 'signal' });
        if (!doc) return res.json({ status: 'idle' });
        res.json({ status: doc.status, linkUri: doc.linkUri || null });
    } catch (err) {
        next(err);
    }
});

// ── Email ─────────────────────────────────────────────────────────────────────

router.post('/email', async (req, res, next) => {
    const { tenantId } = req.user;
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    try {
        const dataKey = await getUserDataKey(req.user.username);
        await getGlobalDb().collection('users').updateOne(
            { tenantId },
            { $set: { 'onboarding.email': 'connected', emailAddress: email, emailPassword: encryptWithKey(password, dataKey) } }
        );
        await restartTenantContainer(tenantId);
        res.json({ status: 'connected' });
    } catch (err) {
        next(err);
    }
});

// ── Slack ─────────────────────────────────────────────────────────────────────

router.post('/slack', async (req, res, next) => {
    const { tenantId } = req.user;
    const { botToken, appToken } = req.body;
    if (!botToken || !appToken) return res.status(400).json({ error: 'botToken and appToken required' });
    try {
        const dataKey = await getUserDataKey(req.user.username);
        await getGlobalDb().collection('users').updateOne(
            { tenantId },
            { $set: { 'onboarding.slack': 'connected', slackBotToken: encryptWithKey(botToken, dataKey), slackAppToken: encryptWithKey(appToken, dataKey) } }
        );
        await restartTenantContainer(tenantId);
        res.json({ status: 'connected' });
    } catch (err) {
        next(err);
    }
});

router.get('/slack/status', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const user = await getGlobalDb().collection('users').findOne({ tenantId });
        res.json({ status: user?.onboarding?.slack || 'idle' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
