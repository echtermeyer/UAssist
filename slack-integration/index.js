require('dotenv').config();
const { App } = require('@slack/bolt');
const { MongoClient } = require('mongodb');

const TENANT_ID = process.env.TENANT_ID || 'default';

const mongo = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017/uassist');
let collection;
let outbox;
let slackApp;

async function getCredentials() {
    const botToken = process.env.SLACK_BOT_TOKEN;
    const appToken = process.env.SLACK_APP_TOKEN;
    if (!botToken || !appToken) return null;
    return { botToken, appToken };
}

async function run() {
    await mongo.connect();
    const db = mongo.db();
    collection = db.collection('slack');
    outbox = db.collection('slack_outbox');
    await outbox.createIndex({ _createdAt: 1 }, { expireAfterSeconds: 604800 });
    console.log('✅ MongoDB ready!');

    const creds = await getCredentials();
    if (!creds) {
        console.error('No Slack credentials found. Complete onboarding or set SLACK_BOT_TOKEN/SLACK_APP_TOKEN.');
        process.exit(1);
    }

    slackApp = new App({
        token: creds.botToken,
        appToken: creds.appToken,
        socketMode: true,
    });

    slackApp.message(async ({ message }) => {
        if (message.subtype) return;
        console.log(`[${message.channel}] ${message.text}`);
        try {
            await collection.insertOne({
                from: message.user,
                channel: message.channel,
                message: message.text,
                ts: message.ts,
                tenantId: TENANT_ID,
                _savedAt: new Date(),
            });
        } catch (err) {
            console.error('Failed to save message:', err.message);
        }
    });

    setInterval(async () => {
        const pending = await outbox.find({ status: 'pending', tenantId: TENANT_ID }).toArray();
        for (const job of pending) {
            try {
                await slackApp.client.chat.postMessage({ channel: job.to, text: job.message });
                await outbox.updateOne({ _id: job._id }, { $set: { status: 'sent' } });
            } catch (e) {
                await outbox.updateOne({ _id: job._id }, { $set: { status: 'failed', error: e.message } });
            }
        }
    }, 2000);

    await slackApp.start();
    console.log('✅ Slack Socket Mode connected!');
}

run().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
