#!/usr/bin/env node
// One-time migration: moves tenant data from the shared 'uassist' DB into
// per-tenant 'uassist_<tenantId>' databases and creates a MongoDB user per tenant.
// Run ONCE on the VM after deploying the per-tenant DB changes.
// Requires MONGO_ADMIN_URL in env (admin credentials).

require('dotenv').config({ path: require('path').join(__dirname, '../api/.env') });
const { MongoClient } = require('mongodb');
const { randomBytes } = require('crypto');
const { encrypt } = require('../api/lib/crypto');

const COLLECTIONS = ['whatsapp', 'whatsapp_outbox', 'email', 'signal', 'signal_contacts', 'slack', 'slack_outbox', 'onboarding'];

async function run() {
    const adminUrl = process.env.MONGO_ADMIN_URL;
    const apiUrl = process.env.MONGO_URL;

    if (!adminUrl) { console.error('MONGO_ADMIN_URL required'); process.exit(1); }
    if (!apiUrl) { console.error('MONGO_URL required'); process.exit(1); }
    if (!process.env.MASTER_ENCRYPTION_KEY) { console.error('MASTER_ENCRYPTION_KEY required'); process.exit(1); }

    const adminClient = new MongoClient(adminUrl);
    const apiClient = new MongoClient(apiUrl);

    await Promise.all([adminClient.connect(), apiClient.connect()]);
    const sharedDb = apiClient.db('uassist');
    const adminDb = adminClient.db('admin');

    const users = await sharedDb.collection('users').find({}).toArray();
    console.log(`Found ${users.length} users to migrate.\n`);

    for (const user of users) {
        const { tenantId, username } = user;
        if (!tenantId) { console.log(`  Skipping user without tenantId: ${username}`); continue; }

        const dbName = `uassist_${tenantId}`;
        const mongoUsername = `ua_${tenantId}`;
        const password = randomBytes(24).toString('hex');

        console.log(`[${username}] Creating DB '${dbName}' and user '${mongoUsername}'...`);

        const existingUsers = await adminDb.command({ usersInfo: { user: mongoUsername, db: dbName } }).catch(() => ({ users: [] }));
        if (existingUsers.users.length === 0) {
            await adminClient.db(dbName).command({
                createUser: mongoUsername,
                pwd: password,
                roles: [{ role: 'readWrite', db: dbName }],
            });
        } else {
            await adminClient.db(dbName).command({
                updateUser: mongoUsername,
                pwd: password,
                roles: [{ role: 'readWrite', db: dbName }],
            });
        }

        const mongoUrl = `mongodb://${mongoUsername}:${password}@localhost:27017/${dbName}?authSource=${dbName}`;
        const encryptedMongoUrl = encrypt(mongoUrl);

        await sharedDb.collection('users').updateOne(
            { _id: user._id },
            { $set: { encryptedMongoUrl } }
        );

        const tenantDb = adminClient.db(dbName);
        let totalMigrated = 0;

        for (const coll of COLLECTIONS) {
            const docs = await sharedDb.collection(coll).find({ tenantId }).toArray();
            if (docs.length > 0) {
                await tenantDb.collection(coll).insertMany(docs, { ordered: false }).catch(() => {});
                totalMigrated += docs.length;
                console.log(`  ${coll}: migrated ${docs.length} docs`);
            }
        }

        console.log(`  Total: ${totalMigrated} documents migrated. mongoUrl encrypted and stored.\n`);
    }

    console.log('Cleaning up shared collections (keeping users)...');
    for (const coll of COLLECTIONS) {
        await sharedDb.collection(coll).drop().catch(() => {});
    }

    console.log('\nMigration complete. All tenant data is now in per-tenant databases.');
    console.log('Update MONGO_ADMIN_URL in api/.env and restart all services.');

    await Promise.all([adminClient.close(), apiClient.close()]);
}

run().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
