require('dotenv').config();
const express = require('express');
const { connect } = require('./lib/db');
const messagesRouter = require('./routes/messages');
const sendRouter = require('./routes/send');

const app = express();
app.use(express.json());

// Basic Auth middleware
app.use((req, res, next) => {
    const user = process.env.API_USER;
    const pass = process.env.API_PASS;
    if (!user || !pass) return next(); // skip if not configured
    const auth = req.headers.authorization;
    if (!auth || !auth.startsWith('Basic ')) {
        res.set('WWW-Authenticate', 'Basic realm="UAssist API"');
        return res.status(401).json({ error: 'Authentication required' });
    }
    const [reqUser, reqPass] = Buffer.from(auth.slice(6), 'base64').toString().split(':');
    if (reqUser !== user || reqPass !== pass) {
        res.set('WWW-Authenticate', 'Basic realm="UAssist API"');
        return res.status(401).json({ error: 'Invalid credentials' });
    }
    next();
});

app.use('/messages', messagesRouter);
app.use('/send', sendRouter);

app.use((err, req, res, next) => {
    console.error(err);
    res.status(500).json({ error: err.message });
});

connect().then(() => {
    app.listen(3000, () => console.log('✅ API running on port 3000'));
}).catch(err => {
    console.error('Fatal:', err.message);
    process.exit(1);
});
