const { execFile } = require('child_process');
const fs = require('fs');
const path = require('path');

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

function send(to, message) {
    return new Promise((resolve, reject) => {
        const phone = detectSignalAccount();
        if (!phone) return reject(new Error('No Signal account found. Link a device first.'));
        execFile('signal-cli', ['-a', phone, 'send', '-m', message, to], (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve(stdout);
        });
    });
}

module.exports = { send };
