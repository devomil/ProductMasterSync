import { Pool, neonConfig } from '@neondatabase/serverless';
import { drizzle } from 'drizzle-orm/neon-serverless';
import ws from "ws";
import * as schema from "@shared/schema";

// Configure websocket for Neon with optimization
neonConfig.webSocketConstructor = ws;
neonConfig.useSecureWebSocket = true;
neonConfig.pipelineConnect = false; // Disable pipeline to prevent connection issues

if (!process.env.DATABASE_URL) {
  throw new Error(
    "DATABASE_URL must be set. Did you forget to provision a database?",
  );
}

// Create optimized pool with better performance settings for 1M+ product scale
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 20,
  min: 2,
  idleTimeoutMillis: 60000,
  connectionTimeoutMillis: 10000,
  maxUses: 7500,
});

export const db = drizzle(pool, { schema });

pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

pool.on('connect', (client) => {
  client.query('SET statement_timeout = 30000');
});

const SLOW_QUERY_THRESHOLD_MS = 5000;
const originalQuery = pool.query.bind(pool);
pool.query = async function(...args: any[]) {
  const start = Date.now();
  try {
    const result = await originalQuery(...args);
    const duration = Date.now() - start;
    if (duration > SLOW_QUERY_THRESHOLD_MS) {
      const queryText = typeof args[0] === 'string' ? args[0].substring(0, 200) : 'prepared statement';
      console.warn(`[SLOW QUERY] ${duration}ms: ${queryText}`);
    }
    return result;
  } catch (err) {
    const duration = Date.now() - start;
    const queryText = typeof args[0] === 'string' ? args[0].substring(0, 200) : 'prepared statement';
    console.error(`[QUERY ERROR] ${duration}ms: ${queryText}`, err);
    throw err;
  }
} as any;