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

function resolveHost(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    return IMAP_HOSTS[domain] ?? `imap.${domain}`;
}

function getCredentials() {
    const email = process.env.EMAIL;
    const password = process.env.EMAIL_PASSWORD || process.env.PASSWORD;
    if (!email || !password) return null;
    return { email, password };
}

async function run() {
    const mongo = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017/uassist');
    await mongo.connect();
    const db = mongo.db();
    const collection = db.collection('email');
    console.log('✅ MongoDB ready!');

    const creds = getCredentials();
    if (!creds) {
        console.error('No email credentials found. Set EMAIL/PASSWORD env vars or complete onboarding.');
        process.exit(1);
    }

    const { email: EMAIL, password: PASSWORD } = creds;
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
        const msg = await client.fetchOne(data.count, { envelope: true, bodyStructure: true, bodyParts: ['1', '2'] });
        if (!msg) return;

        const subject = msg.envelope?.subject;
        const from = msg.envelope?.from?.[0]?.address;
        console.log(`📧 [${from}] ${subject}`);

        const bodyText = msg.bodyParts?.get('1')?.toString('utf-8')?.trim() || null;
        const bodyHtml = msg.bodyParts?.get('2')?.toString('utf-8')?.trim() || null;

        try {
            const doc = JSON.parse(JSON.stringify({
                ...msg,
                bodyText,
                bodyHtml,
                _account: EMAIL,
                tenantId: process.env.TENANT_ID || 'default',
                _savedAt: new Date()
            }));
            await collection.insertOne(doc);
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
