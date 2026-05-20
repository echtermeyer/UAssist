const { MongoClient } = require('mongodb');
const { randomBytes } = require('crypto');
const { encrypt } = require('./crypto');

let client;

async function connect() {
    client = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017/uassist');
    await client.connect();
    console.log('✅ MongoDB ready!');
}

function getGlobalDb() {
    return client.db('uassist');
}

function getTenantDb(tenantId) {
    return client.db(`uassist_${tenantId}`);
}

async function provisionTenantDb(tenantId) {
    const adminUrl = process.env.MONGO_ADMIN_URL;
    if (!adminUrl) {
        console.warn('MONGO_ADMIN_URL not set — skipping per-tenant DB provisioning');
        return null;
    }

    const adminClient = new MongoClient(adminUrl);
    try {
        await adminClient.connect();
        const adminDb = adminClient.db('admin');
        const dbName = `uassist_${tenantId}`;
        const username = `ua_${tenantId}`;
        const password = randomBytes(24).toString('hex');

        const existingUsers = await adminDb.command({
            usersInfo: { user: username, db: dbName },
        });

        if (existingUsers.users.length === 0) {
            await adminClient.db(dbName).command({
                createUser: username,
                pwd: password,
                roles: [{ role: 'readWrite', db: dbName }],
            });
        } else {
            await adminClient.db(dbName).command({
                updateUser: username,
                pwd: password,
                roles: [{ role: 'readWrite', db: dbName }],
            });
        }

        const mongoUrl = `mongodb://${username}:${password}@localhost:27017/${dbName}?authSource=${dbName}`;
        return { mongoUrl, encryptedMongoUrl: encrypt(mongoUrl) };
    } finally {
        await adminClient.close();
    }
}

module.exports = { connect, getGlobalDb, getTenantDb, provisionTenantDb };
