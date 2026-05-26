const { randomBytes, createCipheriv, createDecipheriv } = require('crypto');

const ALGORITHM = 'aes-256-gcm';

function getKey() {
    const hex = process.env.MASTER_ENCRYPTION_KEY;
    if (!hex || hex.length !== 64) throw new Error('MASTER_ENCRYPTION_KEY must be 64 hex chars (32 bytes)');
    return Buffer.from(hex, 'hex');
}

function encrypt(plaintext) {
    const key = getKey();
    const iv = randomBytes(12);
    const cipher = createCipheriv(ALGORITHM, key, iv);
    const ciphertext = Buffer.concat([cipher.update(plaintext, 'utf8'), cipher.final()]);
    const tag = cipher.getAuthTag();
    return JSON.stringify({
        iv: iv.toString('hex'),
        ciphertext: ciphertext.toString('hex'),
        tag: tag.toString('hex'),
    });
}

function decrypt(encryptedJson) {
    const key = getKey();
    const { iv, ciphertext, tag } = JSON.parse(encryptedJson);
    const decipher = createDecipheriv(ALGORITHM, key, Buffer.from(iv, 'hex'));
    decipher.setAuthTag(Buffer.from(tag, 'hex'));
    return Buffer.concat([
        decipher.update(Buffer.from(ciphertext, 'hex')),
        decipher.final(),
    ]).toString('utf8');
}

function isEncrypted(value) {
    if (typeof value !== 'string') return false;
    try {
        const parsed = JSON.parse(value);
        return !!(parsed.iv && parsed.ciphertext && parsed.tag);
    } catch {
        return false;
    }
}

module.exports = { encrypt, decrypt, isEncrypted };
