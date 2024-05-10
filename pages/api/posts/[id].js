import { MongoClient, ObjectId } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connect() {
    await client.connect();
    return client.db('blogs');
}

export default async function handler(req, res) {
    if (req.method !== 'GET') {
        res.status(405).json({ message: 'Method Not Allowed' });
        return;
    }

    const { id } = req.query;

    if (!ObjectId.isValid(id)) {
        res.status(400).json({ message: 'Invalid ObjectId format' });
        return;
    }

    const db = await connect();
    const posts = db.collection('posts');
    
    try {
        const post = await posts.findOne({ _id: new ObjectId(id) });
        if (!post) {
            res.status(404).json({ message: 'Post not found' });
            return;
        }
        res.status(200).json(post);
    } catch (error) {
        console.error('Error fetching post:', error);
        res.status(500).json({ message: 'Failed to fetch post', error: error.message });
    } finally {
        await client.close();
    }
}
