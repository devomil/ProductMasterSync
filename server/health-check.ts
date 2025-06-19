import { db } from './db';
import { sql } from 'drizzle-orm';

export async function healthCheck() {
  try {
    // Simple database connectivity test
    await db.execute(sql`SELECT 1`);
    return { status: 'ok', database: 'connected' };
  } catch (error) {
    console.error('Health check failed:', error);
    return { status: 'error', database: 'disconnected', error: String(error) };
  }
}