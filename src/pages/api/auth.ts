import type { NextApiRequest, NextApiResponse } from 'next';
import dbConnect from '@/lib/mongodb';

export default async function handler(req: NextApiRequest, res: NextApiResponse) {
  if (req.method !== 'POST') {
    return res.status(405).json({ success: false, message: 'Method not allowed' });
  }
  
  try {
    const { db } = await dbConnect();
    const { email, password, isLogin } = req.body;
    const usersCollection = db.collection('users');

    if (isLogin) {
      const user = await usersCollection.findOne({ email, password });
      if (user) {
        return res.status(200).json({ success: true, uid: user._id.toString() });
      } else {
        return res.status(401).json({ success: false, message: 'Invalid credentials' });
      }
    } else {
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return res.status(400).json({ success: false, message: 'User already exists' });
      } else {
        const result = await usersCollection.insertOne({ email, password });
        return res.status(201).json({ success: true, uid: result.insertedId.toString() });
      }
    }
  } catch (error: any) {
    return res.status(500).json({ success: false, message: error.message });
  }
}
