#!/usr/bin/env node
require('dotenv').config({ path: require('path').join(__dirname, '../api/.env') });

const { MongoClient } = require('mongodb');
const { encrypt, isEncrypted } = require('../api/lib/crypto');

const FIELDS = ['emailPassword', 'slackBotToken', 'slackAppToken'];

async function run() {
    if (!process.env.MASTER_ENCRYPTION_KEY) {
        console.error('MASTER_ENCRYPTION_KEY not set — set it in api/.env first');
        process.exit(1);
    }

    const client = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017/uassist');
    await client.connect();
    const db = client.db();

    const users = await db.collection('users').find({}).toArray();
    let migrated = 0;

    for (const user of users) {
        const updates = {};
        for (const field of FIELDS) {
            const val = user[field];
            if (val && !isEncrypted(val)) {
                updates[field] = encrypt(val);
                console.log(`  ${user.username}: encrypting ${field}`);
            }
        }
        if (Object.keys(updates).length > 0) {
            await db.collection('users').updateOne({ _id: user._id }, { $set: updates });
            migrated++;
        }
    }

    console.log(`\nMigrated ${migrated} user(s). All credential fields are now encrypted.`);
    await client.close();
}

run().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
