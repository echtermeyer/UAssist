const express = require('express');
const { authenticate } = require('./lib/auth');
const {
    startTenantContainer,
    restartTenantContainer,
    stopTenantContainer,
    reconcileTenantContainers,
    pullImage,
} = require('./lib/docker');

const app = express();
app.use(express.json());

app.get('/healthz', (req, res) => res.json({ ok: true }));

app.use(authenticate);

app.post('/tenants/reconcile', async (req, res, next) => {
    try {
        const tenants = Array.isArray(req.body) ? req.body : [];
        const started = await reconcileTenantContainers(tenants);
        res.json({ started, total: tenants.length });
    } catch (err) {
        next(err);
    }
});

app.post('/tenants/:id/start', async (req, res, next) => {
    try {
        await startTenantContainer(req.params.id, req.body?.encryptedDataKey);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

app.post('/tenants/:id/restart', async (req, res, next) => {
    try {
        await restartTenantContainer(req.params.id, req.body?.encryptedDataKey);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

app.post('/tenants/:id/stop', async (req, res, next) => {
    try {
        await stopTenantContainer(req.params.id);
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

app.post('/image/pull', async (req, res, next) => {
    try {
        await pullImage();
        res.json({ ok: true });
    } catch (err) {
        next(err);
    }
});

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

const PORT = process.env.PORT || 8080;
app.listen(PORT, () => console.log(`✅ worker-agent listening on port ${PORT}`));
