import { NextRequest, NextResponse } from 'next/server';
import bcrypt from 'bcryptjs';
import dbConnect from '@/lib/mongodb';
import { setSession, clearSession } from '@/lib/auth';

const SALT_ROUNDS = 12;

export async function POST(req: NextRequest) {
  try {
    const { db } = await dbConnect();
    const body = await req.json();
    const { email, password, isLogin, rememberMe } = body;

    // Basic validation
    if (!email || !password) {
      return NextResponse.json({ success: false, message: 'Email and password are required' }, { status: 400 });
    }
    if (typeof email !== 'string' || typeof password !== 'string') {
      return NextResponse.json({ success: false, message: 'Invalid input' }, { status: 400 });
    }
    if (password.length < 6) {
      return NextResponse.json({ success: false, message: 'Password must be at least 6 characters' }, { status: 400 });
    }

    const usersCollection = db.collection('users');

    if (isLogin) {
      // ── লগইন ──
      const user = await usersCollection.findOne({ email: email.toLowerCase().trim() });

      if (!user) {
        // Timing attack থেকে বাঁচতে dummy compare করি
        await bcrypt.compare(password, '$2a$12$dummyhashtopreventtimingattackXXXXXXXXXXXXXXXXXXXXXX');
        return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
      }

      // পুরোনো plaintext password থাকলে migrate করে দেই
      let passwordValid = false;
      if (user.password && !user.password.startsWith('$2')) {
        // পুরোনো plaintext — তুলনা করে hash করে সেভ করি
        if (user.password === password) {
          passwordValid = true;
          const hashed = await bcrypt.hash(password, SALT_ROUNDS);
          await usersCollection.updateOne({ _id: user._id }, { $set: { password: hashed } });
        }
      } else {
        passwordValid = await bcrypt.compare(password, user.password);
      }

      if (!passwordValid) {
        return NextResponse.json({ success: false, message: 'Invalid credentials' }, { status: 401 });
      }

      const uid = user._id.toString();
      // setSession এখন token return করে — mobile এ localStorage-এ রাখার জন্য
      const token = await setSession({ uid, email: user.email }, rememberMe === true);

      return NextResponse.json({ success: true, uid, token });

    } else {
      // ── সাইনআপ ──
      const normalizedEmail = email.toLowerCase().trim();
      const existingUser = await usersCollection.findOne({ email: normalizedEmail });

      if (existingUser) {
        return NextResponse.json({ success: false, message: 'User already exists' }, { status: 400 });
      }

      // পাসওয়ার্ড hash করে সেভ করি
      const hashedPassword = await bcrypt.hash(password, SALT_ROUNDS);
      const result = await usersCollection.insertOne({
        email: normalizedEmail,
        password: hashedPassword,
        createdAt: new Date().toISOString(),
      });

      const uid = result.insertedId.toString();
      const token = await setSession({ uid, email: normalizedEmail }, false);

      return NextResponse.json({ success: true, uid, token }, { status: 201 });
    }

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : 'Internal server error';
    return NextResponse.json({ success: false, message }, { status: 500 });
  }
}

/** Logout — cookie মুছে দেয় */
export async function DELETE() {
  await clearSession();
  return NextResponse.json({ success: true });
}
