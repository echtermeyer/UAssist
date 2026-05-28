const { Router } = require('express');
const { getTenantDb } = require('../lib/db');
const { restartTenantContainer } = require('../lib/docker');

const router = Router();

/**
 * GET /history/status
 * Returns the history sync status for all services.
 */
router.get('/status', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const db = getTenantDb(tenantId);
        const onboardingDocs = await db.collection('onboarding').find({}).toArray();

        const status = {};
        for (const doc of onboardingDocs) {
            status[doc.service] = {
                historySyncStatus: doc.historySyncStatus || 'idle',
                historySyncCount: doc.historySyncCount || 0,
                historySyncAt: doc.historySyncAt || null,
                historySyncError: doc.historySyncError || null,
            };
        }

        // Signal does not support history fetch — always report as unsupported
        if (!status.signal) {
            status.signal = { historySyncStatus: 'unsupported', historySyncCount: 0, historySyncAt: null, historySyncError: null };
        } else {
            status.signal.historySyncStatus = 'unsupported';
        }

        res.json(status);
    } catch (err) {
        next(err);
    }
});

/**
 * POST /history/sync
 * Triggers a history sync for the specified service (or all supported services).
 * Body: { service?: "whatsapp" | "email" }
 *
 * For WhatsApp: resets sync flag so the worker will re-fetch on next ready event.
 * For Email: resets sync flag so the worker will re-fetch on next start.
 * For Signal: returns unsupported (Signal does not expose history via linked devices).
 */
router.post('/sync', async (req, res, next) => {
    const { tenantId } = req.user;
    const { service } = req.body || {};

    try {
        const db = getTenantDb(tenantId);
        const onboardingCol = db.collection('onboarding');

        if (service === 'signal') {
            return res.status(400).json({
                error: 'Signal does not support history fetching. Only messages received after linking are available.',
            });
        }

        const services = service ? [service] : ['whatsapp', 'email'];
        const results = {};

        for (const svc of services) {
            if (svc === 'signal') {
                results[svc] = { status: 'unsupported' };
                continue;
            }

            // Clear previously synced history messages so the worker re-fetches
            await db.collection(svc).deleteMany({ tenantId, _fromHistory: true });

            // Reset sync status to trigger re-fetch
            await onboardingCol.updateOne(
                { service: svc },
                { $set: { historySyncStatus: 'pending', _updatedAt: new Date() }, $unset: { historySyncError: '' } }
            );

            results[svc] = { status: 'pending' };
        }

        // Restart the tenant worker to trigger the sync
        await restartTenantContainer(tenantId);

        res.json({ message: 'History sync triggered', results });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
