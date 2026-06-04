const { App } = require('@slack/bolt');
const { encryptWithKey, decryptWithKey, isEncrypted } = require('../lib/crypto');

async function runSlack(botToken, appToken, tenantId, tenantDb, dataKey) {
    const collection = tenantDb.collection('slack');
    const outbox = tenantDb.collection('slack_outbox');
    await outbox.createIndex({ _createdAt: 1 }, { expireAfterSeconds: 604800 }).catch(() => {});

    const slackApp = new App({ token: botToken, appToken, socketMode: true });

    slackApp.message(async ({ message }) => {
        if (message.subtype) return;
        try {
            await collection.insertOne({
                from: message.user,
                channel: message.channel,
                message: encryptWithKey(message.text || '', dataKey),
                ts: message.ts,
                tenantId,
                _savedAt: new Date(),
            });
        } catch (err) {
            console.error('[slack] Failed to save:', err.message);
        }
    });

    setInterval(async () => {
        const pending = await outbox.find({ status: 'pending', tenantId }).toArray();
        for (const job of pending) {
            try {
                const plaintext = isEncrypted(job.message) ? decryptWithKey(job.message, dataKey) : job.message;
                await slackApp.client.chat.postMessage({ channel: job.to, text: plaintext });
                await outbox.updateOne({ _id: job._id }, { $set: { status: 'sent' } });
            } catch (e) {
                await outbox.updateOne({ _id: job._id }, { $set: { status: 'failed', error: e.message } });
            }
        }
    }, 2000);

    await slackApp.start();
    console.log('[slack] Socket Mode connected');

    return new Promise(() => {});
}

module.exports = { runSlack };
