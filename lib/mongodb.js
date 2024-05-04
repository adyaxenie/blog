const { MongoClient } = require('mongodb');
const url = process.env.MONGODB_URI

async function connect() {
    const client = new MongoClient(url);
    await client.connect();
    return client;
}

async function disconnect(client) {
    await client.close();
}

module.exports = { connect, disconnect };
