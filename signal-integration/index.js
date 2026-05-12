require('dotenv').config();
const { MongoClient } = require('mongodb');
const { spawn } = require('child_process');

const SIGNAL_PHONE = process.env.SIGNAL_PHONE;
if (!SIGNAL_PHONE) {
    console.error('SIGNAL_PHONE env var required');
    process.exit(1);
}

async function run() {
    const mongo = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017/uassist');
    await mongo.connect();
    const collection = mongo.db().collection('signal');
    console.log('✅ MongoDB ready!');

    const proc = spawn('signal-cli', ['-a', SIGNAL_PHONE, '--output=json', 'receive', '--watch'], {
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
                console.log(`📱 [${from}] ${msg.message}`);
                collection.insertOne({
                    from,
                    message: msg.message,
                    timestamp: msg.timestamp,
                    _savedAt: new Date(),
                }).catch(err => console.error('Failed to save:', err.message));
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
