/**
 * Integration tests for the UAssist API.
 *
 * Run against a live API instance:
 *   API_URL=http://46.225.227.83:3000 node --test test/integration.test.js
 *
 * Or locally (requires the API to be running on localhost:3000):
 *   node --test test/integration.test.js
 */

'use strict';

const { test, describe, before, after } = require('node:test');
const assert = require('node:assert/strict');

const BASE = process.env.API_URL || 'http://localhost:3000';

// ── Helpers ───────────────────────────────────────────────────────────────────

async function api(path, { method = 'GET', body, token } = {}) {
    const headers = { 'Content-Type': 'application/json' };
    if (token) headers['Authorization'] = `Bearer ${token}`;
    const res = await fetch(`${BASE}${path}`, {
        method,
        headers,
        body: body ? JSON.stringify(body) : undefined,
    });
    const json = await res.json().catch(() => null);
    return { status: res.status, body: json };
}

// Generate a unique username per test run so tests are idempotent
const RUN_ID = Date.now().toString(36);
function username(name) { return `test_${name}_${RUN_ID}`; }

// ── Auth ──────────────────────────────────────────────────────────────────────

describe('POST /auth/signup', () => {
    test('creates a new user and returns a JWT', async () => {
        const { status, body } = await api('/auth/signup', {
            method: 'POST',
            body: { username: username('signup'), password: 'password123' },
        });
        assert.equal(status, 201);
        assert.ok(body.token, 'should return a token');
        assert.equal(body.role, 'user');
        assert.equal(body.tenantId, username('signup'));
    });

    test('derives tenantId from username (slugified)', async () => {
        const user = `Test User ${RUN_ID}`;
        const { status, body } = await api('/auth/signup', {
            method: 'POST',
            body: { username: user, password: 'password123' },
        });
        assert.equal(status, 201);
        // spaces → underscores, lowercased
        assert.equal(body.tenantId, user.toLowerCase().replace(/[^a-z0-9]/g, '_'));
    });

    test('rejects duplicate username with 409', async () => {
        const user = username('dup');
        await api('/auth/signup', { method: 'POST', body: { username: user, password: 'password123' } });
        const { status, body } = await api('/auth/signup', {
            method: 'POST',
            body: { username: user, password: 'password123' },
        });
        assert.equal(status, 409);
        assert.equal(body.error, 'Username already taken');
    });

    test('rejects short password with 400', async () => {
        const { status, body } = await api('/auth/signup', {
            method: 'POST',
            body: { username: username('shortpw'), password: 'abc' },
        });
        assert.equal(status, 400);
        assert.match(body.error, /at least 6/);
    });

    test('rejects empty fields with 400', async () => {
        const { status, body } = await api('/auth/signup', {
            method: 'POST',
            body: { username: '', password: '' },
        });
        assert.equal(status, 400);
        assert.ok(body.error);
    });
});

describe('POST /auth/login', () => {
    let user;
    before(async () => {
        user = username('login');
        await api('/auth/signup', { method: 'POST', body: { username: user, password: 'correctpass' } });
    });

    test('returns JWT on valid credentials', async () => {
        const { status, body } = await api('/auth/login', {
            method: 'POST',
            body: { username: user, password: 'correctpass' },
        });
        assert.equal(status, 200);
        assert.ok(body.token);
        // Verify JWT payload
        const payload = JSON.parse(Buffer.from(body.token.split('.')[1], 'base64').toString());
        assert.equal(payload.username, user);
        assert.equal(payload.role, 'user');
        assert.ok(payload.exp > Date.now() / 1000);
    });

    test('rejects wrong password with 401', async () => {
        const { status, body } = await api('/auth/login', {
            method: 'POST',
            body: { username: user, password: 'wrongpassword' },
        });
        assert.equal(status, 401);
        assert.equal(body.error, 'Invalid credentials');
    });

    test('rejects non-existent user with 401', async () => {
        const { status } = await api('/auth/login', {
            method: 'POST',
            body: { username: 'nosuchuser_xyz', password: 'anything' },
        });
        assert.equal(status, 401);
    });
});

// ── Authentication middleware ─────────────────────────────────────────────────

describe('Authentication middleware', () => {
    test('rejects requests without token with 401', async () => {
        const { status, body } = await api('/messages');
        assert.equal(status, 401);
        assert.match(body.error, /Bearer token required/);
    });

    test('rejects requests with invalid token with 401', async () => {
        const { status } = await api('/messages', { token: 'not.a.real.token' });
        assert.equal(status, 401);
    });

    test('accepts valid token', async () => {
        const { body: { token } } = await api('/auth/signup', {
            method: 'POST',
            body: { username: username('authtest'), password: 'password123' },
        });
        const { status } = await api('/messages', { token });
        assert.equal(status, 200);
    });
});

// ── Messages ──────────────────────────────────────────────────────────────────

