const { Router } = require('express');
const { getTenantDb } = require('../lib/db');
const signal = require('../lib/signal');
const { sendMail } = require('../lib/mailer');

const router = Router();

router.post('/whatsapp', async (req, res, next) => {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message are required' });
    try {
        const result = await getTenantDb(req.user.tenantId).collection('whatsapp_outbox').insertOne({
            to,
            message,
            status: 'pending',
            tenantId: req.user.tenantId,
            _createdAt: new Date(),
        });
        res.status(202).json({ id: result.insertedId, status: 'pending' });
    } catch (err) {
        next(err);
    }
});

router.post('/signal', async (req, res, next) => {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message are required' });
    try {
        await signal.send(to, message);
        res.json({ status: 'sent' });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

router.post('/email', async (req, res, next) => {
    const { to, subject, message } = req.body;
    if (!to || !subject || !message) return res.status(400).json({ error: 'to, subject and message are required' });
    try {
        await sendMail(to, subject, message);
        res.json({ status: 'sent' });
    } catch (err) {
        res.status(502).json({ error: err.message });
    }
});

router.post('/slack', async (req, res, next) => {
    const { to, message } = req.body;
    if (!to || !message) return res.status(400).json({ error: 'to and message are required' });
    try {
        const result = await getTenantDb(req.user.tenantId).collection('slack_outbox').insertOne({
            to,
            message,
            status: 'pending',
            tenantId: req.user.tenantId,
            _createdAt: new Date(),
        });
        res.status(202).json({ id: result.insertedId, status: 'pending' });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
