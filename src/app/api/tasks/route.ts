import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const mode = searchParams.get('mode');
    const department = searchParams.get('department');

    let query: any = { mode };

    if (mode === 'personal') {
      if (uid) query.uid = uid;
    } else if (mode === 'team') {
      if (department) query.department = department;
    }

    const tasks = await tasksCollection.find(query).toArray();
    // Transform _id to string for the frontend
    const formattedTasks = tasks.map((task: any) => ({
      ...task,
      _id: task._id.toString()
    }));
    return NextResponse.json(formattedTasks, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');
    const data = await req.json();
    const result = await tasksCollection.insertOne(data);
    return NextResponse.json({ success: true, id: result.insertedId.toString() }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const department = searchParams.get('department');
    const updateData = await req.json();

    // Remove _id from updateData if present to avoid modifying immutable field
    delete updateData._id;

    if (id) {
      const result = await tasksCollection.findOneAndUpdate(
        { _id: new ObjectId(id) },
        { $set: updateData },
        { returnDocument: 'after' }
      );
      if (!result) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      return NextResponse.json({ success: true, task: { ...result, _id: result._id.toString() } }, { status: 200 });
    } else if (department) {
      if (updateData.newDepartment) {
        await tasksCollection.updateMany({ department }, { $set: { department: updateData.newDepartment } });
        return NextResponse.json({ success: true }, { status: 200 });
      }
      return NextResponse.json({ error: 'Missing newDepartment' }, { status: 400 });
    }
    
    return NextResponse.json({ error: 'Missing id or department' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const department = searchParams.get('department');

    if (id) {
      await tasksCollection.deleteOne({ _id: new ObjectId(id) });
      return NextResponse.json({ success: true }, { status: 200 });
    } else if (department) {
      await tasksCollection.deleteMany({ department });
      return NextResponse.json({ success: true }, { status: 200 });
    }
    
    return NextResponse.json({ error: 'Missing id or department' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

