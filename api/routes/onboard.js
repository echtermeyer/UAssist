const { Router } = require('express');
const { spawn } = require('child_process');
const path = require('path');
const { getGlobalDb, getTenantDb } = require('../lib/db');
const { provisionTenant, tenantLinuxUser, tenantHome, ensureLinuxUser } = require('../lib/pm2');
const { encrypt, decrypt } = require('../lib/crypto');

const router = Router();

const UASSIST_ROOT = process.env.UASSIST_ROOT || '/home/deploy/UAssist';
const SIGNAL_CLI_PATH = process.env.SIGNAL_CLI_PATH || 'signal-cli';
const FALLBACK_MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/uassist';

const activeSessions = new Map();

async function getTenantMongoUrl(username) {
    const user = await getGlobalDb().collection('users').findOne({ username });
    if (user?.encryptedMongoUrl) {
        try { return decrypt(user.encryptedMongoUrl); } catch {}
    }
    return FALLBACK_MONGO_URL;
}

// ── WhatsApp ──────────────────────────────────────────────────────────────────

router.post('/whatsapp', async (req, res, next) => {
    const { tenantId } = req.user;
    const tenantDb = getTenantDb(tenantId);

    if (activeSessions.has(`wa_${tenantId}`)) {
        try { activeSessions.get(`wa_${tenantId}`).proc.kill(); } catch {}
        activeSessions.delete(`wa_${tenantId}`);
    }

    await tenantDb.collection('onboarding').updateOne(
        { service: 'whatsapp' },
        { $set: { service: 'whatsapp', status: 'pending', qr: null, _updatedAt: new Date() } },
        { upsert: true }
    );

    ensureLinuxUser(tenantId);

    const tenantUser = tenantLinuxUser(tenantId);
    const tenantHomeDir = tenantHome(tenantId);
    const chromiumPath = process.env.CHROMIUM_PATH || '/usr/bin/google-chrome';
    const mongoUrl = await getTenantMongoUrl(req.user.username);

    const proc = spawn('sudo', [
        '-n', '-u', tenantUser,
        'env',
        `MONGO_URL=${mongoUrl}`,
        `TENANT_ID=${tenantId}`,
        `WA_DATA_PATH=${tenantHomeDir}`,
        `HOME=${tenantHomeDir}`,
        `WA_ONBOARD_MODE=1`,
        `CHROMIUM_PATH=${chromiumPath}`,
        'node', path.join(UASSIST_ROOT, 'whatsapp-integration/index.js'),
    ], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    activeSessions.set(`wa_${tenantId}`, { proc });

    let stdoutBuf = '';
    let readyHandled = false;

    async function handleLine(line) {
        if (line.startsWith('QR:')) {
            const qrData = line.slice(3).trim();
            if (qrData) {
                await tenantDb.collection('onboarding').updateOne(
                    { service: 'whatsapp' },
                    { $set: { qr: qrData, _updatedAt: new Date() } }
                );
            }
        } else if (line.startsWith('READY:') && !readyHandled) {
            readyHandled = true;
            await tenantDb.collection('onboarding').updateOne(
                { service: 'whatsapp' },
                { $set: { status: 'connected', qr: null, _updatedAt: new Date() } }
            );
            await getGlobalDb().collection('users').updateOne(
                { username: req.user.username },
                { $set: { 'onboarding.whatsapp': 'connected' } }
            );
            activeSessions.delete(`wa_${tenantId}`);
            provisionTenant(tenantId, { tenantMongoUrl: mongoUrl }).catch(console.error);
        }
    }

    function processBuffer(flush) {
        const lines = stdoutBuf.split('\n');
        if (flush) {
            stdoutBuf = '';
        } else {
            stdoutBuf = lines.pop() || '';
        }
        for (const line of lines) {
            if (line.trim()) handleLine(line).catch(console.error);
        }
    }

    proc.stdout.on('data', chunk => {
        stdoutBuf += chunk.toString();
        processBuffer(false);
    });

    proc.on('close', () => {
        processBuffer(true);
        activeSessions.delete(`wa_${tenantId}`);
    });

    res.json({ status: 'started' });
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
    const tenantDb = getTenantDb(tenantId);

    if (activeSessions.has(`sig_${tenantId}`)) {
        try { activeSessions.get(`sig_${tenantId}`).proc.kill(); } catch {}
        activeSessions.delete(`sig_${tenantId}`);
    }

    await tenantDb.collection('onboarding').updateOne(
        { service: 'signal' },
        { $set: { service: 'signal', status: 'pending', linkUri: null, _updatedAt: new Date() } },
        { upsert: true }
    );

    const tenantUser = tenantLinuxUser(tenantId);
    const tenantHomeDir = tenantHome(tenantId);

    ensureLinuxUser(tenantId);

    const proc = spawn('sudo', [
        '-n', '-u', tenantUser,
        'env',
        `HOME=${tenantHomeDir}`,
        SIGNAL_CLI_PATH, 'link', '-n', `UAssist-${tenantId}`,
    ], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    activeSessions.set(`sig_${tenantId}`, { proc });

    let buffer = '';
    const onData = async chunk => {
        buffer += chunk.toString();
        const match = buffer.match(/(sgnl:\/\/linkdevice\?[^\s]+)/);
        if (match) {
            const linkUri = match[1];
            await tenantDb.collection('onboarding').updateOne(
                { service: 'signal' },
                { $set: { linkUri, _updatedAt: new Date() } }
            );
        }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('close', async code => {
        activeSessions.delete(`sig_${tenantId}`);
        if (code === 0) {
            let phone = null;
            try {
                const fs = require('fs');
                const accountsPath = path.join(tenantHomeDir, '.local/share/signal-cli/data/accounts.json');
                const data = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
                const accounts = data.accounts || [];
                phone = accounts[accounts.length - 1]?.number || null;
            } catch {}

            await tenantDb.collection('onboarding').updateOne(
                { service: 'signal' },
                { $set: { status: 'linked', linkUri: null, phone, _updatedAt: new Date() } }
            );
            await getGlobalDb().collection('users').updateOne(
                { username: req.user.username },
                { $set: { 'onboarding.signal': 'linked', signalPhone: phone } }
            );
            const mongoUrl = await getTenantMongoUrl(req.user.username);
            provisionTenant(tenantId, { signalPhone: phone, tenantMongoUrl: mongoUrl }).catch(console.error);
        }
    });

    res.json({ status: 'started' });
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
        await getGlobalDb().collection('users').updateOne(
            { username: req.user.username },
            { $set: { 'onboarding.email': 'connected', emailAddress: email, emailPassword: encrypt(password) } }
        );
        const mongoUrl = await getTenantMongoUrl(req.user.username);
        await provisionTenant(tenantId, { emailAddress: email, emailPassword: password, tenantMongoUrl: mongoUrl });
        res.json({ status: 'connected' });
    } catch (err) {
        next(err);
    }
});

// ── Slack ──────────────────────────────────────────────────────────────────────

router.post('/slack', async (req, res, next) => {
    const { tenantId } = req.user;
    const { botToken, appToken } = req.body;
    if (!botToken || !appToken) return res.status(400).json({ error: 'botToken and appToken required' });
    try {
        await getGlobalDb().collection('users').updateOne(
            { username: req.user.username },
            { $set: { 'onboarding.slack': 'connected', slackBotToken: encrypt(botToken), slackAppToken: encrypt(appToken) } }
        );
        const mongoUrl = await getTenantMongoUrl(req.user.username);
        await provisionTenant(tenantId, { slackBotToken: botToken, slackAppToken: appToken, tenantMongoUrl: mongoUrl });
        res.json({ status: 'connected' });
    } catch (err) {
        next(err);
    }
});

router.get('/slack/status', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const user = await getGlobalDb().collection('users').findOne({ tenantId });
        const status = user?.onboarding?.slack || 'idle';
        res.json({ status });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
