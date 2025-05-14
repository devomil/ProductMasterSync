import { Router, Request, Response } from "express";
import { db } from "./db";
import { connections, connectionTypeEnum, connectionStatusEnum, insertConnectionSchema } from "@shared/schema";
import { eq } from "drizzle-orm";
import crypto from "crypto";
import { z } from "zod";

// Create a router
const router = Router();

// Encryption key (would normally be stored in environment variable)
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || "a8e7d6c5b4a3f2e1d0c9b8a7f6e5d4c3";
const ENCRYPTION_IV = process.env.ENCRYPTION_IV || "1234567890abcdef";

// Encrypt sensitive data before saving to database
function encrypt(text: string): string {
  const cipher = crypto.createCipheriv(
    'aes-256-cbc', 
    Buffer.from(ENCRYPTION_KEY), 
    Buffer.from(ENCRYPTION_IV)
  );
  let encrypted = cipher.update(text, 'utf8', 'hex');
  encrypted += cipher.final('hex');
  return encrypted;
}

// Decrypt sensitive data when retrieving from database
function decrypt(text: string): string {
  try {
    const decipher = crypto.createDecipheriv(
      'aes-256-cbc', 
      Buffer.from(ENCRYPTION_KEY), 
      Buffer.from(ENCRYPTION_IV)
    );
    let decrypted = decipher.update(text, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  } catch (error) {
    console.error("Decryption error:", error);
    return "**ENCRYPTED**";
  }
}

// Get all connections
router.get('/', async (req: Request, res: Response) => {
  try {
    const allConnections = await db.select().from(connections);
    
    // Don't return the actual credentials, just a placeholder
    const sanitizedConnections = allConnections.map(conn => ({
      ...conn,
      credentials: { 
        ...conn.credentials as any,
        // Remove any sensitive fields
        password: conn.credentials && (conn.credentials as any).password ? "**HIDDEN**" : undefined,
        accessToken: conn.credentials && (conn.credentials as any).accessToken ? "**HIDDEN**" : undefined,
        secretKey: conn.credentials && (conn.credentials as any).secretKey ? "**HIDDEN**" : undefined,
        apiKey: conn.credentials && (conn.credentials as any).apiKey ? "**HIDDEN**" : undefined
      }
    }));
    
    res.json(sanitizedConnections);
  } catch (error) {
    console.error("Error fetching connections:", error);
    res.status(500).json({ error: "Failed to fetch connections" });
  }
});

// Get one connection by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid connection ID" });
    }
    
    const [connection] = await db.select().from(connections).where(eq(connections.id, id));
    
    if (!connection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    
    // Don't return the actual credentials, just a placeholder
    const sanitizedConnection = {
      ...connection,
      credentials: { 
        ...connection.credentials as any,
        // Remove any sensitive fields
        password: connection.credentials && (connection.credentials as any).password ? "**HIDDEN**" : undefined,
        accessToken: connection.credentials && (connection.credentials as any).accessToken ? "**HIDDEN**" : undefined,
        secretKey: connection.credentials && (connection.credentials as any).secretKey ? "**HIDDEN**" : undefined,
        apiKey: connection.credentials && (connection.credentials as any).apiKey ? "**HIDDEN**" : undefined
      }
    };
    
    res.json(sanitizedConnection);
  } catch (error) {
    console.error("Error fetching connection:", error);
    res.status(500).json({ error: "Failed to fetch connection" });
  }
});

