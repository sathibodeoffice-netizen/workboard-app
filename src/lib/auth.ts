import jwt from 'jsonwebtoken';
import { cookies } from 'next/headers';
import { NextRequest } from 'next/server';

const SECRET_KEY = process.env.JWT_SECRET || 'fallback_secret_change_in_production';
const COOKIE_NAME = 'wb_session';
const SESSION_DURATION_7D = 7 * 24 * 60 * 60; // seconds

export interface SessionPayload {
  uid: string;
  email: string;
}

/** JWT token তৈরি করে */
export function createToken(payload: SessionPayload, rememberMe = false): string {
  return jwt.sign(payload, SECRET_KEY, {
    expiresIn: rememberMe ? SESSION_DURATION_7D : '1d',
  });
}

/** JWT token যাচাই করে payload ফেরত দেয় */
export function verifyToken(token: string): SessionPayload | null {
  try {
    return jwt.verify(token, SECRET_KEY) as SessionPayload;
  } catch {
    return null;
  }
}

/** HTTP-only cookie-তে session সেট করে (web browser) */
export async function setSession(payload: SessionPayload, rememberMe = false) {
  const token = createToken(payload, rememberMe);
  const cookieStore = await cookies();
  const isProd = process.env.NODE_ENV === 'production';
  cookieStore.set(COOKIE_NAME, token, {
    httpOnly: true,
    // Mobile WebView & modern browsers require secure: true when sameSite is 'none'
    secure: isProd,
    sameSite: isProd ? ('none' as const) : ('lax' as const),
    maxAge: rememberMe ? SESSION_DURATION_7D : undefined,
    path: '/',
  });
  return token; // token-টা return করি যাতে mobile client localStorage-এ রাখতে পারে
}

/** Cookie থেকে session মুছে দেয় */
export async function clearSession() {
  const cookieStore = await cookies();
  cookieStore.delete(COOKIE_NAME);
}

/**
 * Request থেকে authenticated user বের করে।
 * দুটি উপায়ে token খোঁজে:
 * 1. HTTP-only Cookie (web browser)
 * 2. Authorization: Bearer <token> header (Capacitor mobile app)
 */
export function getAuthUser(req: NextRequest): SessionPayload | null {
  // ১. Cookie থেকে চেক করি (web)
  const cookieToken = req.cookies.get(COOKIE_NAME)?.value;
  if (cookieToken) {
    const payload = verifyToken(cookieToken);
    if (payload) return payload;
  }

  // ২. Authorization header থেকে চেক করি (Capacitor mobile)
  const authHeader = req.headers.get('authorization');
  if (authHeader?.startsWith('Bearer ')) {
    const token = authHeader.slice(7);
    return verifyToken(token);
  }

  return null;
}

/** Server Component-এ authenticated user বের করে */
export async function getCurrentUser(): Promise<SessionPayload | null> {
  const cookieStore = await cookies();
  const token = cookieStore.get(COOKIE_NAME)?.value;
  if (!token) return null;
  return verifyToken(token);
}
