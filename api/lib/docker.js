// Tenant containers are managed by the worker-agent (worker-agent/), reached
// over HTTP. On GCP the request carries a Google-signed ID token; with
// AGENT_AUTH_DISABLED=true (local / single-VM compose) it is a plain request.
const AGENT_URL = process.env.AGENT_URL;
const AUTH_DISABLED = process.env.AGENT_AUTH_DISABLED === 'true';

let idTokenClient;
async function agentFetch(path, body) {
    if (!AGENT_URL) {
        console.warn('AGENT_URL not set — skipping tenant container operation');
        return null;
    }
    const headers = { 'Content-Type': 'application/json' };
    if (!AUTH_DISABLED) {
        if (!idTokenClient) {
            const { GoogleAuth } = require('google-auth-library');
            idTokenClient = await new GoogleAuth().getIdTokenClient(AGENT_URL);
        }
        const idHeaders = await idTokenClient.getRequestHeaders(AGENT_URL);
        headers.Authorization = idHeaders.get
            ? idHeaders.get('authorization')
            : idHeaders.Authorization;
    }
    const res = await fetch(`${AGENT_URL}${path}`, {
        method: 'POST',
        headers,
        body: JSON.stringify(body ?? {}),
    });
    if (!res.ok) {
        const text = await res.text().catch(() => '');
        throw new Error(`worker-agent ${path} failed: ${res.status} ${text}`);
    }
    return res.json();
}

async function getEncryptedDataKey(tenantId) {
    const { getGlobalDb } = require('./db');
    const user = await getGlobalDb().collection('users').findOne(
        { tenantId },
        { projection: { encryptedDataKey: 1 } }
    );
    return user?.encryptedDataKey || null;
}

async function startTenantContainer(tenantId) {
    const encryptedDataKey = await getEncryptedDataKey(tenantId);
    if (!encryptedDataKey) {
        console.warn(`No encryptedDataKey for tenant ${tenantId} — skipping container start`);
        return;
    }
    await agentFetch(`/tenants/${encodeURIComponent(tenantId)}/start`, { encryptedDataKey });
}

async function restartTenantContainer(tenantId) {
    const encryptedDataKey = await getEncryptedDataKey(tenantId);
    if (!encryptedDataKey) {
        console.warn(`No encryptedDataKey for tenant ${tenantId} — skipping container restart`);
        return;
    }
    await agentFetch(`/tenants/${encodeURIComponent(tenantId)}/restart`, { encryptedDataKey });
}

async function stopTenantContainer(tenantId) {
    await agentFetch(`/tenants/${encodeURIComponent(tenantId)}/stop`);
}

async function reconcileTenantContainers() {
    const { getGlobalDb } = require('./db');
    const users = await getGlobalDb().collection('users').find({
        $or: [
            { 'onboarding.whatsapp': { $exists: true } },
            { 'onboarding.signal': { $exists: true } },
            { 'onboarding.email': { $exists: true } },
            { 'onboarding.slack': { $exists: true } },
        ],
    }, { projection: { tenantId: 1, encryptedDataKey: 1 } }).toArray();

    const tenants = users
        .filter(u => u.encryptedDataKey)
        .map(u => ({ tenantId: u.tenantId, encryptedDataKey: u.encryptedDataKey }));

    const result = await agentFetch('/tenants/reconcile', tenants);
    if (result) console.log(`Reconciled ${result.started}/${result.total} tenant containers`);
}

module.exports = { startTenantContainer, restartTenantContainer, stopTenantContainer, reconcileTenantContainers };