// Create a new connection
router.post('/', async (req: Request, res: Response) => {
  try {
    // Validate request body against schema
    const validatedData = insertConnectionSchema.parse(req.body);
    
    // Encrypt any sensitive credentials
    let encryptedCredentials = { ...validatedData.credentials as any };
    
    // Encrypt sensitive fields if they exist
    if (encryptedCredentials.password) {
      encryptedCredentials.password = encrypt(encryptedCredentials.password);
    }
    if (encryptedCredentials.accessToken) {
      encryptedCredentials.accessToken = encrypt(encryptedCredentials.accessToken);
    }
    if (encryptedCredentials.secretKey) {
      encryptedCredentials.secretKey = encrypt(encryptedCredentials.secretKey);
    }
    if (encryptedCredentials.apiKey) {
      encryptedCredentials.apiKey = encrypt(encryptedCredentials.apiKey);
    }
    
    // Create the connection with encrypted credentials
    const [newConnection] = await db.insert(connections)
      .values({
        ...validatedData,
        credentials: encryptedCredentials
      })
      .returning();
    
    // Return the new connection with sanitized credentials
    const sanitizedConnection = {
      ...newConnection,
      credentials: { 
        ...newConnection.credentials as any,
        // Remove any sensitive fields
        password: newConnection.credentials && (newConnection.credentials as any).password ? "**HIDDEN**" : undefined,
        accessToken: newConnection.credentials && (newConnection.credentials as any).accessToken ? "**HIDDEN**" : undefined,
        secretKey: newConnection.credentials && (newConnection.credentials as any).secretKey ? "**HIDDEN**" : undefined,
        apiKey: newConnection.credentials && (newConnection.credentials as any).apiKey ? "**HIDDEN**" : undefined
      }
    };
    
    res.status(201).json(sanitizedConnection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Error creating connection:", error);
    res.status(500).json({ error: "Failed to create connection" });
  }
});

// Update a connection
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid connection ID" });
    }
    
    // Get the existing connection
    const [existingConnection] = await db.select().from(connections).where(eq(connections.id, id));
    
    if (!existingConnection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    
    // Validate request body against schema
    const validatedData = insertConnectionSchema.partial().parse(req.body);
    
    // Handle credentials separately for encryption
    let updatedCredentials = existingConnection.credentials as any;
    
    if (validatedData.credentials) {
      // Merge new credentials with existing ones
      updatedCredentials = { ...updatedCredentials, ...validatedData.credentials as any };
      
      // Encrypt sensitive fields if they exist
      if (updatedCredentials.password && updatedCredentials.password !== "**HIDDEN**") {
        updatedCredentials.password = encrypt(updatedCredentials.password);
      }
      if (updatedCredentials.accessToken && updatedCredentials.accessToken !== "**HIDDEN**") {
        updatedCredentials.accessToken = encrypt(updatedCredentials.accessToken);
      }
      if (updatedCredentials.secretKey && updatedCredentials.secretKey !== "**HIDDEN**") {
        updatedCredentials.secretKey = encrypt(updatedCredentials.secretKey);
      }
      if (updatedCredentials.apiKey && updatedCredentials.apiKey !== "**HIDDEN**") {
        updatedCredentials.apiKey = encrypt(updatedCredentials.apiKey);
      }
    }
    
    // Update the connection with encrypted credentials
    const [updatedConnection] = await db.update(connections)
      .set({
        ...validatedData,
        credentials: updatedCredentials,
        updatedAt: new Date()
      })
      .where(eq(connections.id, id))
      .returning();
    
    // Return the updated connection with sanitized credentials
    const sanitizedConnection = {
      ...updatedConnection,
      credentials: { 
        ...updatedConnection.credentials as any,
        // Remove any sensitive fields
        password: updatedConnection.credentials && (updatedConnection.credentials as any).password ? "**HIDDEN**" : undefined,
        accessToken: updatedConnection.credentials && (updatedConnection.credentials as any).accessToken ? "**HIDDEN**" : undefined,
        secretKey: updatedConnection.credentials && (updatedConnection.credentials as any).secretKey ? "**HIDDEN**" : undefined,
        apiKey: updatedConnection.credentials && (updatedConnection.credentials as any).apiKey ? "**HIDDEN**" : undefined
      }
    };
    
    res.json(sanitizedConnection);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Error updating connection:", error);
    res.status(500).json({ error: "Failed to update connection" });
  }
});

