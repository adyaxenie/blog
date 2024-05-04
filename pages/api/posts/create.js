const { connect, disconnect } = require('../../../lib/mongodb');

export default async function handler(req, res) {
  if (req.method !== 'POST') {
      return res.status(405).json({ message: 'Method Not Allowed' });
  }

  try {
      const client = await connect();
      const db = client.db('blogs');
      const posts = db.collection('posts');
      await posts.insertOne(req.body);
      res.status(201).json({ message: "Post created successfully." });
  } catch (error) {
      console.error("Error in post creation:", error);
      res.status(500).json({ message: 'Error creating post' });
  } finally {
      await disconnect();
  }
}


