const { Router } = require('express');
const { getTenantDb } = require('../lib/db');

const router = Router();

const SERVICES = ['whatsapp', 'signal', 'email'];
const POLL_MS = 2000;

router.get('/', async (req, res) => {
    const { tenantId } = req.user;

    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const db = getTenantDb(tenantId);

    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    let closed = false;
    req.on('close', () => { closed = true; clearInterval(ping); });

    try {
        const streams = [];
        for (const service of SERVICES) {
            const cs = db.collection(service).watch(
                [{ $match: { operationType: 'insert' } }],
                { fullDocument: 'updateLookup' }
            );
            cs.on('change', change => {
                if (!closed) {
                    const doc = { ...change.fullDocument, _service: service };
                    res.write(`data: ${JSON.stringify(doc)}\n\n`);
                }
            });
            cs.on('error', () => {});
            streams.push(cs);
        }

        await Promise.race(streams.map(cs => cs.hasNext().catch(err => { throw err; })));

        req.on('close', () => streams.forEach(s => s.close().catch(() => {})));

    } catch (err) {
        const lastSeen = {};
        for (const service of SERVICES) {
            const latest = await db.collection(service).find({}).sort({ _savedAt: -1 }).limit(1).toArray();
            lastSeen[service] = latest[0]?._savedAt || new Date(0);
        }

        const poll = setInterval(async () => {
            if (closed) { clearInterval(poll); return; }
            try {
                for (const service of SERVICES) {
                    const docs = await db.collection(service)
                        .find({ _savedAt: { $gt: lastSeen[service] } })
                        .sort({ _savedAt: 1 }).toArray();
                    for (const doc of docs) {
                        res.write(`data: ${JSON.stringify({ ...doc, _service: service })}\n\n`);
                        lastSeen[service] = doc._savedAt;
                    }
                }
            } catch {}
        }, POLL_MS);

        req.on('close', () => clearInterval(poll));
    }
});

module.exports = router;