// Delete a connection
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const id = parseInt(req.params.id);
    if (isNaN(id)) {
      return res.status(400).json({ error: "Invalid connection ID" });
    }
    
    // Check if connection exists
    const [existingConnection] = await db.select().from(connections).where(eq(connections.id, id));
    
    if (!existingConnection) {
      return res.status(404).json({ error: "Connection not found" });
    }
    
    // Delete the connection
    await db.delete(connections).where(eq(connections.id, id));
    
    res.status(204).end();
  } catch (error) {
    console.error("Error deleting connection:", error);
    res.status(500).json({ error: "Failed to delete connection" });
  }
});

// Test a connection
router.post('/test', async (req: Request, res: Response) => {
  try {
    // Validate the connection config
    const testConfig = z.object({
      type: connectionTypeEnum,
      credentials: z.record(z.any()),
    }).parse(req.body);
    
    let testResult = {
      success: false,
      message: "Connection test failed",
      details: null
    };
    
    // Test the connection based on type
    switch (testConfig.type) {
      case 'ftp':
        testResult = await testFtpConnection(testConfig.credentials);
        break;
      case 'sftp':
        testResult = await testSftpConnection(testConfig.credentials);
        break;
      case 'api':
        testResult = await testApiConnection(testConfig.credentials);
        break;
      case 'database':
        testResult = await testDatabaseConnection(testConfig.credentials);
        break;
      default:
        testResult = {
          success: false,
          message: `Unsupported connection type: ${testConfig.type}`,
          details: null
        };
    }
    
    res.json(testResult);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error("Error testing connection:", error);
    res.status(500).json({ 
      success: false,
      message: "Failed to test connection",
      details: error instanceof Error ? error.message : String(error)
    });
  }
});

