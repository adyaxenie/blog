import clientPromise from '../../lib/mongodb';

export default async function handler(req, res) {
  const { postId } = req.query;

  if (req.method !== 'GET') {
    return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
    const client = await connect();
    const db = client.db('blogs');
    const posts = db.collection('posts');
    const post = await posts.findOne({ _id: postId }); // Make sure postId matches the format used in your database
    if (post) {
      res.status(200).json(post);
    } else {
      res.status(404).json({ message: 'Post not found' });
    }
  } catch (error) {
    console.error('Error fetching post:', error);
    res.status(500).json({ message: 'Error fetching post' });
  } finally {
    await disconnect();
  }
}