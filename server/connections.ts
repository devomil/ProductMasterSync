import { Request, Response } from 'express';
import { db } from './db';
import { connections, suppliers, connectionStatusEnum } from '@shared/schema';
import { eq } from 'drizzle-orm';
import * as ftp from 'ftp';
import { Client as SFTPClient } from 'ssh2';
import axios from 'axios';
import { Pool } from 'pg';
import { promisify } from 'util';

// Helper to validate connection parameters based on type
const validateConnectionParams = (type: string, credentials: any): { valid: boolean, message: string } => {
  try {
    switch (type) {
      case 'ftp':
        if (!credentials.host) return { valid: false, message: 'Host is required for FTP connection' };
        if (!credentials.username) return { valid: false, message: 'Username is required for FTP connection' };
        if (!credentials.password) return { valid: false, message: 'Password is required for FTP connection' };
        break;
      
      case 'sftp':
        if (!credentials.host) return { valid: false, message: 'Host is required for SFTP connection' };
        if (!credentials.username) return { valid: false, message: 'Username is required for SFTP connection' };
        if ((!credentials.password && !credentials.privateKey)) {
          return { valid: false, message: 'Either password or private key is required for SFTP connection' };
        }
        break;
      
      case 'api':
        if (!credentials.url) return { valid: false, message: 'URL is required for API connection' };
        if (credentials.authType === 'basic' && (!credentials.username || !credentials.password)) {
          return { valid: false, message: 'Username and password are required for Basic Auth' };
        }
        if (credentials.authType === 'bearer' && !credentials.accessToken) {
          return { valid: false, message: 'Access token is required for Bearer Auth' };
        }
        if (credentials.authType === 'apiKey' && (!credentials.apiKeyName || !credentials.apiKey)) {
          return { valid: false, message: 'API key name and value are required for API Key Auth' };
        }
        break;
      
      case 'database':
        if (!credentials.host) return { valid: false, message: 'Host is required for database connection' };
        if (!credentials.username) return { valid: false, message: 'Username is required for database connection' };
        if (!credentials.password) return { valid: false, message: 'Password is required for database connection' };
        if (!credentials.database) return { valid: false, message: 'Database name is required for database connection' };
        break;
      
      default:
        return { valid: false, message: 'Invalid connection type' };
    }
    
    return { valid: true, message: 'Connection parameters are valid' };
  } catch (error) {
    return { valid: false, message: 'Error validating connection parameters' };
  }
};

// Helper function to test FTP connection
const testFTPConnection = (credentials: any): Promise<{ success: boolean, message: string, details?: any }> => {
  return new Promise((resolve) => {
    const client = new ftp();
    
    // Set a timeout to avoid hanging connections
    const timeout = setTimeout(() => {
      client.destroy();
      resolve({ success: false, message: 'Connection timed out' });
    }, 10000);
    
    client.on('ready', () => {
      clearTimeout(timeout);
      
      // Test listing a directory
      client.list(credentials.remoteDir || '/', (err, list) => {
        if (err) {
          client.end();
          resolve({ 
            success: false, 
            message: 'Connected but failed to list directory', 
            details: { error: err.message } 
          });
        } else {
          client.end();
          resolve({ 
            success: true, 
            message: 'Successfully connected to FTP server and listed directory', 
            details: { 
              directoryContents: list.slice(0, 5).map(item => ({
                name: item.name,
                type: item.type,
                size: item.size,
                date: item.date
              })),
              totalFiles: list.length,
              remotePath: credentials.remoteDir || '/'
            } 
          });
        }
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, message: 'FTP connection error', details: { error: err.message } });
    });
    
    // Connect to the FTP server
    client.connect({
      host: credentials.host,
      port: parseInt(credentials.port) || 21,
      user: credentials.username,
      password: credentials.password,
      secure: credentials.secure || false
    });
  });
};

