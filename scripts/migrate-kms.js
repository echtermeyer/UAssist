#!/usr/bin/env node
// One-time migration: re-encrypt every user's data key from AWS KMS to GCP
// Cloud KMS. Idempotent — already-migrated users (kmsProvider: 'gcp') are
// skipped. Run from the api/ directory so both KMS SDKs resolve:
//
//   cd api && MONGO_ADMIN_URL=... AWS_REGION=... AWS_KMS_KEY_ID=... \
//     KMS_KEY_NAME=projects/.../cryptoKeys/user-data-keys \
//     node ../scripts/migrate-kms.js [--dry-run]

const { MongoClient } = require('mongodb');
const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms');
const { KeyManagementServiceClient } = require('@google-cloud/kms');

const DRY_RUN = process.argv.includes('--dry-run');
const MONGO_URL = process.env.MONGO_ADMIN_URL || process.env.MONGO_URL;
const GCP_KEY_NAME = process.env.KMS_KEY_NAME;

if (!MONGO_URL || !GCP_KEY_NAME) {
    console.error('MONGO_ADMIN_URL (or MONGO_URL) and KMS_KEY_NAME are required');
    process.exit(1);
}

async function main() {
    const aws = new KMSClient({ region: process.env.AWS_REGION });
    const gcp = new KeyManagementServiceClient();
    const mongo = new MongoClient(MONGO_URL);
    await mongo.connect();
    const users = mongo.db('uassist').collection('users');

    const candidates = await users.find({
        encryptedDataKey: { $exists: true, $ne: null },
        kmsProvider: { $ne: 'gcp' },
    }).toArray();

    console.log(`${candidates.length} user(s) to migrate${DRY_RUN ? ' (dry run)' : ''}`);

    let migrated = 0, failed = 0;
    for (const user of candidates) {
        try {
            const { Plaintext } = await aws.send(new DecryptCommand({
                CiphertextBlob: Buffer.from(user.encryptedDataKey, 'base64'),
            }));
            const [res] = await gcp.encrypt({
                name: GCP_KEY_NAME,
                plaintext: Buffer.from(Plaintext),
            });
            const newKey = Buffer.from(res.ciphertext).toString('base64');

            if (DRY_RUN) {
                console.log(`[dry-run] would migrate ${user.username} (${user.tenantId})`);
            } else {
                await users.updateOne(
                    { _id: user._id },
                    { $set: { encryptedDataKey: newKey, kmsProvider: 'gcp' } }
                );
                console.log(`migrated ${user.username} (${user.tenantId})`);
            }
            migrated++;
        } catch (err) {
            failed++;
            console.error(`FAILED ${user.username} (${user.tenantId}): ${err.message}`);
        }
    }

    console.log(`done: ${migrated} migrated, ${failed} failed`);
    await mongo.close();
    process.exit(failed > 0 ? 1 : 0);
}

main().catch(err => {
    console.error('Fatal:', err);
    process.exit(1);
});
