import { NextResponse } from 'next/server';
import dbConnect from '@/lib/mongodb';
import Task from '@/models/Task';

export const dynamic = 'force-dynamic';
export const runtime = 'nodejs';

export async function GET(req: Request) {
  try {
    await dbConnect();
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

    const tasks = await Task.find(query);
    return NextResponse.json(tasks, { status: 200 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function POST(req: Request) {
  try {
    await dbConnect();
    const data = await req.json();
    const newTask = await Task.create(data);
    return NextResponse.json({ success: true, id: newTask._id.toString() }, { status: 201 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}

export async function PATCH(req: Request) {
  try {
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const department = searchParams.get('department');
    const updateData = await req.json();

    if (id) {
      const updatedTask = await Task.findByIdAndUpdate(id, updateData, { new: true });
      if (!updatedTask) return NextResponse.json({ error: 'Task not found' }, { status: 404 });
      return NextResponse.json({ success: true, task: updatedTask }, { status: 200 });
    } else if (department) {
      if (updateData.newDepartment) {
        await Task.updateMany({ department }, { department: updateData.newDepartment });
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
    await dbConnect();
    const { searchParams } = new URL(req.url);
    const id = searchParams.get('id');
    const department = searchParams.get('department');

    if (id) {
      await Task.findByIdAndDelete(id);
      return NextResponse.json({ success: true }, { status: 200 });
    } else if (department) {
      await Task.deleteMany({ department });
      return NextResponse.json({ success: true }, { status: 200 });
    }
    
    return NextResponse.json({ error: 'Missing id or department' }, { status: 400 });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
