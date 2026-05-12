require('dotenv').config();
const express = require('express');
const { connect } = require('./lib/db');
const messagesRouter = require('./routes/messages');
const sendRouter = require('./routes/send');

const app = express();
app.use(express.json());

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
