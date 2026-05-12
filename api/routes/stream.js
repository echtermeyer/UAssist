const { Router } = require('express');
const { getDb } = require('../lib/db');

const router = Router();

// GET /stream — Server-Sent Events, pushes new messages for the authenticated tenant
router.get('/', async (req, res) => {
    const { tenantId, role } = req.user;

    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no', // disable nginx buffering if behind a proxy
    });
    res.flushHeaders();

    const db = getDb();
    const SERVICES = ['whatsapp', 'signal', 'email', 'slack'];
    const filter = role === 'admin' ? {} : { tenantId };

    const pipeline = [{ $match: { operationType: 'insert', 'fullDocument.tenantId': tenantId } }];
    if (role === 'admin') pipeline[0].$match = { operationType: 'insert' };

    const streams = [];

    try {
        for (const service of SERVICES) {
            const changeStream = db.collection(service).watch(
                [{ $match: { operationType: 'insert', ...(role !== 'admin' && { 'fullDocument.tenantId': tenantId }) } }],
                { fullDocument: 'updateLookup' }
            );

            changeStream.on('change', (change) => {
                const doc = { ...change.fullDocument, _service: service };
                res.write(`data: ${JSON.stringify(doc)}\n\n`);
            });

            streams.push(changeStream);
        }
    } catch (err) {
        res.write(`event: error\ndata: ${JSON.stringify({ error: err.message })}\n\n`);
    }

    // Keep-alive ping every 20s
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);

    req.on('close', () => {
        clearInterval(ping);
        streams.forEach(s => s.close().catch(() => {}));
    });
});

module.exports = router;
