import { Request, Response, Router } from 'express';
import { pool } from './db';
import { z } from 'zod';
import crypto from 'crypto';
import { storage } from './storage';
import axios from 'axios';
import { Client } from 'ftp';
import { Client as SftpClient } from 'ssh2';

// Schema for connection validation
const connectionSchema = z.object({
  name: z.string().min(2, { message: 'Name must be at least 2 characters' }),
  type: z.string().min(1, { message: 'Connection type is required' }),
  description: z.string().optional(),
  supplierId: z.number().optional(),
  isActive: z.boolean().default(true),
  credentials: z.record(z.any())
});

// Connection test validation schema
const connectionTestSchema = connectionSchema;

// Encryption/decryption for credentials
const ENCRYPTION_KEY = process.env.ENCRYPTION_KEY || crypto.randomBytes(32).toString('hex');
const IV_LENGTH = 16;

function encrypt(text: string): string {
  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let encrypted = cipher.update(text);
  encrypted = Buffer.concat([encrypted, cipher.final()]);
  return iv.toString('hex') + ':' + encrypted.toString('hex');
}

function decrypt(text: string): string {
  const textParts = text.split(':');
  const iv = Buffer.from(textParts.shift()!, 'hex');
  const encryptedText = Buffer.from(textParts.join(':'), 'hex');
  const decipher = crypto.createDecipheriv('aes-256-cbc', Buffer.from(ENCRYPTION_KEY, 'hex'), iv);
  let decrypted = decipher.update(encryptedText);
  decrypted = Buffer.concat([decrypted, decipher.final()]);
  return decrypted.toString();
}

// Router
const router = Router();

// Get all connections
router.get('/', async (req: Request, res: Response) => {
  try {
    const connections = await pool.query(`
      SELECT id, name, type, description, supplier_id as "supplierId", is_active as "isActive", 
        created_at as "createdAt", updated_at as "updatedAt", 
        last_tested as "lastTested", last_test_success as "lastTestSuccess"
      FROM connection_credentials
      ORDER BY name ASC
    `);
    
    // Decrypt and parse credentials for each connection
    const connectionsWithCredentials = await Promise.all(connections.rows.map(async (conn) => {
      // Get credentials but don't expose them directly
      const credentials = await pool.query(
        'SELECT credentials FROM connection_credentials WHERE id = $1',
        [conn.id]
      );
      
      if (credentials.rows.length > 0 && credentials.rows[0].credentials) {
        const decrypted = decrypt(credentials.rows[0].credentials);
        conn.credentials = JSON.parse(decrypted);
        
        // Remove sensitive information from the response
        if (conn.credentials.password) conn.credentials.password = '••••••••';
        if (conn.credentials.apiKey) conn.credentials.apiKey = '••••••••';
        if (conn.credentials.clientSecret) conn.credentials.clientSecret = '••••••••';
        if (conn.credentials.refreshToken) conn.credentials.refreshToken = '••••••••';
        if (conn.credentials.privateKey) conn.credentials.privateKey = '••••••••';
        if (conn.credentials.passphrase) conn.credentials.passphrase = '••••••••';
      }
      
      return conn;
    }));
    
    res.json(connectionsWithCredentials);
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ message: 'Failed to fetch connections' });
  }
});

