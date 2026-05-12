const { Client, LocalAuth } = require('whatsapp-web.js');
const qrcode = require('qrcode-terminal');

const client = new Client({
    authStrategy: new LocalAuth(),
    puppeteer: { args: ['--no-sandbox', '--disable-setuid-sandbox'] }
});

client.on('qr', qr => qrcode.generate(qr, { small: true }));

client.on('ready', () => console.log('✅ Connected!'));

client.on('message', async msg => {
    const chat = await msg.getChat();
    console.log(`[${chat.name}] ${msg.body}`);
    console.log(msg);
});

client.initialize();