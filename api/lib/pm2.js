const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

const ECOSYSTEM_PATH = process.env.ECOSYSTEM_PATH || '/home/deploy/ecosystem.config.js';
const UASSIST_ROOT = process.env.UASSIST_ROOT || '/home/deploy/UAssist';
const WA_DATA_PATH = process.env.WA_DATA_PATH || '/home/deploy/wa-sessions';
const MONGO_URL = process.env.MONGO_URL || 'mongodb://localhost:27017/uassist';
const SIGNAL_CLI_PATH = process.env.SIGNAL_CLI_PATH || 'signal-cli';

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

async function provisionTenant(tenantId, { emailAddress, emailPassword, signalPhone, slackBotToken } = {}) {
    const config = readEcosystem();

    const newApps = [];

    // WhatsApp process
    const waName = `uassist_${tenantId}`;
    if (!config.apps.find(a => a.name === waName)) {
        newApps.push({
            name: waName,
            script: `${UASSIST_ROOT}/whatsapp-integration/index.js`,
            cwd: `${UASSIST_ROOT}/whatsapp-integration`,
            env: {
                MONGO_URL,
                TENANT_ID: tenantId,
                WA_DATA_PATH,
            },
        });
    }

    // Signal process
    if (signalPhone) {
        const sigName = `signal_${tenantId}`;
        if (!config.apps.find(a => a.name === sigName)) {
            newApps.push({
                name: sigName,
                script: `${UASSIST_ROOT}/signal-integration/index.js`,
                cwd: `${UASSIST_ROOT}/signal-integration`,
                env: {
                    MONGO_URL,
                    TENANT_ID: tenantId,
                    SIGNAL_CLI_PATH,
                    SIGNAL_PHONE: signalPhone,
                },
            });
        }
    }

    // Email process — credentials are read from MongoDB by the process itself
    if (emailAddress) {
        const emailName = `email_${tenantId}`;
        if (!config.apps.find(a => a.name === emailName)) {
            newApps.push({
                name: emailName,
                script: `${UASSIST_ROOT}/email-integration/index.js`,
                cwd: `${UASSIST_ROOT}/email-integration`,
                env: {
                    MONGO_URL,
                    TENANT_ID: tenantId,
                    // No EMAIL/PASSWORD here — process reads from MongoDB users collection
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

module.exports = { provisionTenant };
