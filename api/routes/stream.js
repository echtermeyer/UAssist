const { Router } = require('express');
const { getDb } = require('../lib/db');

const router = Router();

const SERVICES = ['whatsapp', 'signal', 'email'];
const POLL_MS = 2000; // fallback polling interval when change streams unavailable

// GET /stream — Server-Sent Events, pushes new messages for the authenticated tenant.
// Uses MongoDB change streams when available (replica set), falls back to polling otherwise.
router.get('/', async (req, res) => {
    const { tenantId, role } = req.user;

    res.set({
        'Content-Type': 'text/event-stream',
        'Cache-Control': 'no-cache',
        'Connection': 'keep-alive',
        'X-Accel-Buffering': 'no',
    });
    res.flushHeaders();

    const db = getDb();

    // Keep-alive ping every 20s
    const ping = setInterval(() => res.write(': ping\n\n'), 20000);
    let closed = false;
    req.on('close', () => { closed = true; clearInterval(ping); });

    // Try change streams first; fall back to polling on error (e.g. standalone MongoDB)
    try {
        const streams = [];
        for (const service of SERVICES) {
            const cs = db.collection(service).watch(
                [{ $match: { operationType: 'insert', ...(role !== 'admin' && { 'fullDocument.tenantId': tenantId }) } }],
                { fullDocument: 'updateLookup' }
            );
            cs.on('change', change => {
                if (!closed) {
                    const doc = { ...change.fullDocument, _service: service };
                    res.write(`data: ${JSON.stringify(doc)}\n\n`);
                }
            });
            cs.on('error', () => {}); // handled by the outer catch via the first .next() call
            streams.push(cs);
        }

        // Verify change streams actually work by trying a no-op iteration
        await Promise.race(streams.map(cs => cs.hasNext().catch(err => { throw err; })));

        req.on('close', () => streams.forEach(s => s.close().catch(() => {})));

    } catch (err) {
        // Change streams not supported (standalone MongoDB) — fall back to polling
        const lastSeen = {};
        for (const service of SERVICES) {
            const latest = await db.collection(service)
                .find(role === 'admin' ? {} : { tenantId })
                .sort({ _savedAt: -1 }).limit(1).toArray();
            lastSeen[service] = latest[0]?._savedAt || new Date(0);
        }

        const poll = setInterval(async () => {
            if (closed) { clearInterval(poll); return; }
            try {
                for (const service of SERVICES) {
                    const docs = await db.collection(service)
                        .find({
                            ...(role !== 'admin' && { tenantId }),
                            _savedAt: { $gt: lastSeen[service] },
                        })
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
