const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');

const WA_DATA_PATH = process.env.HOME || '/home/tenant';
const CHROMIUM_PATH = process.env.CHROMIUM_PATH || '/usr/bin/google-chrome';
const HISTORY_FETCH_LIMIT = parseInt(process.env.WA_HISTORY_LIMIT, 10) || 50;

/**
 * Fetch message history from all WhatsApp chats after initial connection.
 * Uses whatsapp-web.js's chat.fetchMessages() which leverages the WhatsApp Web
 * protocol to retrieve historical messages stored on the device/server.
 *
 * WhatsApp Web fully supports this — when a device is linked, it syncs message
 * history from the phone, making it available via the getChats/fetchMessages API.
 *
 * @param {object} client - whatsapp-web.js Client instance (must be ready)
 * @param {string} tenantId - tenant identifier
 * @param {object} whatsappCol - MongoDB collection for whatsapp messages
 * @param {object} onboardingCol - MongoDB collection for onboarding status
 * @returns {Promise<number>} number of messages saved
 */
async function fetchWhatsappHistory(client, tenantId, whatsappCol, onboardingCol) {
    try {
        console.log(`[whatsapp] Starting history sync (limit: ${HISTORY_FETCH_LIMIT} per chat)...`);
        await onboardingCol.updateOne(
            { service: 'whatsapp' },
            { $set: { historySyncStatus: 'syncing', _updatedAt: new Date() } }
        );

        const chats = await client.getChats();
        let totalSaved = 0;

        for (const chat of chats) {
            try {
                const messages = await chat.fetchMessages({ limit: HISTORY_FETCH_LIMIT });
                for (const msg of messages) {
                    // Skip if message already stored (idempotent by serialized ID)
                    const exists = await whatsappCol.findOne({
                        'id._serialized': msg.id._serialized,
                        tenantId,
                    });
                    if (exists) continue;

                    await whatsappCol.insertOne({
                        ...msg,
                        _chat: chat.name,
                        tenantId,
                        _savedAt: new Date(),
                        _fromHistory: true,
                    });
                    totalSaved++;
                }
            } catch (chatErr) {
                console.error(`[whatsapp] Failed to fetch history for chat "${chat.name}":`, chatErr.message);
            }
        }

        await onboardingCol.updateOne(
            { service: 'whatsapp' },
            { $set: { historySyncStatus: 'done', historySyncCount: totalSaved, historySyncAt: new Date(), _updatedAt: new Date() } }
        );
        console.log(`[whatsapp] History sync complete: ${totalSaved} messages saved from ${chats.length} chats.`);
        return totalSaved;
    } catch (err) {
        console.error('[whatsapp] History sync failed:', err.message);
        await onboardingCol.updateOne(
            { service: 'whatsapp' },
            { $set: { historySyncStatus: 'error', historySyncError: err.message, _updatedAt: new Date() } }
        );
        return 0;
    }
}

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
            args: ['--no-sandbox', '--disable-setuid-sandbox', '--disable-dev-shm-usage'],
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

        // Automatically fetch history on first connection or when sync was requested
        const onboardDoc = await onboardingCol.findOne({ service: 'whatsapp' });
        const syncStatus = onboardDoc?.historySyncStatus;
        const existingCount = await whatsappCol.countDocuments({ tenantId });
        if (existingCount === 0 || syncStatus === 'pending') {
            await fetchWhatsappHistory(client, tenantId, whatsappCol, onboardingCol);
        }

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

module.exports = { runWhatsapp, fetchWhatsappHistory };
