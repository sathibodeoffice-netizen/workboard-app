import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

export async function GET(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await dbConnect();
    const url = new URL(req.url);
    const uid = url.searchParams.get('uid');

    // শুধু নিজের profile দেখা যাবে
    if (uid && uid !== user.uid) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const targetUid = uid || user.uid;

    const dbUser = await db.collection('users').findOne({ _id: new ObjectId(targetUid) });
    if (!dbUser) {
      return NextResponse.json({ success: false, message: 'User not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true, name: dbUser.name || '', avatar: dbUser.avatar || '' });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) {
    return NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 });
  }

  try {
    const { db } = await dbConnect();
    const body = await req.json();
    const { uid, name, avatar } = body;

    // শুধু নিজের profile আপডেট করা যাবে
    if (uid && uid !== user.uid) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const updateFields: Record<string, string> = {};
    if (name !== undefined) updateFields.name = name;
    if (avatar !== undefined) updateFields.avatar = avatar;

    await db.collection('users').updateOne(
      { _id: new ObjectId(user.uid) },
      { $set: updateFields }
    );

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
