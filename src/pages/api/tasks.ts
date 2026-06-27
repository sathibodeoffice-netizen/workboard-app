import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  try {
    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');
    
    if (req.method === 'GET') {
      const { uid, mode, department } = req.query;
      let query: any = { mode };

      if (mode === 'personal') {
        if (uid) query.uid = uid;
      } else if (mode === 'team') {
        if (department) query.department = department;
      }

      const tasks = await tasksCollection.find(query).toArray();
      const formattedTasks = tasks.map((task: any) => ({
        ...task,
        _id: task._id.toString()
      }));
      return res.status(200).json(formattedTasks);
    } 
    
    else if (req.method === 'POST') {
      const data = req.body;
      const result = await tasksCollection.insertOne(data);
      return res.status(201).json({ success: true, id: result.insertedId.toString() });
    } 
    
    else if (req.method === 'PATCH') {
      const { id, department } = req.query;
      const updateData = req.body;
      delete updateData._id;

      if (id && typeof id === 'string') {
        const result = await tasksCollection.findOneAndUpdate(
          { _id: new ObjectId(id) },
          { $set: updateData },
          { returnDocument: 'after' }
        );
        if (!result) return res.status(404).json({ error: 'Task not found' });
        return res.status(200).json({ success: true, task: { ...result, _id: result?._id?.toString() } });
      } else if (department && typeof department === 'string') {
        if (updateData.newDepartment) {
          await tasksCollection.updateMany({ department }, { $set: { department: updateData.newDepartment } });
          return res.status(200).json({ success: true });
        }
        return res.status(400).json({ error: 'Missing newDepartment' });
      }
      return res.status(400).json({ error: 'Missing id or department' });
    } 
    
    else if (req.method === 'DELETE') {
      const { id, department } = req.query;

      if (id && typeof id === 'string') {
        await tasksCollection.deleteOne({ _id: new ObjectId(id) });
        return res.status(200).json({ success: true });
      } else if (department && typeof department === 'string') {
        await tasksCollection.deleteMany({ department });
        return res.status(200).json({ success: true });
      }
      return res.status(400).json({ error: 'Missing id or department' });
    }
    
    else {
      return res.status(405).json({ error: 'Method not allowed' });
    }
  } catch (error: any) {
    return res.status(500).json({ error: error.message });
  }
}
