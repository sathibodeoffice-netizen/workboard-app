import { MongoClient, Db } from 'mongodb';

let cachedClient: MongoClient | null = null;
let cachedDb: Db | null = null;

export default async function dbConnect() {
  const MONGODB_URI = process.env.MONGODB_URI;

  if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
  }

  if (cachedClient && cachedDb) {
    return { client: cachedClient, db: cachedDb };
  }

  const client = new MongoClient(MONGODB_URI, {
    serverSelectionTimeoutMS: 8000,
  });

  try {
    await client.connect();
  } catch (err: unknown) {
    const errorMsg = err instanceof Error ? err.message : String(err);
    if (errorMsg.includes('querySrv') || errorMsg.includes('ENOTFOUND') || errorMsg.includes('ECONNREFUSED')) {
      throw new Error(
        'MongoDB Atlas ক্লাস্টারটি বন্ধ (Paused) আছে অথবা ক্লাস্টার লিঙ্ক পরিবর্তিত হয়েছে। দয়া করে cloud.mongodb.com-এ গিয়ে ক্লাস্টারটি "Resume" করুন।'
      );
    }
    throw err;
  }

  const db = client.db('workboard');

  cachedClient = client;
  cachedDb = db;

  return { client, db };
}