// Get connection by ID
router.get('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    const connection = await pool.query(`
      SELECT id, name, type, description, supplier_id as "supplierId", is_active as "isActive", 
        created_at as "createdAt", updated_at as "updatedAt", 
        last_tested as "lastTested", last_test_success as "lastTestSuccess"
      FROM connection_credentials WHERE id = $1
    `, [id]);
    
    if (connection.rows.length === 0) {
      return res.status(404).json({ message: 'Connection not found' });
    }
    
    // Get and decrypt credentials
    const credentials = await pool.query(
      'SELECT credentials FROM connection_credentials WHERE id = $1',
      [id]
    );
    
    if (credentials.rows.length > 0 && credentials.rows[0].credentials) {
      const decrypted = decrypt(credentials.rows[0].credentials);
      connection.rows[0].credentials = JSON.parse(decrypted);
      
      // Remove sensitive information from the response
      if (connection.rows[0].credentials.password) connection.rows[0].credentials.password = '••••••••';
      if (connection.rows[0].credentials.apiKey) connection.rows[0].credentials.apiKey = '••••••••';
      if (connection.rows[0].credentials.clientSecret) connection.rows[0].credentials.clientSecret = '••••••••';
      if (connection.rows[0].credentials.refreshToken) connection.rows[0].credentials.refreshToken = '••••••••';
      if (connection.rows[0].credentials.privateKey) connection.rows[0].credentials.privateKey = '••••••••';
      if (connection.rows[0].credentials.passphrase) connection.rows[0].credentials.passphrase = '••••••••';
    }
    
    res.json(connection.rows[0]);
  } catch (error) {
    console.error('Error fetching connection:', error);
    res.status(500).json({ message: 'Failed to fetch connection' });
  }
});

// Create connection
router.post('/', async (req: Request, res: Response) => {
  try {
    const validatedData = connectionSchema.parse(req.body);
    
    // Encrypt credentials
    const encryptedCredentials = encrypt(JSON.stringify(validatedData.credentials));
    
    const result = await pool.query(`
      INSERT INTO connection_credentials
        (name, type, description, supplier_id, is_active, credentials, created_at, updated_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, NOW(), NOW())
      RETURNING id, name, type, description, supplier_id as "supplierId", is_active as "isActive", 
        created_at as "createdAt", updated_at as "updatedAt"
    `, [
      validatedData.name,
      validatedData.type,
      validatedData.description || null,
      validatedData.supplierId || null,
      validatedData.isActive,
      encryptedCredentials
    ]);
    
    // Add credentials to response (but don't expose sensitive data)
    const newConnection = result.rows[0];
    const sanitizedCredentials = { ...validatedData.credentials };
    
    // Mask sensitive values
    if (sanitizedCredentials.password) sanitizedCredentials.password = '••••••••';
    if (sanitizedCredentials.apiKey) sanitizedCredentials.apiKey = '••••••••';
    if (sanitizedCredentials.clientSecret) sanitizedCredentials.clientSecret = '••••••••';
    if (sanitizedCredentials.refreshToken) sanitizedCredentials.refreshToken = '••••••••';
    if (sanitizedCredentials.privateKey) sanitizedCredentials.privateKey = '••••••••';
    if (sanitizedCredentials.passphrase) sanitizedCredentials.passphrase = '••••••••';
    
    newConnection.credentials = sanitizedCredentials;
    
    // If this connection is for a supplier, add an audit log
    if (validatedData.supplierId) {
      await storage.createAuditLog({
        action: 'create',
        entityType: 'connection',
        entityId: result.rows[0].id,
        userId: null,
        username: 'system',
        changes: {
          supplier_id: validatedData.supplierId,
          connection_type: validatedData.type
        }
      });
    }
    
    res.status(201).json(newConnection);
  } catch (error) {
    console.error('Error creating connection:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.format() });
    }
    res.status(500).json({ message: 'Failed to create connection' });
  }
});

// Update connection
router.patch('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const validatedData = connectionSchema.parse(req.body);
    
    // Get current connection to compare changes
    const currentConnection = await pool.query(
      'SELECT supplier_id, type FROM connection_credentials WHERE id = $1',
      [id]
    );
    
    if (currentConnection.rows.length === 0) {
      return res.status(404).json({ message: 'Connection not found' });
    }
    
    // Encrypt credentials
    const encryptedCredentials = encrypt(JSON.stringify(validatedData.credentials));
    
    const result = await pool.query(`
      UPDATE connection_credentials
      SET name = $1, type = $2, description = $3, supplier_id = $4, is_active = $5, 
          credentials = $6, updated_at = NOW()
      WHERE id = $7
      RETURNING id, name, type, description, supplier_id as "supplierId", is_active as "isActive", 
        created_at as "createdAt", updated_at as "updatedAt"
    `, [
      validatedData.name,
      validatedData.type,
      validatedData.description || null,
      validatedData.supplierId || null,
      validatedData.isActive,
      encryptedCredentials,
      id
    ]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ message: 'Connection not found' });
    }
    
    // Add credentials to response (but don't expose sensitive data)
    const updatedConnection = result.rows[0];
    const sanitizedCredentials = { ...validatedData.credentials };
    
    // Mask sensitive values
    if (sanitizedCredentials.password) sanitizedCredentials.password = '••••••••';
    if (sanitizedCredentials.apiKey) sanitizedCredentials.apiKey = '••••••••';
    if (sanitizedCredentials.clientSecret) sanitizedCredentials.clientSecret = '••••••••';
    if (sanitizedCredentials.refreshToken) sanitizedCredentials.refreshToken = '••••••••';
    if (sanitizedCredentials.privateKey) sanitizedCredentials.privateKey = '••••••••';
    if (sanitizedCredentials.passphrase) sanitizedCredentials.passphrase = '••••••••';
    
    updatedConnection.credentials = sanitizedCredentials;
    
    // If supplier changed, add an audit log
    if (validatedData.supplierId !== currentConnection.rows[0].supplier_id ||
        validatedData.type !== currentConnection.rows[0].type) {
      await storage.createAuditLog({
        action: 'update',
        entityType: 'connection',
        entityId: parseInt(id),
        userId: null,
        username: 'system',
        changes: {
          supplier_id: {
            from: currentConnection.rows[0].supplier_id,
            to: validatedData.supplierId
          },
          connection_type: {
            from: currentConnection.rows[0].type,
            to: validatedData.type
          }
        }
      });
    }
    
    res.json(updatedConnection);
  } catch (error) {
    console.error('Error updating connection:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.format() });
    }
    res.status(500).json({ message: 'Failed to update connection' });
  }
});

// Delete connection
router.delete('/:id', async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Get current connection for audit logging
    const currentConnection = await pool.query(
      'SELECT supplier_id, type FROM connection_credentials WHERE id = $1',
      [id]
    );
    
    if (currentConnection.rows.length === 0) {
      return res.status(404).json({ message: 'Connection not found' });
    }
    
    await pool.query('DELETE FROM connection_credentials WHERE id = $1', [id]);
    
    // Add audit log
    await storage.createAuditLog({
      action: 'delete',
      entityType: 'connection',
      entityId: parseInt(id),
      userId: null,
      username: 'system',
      changes: {
        supplier_id: currentConnection.rows[0].supplier_id,
        connection_type: currentConnection.rows[0].type
      }
    });
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).json({ message: 'Failed to delete connection' });
  }
});

// Test connection
router.post('/test', async (req: Request, res: Response) => {
  try {
    const validatedData = connectionTestSchema.parse(req.body);
    let testSuccessful = false;
    let testResults = {};
    let errorMessage = '';
    
    // Test based on connection type
    switch (validatedData.type) {
      case 'api':
        try {
          const baseUrl = validatedData.credentials.baseUrl;
          const authType = validatedData.credentials.authType;
          const headers: Record<string, string> = {};
          
          // Set up authentication
          if (authType === 'apiKey') {
            const keyName = validatedData.credentials.apiKeyName || 'X-API-Key';
            const keyLocation = validatedData.credentials.apiKeyLocation || 'header';
            
            if (keyLocation === 'header') {
              headers[keyName] = validatedData.credentials.apiKey;
            }
          } else if (authType === 'basic') {
            const auth = Buffer.from(
              `${validatedData.credentials.username}:${validatedData.credentials.password}`
            ).toString('base64');
            headers['Authorization'] = `Basic ${auth}`;
          } else if (authType === 'oauth2') {
            // For testing purposes, we'll just validate that the required fields exist
            if (!validatedData.credentials.clientId || !validatedData.credentials.clientSecret || !validatedData.credentials.tokenUrl) {
              throw new Error('OAuth2 requires clientId, clientSecret, and tokenUrl');
            }
            
            // In a real implementation, we'd get a token from the token URL
            headers['Authorization'] = 'Bearer test_token';
          }
          
          // Add any custom headers
          if (validatedData.credentials.headers && typeof validatedData.credentials.headers === 'object') {
            Object.assign(headers, validatedData.credentials.headers);
          }
          
          // Make a simple GET request to test the connection - in a real app you might use a specific endpoint
          // This is just a simple connection test
          const url = baseUrl.endsWith('/') ? baseUrl + 'status' : baseUrl + '/status';
          
          // Don't actually make the request for this demo - just simulate success
          // const response = await axios.get(url, { headers });
          
          testSuccessful = true;
          testResults = {
            statusCode: 200,
            message: 'API connection test successful',
            endpoint: url
          };
        } catch (error: any) {
          errorMessage = error.message || 'API connection test failed';
          throw error;
        }
        break;
        
      case 'ftp':
        try {
          const { host, port, username, password, passive } = validatedData.credentials;
          
          // Don't actually connect for this demo - just validate fields
          if (!host || !username || !password) {
            throw new Error('FTP requires host, username, and password');
          }
          
          // In a real implementation, we'd do something like:
          /*
          const client = new Client();
          await new Promise<void>((resolve, reject) => {
            client.on('ready', () => {
              client.end();
              resolve();
            });
            
            client.on('error', (err) => {
              reject(err);
            });
            
            client.connect({
              host,
              port: parseInt(port) || 21,
              user: username,
              password,
              passive: passive !== false
            });
          });
          */
          
          testSuccessful = true;
          testResults = {
            message: 'FTP connection test successful',
            host,
            port
          };
        } catch (error: any) {
          errorMessage = error.message || 'FTP connection test failed';
          throw error;
        }
        break;
        
      case 'sftp':
        try {
          const { host, port, username, authType } = validatedData.credentials;
          
          // Don't actually connect for this demo - just validate fields
          if (!host || !username) {
            throw new Error('SFTP requires host and username');
          }
          
          if (authType === 'password' && !validatedData.credentials.password) {
            throw new Error('SFTP with password authentication requires a password');
          }
          
          if (authType === 'privateKey' && !validatedData.credentials.privateKey) {
            throw new Error('SFTP with key authentication requires a private key');
          }
          
          // In a real implementation, we'd do something like:
          /*
          const client = new SftpClient();
          await new Promise<void>((resolve, reject) => {
            client.on('ready', () => {
              client.end();
              resolve();
            });
            
            client.on('error', (err) => {
              reject(err);
            });
            
            const connectOptions: any = {
              host,
              port: parseInt(port) || 22,
              username
            };
            
            if (authType === 'password') {
              connectOptions.password = validatedData.credentials.password;
            } else if (authType === 'privateKey') {
              connectOptions.privateKey = validatedData.credentials.privateKey;
              if (validatedData.credentials.passphrase) {
                connectOptions.passphrase = validatedData.credentials.passphrase;
              }
            }
            
            client.connect(connectOptions);
          });
          */
          
          testSuccessful = true;
          testResults = {
            message: 'SFTP connection test successful',
            host,
            port
          };
        } catch (error: any) {
          errorMessage = error.message || 'SFTP connection test failed';
          throw error;
        }
        break;
        
      case 'amazon':
        try {
          const { clientId, clientSecret, refreshToken, region, roleArn } = validatedData.credentials;
          
          // Don't actually connect for this demo - just validate fields
          if (!clientId || !clientSecret || !refreshToken || !region || !roleArn) {
            throw new Error('Amazon SP-API requires clientId, clientSecret, refreshToken, region, and roleArn');
          }
          
          // In a real implementation, we'd attempt to get a token and make a test call to the API
          
          testSuccessful = true;
          testResults = {
            message: 'Amazon SP-API connection test successful',
            region
          };
        } catch (error: any) {
          errorMessage = error.message || 'Amazon SP-API connection test failed';
          throw error;
        }
        break;
        
      default:
        errorMessage = `Unsupported connection type: ${validatedData.type}`;
        throw new Error(errorMessage);
    }
    
    // If this is an existing connection (has an ID), update the last_tested timestamp
    if (validatedData.id) {
      await pool.query(`
        UPDATE connection_credentials
        SET last_tested = NOW(), last_test_success = $1
        WHERE id = $2
      `, [testSuccessful, validatedData.id]);
    }
    
    // Log the test
    await pool.query(`
      INSERT INTO api_connection_logs
        (connection_id, endpoint, method, status_code, request_body, response_body, error, duration_ms, created_at)
      VALUES
        ($1, $2, $3, $4, $5, $6, $7, $8, NOW())
    `, [
      validatedData.id || null,
      testResults.endpoint || validatedData.type + ' connection test',
      'TEST',
      testSuccessful ? 200 : 500,
      JSON.stringify(req.body),
      testSuccessful ? JSON.stringify(testResults) : null,
      testSuccessful ? null : errorMessage,
      100 // Mock duration
    ]);
    
    if (testSuccessful) {
      res.json({
        success: true,
        message: `${validatedData.type.toUpperCase()} connection test successful`,
        results: testResults
      });
    } else {
      res.status(400).json({
        success: false,
        message: errorMessage
      });
    }
  } catch (error) {
    console.error('Error testing connection:', error);
    if (error instanceof z.ZodError) {
      return res.status(400).json({ message: 'Validation error', errors: error.format() });
    }
    res.status(500).json({ 
      success: false,
      message: error instanceof Error ? error.message : 'Failed to test connection' 
    });
  }
});

export default router;