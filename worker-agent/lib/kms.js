// Provider is selected by environment: KMS_KEY_NAME → GCP Cloud KMS,
// otherwise AWS_KMS_KEY_ID → AWS KMS (legacy, until the Hetzner cutover).
const GCP_KEY_NAME = process.env.KMS_KEY_NAME;

let decryptImpl;

if (GCP_KEY_NAME) {
    const { KeyManagementServiceClient } = require('@google-cloud/kms');
    const client = new KeyManagementServiceClient();
    decryptImpl = async ciphertext => {
        const [res] = await client.decrypt({ name: GCP_KEY_NAME, ciphertext });
        return Buffer.from(res.plaintext);
    };
} else {
    const { KMSClient, DecryptCommand } = require('@aws-sdk/client-kms');
    const client = new KMSClient({ region: process.env.AWS_REGION });
    decryptImpl = async ciphertext => {
        const { Plaintext } = await client.send(new DecryptCommand({ CiphertextBlob: ciphertext }));
        return Buffer.from(Plaintext);
    };
}

async function decryptUserDataKey(encryptedKeyBase64) {
    return decryptImpl(Buffer.from(encryptedKeyBase64, 'base64'));
}

module.exports = { decryptUserDataKey };
