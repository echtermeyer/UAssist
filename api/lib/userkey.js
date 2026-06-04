const { decryptUserDataKey } = require('./kms');
const { getGlobalDb } = require('./db');

async function getUserDataKey(username) {
    const user = await getGlobalDb()
        .collection('users')
        .findOne({ username }, { projection: { encryptedDataKey: 1 } });
    if (!user?.encryptedDataKey) throw new Error(`No data key for user: ${username}`);
    return decryptUserDataKey(user.encryptedDataKey);
}

module.exports = { getUserDataKey };
