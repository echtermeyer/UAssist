const { execFile } = require('child_process');

function send(to, message) {
    return new Promise((resolve, reject) => {
        const phone = process.env.SIGNAL_PHONE;
        if (!phone) return reject(new Error('SIGNAL_PHONE env var not set'));
        execFile('signal-cli', ['-a', phone, 'send', '-m', message, to], (err, stdout, stderr) => {
            if (err) return reject(new Error(stderr || err.message));
            resolve(stdout);
        });
    });
}

module.exports = { send };