// Helper function to test SFTP connection
const testSFTPConnection = (credentials: any): Promise<{ success: boolean, message: string, details?: any }> => {
  return new Promise((resolve) => {
    const client = new SFTPClient();
    
    // Set a timeout to avoid hanging connections
    const timeout = setTimeout(() => {
      client.end();
      resolve({ success: false, message: 'Connection timed out' });
    }, 10000);
    
    client.on('ready', () => {
      clearTimeout(timeout);
      
      // Test SFTP operations
      client.sftp((err, sftp) => {
        if (err) {
          client.end();
          resolve({ 
            success: false, 
            message: 'Connected but failed to start SFTP session', 
            details: { error: err.message } 
          });
        } else {
          // Read directory
          sftp.readdir(credentials.remoteDir || '.', (err, list) => {
            client.end();
            
            if (err) {
              resolve({ 
                success: false, 
                message: 'Connected but failed to list directory', 
                details: { error: err.message } 
              });
            } else {
              resolve({ 
                success: true, 
                message: 'Successfully connected to SFTP server and listed directory', 
                details: { 
                  directoryContents: list.slice(0, 5).map(item => ({
                    name: item.filename,
                    longname: item.longname
                  })),
                  totalFiles: list.length,
                  remotePath: credentials.remoteDir || '.'
                } 
              });
            }
          });
        }
      });
    });
    
    client.on('error', (err) => {
      clearTimeout(timeout);
      resolve({ success: false, message: 'SFTP connection error', details: { error: err.message } });
    });
    
    // Connection options
    const connectConfig: any = {
      host: credentials.host,
      port: parseInt(credentials.port) || 22,
      username: credentials.username
    };
    
    // Authentication options
    if (credentials.privateKey) {
      connectConfig.privateKey = credentials.privateKey;
      if (credentials.passphrase) {
        connectConfig.passphrase = credentials.passphrase;
      }
    } else {
      connectConfig.password = credentials.password;
    }
    
    // Connect to the SFTP server
    client.connect(connectConfig);
  });
};

// Helper function to test API connection
const testAPIConnection = async (credentials: any): Promise<{ success: boolean, message: string, details?: any }> => {
  try {
    const config: any = {
      url: credentials.url,
      method: credentials.method || 'GET',
      timeout: 10000
    };
    
    // Add authentication if specified
    if (credentials.authType === 'basic') {
      config.auth = {
        username: credentials.username,
        password: credentials.password
      };
    } else if (credentials.authType === 'bearer') {
      config.headers = {
        ...config.headers,
        'Authorization': `Bearer ${credentials.accessToken}`
      };
    } else if (credentials.authType === 'apiKey') {
      if (credentials.apiKeyLocation === 'header') {
        config.headers = {
          ...config.headers,
          [credentials.apiKeyName]: credentials.apiKey
        };
      } else if (credentials.apiKeyLocation === 'query') {
        const url = new URL(credentials.url);
        url.searchParams.append(credentials.apiKeyName, credentials.apiKey);
        config.url = url.toString();
      }
    }
    
    // Add content-type if provided
    if (credentials.contentType) {
      config.headers = {
        ...config.headers,
        'Content-Type': credentials.contentType
      };
    }
    
    // Add custom headers if provided
    if (credentials.headers) {
      config.headers = {
        ...config.headers,
        ...credentials.headers
      };
    }
    
    // Add request body for POST or PUT requests
    if (['POST', 'PUT'].includes(credentials.method) && credentials.body) {
      try {
        if (credentials.contentType?.includes('json')) {
          config.data = JSON.parse(credentials.body);
        } else {
          config.data = credentials.body;
        }
      } catch (error) {
        // If parsing fails, send as raw text
        config.data = credentials.body;
      }
    }
    
    const response = await axios(config);
    
    return {
      success: true,
      message: `API connection successful: ${response.status} ${response.statusText}`,
      details: {
        status: response.status,
        statusText: response.statusText,
        headers: response.headers,
        data: response.data
      }
    };
  } catch (error) {
    let errorMessage = 'API connection error';
    let details: any = {};
    
    if (axios.isAxiosError(error)) {
      errorMessage = `API connection failed: ${error.message}`;
      details = {
        error: error.message,
        code: error.code,
        status: error.response?.status,
        statusText: error.response?.statusText,
        data: error.response?.data
      };
    } else if (error instanceof Error) {
      errorMessage = `API connection error: ${error.message}`;
      details = { error: error.message };
    }
    
    return { success: false, message: errorMessage, details };
  }
};

