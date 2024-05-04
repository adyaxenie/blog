import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
const client = new MongoClient(uri);

async function connect() {
  await client.connect();
  return client.db('blogs'); // Adjust the database name as necessary
}

export default async function handler(req, res) {
  if (req.method !== 'GET') {
    res.status(405).json({ message: 'Method Not Allowed' });
    return;
  }

  const db = await connect();
  const posts = db.collection('posts');

  try {
    const allPosts = await posts.find({}).toArray(); // Fetch all posts
    res.status(200).json(allPosts);
  } catch (error) {
    console.error('Error fetching posts:', error);
    res.status(500).json({ message: 'Failed to fetch posts' });
  } finally {
    await client.close();
  }
}