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

// Create optimized pool with better performance settings
export const pool = new Pool({ 
  connectionString: process.env.DATABASE_URL,
  max: 10, // Increased connection pool size
  min: 2,  // Maintain minimum connections
  idleTimeoutMillis: 60000, // Keep connections alive longer
  connectionTimeoutMillis: 10000, // Longer timeout for connection establishment
  maxUses: 7500, // Allow more reuses per connection
});

export const db = drizzle(pool, { schema });

// Add connection error handling
pool.on('error', (err) => {
  console.error('Database pool error:', err);
});

pool.on('connect', () => {
  console.log('Database connected successfully');
});