require('dotenv').config();
const { ImapFlow } = require('imapflow');
const { MongoClient } = require('mongodb');

const IMAP_HOSTS = {
    'gmail.com': 'imap.gmail.com',
    'googlemail.com': 'imap.gmail.com',
    'outlook.com': 'outlook.office365.com',
    'hotmail.com': 'outlook.office365.com',
    'live.com': 'outlook.office365.com',
    'gmx.net': 'imap.gmx.net',
    'gmx.de': 'imap.gmx.net',
    'yahoo.com': 'imap.mail.yahoo.com',
};

const EMAIL = process.env.EMAIL;
const PASSWORD = process.env.PASSWORD;

if (!EMAIL || !PASSWORD) {
    console.error('EMAIL and PASSWORD env vars required');
    process.exit(1);
}

function resolveHost(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    return IMAP_HOSTS[domain] ?? `imap.${domain}`;
}

async function run() {
    const mongo = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017/uassist');
    await mongo.connect();
    const collection = mongo.db().collection('email');
    console.log('✅ MongoDB ready!');

    const host = resolveHost(EMAIL);
    const client = new ImapFlow({
        host,
        port: 993,
        secure: true,
        auth: { user: EMAIL, pass: PASSWORD },
        logger: false,
    });

    await client.connect();
    console.log(`✅ Connected to ${host} as ${EMAIL}`);

    const lock = await client.getMailboxLock('INBOX');

    client.on('exists', async data => {
        const msg = await client.fetchOne(data.count, { envelope: true, bodyStructure: true });
        if (!msg) return;
        console.log(`📧 [${msg.envelope?.from?.[0]?.address}] ${msg.envelope?.subject}`);
        console.log('msg keys:', Object.keys(msg));
        console.log('msg JSON:', JSON.stringify(msg));
        try {
            const doc = JSON.parse(JSON.stringify({ ...msg, _account: EMAIL, _savedAt: new Date() }));
            console.log('inserting doc:', JSON.stringify(doc));
            const result = await collection.insertOne(doc);
            console.log('inserted:', result.insertedId);
        } catch (err) {
            console.error('Failed to save message:', err);
        }
    });

    while (client.usable) {
        await client.idle();
    }

    lock.release();
    await client.logout();
}

run().catch(err => {
    console.error('Fatal:', err.message);
    console.error(err);
    process.exit(1);
});
