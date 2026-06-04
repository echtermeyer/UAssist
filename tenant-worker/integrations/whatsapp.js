const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const { encryptWithKey, decryptWithKey, isEncrypted } = require('../lib/crypto');

const WA_DATA_PATH = process.env.HOME || '/home/tenant';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/google-chrome';

async function runWhatsapp(tenantId, tenantDb, globalDb, dataKey) {
    const lockFile = path.join(WA_DATA_PATH, `session-${tenantId}`, 'SingletonLock');
    try { fs.unlinkSync(lockFile); console.log('[whatsapp] removed stale lock file'); } catch {}

    const onboardingCol = tenantDb.collection('onboarding');
    const whatsappCol = tenantDb.collection('whatsapp');
    const outboxCol = tenantDb.collection('whatsapp_outbox');

    await onboardingCol.updateOne(
        { service: 'whatsapp' },
        { $setOnInsert: { service: 'whatsapp', status: 'idle', _updatedAt: new Date() } },
        { upsert: true }
    );

    console.log('[whatsapp] creating client, chromium:', CHROMIUM_PATH);

    const client = new Client({
        authStrategy: new LocalAuth({ clientId: tenantId, dataPath: WA_DATA_PATH }),
        puppeteer: {
            executablePath: CHROMIUM_PATH,
            args: [
                '--no-sandbox',
                '--disable-setuid-sandbox',
                '--disable-dev-shm-usage',
                '--disable-gpu',
                '--disable-extensions',
                '--disable-background-networking',
                '--disable-default-apps',
                '--disable-sync',
                '--disable-translate',
                '--no-first-run',
                '--mute-audio',
                '--disable-background-timer-throttling',
                '--disable-renderer-backgrounding',
            ],
        },
    });

    client.on('loading_screen', (percent, message) => {
        console.log(`[whatsapp] loading ${percent}% — ${message}`);
    });

    client.on('authenticated', () => {
        console.log('[whatsapp] authenticated (session loaded)');
    });

    client.on('auth_failure', msg => {
        console.error('[whatsapp] auth_failure:', msg);
    });

    client.on('qr', async qr => {
        console.log('[whatsapp] QR generated — scan now');
        try {
            const dataUrl = await qrcode.toDataURL(qr);
            await onboardingCol.updateOne(
                { service: 'whatsapp' },
                { $set: { status: 'pending', qr: dataUrl, _updatedAt: new Date() } }
            );
        } catch (err) {
            console.error('[whatsapp] QR error:', err.message);
        }
    });

    client.on('ready', async () => {
        console.log('[whatsapp] ready — connected and synced');
        await onboardingCol.updateOne(
            { service: 'whatsapp' },
            { $set: { status: 'connected', qr: null, _updatedAt: new Date() } }
        );
        await globalDb.collection('users').updateOne(
            { tenantId },
            { $set: { 'onboarding.whatsapp': 'connected' } }
        );
        await outboxCol.createIndex({ _createdAt: 1 }, { expireAfterSeconds: 604800 }).catch(() => {});

        setInterval(async () => {
            const pending = await outboxCol.find({ status: 'pending', tenantId }).toArray();
            for (const job of pending) {
                try {
                    const plaintext = isEncrypted(job.message) ? decryptWithKey(job.message, dataKey) : job.message;
                    await client.sendMessage(`${job.to}@c.us`, plaintext);
                    await outboxCol.updateOne({ _id: job._id }, { $set: { status: 'sent' } });
                    console.log('[whatsapp] sent outbox message to', job.to);
                } catch (e) {
                    console.error('[whatsapp] failed to send outbox:', e.message);
                    await outboxCol.updateOne({ _id: job._id }, { $set: { status: 'failed', error: e.message } });
                }
            }
        }, 2000);
    });

    const saveMessage = async msg => {
        const chat = await msg.getChat();
        console.log(`[whatsapp] message from ${chat.name || msg.from} (${msg.type})`);
        try {
            await whatsappCol.insertOne({
                from: msg.from,
                to: msg.to,
                body: encryptWithKey(msg.body || '', dataKey),
                type: msg.type,
                timestamp: msg.timestamp,
                id: msg.id,
                hasMedia: msg.hasMedia,
                _chat: chat.name,
                tenantId,
                _savedAt: new Date(),
            });
        } catch (err) {
            console.error('[whatsapp] failed to save message:', err.message);
        }
    };

    client.on('message', saveMessage);
    client.on('message_create', saveMessage);

    client.on('disconnected', reason => {
        console.error('[whatsapp] disconnected:', reason);
    });

    console.log('[whatsapp] initializing client...');
    await client.initialize();

    return new Promise((_, reject) => {
        client.on('disconnected', reason => reject(new Error(`WhatsApp disconnected: ${reason}`)));
    });
}

module.exports = { runWhatsapp };