// Helper function to test database connection
const testDatabaseConnection = async (credentials: any): Promise<{ success: boolean, message: string, details?: any }> => {
  let client: Pool | null = null;
  
  try {
    // Connection string based on database type
    let connectionString: string;
    
    switch (credentials.databaseType) {
      case 'postgresql':
        connectionString = `postgres://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port || 5432}/${credentials.database}`;
        if (credentials.ssl) {
          connectionString += '?sslmode=require';
        }
        break;
        
      case 'mysql':
        // For MySQL we would use a different driver, but we'll simulate it here
        connectionString = `postgres://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port || 3306}/${credentials.database}`;
        break;
        
      case 'mssql':
        // For SQL Server we would use a different driver, but we'll simulate it here
        connectionString = `postgres://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port || 1433}/${credentials.database}`;
        break;
        
      case 'oracle':
        // For Oracle we would use a different driver, but we'll simulate it here
        connectionString = `postgres://${credentials.username}:${credentials.password}@${credentials.host}:${credentials.port || 1521}/${credentials.database}`;
        break;
        
      default:
        return { 
          success: false, 
          message: 'Unsupported database type', 
          details: { error: 'Only PostgreSQL connection testing is currently supported' } 
        };
    }
    
    if (credentials.databaseType !== 'postgresql') {
      return { 
        success: false, 
        message: 'Simulated connection for non-PostgreSQL databases', 
        details: { 
          warning: 'Only PostgreSQL connection testing is currently implemented. This is a simulated successful connection.' 
        } 
      };
    }
    
    // Create a new client
    client = new Pool({ connectionString });
    
    // Test connection with query
    const result = await client.query('SELECT current_database() as db, current_user as user, version() as version');
    
    return {
      success: true,
      message: 'Database connection successful',
      details: {
        database: result.rows[0].db,
        user: result.rows[0].user,
        version: result.rows[0].version,
        tables: [] // We would get table info here in a real implementation
      }
    };
  } catch (error) {
    let errorMessage = 'Database connection error';
    let details: any = { error: 'Unknown error' };
    
    if (error instanceof Error) {
      errorMessage = `Database connection error: ${error.message}`;
      details = { error: error.message };
    }
    
    return { success: false, message: errorMessage, details };
  } finally {
    // Close the connection
    if (client) {
      await client.end();
    }
  }
};

// API Endpoints
export const getConnections = async (req: Request, res: Response) => {
  try {
    const result = await db.select().from(connections);
    res.json(result);
  } catch (error) {
    console.error('Error fetching connections:', error);
    res.status(500).json({ error: 'Failed to fetch connections' });
  }
};

export const getConnection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const result = await db.select().from(connections).where(eq(connections.id, parseInt(id))).limit(1);
    
    if (result.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    res.json(result[0]);
  } catch (error) {
    console.error('Error fetching connection:', error);
    res.status(500).json({ error: 'Failed to fetch connection' });
  }
};

export const createConnection = async (req: Request, res: Response) => {
  try {
    const { name, type, description, supplierId, isActive, credentials } = req.body;
    
    // Validate connection parameters
    const validation = validateConnectionParams(type, credentials);
    if (!validation.valid) {
      return res.status(400).json({ error: validation.message });
    }
    
    // If supplier ID is provided, check if it exists
    if (supplierId) {
      const supplierExists = await db.select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);
      
      if (supplierExists.length === 0) {
        return res.status(400).json({ error: `Supplier with ID ${supplierId} not found` });
      }
    }
    
    // Create the connection
    const [connection] = await db.insert(connections)
      .values({
        name,
        type,
        description,
        supplierId,
        isActive,
        credentials,
        createdAt: new Date(),
        updatedAt: new Date()
      })
      .returning();
    
    res.status(201).json(connection);
  } catch (error) {
    console.error('Error creating connection:', error);
    res.status(500).json({ error: 'Failed to create connection' });
  }
};

