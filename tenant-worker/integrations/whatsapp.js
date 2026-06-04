const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const WA_DATA_PATH = process.env.HOME || '/home/tenant';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/google-chrome';

async function runWhatsapp(tenantId, tenantDb, globalDb) {
    const lockFile = path.join(WA_DATA_PATH, `session-${tenantId}`, 'SingletonLock');
    try { fs.unlinkSync(lockFile); } catch {}

    const onboardingCol = tenantDb.collection('onboarding');
    const whatsappCol = tenantDb.collection('whatsapp');
    const outboxCol = tenantDb.collection('whatsapp_outbox');

    await onboardingCol.updateOne(
        { service: 'whatsapp' },
        { $setOnInsert: { service: 'whatsapp', status: 'idle', _updatedAt: new Date() } },
        { upsert: true }
    );

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

    client.on('qr', async qr => {
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
        console.log('[whatsapp] ready');
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
                    await client.sendMessage(`${job.to}@c.us`, job.message);
                    await outboxCol.updateOne({ _id: job._id }, { $set: { status: 'sent' } });
                } catch (e) {
                    await outboxCol.updateOne({ _id: job._id }, { $set: { status: 'failed', error: e.message } });
                }
            }
        }, 2000);
    });

    client.on('message', async msg => {
        const chat = await msg.getChat();
        try {
            await whatsappCol.insertOne({ ...msg, _chat: chat.name, tenantId, _savedAt: new Date() });
        } catch (err) {
            console.error('[whatsapp] Failed to save:', err.message);
        }
    });

    await client.initialize();

    return new Promise((_, reject) => {
        client.on('disconnected', reason => reject(new Error(`WhatsApp disconnected: ${reason}`)));
    });
}

module.exports = { runWhatsapp };
