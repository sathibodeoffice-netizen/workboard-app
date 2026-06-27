import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  try {
    const { db } = await dbConnect();
    const url = new URL(req.url);
    const uid = url.searchParams.get('uid');

    if (!uid) {
      return NextResponse.json({ success: false, message: 'Missing uid' }, { status: 400 });
    }

    const user = await db.collection('users').findOne({ _id: new ObjectId(uid) });
    if (!user) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, name: user.name || '', avatar: user.avatar || '' });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { db } = await dbConnect();
    const body = await req.json();
    const { uid, name, avatar } = body;

    if (!uid) {
      return NextResponse.json({ success: false, message: 'Missing uid' }, { status: 400 });
    }

    const updateFields: any = {};
    if (name !== undefined) updateFields.name = name;
    if (avatar !== undefined) updateFields.avatar = avatar;

    await db.collection('users').updateOne(
      { _id: new ObjectId(uid) },
      { $set: updateFields }
    );

    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
