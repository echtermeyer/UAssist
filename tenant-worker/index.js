const { MongoClient } = require('mongodb');
const { decrypt, isEncrypted } = require('./lib/crypto');
const { runWhatsapp } = require('./integrations/whatsapp');
const { runSignal } = require('./integrations/signal');
const { runEmail } = require('./integrations/email');
const { runSlack } = require('./integrations/slack');

process.on('uncaughtException', err => {
    console.error('[tenant-worker] Uncaught exception:', err.message);
});

process.on('unhandledRejection', err => {
    console.error('[tenant-worker] Unhandled rejection:', err.message);
});

const TENANT_ID = process.env.TENANT_ID;
const MONGO_URL = process.env.MONGO_URL;

async function main() {
    if (!TENANT_ID || !MONGO_URL) {
        console.error('TENANT_ID and MONGO_URL are required');
        process.exit(1);
    }

    const mongo = new MongoClient(MONGO_URL);
    await mongo.connect();

    const globalDb = mongo.db('uassist');
    const tenantDb = mongo.db(`uassist_${TENANT_ID}`);

    const user = await globalDb.collection('users').findOne({ tenantId: TENANT_ID });
    if (!user) {
        console.error(`No user found for tenantId: ${TENANT_ID}`);
        process.exit(1);
    }

    console.log(`[tenant-worker] Starting for tenant: ${TENANT_ID}`);

    const runners = [];

    runners.push(
        runWhatsapp(TENANT_ID, tenantDb, globalDb).catch(err => {
            console.error('[whatsapp] crashed:', err.message);
        })
    );

    if (user.onboarding?.signal) {
        runners.push(
            runSignal(TENANT_ID, tenantDb, globalDb).catch(err => {
                console.error('[signal] crashed:', err.message);
            })
        );
    }

    if (user.emailAddress) {
        const emailPassword = isEncrypted(user.emailPassword)
            ? decrypt(user.emailPassword)
            : user.emailPassword;
        runners.push(
            runEmail(user.emailAddress, emailPassword, TENANT_ID, tenantDb).catch(err => {
                console.error('[email] crashed:', err.message);
            })
        );
    }

    if (user.slackBotToken) {
        const botToken = isEncrypted(user.slackBotToken) ? decrypt(user.slackBotToken) : user.slackBotToken;
        const appToken = isEncrypted(user.slackAppToken) ? decrypt(user.slackAppToken) : user.slackAppToken;
        runners.push(
            runSlack(botToken, appToken, TENANT_ID, tenantDb).catch(err => {
                console.error('[slack] crashed:', err.message);
            })
        );
    }

    await Promise.all(runners);
}

main().catch(err => {
    console.error('[tenant-worker] Fatal:', err.message);
    process.exit(1);
});
