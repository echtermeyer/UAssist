const { Router } = require('express');
const { getTenantDb } = require('../lib/db');
const { getUserDataKey } = require('../lib/userkey');
const { decryptWithKey, isEncrypted } = require('../lib/crypto');

const router = Router();
const SERVICES = ['whatsapp', 'signal', 'email', 'slack'];

const SERVICE_FIELDS = {
    whatsapp: ['body'],
    signal: ['message'],
    email: ['bodyText', 'bodyHtml'],
    slack: ['message'],
};

function decryptDoc(doc, service, dataKey) {
    const fields = SERVICE_FIELDS[service] || [];
    const result = { ...doc };
    for (const field of fields) {
        if (result[field] && isEncrypted(result[field])) {
            result[field] = decryptWithKey(result[field], dataKey);
        }
    }
    return result;
}

router.get('/', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const db = getTenantDb(tenantId);
        const dataKey = await getUserDataKey(req.user.username);
        const results = await Promise.all(
            SERVICES.map(s => db.collection(s).find({}).sort({ _savedAt: -1 }).limit(100).toArray()
                .then(docs => docs.map(d => decryptDoc({ ...d, _service: s }, s, dataKey))))
        );
        const merged = results.flat().sort((a, b) => new Date(b._savedAt) - new Date(a._savedAt));
        res.json(merged);
    } catch (err) {
        next(err);
    }
});

router.get('/:service', async (req, res, next) => {
    const { service } = req.params;
    if (!SERVICES.includes(service)) {
        return res.status(400).json({ error: `Unknown service. Must be one of: ${SERVICES.join(', ')}` });
    }
    const { tenantId } = req.user;
    try {
        const dataKey = await getUserDataKey(req.user.username);
        const docs = await getTenantDb(tenantId).collection(service).find({}).sort({ _savedAt: -1 }).limit(100).toArray();
        res.json(docs.map(d => decryptDoc(d, service, dataKey)));
    } catch (err) {
        next(err);
    }
});

module.exports = router;
