import { NextRequest, NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { getAuthUser } from '@/lib/auth';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';

/** Auth guard — unauthenticated request block করে */
function requireAuth(req: NextRequest) {
  const user = getAuthUser(req);
  if (!user) {
    return { user: null, error: NextResponse.json({ success: false, message: 'Unauthorized' }, { status: 401 }) };
  }
  return { user, error: null };
}

export async function GET(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const mode = searchParams.get('mode');
    const department = searchParams.get('department');

    // Personal mode-এ শুধু নিজের tasks দেখা যাবে
    if (mode !== 'team' && uid && uid !== user!.uid) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');

    let tasks = [];
    if (mode === 'team') {
      tasks = await tasksCollection.find({ department: department, mode: 'team' }).toArray();
    } else {
      tasks = await tasksCollection.find({ uid: user!.uid, mode: 'personal' }).toArray();
    }

    return NextResponse.json(tasks);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function POST(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    const body = await req.json();

    // Personal task হলে নিজের uid-ই ব্যবহার হবে
    if (body.mode === 'personal') {
      body.uid = user!.uid;
    } else {
      body.uid = body.uid || user!.uid;
    }

    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');

    const result = await tasksCollection.insertOne(body);
    return NextResponse.json({ success: true, task: { ...body, _id: result.insertedId.toString() } }, { status: 201 });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PUT(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    const body = await req.json();
    const { _id, ...updateData } = body;

    if (!_id) {
      return NextResponse.json({ success: false, message: 'Task ID is required' }, { status: 400 });
    }

    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');

    // Task টি আসলে এই user-এর কিনা যাচাই করি
    const task = await tasksCollection.findOne({ _id: new ObjectId(_id as string) });
    if (!task) {
      return NextResponse.json({ success: false, message: 'Task not found' }, { status: 404 });
    }
    if (task.mode === 'personal' && task.uid !== user!.uid) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(_id as string) },
      { $set: updateData }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function DELETE(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const department = searchParams.get('department');

    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');

    if (department) {
      // Department task — department নামে delete করি
      await tasksCollection.deleteMany({ department });
      return NextResponse.json({ success: true });
    }

    if (!id) {
      return NextResponse.json({ success: false, message: 'Task ID or department is required' }, { status: 400 });
    }

    // Personal task হলে owner check করি
    const task = await tasksCollection.findOne({ _id: new ObjectId(id as string) });
    if (!task) {
      return NextResponse.json({ success: false, message: 'Task not found' }, { status: 404 });
    }
    if (task.mode === 'personal' && task.uid !== user!.uid) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const result = await tasksCollection.deleteOne({ _id: new ObjectId(id as string) });

    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

export async function PATCH(req: NextRequest) {
  const { user, error } = requireAuth(req);
  if (error) return error;

  try {
    const { searchParams } = new URL(req.url);
    let id = searchParams.get('id');
    const department = searchParams.get('department');
    const body = await req.json();

    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');

    // Department rename
    if (department && body.newDepartment) {
      await tasksCollection.updateMany(
        { department },
        { $set: { department: body.newDepartment } }
      );
      return NextResponse.json({ success: true });
    }

    if (!id && body._id) {
      id = body._id;
      delete body._id;
    }

    if (!id) {
      return NextResponse.json({ success: false, message: 'Task ID is required' }, { status: 400 });
    }

    // Personal task owner check
    const task = await tasksCollection.findOne({ _id: new ObjectId(id as string) });
    if (!task) {
      return NextResponse.json({ success: false, message: 'Task not found' }, { status: 404 });
    }
    if (task.mode === 'personal' && task.uid !== user!.uid) {
      return NextResponse.json({ success: false, message: 'Forbidden' }, { status: 403 });
    }

    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(id as string) },
      { $set: body }
    );

    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Task not found' }, { status: 404 });
    }

    return NextResponse.json({ success: true });
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}
