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

function resolveHost(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    return IMAP_HOSTS[domain] ?? `imap.${domain}`;
}

async function runEmail(emailAddress, emailPassword, tenantId, tenantDb) {
    const collection = tenantDb.collection('email');
    const host = resolveHost(emailAddress);

    const client = new ImapFlow({
        host,
        port: 993,
        secure: true,
        auth: { user: emailAddress, pass: emailPassword },
        logger: false,
    });

    await client.connect();
    console.log(`[email] Connected to ${host} as ${emailAddress}`);

    const lock = await client.getMailboxLock('INBOX');

    client.on('exists', async data => {
        const msg = await client.fetchOne(data.count, { envelope: true, bodyStructure: true, bodyParts: ['1', '2'] });
        if (!msg) return;
        const subject = msg.envelope?.subject;
        const from = msg.envelope?.from?.[0]?.address;
        console.log(`[email] [${from}] ${subject}`);
        try {
            await collection.insertOne({
                ...JSON.parse(JSON.stringify(msg)),
                bodyText: msg.bodyParts?.get('1')?.toString('utf-8')?.trim() || null,
                bodyHtml: msg.bodyParts?.get('2')?.toString('utf-8')?.trim() || null,
                _account: emailAddress,
                tenantId,
                _savedAt: new Date(),
            });
        } catch (err) {
            console.error('[email] Failed to save:', err.message);
        }
    });

    return new Promise((_, reject) => {
        (async () => {
            while (client.usable) await client.idle();
            lock.release();
            await client.logout();
            reject(new Error('IMAP connection closed'));
        })();
    });
}

module.exports = { runEmail };
