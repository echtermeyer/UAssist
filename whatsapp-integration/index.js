require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode');
const { MongoClient } = require('mongodb');
const path = require('path');

const TENANT_ID = process.env.TENANT_ID || 'default';
const WA_DATA_PATH = process.env.WA_DATA_PATH || path.join(__dirname, '.wwebjs_auth');
const ONBOARD_MODE = process.env.WA_ONBOARD_MODE === '1';

const mongo = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017/uassist');
let collection;
let outbox;

async function initDb() {
    await mongo.connect();
    const db = mongo.db();
    collection = db.collection('whatsapp');
    outbox = db.collection('whatsapp_outbox');
    await outbox.createIndex({ _createdAt: 1 }, { expireAfterSeconds: 604800 });
    console.log('✅ MongoDB ready!');
}

// Each tenant gets its own session directory and clientId
const client = new Client({
    authStrategy: new LocalAuth({
        clientId: TENANT_ID,
        dataPath: WA_DATA_PATH,
    }),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', async qr => {
    if (ONBOARD_MODE) {
        // Emit QR as base64 PNG to stdout for the API to pick up
        try {
            const dataUrl = await qrcode.toDataURL(qr);
            process.stdout.write(`QR:${dataUrl}\n`);
        } catch {
            process.stdout.write(`QR:${qr}\n`);
        }
    } else {
        // Fallback for terminal use
        const qrcodeTerminal = require('qrcode-terminal');
        qrcodeTerminal.generate(qr, { small: true });
    }
});

client.on('ready', async () => {
    console.log('✅ Connected!');
    if (ONBOARD_MODE) {
        // Signal to the API that auth is complete
        process.stdout.write(`READY:${TENANT_ID}\n`);
        // In onboard mode, stay alive briefly then exit — persistent process takes over
        setTimeout(() => process.exit(0), 2000);
        return;
    }
    await initDb();

    setInterval(async () => {
        const tenantFilter = { status: 'pending', tenantId: TENANT_ID };
        const pending = await outbox.find(tenantFilter).toArray();
        for (const job of pending) {
            try {
                await client.sendMessage(`${job.to}@c.us`, job.message);
                await outbox.updateOne({ _id: job._id }, { $set: { status: 'sent' } });
            } catch (e) {
                await outbox.updateOne({ _id: job._id }, { $set: { status: 'failed', error: e.message } });
            }
        }
    }, 2000);
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    console.log(`[${chat.name}] ${msg.body}`);
    if (ONBOARD_MODE) return;
    try {
        await collection.insertOne({ ...msg, _chat: chat.name, tenantId: TENANT_ID, _savedAt: new Date() });
    } catch (err) {
        console.error('Failed to save message:', err.message);
    }
});

client.initialize();
