const bcrypt = require('bcryptjs');
const jwt = require('jsonwebtoken');

const JWT_SECRET = process.env.JWT_SECRET || 'changeme-set-JWT_SECRET-in-env';
const JWT_EXPIRES = '7d';

function hashPassword(password) {
    return bcrypt.hash(password, 12);
}

function verifyPassword(password, hash) {
    return bcrypt.compare(password, hash);
}

function signToken(payload) {
    return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRES });
}

function verifyToken(token) {
    return jwt.verify(token, JWT_SECRET);
}

module.exports = { hashPassword, verifyPassword, signToken, verifyToken };
