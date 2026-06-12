const crypto = require('crypto');

// Provider is selected by environment: KMS_KEY_NAME → GCP Cloud KMS,
// otherwise AWS_KMS_KEY_ID → AWS KMS (legacy, until the Hetzner cutover).
// scripts/migrate-kms.js re-encrypts existing user keys from AWS to GCP.
const GCP_KEY_NAME = process.env.KMS_KEY_NAME;

let generateImpl, decryptImpl;

if (GCP_KEY_NAME) {
    const { KeyManagementServiceClient } = require('@google-cloud/kms');
    const client = new KeyManagementServiceClient();

    generateImpl = async () => {
        const plaintextKey = crypto.randomBytes(32);
        const [res] = await client.encrypt({ name: GCP_KEY_NAME, plaintext: plaintextKey });
        return {
            plaintextKey,
            encryptedKey: Buffer.from(res.ciphertext).toString('base64'),
        };
    };
    decryptImpl = async ciphertext => {
        const [res] = await client.decrypt({ name: GCP_KEY_NAME, ciphertext });
        return Buffer.from(res.plaintext);
    };
} else {
    const { KMSClient, GenerateDataKeyCommand, DecryptCommand } = require('@aws-sdk/client-kms');
    const client = new KMSClient({ region: process.env.AWS_REGION });
    const KEY_ID = process.env.AWS_KMS_KEY_ID;

    generateImpl = async () => {
        const { Plaintext, CiphertextBlob } = await client.send(new GenerateDataKeyCommand({
            KeyId: KEY_ID,
            KeySpec: 'AES_256',
        }));
        return {
            plaintextKey: Buffer.from(Plaintext),
            encryptedKey: Buffer.from(CiphertextBlob).toString('base64'),
        };
    };
    decryptImpl = async ciphertext => {
        const { Plaintext } = await client.send(new DecryptCommand({ CiphertextBlob: ciphertext }));
        return Buffer.from(Plaintext);
    };
}

async function generateUserDataKey() {
    return generateImpl();
}

async function decryptUserDataKey(encryptedKeyBase64) {
    return decryptImpl(Buffer.from(encryptedKeyBase64, 'base64'));
}

module.exports = { generateUserDataKey, decryptUserDataKey };
