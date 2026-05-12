const { execFile, execSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const ECOSYSTEM_PATH = process.env.ECOSYSTEM_PATH || '/home/deploy/ecosystem.config.js';
const UASSIST_ROOT = process.env.UASSIST_ROOT || '/home/deploy/UAssist';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/uassist';
const SIGNAL_CLI_PATH = process.env.SIGNAL_CLI_PATH || 'signal-cli';

// Linux user for a tenant — each gets an isolated home directory
function tenantLinuxUser(tenantId) {
    return `ua_${tenantId}`;
}

// Home directory for a tenant's Linux user
function tenantHome(tenantId) {
    return `/home/ua_${tenantId}`;
}

// Create the Linux user and set up their home directory (idempotent).
// Requires deploy to have: sudo -n /usr/sbin/useradd, sudo -n /usr/sbin/mkhomedir_helper
function ensureLinuxUser(tenantId) {
    const user = tenantLinuxUser(tenantId);
    const home = tenantHome(tenantId);

    // Check if user already exists
    try {
        execSync(`id ${user}`, { stdio: 'ignore' });
    } catch {
        // Create system user, no login shell, home dir created by useradd
        execSync(`sudo -n useradd -m -d ${home} -s /usr/sbin/nologin -U ${user}`, { stdio: 'inherit' });
    }

    // Ensure home is 700 so no other user can read it
    execSync(`sudo -n chmod 700 ${home}`, { stdio: 'inherit' });
    execSync(`sudo -n chown ${user}:${user} ${home}`, { stdio: 'inherit' });

    // Create subdirectories owned by the tenant user
    for (const subdir of ['wa-session', '.local/share/signal-cli']) {
        const full = path.join(home, subdir);
        execSync(`sudo -n mkdir -p ${full}`, { stdio: 'inherit' });
        execSync(`sudo -n chown -R ${user}:${user} ${full}`, { stdio: 'inherit' });
    }

    return { user, home };
}

function pm2(args) {
    return new Promise((resolve, reject) => {
        execFile('pm2', args, (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve(stdout);
        });
    });
}

function readEcosystem() {
    // eslint-disable-next-line no-undef
    delete require.cache[require.resolve(ECOSYSTEM_PATH)];
    return require(ECOSYSTEM_PATH);
}

function writeEcosystem(config) {
    const content = `module.exports = ${JSON.stringify(config, null, 2)}\n`;
    fs.writeFileSync(ECOSYSTEM_PATH, content, 'utf-8');
}

async function provisionTenant(tenantId, { emailAddress, signalPhone, slackBotToken } = {}) {
    const { user, home } = ensureLinuxUser(tenantId);
    const config = readEcosystem();
    const newApps = [];

    // WhatsApp process — runs as the tenant's Linux user
    const waName = `uassist_${tenantId}`;
    if (!config.apps.find(a => a.name === waName)) {
        newApps.push({
            name: waName,
            script: `${UASSIST_ROOT}/whatsapp-integration/index.js`,
            cwd: `${UASSIST_ROOT}/whatsapp-integration`,
            uid: user,
            env: {
                MONGO_URL,
                TENANT_ID: tenantId,
                WA_DATA_PATH: home,  // sessions go in /home/ua_<tid>/wa-session/
            },
        });
    }

    // Signal process — runs as the tenant's Linux user
    if (signalPhone) {
        const sigName = `signal_${tenantId}`;
        if (!config.apps.find(a => a.name === sigName)) {
            newApps.push({
                name: sigName,
                script: `${UASSIST_ROOT}/signal-integration/index.js`,
                cwd: `${UASSIST_ROOT}/signal-integration`,
                uid: user,
                env: {
                    MONGO_URL,
                    TENANT_ID: tenantId,
                    SIGNAL_CLI_PATH,
                    SIGNAL_PHONE: signalPhone,
                    HOME: home,   // signal-cli reads/writes to $HOME/.local/share/signal-cli
                },
            });
        }
    }

    // Email process — runs as the tenant's Linux user; reads creds from MongoDB
    if (emailAddress) {
        const emailName = `email_${tenantId}`;
        if (!config.apps.find(a => a.name === emailName)) {
            newApps.push({
                name: emailName,
                script: `${UASSIST_ROOT}/email-integration/index.js`,
                cwd: `${UASSIST_ROOT}/email-integration`,
                uid: user,
                env: {
                    MONGO_URL,
                    TENANT_ID: tenantId,
                    // No EMAIL/PASSWORD — process reads from MongoDB users collection
                },
            });
        }
    }

    // Slack process — tokens are read from MongoDB by the process itself
    if (slackBotToken) {
        const slackName = `slack_${tenantId}`;
        if (!config.apps.find(a => a.name === slackName)) {
            newApps.push({
                name: slackName,
                script: `${UASSIST_ROOT}/slack-integration/index.js`,
                cwd: `${UASSIST_ROOT}/slack-integration`,
                uid: user,
                env: {
                    MONGO_URL,
                    TENANT_ID: tenantId,
                },
            });
        }
    }

    // Slack process — tokens are read from MongoDB by the process itself
    if (slackBotToken) {
        const slackName = `slack_${tenantId}`;
        if (!config.apps.find(a => a.name === slackName)) {
            newApps.push({
                name: slackName,
                script: `${UASSIST_ROOT}/slack-integration/index.js`,
                cwd: `${UASSIST_ROOT}/slack-integration`,
                env: {
                    MONGO_URL,
                    TENANT_ID: tenantId,
                },
            });
        }
    }

    if (newApps.length === 0) return { started: [] };

    config.apps.push(...newApps);
    writeEcosystem(config);

    const started = [];
    for (const app of newApps) {
        await pm2(['start', ECOSYSTEM_PATH, '--only', app.name]);
        started.push(app.name);
    }
    await pm2(['save']);
    return { started };
}

module.exports = { provisionTenant, tenantLinuxUser, tenantHome };
