const { MongoClient } = require('mongodb');

let db;

async function connect() {
    const client = new MongoClient(process.env.MONGO_URL || 'mongodb://localhost:27017/uassist');
    await client.connect();
    db = client.db();
    console.log('✅ MongoDB ready!');
}

function getDb() {
    return db;
}

module.exports = { connect, getDb };
