require('dotenv').config();
const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { MongoClient } = require('mongodb');

const mongo = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017/uassist');
let collection;

async function initDb() {
    await mongo.connect();
    collection = mongo.db().collection('whatsapp');
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
