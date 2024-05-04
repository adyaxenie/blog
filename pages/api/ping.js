const { connect, disconnect } = require('../../lib/mongodb');

async function ping(req, res) {
    try {
        const client = await connect();
        const db = client.db('blogs');
        console.log('Pinging MongoDB');
        await db.command({ ping: 1 });
        console.log('Pong!');
        res.status(200).send("Pong!");
    } catch (error) {
        console.error('Error connecting to MongoDB', error);
        res.status(500).send('Error connecting to MongoDB');
    } finally {
        await disconnect(); 
    }
}

export default ping;