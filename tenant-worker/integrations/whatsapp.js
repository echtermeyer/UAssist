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
    const profilePicsCol = tenantDb.collection('profile_pics');
    const contactPicsCol = tenantDb.collection('contact_pics');
    const pictureCache = new Map();

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

        // Pre-populate profile pics for recent chats so existing messages get pictures too
        (async () => {
            try {
                const chats = await client.getChats();
                for (const chat of chats.slice(0, 50)) {
                    await new Promise(r => setTimeout(r, 150));
                    try {
                        const url = await client.getProfilePicUrl(chat.id._serialized) || '';
                        if (url) {
                            await profilePicsCol.updateOne(
                                { chatName: chat.name },
                                { $set: { chatName: chat.name, url, _updatedAt: new Date() } },
                                { upsert: true }
                            );
                        }
                    } catch {}
                }
                console.log('[whatsapp] profile pics pre-populated');
            } catch (err) {
                console.error('[whatsapp] profile pic pre-population failed:', err.message);
            }
        })();

        // Pre-populate contact pics (individual people, not groups) once a day
        (async () => {
            try {
                const contacts = await client.getContacts();
                const now = Date.now();
                for (const contact of contacts) {
                    const jid = contact.id?._serialized;
                    if (!jid || jid.includes('@g.us') || jid.includes('@broadcast') || jid.includes('@lid')) continue;
                    const existing = await contactPicsCol.findOne({ jid });
                    if (existing && (now - new Date(existing._updatedAt).getTime() < 86400000)) continue;
                    await new Promise(r => setTimeout(r, 150));
                    try {
                        const url = await client.getProfilePicUrl(jid) || '';
                        await contactPicsCol.updateOne(
                            { jid },
                            { $set: { jid, url, _updatedAt: new Date() } },
                            { upsert: true }
                        );
                    } catch {}
                }
                console.log('[whatsapp] contact pics pre-populated');
            } catch (err) {
                console.error('[whatsapp] contact pic pre-population failed:', err.message);
            }
        })();
    });

    const saveMessage = async msg => {
        const SKIP_TYPES = ['e2e_notification', 'notification_template', 'call_log', 'protocol', 'revoked'];
        if (SKIP_TYPES.includes(msg.type)) return;

        const chat = await msg.getChat();
        console.log(`[whatsapp] message from ${chat.name || msg.from} (${msg.type})`);

        // For received messages, get the individual sender's name.
        // Group messages have msg.author = individual sender JID; direct messages use msg.getContact().
        let fromName = '';
        if (!msg.fromMe) {
            try {
                if (msg.author) {
                    const contact = await client.getContactById(msg.author);
                    fromName = contact.pushname || contact.name || '';
                } else {
                    const contact = await msg.getContact();
                    fromName = contact.pushname || contact.name || '';
                }
            } catch {}
        }

        // Refresh contact pic for group message sender (24h TTL)
        if (msg.author) {
            const existing = await contactPicsCol.findOne({ jid: msg.author });
            if (!existing || (Date.now() - new Date(existing._updatedAt).getTime() > 86400000)) {
                let url = '';
                try { url = await client.getProfilePicUrl(msg.author) || ''; } catch {}
                contactPicsCol.updateOne(
                    { jid: msg.author },
                    { $set: { jid: msg.author, url, _updatedAt: new Date() } },
                    { upsert: true }
                ).catch(() => {});
            }
        }

        // Refresh profile pic for this chat and store in profile_pics collection.
        // Using a separate collection (not per-message) means old messages benefit from fresh URLs.
        const picJid = chat.id._serialized;
        if (!pictureCache.has(picJid)) {
            let pictureUrl = '';
            try { pictureUrl = await client.getProfilePicUrl(picJid) || ''; } catch {}
            pictureCache.set(picJid, pictureUrl);
            setTimeout(() => pictureCache.delete(picJid), 3600000);
            if (pictureUrl) {
                profilePicsCol.updateOne(
                    { chatName: chat.name },
                    { $set: { chatName: chat.name, url: pictureUrl, _updatedAt: new Date() } },
                    { upsert: true }
                ).catch(() => {});
            }
        }

        try {
            await whatsappCol.updateOne(
                { 'id._serialized': msg.id._serialized },
                { $setOnInsert: {
                    from: encryptWithKey(msg.from || '', dataKey),
                    to: encryptWithKey(msg.to || '', dataKey),
                    body: encryptWithKey(msg.body || '', dataKey),
                    type: msg.type,
                    timestamp: msg.timestamp,
                    id: msg.id,
                    hasMedia: msg.hasMedia,
                    _chat: encryptWithKey(chat.name || '', dataKey),
                    fromName: encryptWithKey(fromName, dataKey),
                    author: encryptWithKey(msg.author || '', dataKey),
                    tenantId,
                    _savedAt: new Date(),
                }},
                { upsert: true }
            );
        } catch (err) {
            console.error('[whatsapp] failed to save message:', err.message);
        }
    };

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