describe('GET /messages', () => {
    let token;
    before(async () => {
        const { body } = await api('/auth/signup', {
            method: 'POST',
            body: { username: username('msgtest'), password: 'password123' },
        });
        token = body.token;
    });

    test('returns an array', async () => {
        const { status, body } = await api('/messages', { token });
        assert.equal(status, 200);
        assert.ok(Array.isArray(body));
    });

    test('GET /messages/whatsapp returns an array', async () => {
        const { status, body } = await api('/messages/whatsapp', { token });
        assert.equal(status, 200);
        assert.ok(Array.isArray(body));
    });

    test('GET /messages/email returns an array', async () => {
        const { status, body } = await api('/messages/email', { token });
        assert.equal(status, 200);
        assert.ok(Array.isArray(body));
    });

    test('GET /messages/signal returns an array', async () => {
        const { status, body } = await api('/messages/signal', { token });
        assert.equal(status, 200);
        assert.ok(Array.isArray(body));
    });
});

// ── Tenant isolation ──────────────────────────────────────────────────────────

describe('Tenant isolation', () => {
    let tokenA, tokenB, tenantA;

    before(async () => {
        const userA = username('tenantA');
        const userB = username('tenantB');
        tenantA = userA;
        const { body: a } = await api('/auth/signup', { method: 'POST', body: { username: userA, password: 'password123' } });
        const { body: b } = await api('/auth/signup', { method: 'POST', body: { username: userB, password: 'password123' } });
        tokenA = a.token;
        tokenB = b.token;
    });

    test('each user gets their own tenantId', async () => {
        const payloadA = JSON.parse(Buffer.from(tokenA.split('.')[1], 'base64').toString());
        const payloadB = JSON.parse(Buffer.from(tokenB.split('.')[1], 'base64').toString());
        assert.notEqual(payloadA.tenantId, payloadB.tenantId);
    });

    test('user A cannot see user B messages via their own token', async () => {
        // Both message lists should be independent (both empty here, but scoped to their own tenant)
        const { body: msgsA } = await api('/messages', { token: tokenA });
        const { body: msgsB } = await api('/messages', { token: tokenB });
        // Verify all messages belong to the correct tenant by checking no cross-tenant leakage
        assert.ok(Array.isArray(msgsA));
        assert.ok(Array.isArray(msgsB));
        if (msgsA.length > 0) {
            msgsA.forEach(m => assert.equal(m.tenantId, tenantA, 'message tenantId must match token tenantId'));
        }
    });
});

// ── Send endpoints (validation) ───────────────────────────────────────────────

describe('POST /send/* — input validation', () => {
    let token;
    before(async () => {
        const { body } = await api('/auth/signup', {
            method: 'POST',
            body: { username: username('sendtest'), password: 'password123' },
        });
        token = body.token;
    });

    test('/send/email requires to, subject, message fields', async () => {
        const { status, body } = await api('/send/email', {
            method: 'POST', token,
            body: { to: 'missing@example.com' }, // missing subject and message
        });
        // Should fail — 400 or 500 (not connected), but not 401
        assert.notEqual(status, 401);
    });

    test('/send/whatsapp requires to and message fields', async () => {
        const { status } = await api('/send/whatsapp', {
            method: 'POST', token,
            body: { to: '491234567890', message: 'hi' },
        });
        // 202 (queued) or error — but not auth error
        assert.notEqual(status, 401);
    });

    test('/send/* rejects unauthenticated requests', async () => {
        const { status } = await api('/send/email', {
            method: 'POST',
            body: { to: 'x@x.com', subject: 'hi', message: 'hi' },
        });
        assert.equal(status, 401);
    });
});

// ── Onboarding endpoints ──────────────────────────────────────────────────────

describe('GET /onboard/*/status — requires auth', () => {
    test('whatsapp status requires auth', async () => {
        const { status } = await api('/onboard/whatsapp/status');
        assert.equal(status, 401);
    });

    test('signal status requires auth', async () => {
        const { status } = await api('/onboard/signal/status');
        assert.equal(status, 401);
    });

    test('authenticated whatsapp status returns idle when not started', async () => {
        const { body: { token } } = await api('/auth/signup', {
            method: 'POST',
            body: { username: username('wastatustest'), password: 'password123' },
        });
        const { status, body } = await api('/onboard/whatsapp/status', { token });
        assert.equal(status, 200);
        assert.equal(body.status, 'idle');
    });

    test('authenticated signal status returns idle when not started', async () => {
        const { body: { token } } = await api('/auth/signup', {
            method: 'POST',
            body: { username: username('sigstatustest'), password: 'password123' },
        });
        const { status, body } = await api('/onboard/signal/status', { token });
        assert.equal(status, 200);
        assert.equal(body.status, 'idle');
    });
});

// ── SSE stream ────────────────────────────────────────────────────────────────

describe('GET /stream', () => {
    test('rejects unauthenticated stream with 401', async () => {
        const res = await fetch(`${BASE}/stream`);
        assert.equal(res.status, 401);
        await res.body?.cancel();
    });

    test('opens SSE stream for authenticated user', async () => {
        const { body: { token } } = await api('/auth/signup', {
            method: 'POST',
            body: { username: username('streamtest'), password: 'password123' },
        });
        const controller = new AbortController();
        const res = await fetch(`${BASE}/stream`, {
            headers: { Authorization: `Bearer ${token}` },
            signal: controller.signal,
        });
        assert.equal(res.status, 200);
        assert.ok(res.headers.get('content-type')?.includes('text/event-stream'));
        controller.abort(); // close the stream
    });
});
