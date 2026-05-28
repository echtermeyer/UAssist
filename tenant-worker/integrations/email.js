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

const EMAIL_HISTORY_LIMIT = parseInt(process.env.EMAIL_HISTORY_LIMIT, 10) || 50;

function resolveHost(email) {
    const domain = email.split('@')[1]?.toLowerCase();
    return IMAP_HOSTS[domain] ?? `imap.${domain}`;
}

/**
 * Fetch email history via IMAP.
 * IMAP fully supports fetching historical messages — this uses the FETCH command
 * to retrieve the last N emails from INBOX by sequence number.
 *
 * @param {string} emailAddress - IMAP login email
 * @param {string} emailPassword - IMAP login password
 * @param {string} tenantId - tenant identifier
 * @param {object} tenantDb - tenant MongoDB database instance
 * @returns {Promise<number>} number of emails saved
 */
async function fetchEmailHistory(emailAddress, emailPassword, tenantId, tenantDb) {
    const collection = tenantDb.collection('email');
    const onboardingCol = tenantDb.collection('onboarding');
    const host = resolveHost(emailAddress);

    const client = new ImapFlow({
        host,
        port: 993,
        secure: true,
        auth: { user: emailAddress, pass: emailPassword },
        logger: false,
    });

    try {
        console.log(`[email] Starting history sync for ${emailAddress} (limit: ${EMAIL_HISTORY_LIMIT})...`);
        await onboardingCol.updateOne(
            { service: 'email' },
            { $set: { service: 'email', historySyncStatus: 'syncing', _updatedAt: new Date() } },
            { upsert: true }
        );

        await client.connect();
        const lock = await client.getMailboxLock('INBOX');

        let totalSaved = 0;
        try {
            const totalMessages = client.mailbox.exists;
            if (totalMessages > 0) {
                const startSeq = Math.max(1, totalMessages - EMAIL_HISTORY_LIMIT + 1);
                const range = `${startSeq}:*`;

                for await (const msg of client.fetch(range, { envelope: true, bodyStructure: true, bodyParts: ['1', '2'] })) {
                    if (!msg?.envelope) continue;

                    // Skip duplicates by Message-ID
                    const messageId = msg.envelope.messageId;
                    if (messageId) {
                        const exists = await collection.findOne({ 'envelope.messageId': messageId, tenantId });
                        if (exists) continue;
                    }

                    await collection.insertOne({
                        ...JSON.parse(JSON.stringify(msg)),
                        bodyText: msg.bodyParts?.get('1')?.toString('utf-8')?.trim() || null,
                        bodyHtml: msg.bodyParts?.get('2')?.toString('utf-8')?.trim() || null,
                        _account: emailAddress,
                        tenantId,
                        _savedAt: new Date(),
                        _fromHistory: true,
                    });
                    totalSaved++;
                }
            }
        } finally {
            lock.release();
        }

        await client.logout();

        await onboardingCol.updateOne(
            { service: 'email' },
            { $set: { historySyncStatus: 'done', historySyncCount: totalSaved, historySyncAt: new Date(), _updatedAt: new Date() } }
        );
        console.log(`[email] History sync complete: ${totalSaved} emails saved.`);
        return totalSaved;
    } catch (err) {
        console.error('[email] History sync failed:', err.message);
        await onboardingCol.updateOne(
            { service: 'email' },
            { $set: { historySyncStatus: 'error', historySyncError: err.message, _updatedAt: new Date() } }
        ).catch(() => {});
        return 0;
    }
}

async function runEmail(emailAddress, emailPassword, tenantId, tenantDb) {
    const collection = tenantDb.collection('email');
    const onboardingCol = tenantDb.collection('onboarding');
    const host = resolveHost(emailAddress);

    // Fetch history on first connection or when sync was requested
    const onboardDoc = await onboardingCol.findOne({ service: 'email' });
    const syncStatus = onboardDoc?.historySyncStatus;
    const existingCount = await collection.countDocuments({ tenantId });
    if (existingCount === 0 || syncStatus === 'pending') {
        await fetchEmailHistory(emailAddress, emailPassword, tenantId, tenantDb);
    }

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

module.exports = { runEmail, fetchEmailHistory };
