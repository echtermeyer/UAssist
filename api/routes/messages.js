const { Router } = require('express');
const { getTenantDb } = require('../lib/db');
const { getUserDataKey } = require('../lib/userkey');
const { decryptWithKey, isEncrypted } = require('../lib/crypto');

const router = Router();
const SERVICES = ['whatsapp', 'signal', 'email', 'slack'];

const SERVICE_FIELDS = {
    whatsapp: ['body', 'from', 'to', '_chat', 'fromName', 'author'],
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

async function getSentSignalMessages(db, dataKey) {
    const docs = await db.collection('signal_outbox')
        .find({ status: { $in: ['pending', 'sent'] } })
        .sort({ _createdAt: -1 }).limit(100).toArray();
    return docs.map(d => {
        const message = d.message && isEncrypted(d.message) ? decryptWithKey(d.message, dataKey) : (d.message || '');
        return {
            _id: d._id,
            _service: 'signal',
            _savedAt: d._createdAt || d._savedAt || new Date(),
            from: d.to,
            message,
            fromMe: true,
            tenantId: d.tenantId,
        };
    });
}

router.get('/', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const db = getTenantDb(tenantId);
        const dataKey = await getUserDataKey(req.user.username);
        const [results, sentSignal, profilePics, contactPics] = await Promise.all([
            Promise.all(
                SERVICES.map(s => db.collection(s).find({}).sort({ _savedAt: -1 }).limit(100).toArray()
                    .then(docs => docs.map(d => decryptDoc({ ...d, _service: s }, s, dataKey))))
            ),
            getSentSignalMessages(db, dataKey),
            db.collection('profile_pics').find({}).toArray(),
            db.collection('contact_pics').find({}).toArray(),
        ]);
        const picMap = new Map(profilePics.map(p => [p.chatName, p.url]));
        const contactPicMap = new Map(contactPics.map(p => [p.jid, p.url]));
        const allMessages = [...results.flat(), ...sentSignal];
        for (const msg of allMessages) {
            if (msg._service === 'whatsapp' && msg._chat) {
                const url = picMap.get(msg._chat);
                if (url) msg.pictureUrl = url;
                if (msg.author) {
                    const contactUrl = contactPicMap.get(msg.author);
                    if (contactUrl) msg.senderPictureUrl = contactUrl;
                } else if (msg.from) {
                    const contactUrl = contactPicMap.get(msg.from);
                    if (contactUrl) msg.senderPictureUrl = contactUrl;
                }
            }
        }
        const merged = allMessages.sort((a, b) => new Date(b._savedAt) - new Date(a._savedAt));
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
