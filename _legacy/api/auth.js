import { MongoClient } from 'mongodb';

const uri = process.env.MONGODB_URI;
let client;

async function connectToDatabase() {
    if (!client) {
        client = new MongoClient(uri);
        await client.connect();
    }
    return client.db('workboard');
}

export default async function handler(req, res) {
    if (req.method === 'POST') {
        try {
            const { email, password, isLogin } = req.body;
            const db = await connectToDatabase();
            const users = db.collection('users');

            if (isLogin) {
                // Login logic
                const user = await users.findOne({ email, password });
                if (user) {
                    res.status(200).json({ success: true, uid: user._id.toString() });
                } else {
                    res.status(401).json({ success: false, message: 'Invalid credentials' });
                }
            } else {
                // Signup logic
                const existingUser = await users.findOne({ email });
                if (existingUser) {
                    res.status(400).json({ success: false, message: 'User already exists' });
                } else {
                    const result = await users.insertOne({ email, password });
                    res.status(200).json({ success: true, uid: result.insertedId.toString() });
                }
            }
        } catch (error) {
            res.status(500).json({ success: false, message: error.message });
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' });
    }
}
