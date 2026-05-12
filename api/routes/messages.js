const { Router } = require('express');
const { getDb } = require('../lib/db');

const router = Router();
const SERVICES = ['whatsapp', 'signal', 'email'];

router.get('/', async (req, res, next) => {
    try {
        const db = getDb();
        const results = await Promise.all(
            SERVICES.map(s => db.collection(s).find().sort({ _savedAt: -1 }).limit(100).toArray()
                .then(docs => docs.map(d => ({ ...d, _service: s }))))
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
    try {
        const docs = await getDb().collection(service).find().sort({ _savedAt: -1 }).limit(100).toArray();
        res.json(docs);
    } catch (err) {
        next(err);
    }
});

module.exports = router;
