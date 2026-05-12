require('dotenv').config();
const { MongoClient } = require('mongodb');
const { spawn, execFileSync } = require('child_process');
const fs = require('fs');
const path = require('path');

const SIGNAL_CLI = process.env.SIGNAL_CLI_PATH || 'signal-cli';

function detectSignalAccount() {
    if (process.env.SIGNAL_PHONE) return process.env.SIGNAL_PHONE;
    try {
        const accountsPath = path.join(process.env.HOME, '.local/share/signal-cli/data/accounts.json');
        const data = JSON.parse(fs.readFileSync(accountsPath, 'utf-8'));
        return data.accounts?.[0]?.number;
    } catch {
        return null;
    }
}

const SIGNAL_PHONE = detectSignalAccount();
if (!SIGNAL_PHONE) {
    console.error('No Signal account found. Link a device first: signal-cli link -n "UAssist VM"');
    process.exit(1);
}

function resolveContactName(contact) {
    if (contact.name) return contact.name;
    const given = contact.givenName || contact.profile?.givenName || '';
    const family = contact.familyName || contact.profile?.familyName || '';
    return [given, family].filter(Boolean).join(' ') || null;
}

async function syncContacts(db) {
    try {
        const output = execFileSync(SIGNAL_CLI, ['-a', SIGNAL_PHONE, '--output=json', 'listContacts'], {
            timeout: 30000,
        }).toString();
        const contacts = JSON.parse(output);
        const col = db.collection('signal_contacts');
        for (const c of contacts) {
            if (!c.number) continue;
            const name = resolveContactName(c);
            await col.updateOne(
                { number: c.number },
                { $set: { number: c.number, name, uuid: c.uuid || null, _updatedAt: new Date() } },
                { upsert: true }
            );
        }
        console.log(`✅ Synced ${contacts.length} Signal contacts`);
        return col;
    } catch (err) {
        console.error('Failed to sync contacts:', err.message);
        return db.collection('signal_contacts');
    }
}

async function run() {
    const mongo = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017/uassist');
    await mongo.connect();
    const db = mongo.db();
    const collection = db.collection('signal');
    console.log('✅ MongoDB ready!');

    // Sync contacts before spawning receive (which holds the file lock)
    const contactsCol = await syncContacts(db);

    const proc = spawn(SIGNAL_CLI, ['-a', SIGNAL_PHONE, '--output=json', 'receive', '-t', '-1'], {
        stdio: ['ignore', 'pipe', 'pipe'],
    });

    console.log(`✅ Signal listening on ${SIGNAL_PHONE}`);

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
                    const fromName = contact?.name || from;
                    console.log(`📱 [${fromName}] ${msg.message}`);
                    collection.insertOne({
                        from,
                        fromName,
                        message: msg.message,
                        timestamp: msg.timestamp,
                        tenantId: process.env.TENANT_ID || 'default',
                        _savedAt: new Date(),
                    }).catch(err => console.error('Failed to save:', err.message));
                });
            } catch (e) {
                console.error('Parse error:', e.message);
            }
        }
    });

    proc.stderr.on('data', d => console.error('[signal-cli]', d.toString().trim()));

    proc.on('close', code => {
        console.error(`signal-cli exited with code ${code}, restarting in 5s...`);
        setTimeout(() => process.exit(1), 5000);
    });
}

run().catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
