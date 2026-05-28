const { Router } = require('express');
const { getTenantDb, getGlobalDb } = require('../lib/db');
const { generateSummary, generateTodos, generateWhatMatters } = require('../lib/llm');

const router = Router();
const SERVICES = ['whatsapp', 'signal', 'email', 'slack'];

// Cache TTL: 5 minutes
const CACHE_TTL_MS = 5 * 60 * 1000;

/**
 * Fetch today's messages for a tenant.
 */
async function getTodayMessages(tenantId) {
    const db = getTenantDb(tenantId);
    const startOfDay = new Date();
    startOfDay.setHours(0, 0, 0, 0);

    const results = await Promise.all(
        SERVICES.map(s =>
            db.collection(s)
                .find({ _savedAt: { $gte: startOfDay } })
                .sort({ _savedAt: -1 })
                .limit(50)
                .toArray()
                .then(docs => docs.map(d => ({ ...d, _service: s })))
                .catch(() => [])
        )
    );
    return results.flat().sort((a, b) => new Date(b._savedAt) - new Date(a._savedAt));
}

/**
 * Get cached result or generate new one.
 */
async function getCachedOrGenerate(tenantId, cacheKey, generatorFn, messages) {
    const db = getGlobalDb();
    const cacheCollection = db.collection('ai_cache');

    const cached = await cacheCollection.findOne({
        tenantId,
        key: cacheKey,
        expiresAt: { $gt: new Date() },
    });

    if (cached) {
        return cached.value;
    }

    const value = await generatorFn(messages);

    await cacheCollection.updateOne(
        { tenantId, key: cacheKey },
        {
            $set: {
                value,
                expiresAt: new Date(Date.now() + CACHE_TTL_MS),
                updatedAt: new Date(),
            },
        },
        { upsert: true }
    );

    return value;
}

/**
 * GET /ai/summary
 * Returns the AI-generated daily summary.
 */
router.get('/summary', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const messages = await getTodayMessages(tenantId);
        if (messages.length === 0) {
            return res.json({ summary: 'No messages yet today. Enjoy the quiet!' });
        }
        const summary = await getCachedOrGenerate(tenantId, 'summary', generateSummary, messages);
        res.json({ summary });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /ai/todos
 * Returns AI-extracted to-do items.
 */
router.get('/todos', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const messages = await getTodayMessages(tenantId);
        if (messages.length === 0) {
            return res.json({ todos: [] });
        }
        const todos = await getCachedOrGenerate(tenantId, 'todos', generateTodos, messages);
        res.json({ todos });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /ai/what-matters
 * Returns top 3 "What Matters Today" cards.
 */
router.get('/what-matters', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const messages = await getTodayMessages(tenantId);
        if (messages.length === 0) {
            return res.json({ items: [] });
        }
        const items = await getCachedOrGenerate(tenantId, 'what-matters', generateWhatMatters, messages);
        res.json({ items });
    } catch (err) {
        next(err);
    }
});

/**
 * POST /ai/todos/:index/toggle
 * Toggle a todo item's done status (stored per tenant).
 */
router.post('/todos/:index/toggle', async (req, res, next) => {
    const { tenantId } = req.user;
    const index = parseInt(req.params.index, 10);
    try {
        const db = getGlobalDb();
        const collection = db.collection('ai_todo_state');

        const doc = await collection.findOne({ tenantId }) || { tenantId, done: [] };
        const doneSet = new Set(doc.done || []);

        if (doneSet.has(index)) {
            doneSet.delete(index);
        } else {
            doneSet.add(index);
        }

        await collection.updateOne(
            { tenantId },
            { $set: { done: [...doneSet], updatedAt: new Date() } },
            { upsert: true }
        );

        res.json({ done: [...doneSet] });
    } catch (err) {
        next(err);
    }
});

/**
 * GET /ai/todos/state
 * Get current done state for todos.
 */
router.get('/todos/state', async (req, res, next) => {
    const { tenantId } = req.user;
    try {
        const db = getGlobalDb();
        const doc = await db.collection('ai_todo_state').findOne({ tenantId });
        res.json({ done: doc?.done || [] });
    } catch (err) {
        next(err);
    }
});

module.exports = router;