export const updateConnection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    const { name, type, description, supplierId, isActive, credentials } = req.body;
    
    // Check if connection exists
    const existingConnection = await db.select().from(connections).where(eq(connections.id, parseInt(id))).limit(1);
    if (existingConnection.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    // Validate connection parameters if type or credentials are being updated
    if (type || credentials) {
      const validation = validateConnectionParams(
        type || existingConnection[0].type,
        credentials || existingConnection[0].credentials
      );
      if (!validation.valid) {
        return res.status(400).json({ error: validation.message });
      }
    }
    
    // If supplier ID is provided, check if it exists
    if (supplierId) {
      const supplierExists = await db.select({ id: suppliers.id })
        .from(suppliers)
        .where(eq(suppliers.id, supplierId))
        .limit(1);
      
      if (supplierExists.length === 0) {
        return res.status(400).json({ error: `Supplier with ID ${supplierId} not found` });
      }
    }
    
    // Update the connection
    const [updatedConnection] = await db.update(connections)
      .set({
        name: name !== undefined ? name : existingConnection[0].name,
        type: type !== undefined ? type : existingConnection[0].type,
        description: description !== undefined ? description : existingConnection[0].description,
        supplierId: supplierId !== undefined ? supplierId : existingConnection[0].supplierId,
        isActive: isActive !== undefined ? isActive : existingConnection[0].isActive,
        credentials: credentials !== undefined ? credentials : existingConnection[0].credentials,
        updatedAt: new Date()
      })
      .where(eq(connections.id, parseInt(id)))
      .returning();
    
    res.json(updatedConnection);
  } catch (error) {
    console.error('Error updating connection:', error);
    res.status(500).json({ error: 'Failed to update connection' });
  }
};

export const deleteConnection = async (req: Request, res: Response) => {
  try {
    const { id } = req.params;
    
    // Check if connection exists
    const existingConnection = await db.select().from(connections).where(eq(connections.id, parseInt(id))).limit(1);
    if (existingConnection.length === 0) {
      return res.status(404).json({ error: 'Connection not found' });
    }
    
    // Delete the connection
    await db.delete(connections).where(eq(connections.id, parseInt(id)));
    
    res.status(204).send();
  } catch (error) {
    console.error('Error deleting connection:', error);
    res.status(500).json({ error: 'Failed to delete connection' });
  }
};

export const testConnection = async (req: Request, res: Response) => {
  try {
    const { type, credentials } = req.body;
    
    // Validate connection parameters
    const validation = validateConnectionParams(type, credentials);
    if (!validation.valid) {
      return res.status(400).json({ 
        success: false, 
        message: validation.message 
      });
    }
    
    let testResult;
    
    // Test the connection based on type
    switch (type) {
      case 'ftp':
        testResult = await testFTPConnection(credentials);
        break;
      
      case 'sftp':
        testResult = await testSFTPConnection(credentials);
        break;
      
      case 'api':
        testResult = await testAPIConnection(credentials);
        break;
      
      case 'database':
        testResult = await testDatabaseConnection(credentials);
        break;
      
      default:
        return res.status(400).json({ 
          success: false, 
          message: 'Unsupported connection type' 
        });
    }
    
    // Update connection status in the database if connection ID is provided
    if (req.query.id) {
      const connectionId = parseInt(req.query.id as string);
      
      await db.update(connections)
        .set({
          lastTested: new Date(),
          lastStatus: testResult.success ? 'success' : 'error',
          updatedAt: new Date()
        })
        .where(eq(connections.id, connectionId));
    }
    
    res.json(testResult);
  } catch (error) {
    console.error('Error testing connection:', error);
    res.status(500).json({ 
      success: false, 
      message: 'Error testing connection', 
      details: { error: error instanceof Error ? error.message : 'Unknown error' } 
    });
  }
};

export const registerConnectionsRoutes = (app: any) => {
  app.get('/api/connections', getConnections);
  app.get('/api/connections/:id', getConnection);
  app.post('/api/connections', createConnection);
  app.patch('/api/connections/:id', updateConnection);
  app.delete('/api/connections/:id', deleteConnection);
  app.post('/api/connections/test', testConnection);
};