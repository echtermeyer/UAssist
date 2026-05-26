const Docker = require('dockerode');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const DOCKER_NETWORK = process.env.DOCKER_NETWORK || 'uassist';
const TENANT_IMAGE = process.env.TENANT_WORKER_IMAGE;

function containerName(tenantId) {
    return `uassist-tenant-${tenantId}`;
}

function volumeName(tenantId) {
    return `uassist-tenant-${tenantId}`;
}

async function ensureVolume(name) {
    try {
        await docker.getVolume(name).inspect();
    } catch (err) {
        if (err.statusCode === 404) await docker.createVolume({ Name: name });
        else throw err;
    }
}

async function startTenantContainer(tenantId) {
    if (!TENANT_IMAGE) {
        console.warn('TENANT_WORKER_IMAGE not set — skipping container start');
        return;
    }

    const name = containerName(tenantId);
    const vol = volumeName(tenantId);
    await ensureVolume(vol);

    try {
        const container = docker.getContainer(name);
        const info = await container.inspect();
        if (info.State.Running) return;
        await container.start();
        return;
    } catch (err) {
        if (err.statusCode !== 404) throw err;
    }

    const container = await docker.createContainer({
        name,
        Image: TENANT_IMAGE,
        Env: [
            `TENANT_ID=${tenantId}`,
            `MONGO_URL=${process.env.MONGO_URL}`,
            `MASTER_ENCRYPTION_KEY=${process.env.MASTER_ENCRYPTION_KEY}`,
        ],
        HostConfig: {
            Binds: [`${vol}:/home/tenant`],
            RestartPolicy: { Name: 'unless-stopped' },
        },
        NetworkingConfig: {
            EndpointsConfig: { [DOCKER_NETWORK]: {} },
        },
    });

    await container.start();
    console.log(`Started container for tenant ${tenantId}`);
}

async function restartTenantContainer(tenantId) {
    const name = containerName(tenantId);
    try {
        const container = docker.getContainer(name);
        await container.stop().catch(() => {});
        await container.remove().catch(() => {});
    } catch (err) {
        if (err.statusCode !== 404) console.warn(`Could not remove ${name}:`, err.message);
    }
    await startTenantContainer(tenantId);
}

async function stopTenantContainer(tenantId) {
    const name = containerName(tenantId);
    try {
        const container = docker.getContainer(name);
        await container.stop();
        await container.remove();
    } catch (err) {
        if (err.statusCode !== 404) throw err;
    }
}

async function reconcileTenantContainers() {
    if (!TENANT_IMAGE) {
        console.warn('TENANT_WORKER_IMAGE not set — skipping reconciliation');
        return;
    }
    const { getGlobalDb } = require('./db');
    const users = await getGlobalDb().collection('users').find({
        $or: [
            { 'onboarding.whatsapp': { $exists: true } },
            { 'onboarding.signal': { $exists: true } },
            { 'onboarding.email': { $exists: true } },
            { 'onboarding.slack': { $exists: true } },
        ],
    }).toArray();

    for (const user of users) {
        await startTenantContainer(user.tenantId).catch(err =>
            console.error(`Failed to start container for ${user.tenantId}:`, err.message)
        );
    }
    console.log(`Reconciled ${users.length} tenant containers`);
}

module.exports = { startTenantContainer, restartTenantContainer, stopTenantContainer, reconcileTenantContainers };