// Test FTP connection
async function testFtpConnection(credentials: any) {
  try {
    const FTP = require('ftp');
    const client = new FTP();
    
    return new Promise((resolve, reject) => {
      client.on('ready', () => {
        client.list((err: Error, list: any[]) => {
          client.end();
          if (err) {
            resolve({
              success: false,
              message: "Connected but failed to list directory",
              details: err.message
            });
          } else {
            resolve({
              success: true,
              message: "Successfully connected to FTP server",
              details: {
                fileCount: list.length,
                sampleFiles: list.slice(0, 5).map((file: any) => file.name)
              }
            });
          }
        });
      });
      
      client.on('error', (err: Error) => {
        client.end();
        resolve({
          success: false,
          message: "Failed to connect to FTP server",
          details: err.message
        });
      });
      
      client.connect({
        host: credentials.host,
        port: credentials.port || 21,
        user: credentials.username,
        password: credentials.password,
        secure: credentials.secure || false
      });
      
      // Set a timeout in case the connection hangs
      setTimeout(() => {
        client.end();
        resolve({
          success: false,
          message: "Connection timeout",
          details: "The connection attempt took too long and was aborted"
        });
      }, 10000);
    });
  } catch (error) {
    return {
      success: false,
      message: "FTP connection test failed",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

// Test SFTP connection
async function testSftpConnection(credentials: any) {
  try {
    const { Client } = require('ssh2');
    const client = new Client();
    
    return new Promise((resolve, reject) => {
      client.on('ready', () => {
        client.sftp((err: Error, sftp: any) => {
          if (err) {
            client.end();
            resolve({
              success: false,
              message: "Connected but failed to initialize SFTP",
              details: err.message
            });
            return;
          }
          
          sftp.readdir('.', (err: Error, list: any[]) => {
            client.end();
            if (err) {
              resolve({
                success: false,
                message: "Connected but failed to list directory",
                details: err.message
              });
            } else {
              resolve({
                success: true,
                message: "Successfully connected to SFTP server",
                details: {
                  fileCount: list.length,
                  sampleFiles: list.slice(0, 5).map((file: any) => file.filename)
                }
              });
            }
          });
        });
      });
      
      client.on('error', (err: Error) => {
        client.end();
        resolve({
          success: false,
          message: "Failed to connect to SFTP server",
          details: err.message
        });
      });
      
      const connectConfig: any = {
        host: credentials.host,
        port: credentials.port || 22,
        username: credentials.username,
      };
      
      // Handle different authentication methods
      if (credentials.password) {
        connectConfig.password = credentials.password;
      } else if (credentials.privateKey) {
        connectConfig.privateKey = credentials.privateKey;
        if (credentials.passphrase) {
          connectConfig.passphrase = credentials.passphrase;
        }
      }
      
      client.connect(connectConfig);
      
      // Set a timeout in case the connection hangs
      setTimeout(() => {
        client.end();
        resolve({
          success: false,
          message: "Connection timeout",
          details: "The connection attempt took too long and was aborted"
        });
      }, 10000);
    });
  } catch (error) {
    return {
      success: false,
      message: "SFTP connection test failed",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

// Test API connection
async function testApiConnection(credentials: any) {
  try {
    const axios = require('axios');
    
    // Set up headers based on auth type
    const headers: Record<string, string> = {};
    
    if (credentials.authType === 'basic') {
      const auth = Buffer.from(`${credentials.username}:${credentials.password}`).toString('base64');
      headers['Authorization'] = `Basic ${auth}`;
    } else if (credentials.authType === 'bearer') {
      headers['Authorization'] = `Bearer ${credentials.accessToken}`;
    } else if (credentials.authType === 'apiKey') {
      if (credentials.apiKeyLocation === 'header') {
        headers[credentials.apiKeyName] = credentials.apiKey;
      }
    }
    
    // Set content type if provided
    if (credentials.contentType) {
      headers['Content-Type'] = credentials.contentType;
    }
    
    // Create request options
    const options: any = {
      method: credentials.method || 'GET',
      url: credentials.url,
      headers,
      timeout: 10000
    };
    
    // Add query params for apiKey in query
    if (credentials.authType === 'apiKey' && credentials.apiKeyLocation === 'query') {
      options.params = {
        [credentials.apiKeyName]: credentials.apiKey
      };
    }
    
    // Add request body if method is POST/PUT/PATCH
    if (['POST', 'PUT', 'PATCH'].includes(options.method) && credentials.body) {
      options.data = credentials.body;
    }
    
    // Make the request
    const response = await axios(options);
    
    return {
      success: true,
      message: "Successfully connected to API",
      details: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        sampleData: response.data
      }
    };
  } catch (error: any) {
    let details = "Unknown error";
    
    if (error.response) {
      // The request was made and the server responded with a status code
      // that falls out of the range of 2xx
      details = {
        status: error.response.status,
        statusText: error.response.statusText,
        data: error.response.data
      };
    } else if (error.request) {
      // The request was made but no response was received
      details = "No response received from server";
    } else {
      // Something happened in setting up the request that triggered an Error
      details = error.message;
    }
    
    return {
      success: false,
      message: "API connection test failed",
      details
    };
  }
}

// Test database connection
async function testDatabaseConnection(credentials: any) {
  try {
    let client;
    let result;
    
    // Test based on database type
    switch (credentials.databaseType) {
      case 'postgresql':
        const { Pool } = require('pg');
        client = new Pool({
          host: credentials.host,
          port: credentials.port || 5432,
          database: credentials.database,
          user: credentials.username,
          password: credentials.password,
          ssl: credentials.ssl || false,
          // Set a query timeout
          statement_timeout: 10000
        });
        
        // Test the connection
        const { rows } = await client.query('SELECT NOW() as time');
        
        // Close the connection
        await client.end();
        
        result = {
          success: true,
          message: "Successfully connected to PostgreSQL database",
          details: {
            time: rows[0].time,
            serverVersion: "PostgreSQL"
          }
        };
        break;
        
      // Add support for other database types as needed
      
      default:
        result = {
          success: false,
          message: `Unsupported database type: ${credentials.databaseType}`,
          details: null
        };
    }
    
    return result;
  } catch (error) {
    return {
      success: false,
      message: "Database connection test failed",
      details: error instanceof Error ? error.message : String(error)
    };
  }
}

export default router;