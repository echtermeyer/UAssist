require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { MongoClient } = require('mongodb');

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

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
    console.log('✅ Connected!');
    await initDb();

    // Poll outbox for pending messages to send
    setInterval(async () => {
        const pending = await outbox.find({ status: 'pending' }).toArray();
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
    try {
        await collection.insertOne({ ...msg, _chat: chat.name, _savedAt: new Date() });
    } catch (err) {
        console.error('Failed to save message:', err.message);
    }
});

client.initialize();
