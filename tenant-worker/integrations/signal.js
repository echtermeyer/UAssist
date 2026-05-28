const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SIGNAL_CLI = process.env.SIGNAL_CLI_PATH || '/usr/local/bin/signal-cli';
const HOME = process.env.HOME || '/home/tenant';

function accountsPath() {
    return path.join(HOME, '.local/share/signal-cli/data/accounts.json');
}

function detectSignalAccount() {
    try {
        const data = JSON.parse(fs.readFileSync(accountsPath(), 'utf-8'));
        return data.accounts?.[0]?.number || null;
    } catch {
        return null;
    }
}

function resolveContactName(contact) {
    const given = contact.givenName || contact.profile?.givenName || '';
    const family = contact.familyName || contact.profile?.familyName || '';
    return [given, family].filter(Boolean).join(' ') || contact.name || null;
}

async function syncContacts(phone, contactsCol) {
    try {
        const output = execFileSync(SIGNAL_CLI, ['-a', phone, '--output=json', 'listContacts'], { timeout: 30000 }).toString();
        const contacts = JSON.parse(output);
        for (const c of contacts) {
            if (!c.number) continue;
            await contactsCol.updateOne(
                { number: c.number },
                { $set: { number: c.number, name: resolveContactName(c), uuid: c.uuid || null, _updatedAt: new Date() } },
                { upsert: true }
            );
        }
    } catch (err) {
        console.error('[signal] Failed to sync contacts:', err.message);
    }
}

async function runSignalLink(tenantId, onboardingCol) {
    return new Promise((resolve, reject) => {
        const proc = spawn(SIGNAL_CLI, ['link', '-n', `UAssist-${tenantId}`], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        let buffer = '';
        const onData = async chunk => {
            buffer += chunk.toString();
            const match = buffer.match(/(sgnl:\/\/linkdevice\?[^\s]+)/);
            if (match) {
                await onboardingCol.updateOne(
                    { service: 'signal' },
                    { $set: { linkUri: match[1], _updatedAt: new Date() } }
                ).catch(() => {});
            }
        };

        proc.stdout.on('data', onData);
        proc.stderr.on('data', onData);
        proc.on('close', code => {
            if (code === 0) resolve();
            else reject(new Error(`signal-cli link exited with code ${code}`));
        });
    });
}

/**
 * History fetch feasibility for Signal:
 *
 * Signal does NOT support fetching message history through its linked-device API.
 * When linking a new device via signal-cli, only new messages received after linking
 * are delivered to the linked device. The Signal protocol is designed so that message
 * history stays on the primary device for privacy/security reasons.
 *
 * Possible workarounds (none fully reliable for a server-side integration):
 * - Export from Signal Desktop's local SQLite database (requires access to the user's
 *   machine and decryption key — not viable for a server-side integration).
 * - Use signal-cli's `receive` command immediately after linking — but this only
 *   fetches pending/queued messages, not historical ones.
 * - Signal's backup format could theoretically be imported, but requires the user to
 *   manually export and upload a backup file.
 *
 * Conclusion: Signal history fetch is NOT feasible with the current signal-cli
 * linked-device approach. Users are informed that only new messages after
 * linking will appear in UAssist.
 */

async function runSignal(tenantId, tenantDb, globalDb) {
    const onboardingCol = tenantDb.collection('onboarding');
    const signalCol = tenantDb.collection('signal');
    const contactsCol = tenantDb.collection('signal_contacts');

    let phone = detectSignalAccount();

    if (!phone) {
        console.log('[signal] No account linked, starting link flow...');
        await runSignalLink(tenantId, onboardingCol);
        phone = detectSignalAccount();
        if (!phone) throw new Error('signal-cli link completed but no account found');

        await onboardingCol.updateOne(
            { service: 'signal' },
            { $set: { status: 'linked', linkUri: null, phone, _updatedAt: new Date() } }
        );
        await globalDb.collection('users').updateOne(
            { tenantId },
            { $set: { 'onboarding.signal': 'linked', signalPhone: phone } }
        );
    }

    // Mark Signal history as unsupported in the onboarding collection
    await onboardingCol.updateOne(
        { service: 'signal' },
        { $set: { historySyncStatus: 'unsupported', _updatedAt: new Date() } },
        { upsert: true }
    );

    await syncContacts(phone, contactsCol);

    return new Promise((_, reject) => {
        const proc = spawn(SIGNAL_CLI, ['-a', phone, '--output=json', 'receive', '-t', '-1'], {
            stdio: ['ignore', 'pipe', 'pipe'],
        });

        console.log(`[signal] Listening on ${phone}`);

        let buffer = '';
        proc.stdout.on('data', chunk => {
            buffer += chunk.toString();
            const lines = buffer.split('\n');
            buffer = lines.pop();
            for (const line of lines) {
                if (!line.trim()) continue;
                try {
                    const envelope = JSON.parse(line);
                    const msg = envelope?.envelope?.dataMessage;
                    const from = envelope?.envelope?.source;
                    if (!msg?.message) continue;
                    contactsCol.findOne({ $or: [{ number: from }, { uuid: from }] }).then(contact => {
                        signalCol.insertOne({
                            from,
                            fromName: contact?.name || from,
                            message: msg.message,
                            timestamp: msg.timestamp,
                            tenantId,
                            _savedAt: new Date(),
                        }).catch(err => console.error('[signal] Failed to save:', err.message));
                    });
                } catch (e) {
                    console.error('[signal] Parse error:', e.message);
                }
            }
        });

        proc.stderr.on('data', d => console.error('[signal-cli]', d.toString().trim()));
        proc.on('close', code => reject(new Error(`signal-cli exited with code ${code}`)));
    });
}

module.exports = { runSignal };
