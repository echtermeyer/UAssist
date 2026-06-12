const Docker = require('dockerode');
const { decryptUserDataKey } = require('./kms');

const docker = new Docker({ socketPath: '/var/run/docker.sock' });
const DOCKER_NETWORK = process.env.DOCKER_NETWORK || 'uassist';
const TENANT_IMAGE = process.env.TENANT_WORKER_IMAGE;
const WORKER_MONGO_URL = process.env.WORKER_MONGO_URL;

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

async function getRegistryAuth() {
    // Only Artifact Registry pulls are authenticated here; on GCE the metadata
    // server hands out an access token for the VM's service account.
    if (!TENANT_IMAGE?.includes('-docker.pkg.dev/')) return undefined;
    const res = await fetch(
        'http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/token',
        { headers: { 'Metadata-Flavor': 'Google' } }
    );
    if (!res.ok) throw new Error(`metadata token fetch failed: ${res.status}`);
    const { access_token } = await res.json();
    return {
        username: 'oauth2accesstoken',
        password: access_token,
        serveraddress: TENANT_IMAGE.split('/')[0],
    };
}

async function pullImage() {
    if (!TENANT_IMAGE) throw new Error('TENANT_WORKER_IMAGE not set');
    const authconfig = await getRegistryAuth();
    const stream = await docker.pull(TENANT_IMAGE, { authconfig });
    await new Promise((resolve, reject) => {
        docker.modem.followProgress(stream, err => (err ? reject(err) : resolve()));
    });
    console.log(`Pulled ${TENANT_IMAGE}`);
}

async function ensureImage() {
    try {
        await pullImage();
    } catch (err) {
        try {
            await docker.getImage(TENANT_IMAGE).inspect();
            console.warn(`Pull failed (${err.message}) — using local image`);
        } catch {
            throw err;
        }
    }
}

async function startTenantContainer(tenantId, encryptedDataKey) {
    if (!TENANT_IMAGE) {
        console.warn('TENANT_WORKER_IMAGE not set — skipping container start');
        return;
    }
    if (!encryptedDataKey) {
        console.warn(`No encryptedDataKey for tenant ${tenantId} — skipping container start`);
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

    const dataKey = await decryptUserDataKey(encryptedDataKey);
    await ensureImage();

    const container = await docker.createContainer({
        name,
        Image: TENANT_IMAGE,
        Env: [
            `TENANT_ID=${tenantId}`,
            `MONGO_URL=${WORKER_MONGO_URL}`,
            `USER_DATA_KEY=${dataKey.toString('hex')}`,
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

async function restartTenantContainer(tenantId, encryptedDataKey) {
    const name = containerName(tenantId);
    try {
        const container = docker.getContainer(name);
        await container.stop().catch(() => {});
        await container.remove().catch(() => {});
    } catch (err) {
        if (err.statusCode !== 404) console.warn(`Could not remove ${name}:`, err.message);
    }
    await startTenantContainer(tenantId, encryptedDataKey);
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

async function reconcileTenantContainers(tenants) {
    let started = 0;
    for (const { tenantId, encryptedDataKey } of tenants) {
        try {
            await startTenantContainer(tenantId, encryptedDataKey);
            started++;
        } catch (err) {
            console.error(`Failed to start container for ${tenantId}:`, err.message);
        }
    }
    console.log(`Reconciled ${started}/${tenants.length} tenant containers`);
    return started;
}

module.exports = {
    startTenantContainer,
    restartTenantContainer,
    stopTenantContainer,
    reconcileTenantContainers,
    pullImage,
};
