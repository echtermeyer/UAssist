const { ImapFlow } = require('imapflow');

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

async function fetchMessage(client, seq) {
    const msg = await client.fetchOne(seq, { envelope: true, bodyStructure: true });
    return msg?.envelope;
}

async function run() {
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
        const seq = data.count;
        const envelope = await fetchMessage(client, seq);
        if (!envelope) return;
        console.log(`📧 New email`);
        console.log(`   From:    ${envelope.from?.[0]?.address}`);
        console.log(`   Subject: ${envelope.subject}`);
        console.log(`   Date:    ${envelope.date}`);
    });

    await client.idle();
    lock.release();
    await client.logout();
}

run().catch(err => {
    console.error('Fatal:', err.message);
    console.error(err);
    process.exit(1);
});
