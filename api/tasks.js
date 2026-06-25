import { MongoClient, ObjectId } from 'mongodb';

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
    const db = await connectToDatabase();
    const tasksCollection = db.collection('tasks');

    if (req.method === 'GET') {
        const { uid, mode, department } = req.query;
        let query = {};
        
        if (mode === 'personal') {
            query = { uid: uid, mode: 'personal' };
        } else if (mode === 'team') {
            query = { department: department, mode: 'team' };
        }
        
        try {
            const tasks = await tasksCollection.find(query).toArray();
            res.status(200).json(tasks);
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else if (req.method === 'POST') {
        try {
            const newTask = req.body;
            const result = await tasksCollection.insertOne(newTask);
            res.status(200).json({ success: true, id: result.insertedId });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else if (req.method === 'DELETE') {
        try {
            const { id, department } = req.query;
            if (department) {
                await tasksCollection.deleteMany({ department: department });
            } else {
                await tasksCollection.deleteOne({ _id: new ObjectId(id) });
            }
            res.status(200).json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else if (req.method === 'PATCH') {
        try {
            const { id, department } = req.query;
            if (department) {
                const { newDepartment } = req.body;
                await tasksCollection.updateMany(
                    { department: department },
                    { $set: { department: newDepartment } }
                );
            } else {
                const updates = req.body;
                await tasksCollection.updateOne(
                    { _id: new ObjectId(id) },
                    { $set: updates }
                );
            }
            res.status(200).json({ success: true });
        } catch (error) {
            res.status(500).json({ error: error.message });
        }
    } else {
        res.status(405).json({ message: 'Method not allowed' });
    }
}
