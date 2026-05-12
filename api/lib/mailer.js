const nodemailer = require('nodemailer');

const transporter = nodemailer.createTransport({
    host: 'mail.gmx.net',
    port: 587,
    secure: false,
    auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
    },
});

function sendMail(to, subject, text) {
    return transporter.sendMail({
        from: process.env.SMTP_USER,
        to,
        subject,
        text,
    });
}

module.exports = { sendMail };
