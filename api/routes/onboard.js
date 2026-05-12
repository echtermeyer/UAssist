const { Router } = require('express');
const { spawn, execFile } = require('child_process');
const path = require('path');
const { getDb } = require('../lib/db');
const { provisionTenant, tenantLinuxUser, tenantHome } = require('../lib/pm2');

const router = Router();

const UASSIST_ROOT = process.env.UASSIST_ROOT || '/home/deploy/UAssist';
const SIGNAL_CLI_PATH = process.env.SIGNAL_CLI_PATH || 'signal-cli';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/uassist';

// In-memory map of active onboarding sessions (tenantId -> child process)
// These are short-lived — only alive during the QR scan window
const activeSessions = new Map();

// ── WhatsApp ──────────────────────────────────────────────────────────────────

// POST /onboard/whatsapp — start onboarding, spawn a temp WA client
router.post('/whatsapp', async (req, res, next) => {
    const { tenantId } = req.user;
    const db = getDb();

    // Kill any existing session for this tenant
    if (activeSessions.has(`wa_${tenantId}`)) {
        try { activeSessions.get(`wa_${tenantId}`).proc.kill(); } catch {}
        activeSessions.delete(`wa_${tenantId}`);
    }

    await db.collection('onboarding').updateOne(
        { tenantId, service: 'whatsapp' },
        { $set: { tenantId, service: 'whatsapp', status: 'pending', qr: null, _updatedAt: new Date() } },
        { upsert: true }
    );

    // Spawn a dedicated onboarding process as the tenant's Linux user
    // sudo -n -u ua_<tenantId> ensures the WA session is written into their locked home dir
    const tenantUser = tenantLinuxUser(tenantId);
    const tenantHomeDir = tenantHome(tenantId);
    const proc = spawn('sudo', [
        '-n', '-u', tenantUser,
        'node', path.join(UASSIST_ROOT, 'whatsapp-integration/index.js'),
    ], {
        env: {
            ...process.env,
            MONGO_URL,
            TENANT_ID: tenantId,
            WA_DATA_PATH: tenantHomeDir,  // sessions → /home/ua_<tid>/wa-session/
            HOME: tenantHomeDir,
            WA_ONBOARD_MODE: '1',
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    activeSessions.set(`wa_${tenantId}`, { proc });

    // Buffer stdout to handle large QR base64 strings split across multiple chunks
    let stdoutBuf = '';
    proc.stdout.on('data', async chunk => {
        stdoutBuf += chunk.toString();
        const lines = stdoutBuf.split('\n');
        stdoutBuf = lines.pop(); // keep incomplete last line in buffer
        for (const line of lines) {
            if (line.startsWith('QR:')) {
                const qrData = line.slice(3).trim();
                if (qrData) {
                    await db.collection('onboarding').updateOne(
                        { tenantId, service: 'whatsapp' },
                        { $set: { qr: qrData, _updatedAt: new Date() } }
                    );
                }
            } else if (line.startsWith('READY:')) {
                await db.collection('onboarding').updateOne(
                    { tenantId, service: 'whatsapp' },
                    { $set: { status: 'connected', qr: null, _updatedAt: new Date() } }
                );
                await db.collection('users').updateOne(
                    { username: req.user.username },
                    { $set: { 'onboarding.whatsapp': 'connected' } }
                );
                activeSessions.delete(`wa_${tenantId}`);
                // Provision the persistent process
                provisionTenant(tenantId).catch(console.error);
            }
        }
    });

    proc.on('close', async () => {
        activeSessions.delete(`wa_${tenantId}`);
    });

    res.json({ status: 'started' });
});

// GET /onboard/whatsapp/status — poll for QR or connected state
router.get('/whatsapp/status', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const doc = await getDb().collection('onboarding').findOne({ tenantId, service: 'whatsapp' });
        if (!doc) return res.json({ status: 'idle' });
        res.json({ status: doc.status, qr: doc.qr || null });
    } catch (err) {
        next(err);
    }
});

// ── Signal ────────────────────────────────────────────────────────────────────

// POST /onboard/signal — run signal-cli link, capture linkdevice URI
router.post('/signal', async (req, res, next) => {
    const { tenantId } = req.user;
    const db = getDb();

    if (activeSessions.has(`sig_${tenantId}`)) {
        try { activeSessions.get(`sig_${tenantId}`).proc.kill(); } catch {}
        activeSessions.delete(`sig_${tenantId}`);
    }

    await db.collection('onboarding').updateOne(
        { tenantId, service: 'signal' },
        { $set: { tenantId, service: 'signal', status: 'pending', linkUri: null, _updatedAt: new Date() } },
        { upsert: true }
    );

    const tenantUser = tenantLinuxUser(tenantId);
    const tenantHomeDir = tenantHome(tenantId);
    const proc = spawn('sudo', [
        '-n', '-u', tenantUser,
        SIGNAL_CLI_PATH, 'link', '-n', `UAssist-${tenantId}`,
    ], {
        env: {
            ...process.env,
            HOME: tenantHomeDir,  // signal-cli reads/writes $HOME/.local/share/signal-cli
        },
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    activeSessions.set(`sig_${tenantId}`, { proc });

    let buffer = '';
    const onData = async chunk => {
        buffer += chunk.toString();
        // signal-cli emits the link URI on stdout: sgnl://linkdevice?uuid=...
        const match = buffer.match(/(sgnl:\/\/linkdevice\?[^\s]+)/);
        if (match) {
            const linkUri = match[1];
            await db.collection('onboarding').updateOne(
                { tenantId, service: 'signal' },
                { $set: { linkUri, _updatedAt: new Date() } }
            );
        }
    };

    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    proc.on('close', async code => {
        activeSessions.delete(`sig_${tenantId}`);
        if (code === 0) {
            // Linked successfully — find the new account number from the tenant's signal-cli data
            let phone = null;
            try {
                const fs = require('fs');
                const accountsPath = path.join(tenantHomeDir, '.local/share/signal-cli/data/accounts.json');
                const data = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
                const accounts = data.accounts || [];
                phone = accounts[accounts.length - 1]?.number || null;
            } catch {}

            await db.collection('onboarding').updateOne(
                { tenantId, service: 'signal' },
                { $set: { status: 'linked', linkUri: null, phone, _updatedAt: new Date() } }
            );
            await db.collection('users').updateOne(
                { username: req.user.username },
                { $set: { 'onboarding.signal': 'linked', signalPhone: phone } }
            );
            provisionTenant(tenantId, { signalPhone: phone }).catch(console.error);
        }
    });

    res.json({ status: 'started' });
});

// GET /onboard/signal/status
router.get('/signal/status', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const doc = await getDb().collection('onboarding').findOne({ tenantId, service: 'signal' });
        if (!doc) return res.json({ status: 'idle' });
        res.json({ status: doc.status, linkUri: doc.linkUri || null });
    } catch (err) {
        next(err);
    }
});

// ── Email ─────────────────────────────────────────────────────────────────────

// POST /onboard/email — save credentials in DB (not ecosystem), provision email process
router.post('/email', async (req, res, next) => {
    const { tenantId } = req.user;
    const { email, password } = req.body;
    if (!email || !password) return res.status(400).json({ error: 'email and password required' });
    try {
        // Store credentials in MongoDB — email process reads them from DB at startup
        await getDb().collection('users').updateOne(
            { username: req.user.username },
            { $set: { 'onboarding.email': 'connected', emailAddress: email, emailPassword: password } }
        );
        // Provision without passing creds to ecosystem (process reads from DB)
        await provisionTenant(tenantId, { emailAddress: email });
        res.json({ status: 'connected' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
