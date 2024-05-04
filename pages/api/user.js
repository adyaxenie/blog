import clientPromise from '../../lib/mongodb';

export default async function handler(req, res) {
  try {
    const client = await clientPromise;
    const db = client.db('blog'); 
    const collection = db.collection('blogs.users');  
    const data = await collection.find({}).toArray(); 
    res.status(200).json(data);
  } catch (e) {
    console.error(e);
    res.status(500).json({ error: "Failed to connect to the database" });
  }
}
