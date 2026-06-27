import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import User from '@/models/User';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function POST(req: Request) {
  try {
    await dbConnect();
    const { email, password, isLogin } = await req.json();

    if (isLogin) {
      const user = await User.findOne({ email, password });
      if (user) {
        return NextResponse.json({ success: true, uid: user._id.toString() }, { status: 200 });
      } else {
        return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
      }
    } else {
      const existingUser = await User.findOne({ email });
      if (existingUser) {
        return NextResponse.json({ success: false, message: 'User already exists' }, { status: 400 });
      } else {
        const newUser = await User.create({ email, password });
        return NextResponse.json({ success: true, uid: newUser._id.toString() }, { status: 201 });
      }
    }
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
