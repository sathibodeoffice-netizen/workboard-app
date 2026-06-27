import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';

export async function POST(req: Request) {
  try {
    const { db } = await dbConnect();
    const body = await req.json();
    const { email, password, isLogin } = body;
    const usersCollection = db.collection('users');

    if (isLogin) {
      const user = await usersCollection.findOne({ email, password });
      if (user) {
        return NextResponse.json({ success: true, uid: user._id.toString() });
      } else {
        return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
      }
    } else {
      const existingUser = await usersCollection.findOne({ email });
      if (existingUser) {
        return NextResponse.json({ success: false, message: 'User already exists' }, { status: 400 });
      } else {
        const result = await usersCollection.insertOne({ email, password });
        return NextResponse.json({ success: true, uid: result.insertedId.toString() }, { status: 201 });
      }
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
