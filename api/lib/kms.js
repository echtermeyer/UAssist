const { KMSClient, GenerateDataKeyCommand, DecryptCommand } = require('@aws-sdk/client-kms');

const client = new KMSClient({ region: process.env.AWS_REGION });
const KEY_ID = process.env.AWS_KMS_KEY_ID;

async function generateUserDataKey() {
    const { Plaintext, CiphertextBlob } = await client.send(new GenerateDataKeyCommand({
        KeyId: KEY_ID,
        KeySpec: 'AES_256',
    }));
    return {
        plaintextKey: Buffer.from(Plaintext),
        encryptedKey: Buffer.from(CiphertextBlob).toString('base64'),
    };
}

async function decryptUserDataKey(encryptedKeyBase64) {
    const { Plaintext } = await client.send(new DecryptCommand({
        CiphertextBlob: Buffer.from(encryptedKeyBase64, 'base64'),
    }));
    return Buffer.from(Plaintext);
}

module.exports = { generateUserDataKey, decryptUserDataKey };
