const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');
const { Pool } = require('pg');

const pool = new Pool({
    host: process.env.DB_HOST || 'localhost',
    port: process.env.DB_PORT || 5432,
    database: process.env.DB_NAME || 'uassist',
    user: process.env.DB_USER || 'uassist',
    password: process.env.DB_PASSWORD,
});

async function initDb() {
    await pool.query(`
        CREATE TABLE IF NOT EXISTS messages (
            id              TEXT PRIMARY KEY,
            timestamp       BIGINT,
            from_id         TEXT,
            to_id           TEXT,
            author          TEXT,
            body            TEXT,
            type            TEXT,
            ack             SMALLINT,
            device_type     TEXT,
            from_me         BOOLEAN,
            is_forwarded    BOOLEAN,
            forwarding_score SMALLINT,
            is_status       BOOLEAN,
            is_starred      BOOLEAN,
            broadcast       BOOLEAN,
            has_quoted_msg  BOOLEAN,
            has_reaction    BOOLEAN,
            has_media       BOOLEAN,
            is_gif          BOOLEAN,
            is_ephemeral    BOOLEAN,
            duration        TEXT,
            mentioned_ids   TEXT[],
            links           JSONB,
            location        JSONB,
            v_cards         TEXT[],
            poll_name       TEXT,
            poll_options    JSONB,
            chat_name       TEXT,
            raw             JSONB,
            created_at      TIMESTAMPTZ DEFAULT NOW()
        )
    `);
}

async function saveMessage(msg, chatName) {
    const msgId = [msg.id.remote, msg.id.id].join('_');
    await pool.query(`
        INSERT INTO messages (
            id, timestamp, from_id, to_id, author, body, type, ack,
            device_type, from_me, is_forwarded, forwarding_score,
            is_status, is_starred, broadcast, has_quoted_msg,
            has_reaction, has_media, is_gif, is_ephemeral,
            duration, mentioned_ids, links, location, v_cards,
            poll_name, poll_options, chat_name, raw
        ) VALUES (
            $1,$2,$3,$4,$5,$6,$7,$8,
            $9,$10,$11,$12,
            $13,$14,$15,$16,
            $17,$18,$19,$20,
            $21,$22,$23,$24,$25,
            $26,$27,$28,$29
        ) ON CONFLICT (id) DO NOTHING
    `, [
        msgId,
        msg.timestamp,
        msg.from,
        msg.to,
        msg.author || null,
        msg.body,
        msg.type,
        msg.ack,
        msg.deviceType || null,
        msg.fromMe,
        msg.isForwarded,
        msg.forwardingScore,
        msg.isStatus,
        msg.isStarred,
        msg.broadcast,
        msg.hasQuotedMsg,
        msg.hasReaction,
        msg.hasMedia,
        msg.isGif,
        msg.isEphemeral,
        msg.duration || null,
        msg.mentionedIds || [],
        JSON.stringify(msg.links || []),
        msg.location ? JSON.stringify(msg.location) : null,
        msg.vCards || [],
        msg.pollName || null,
        msg.pollOptions ? JSON.stringify(msg.pollOptions) : null,
        chatName,
        JSON.stringify(msg.rawData || {}),
    ]);
}

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', async () => {
    console.log('✅ Connected!');
    await initDb();
    console.log('✅ Database ready!');
});

client.on('message', async msg => {
    const chat = await msg.getChat();
    console.log(`[${chat.name}] ${msg.body}`);
    try {
        await saveMessage(msg, chat.name);
    } catch (err) {
        console.error('Failed to save message:', err.message);
    }
});

client.initialize();
