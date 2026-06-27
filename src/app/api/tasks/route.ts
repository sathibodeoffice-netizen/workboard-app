import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import { ObjectId } from 'mongodb';

export async function GET(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const uid = searchParams.get('uid');
    const mode = searchParams.get('mode');
    const department = searchParams.get('department');
    
    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');
    
    let tasks = [];
    if (mode === 'team') {
      tasks = await tasksCollection.find({ department: department, mode: 'team' }).toArray();
    } else {
      if (!uid) {
        return NextResponse.json({ success: false, message: 'User ID is required for personal tasks' }, { status: 400 });
      }
      tasks = await tasksCollection.find({ uid: uid, mode: 'personal' }).toArray();
    }
    
    // Return array directly to match frontend expectations
    return NextResponse.json(tasks);
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');
    
    const result = await tasksCollection.insertOne(body);
    return NextResponse.json({ success: true, task: { ...body, _id: result.insertedId.toString() } }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function PUT(req: Request) {
  try {
    const body = await req.json();
    const { _id, ...updateData } = body;
    
    if (!_id) {
      return NextResponse.json({ success: false, message: 'Task ID is required' }, { status: 400 });
    }
    
    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');
    
    const result = await tasksCollection.updateOne(
      { _id: new ObjectId(_id as string) },
      { $set: updateData }
    );
    
    if (result.matchedCount === 0) {
      return NextResponse.json({ success: false, message: 'Task not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}

export async function DELETE(req: Request) {
  try {
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const department = searchParams.get('department');
    
    const { db } = await dbConnect();
    const tasksCollection = db.collection('tasks');
    
    if (department) {
      await tasksCollection.deleteMany({ department });
      return NextResponse.json({ success: true });
    }
    
    if (!id) {
      return NextResponse.json({ success: false, message: 'Task ID or department is required' }, { status: 400 });
    }
    
    const result = await tasksCollection.deleteOne({ _id: new ObjectId(id as string) });
    
    if (result.deletedCount === 0) {
      return NextResponse.json({ success: false, message: 'Task not found' }, { status: 404 });
    }
    
    return NextResponse.json({ success: true });
  } catch (error: any) {
    return NextResponse.json({ success: false, message: error.message }, { status: 500 });
  }
}
